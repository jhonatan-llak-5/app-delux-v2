from django.contrib.auth import get_user_model
from django.db.models import QuerySet
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import IsSuperadmin, IsBranchManager
from .serializers import (
    ActivationSerializer,
    AdminUserSerializer,
    AdminUserUpdateSerializer,
    ForgotPasswordSerializer,
    LoginSerializer,
    RegisterSerializer,
    ResendCodeSerializer,
    ResetPasswordSerializer,
    UserSerializer,
)
from .services import activate_user, assign_activation_code, is_activation_valid
from .tasks import dispatch, send_activation_email, send_password_reset_email

User = get_user_model()


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from django.db.models import Q
        from django.utils import timezone

        identifier = (request.data.get('identifier') or '').strip()
        password = request.data.get('password') or ''
        user_obj = User.objects.filter(
            Q(email__iexact=identifier) | Q(username__iexact=identifier)
        ).first()

        # Credenciales correctas pero cuenta SIN verificar el correo: no la
        # bloqueamos como "credenciales invalidas" (Django rechaza is_active=False).
        # La enviamos a ingresar el codigo y reenviamos uno si no hay vigente.
        if (user_obj and not user_obj.is_email_verified
                and user_obj.check_password(password)):
            has_valid_code = bool(
                user_obj.activation_code and user_obj.activation_expires_at
                and timezone.now() <= user_obj.activation_expires_at
            )
            if not has_valid_code:
                code = assign_activation_code(user_obj)
                dispatch(send_activation_email, user_obj.email,
                         user_obj.full_name, code)
            return Response(
                {'detail': 'Tu cuenta aun no esta verificada. Ingresa el codigo '
                           'que te enviamos al correo.',
                 'code': 'email_not_verified',
                 'email': user_obj.email},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from .recaptcha import verify_recaptcha
        token = request.data.get('recaptcha_token', '')
        ip = request.META.get('REMOTE_ADDR', '')
        if not verify_recaptcha(token, ip):
            return Response(
                {'detail': 'Verificación reCAPTCHA fallida. Inténtalo de nuevo.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        code = assign_activation_code(user)
        dispatch(send_activation_email, user.email, user.full_name, code)
        return Response(
            {'detail': 'Te enviamos un codigo de activacion al correo.',
             'email': user.email},
            status=status.HTTP_201_CREATED,
        )


class ActivateView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ActivationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = User.objects.get(email__iexact=serializer.validated_data['email'])
        except User.DoesNotExist:
            return Response({'detail': 'Cuenta no encontrada.'},
                            status=status.HTTP_404_NOT_FOUND)
        if not is_activation_valid(user, serializer.validated_data['code']):
            return Response({'detail': 'Codigo invalido o expirado.'},
                            status=status.HTTP_400_BAD_REQUEST)
        activate_user(user)
        return Response({'detail': 'Cuenta activada correctamente.'},
                        status=status.HTTP_200_OK)


class ResendCodeView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ResendCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = User.objects.get(email__iexact=serializer.validated_data['email'])
        except User.DoesNotExist:
            return Response(status=status.HTTP_204_NO_CONTENT)
        if user.is_email_verified:
            return Response({'detail': 'La cuenta ya esta activada.'},
                            status=status.HTTP_400_BAD_REQUEST)
        # Cooldown de 60s entre envios (deriva el ultimo envio de la expiracion).
        from datetime import timedelta
        from django.utils import timezone
        if user.activation_expires_at:
            last_sent = user.activation_expires_at - timedelta(minutes=15)
            elapsed = (timezone.now() - last_sent).total_seconds()
            if elapsed < 60:
                wait = int(60 - elapsed)
                return Response(
                    {'detail': f'Espera {wait}s para reenviar el codigo.', 'retry_after': wait},
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )
        code = assign_activation_code(user)
        dispatch(send_activation_email, user.email, user.full_name, code)
        return Response({'detail': 'Reenviamos el codigo.'},
                        status=status.HTTP_200_OK)


class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = User.objects.get(email__iexact=serializer.validated_data['email'])
        except User.DoesNotExist:
            return Response({'detail': 'Si la cuenta existe, recibiras un correo.'},
                            status=status.HTTP_200_OK)
        code = assign_activation_code(user)
        dispatch(send_password_reset_email, user.email, user.full_name, code)
        return Response({'detail': 'Si la cuenta existe, recibiras un correo.'},
                        status=status.HTTP_200_OK)


class ResetPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            user = User.objects.get(email__iexact=data['email'])
        except User.DoesNotExist:
            return Response({'detail': 'Cuenta no encontrada.'},
                            status=status.HTTP_404_NOT_FOUND)
        if not is_activation_valid(user, data['code']):
            return Response({'detail': 'Codigo invalido o expirado.'},
                            status=status.HTTP_400_BAD_REQUEST)
        user.set_password(data['new_password'])
        user.activation_code = ''
        user.activation_expires_at = None
        user.save(update_fields=['password', 'activation_code', 'activation_expires_at'])
        return Response({'detail': 'Contrasena actualizada.'}, status=status.HTTP_200_OK)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        u = request.user
        full_name = request.data.get('full_name')
        phone = request.data.get('phone')
        fields = []
        if full_name is not None:
            u.full_name = full_name.strip(); fields.append('full_name')
        if phone is not None and hasattr(u, 'phone'):
            u.phone = phone.strip(); fields.append('phone')
        if fields:
            u.save(update_fields=fields)
        return Response(UserSerializer(u).data)


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError
        u = request.user
        cur = request.data.get('current_password') or ''
        new = request.data.get('new_password') or ''
        if not u.check_password(cur):
            return Response({'detail': 'La contraseña actual es incorrecta.'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_password(new, u)
        except DjangoValidationError as e:
            return Response({'detail': ' '.join(e.messages)},
                            status=status.HTTP_400_BAD_REQUEST)
        u.set_password(new)
        u.save(update_fields=['password'])
        return Response({'detail': 'Contraseña actualizada.'})


class AdminUserViewSet(viewsets.ModelViewSet):
    serializer_class = AdminUserSerializer
    permission_classes = [permissions.IsAuthenticated, IsBranchManager]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['email', 'full_name']
    ordering_fields = ['date_joined', 'email']

    def get_queryset(self) -> QuerySet:
        qs = (
            User.objects
            .select_related('tenant', 'branch')
            .order_by('-date_joined')
        )
        role = self.request.query_params.get('role')
        if role:
            qs = qs.filter(role=role)
        # Clasificacion por tipo: clientes (rol CUSTOMER) vs sistema (resto).
        kind = self.request.query_params.get('kind')
        if kind == 'clients':
            qs = qs.filter(role='CUSTOMER')
        elif kind == 'system':
            qs = qs.exclude(role='CUSTOMER')

        # Alcance por rol: superadmin ve todo; admin su tienda; gerente su
        # sucursal (staff) + los clientes de su tienda.
        from django.db.models import Q
        u = self.request.user
        role_u = getattr(u, 'role', None)
        if role_u == 'TENANT_ADMIN' and u.tenant_id:
            qs = qs.filter(tenant_id=u.tenant_id)
        elif role_u == 'BRANCH_MANAGER':
            cond = Q(branch_id=u.branch_id)
            if u.tenant_id:
                cond = cond | Q(role='CUSTOMER', tenant_id=u.tenant_id)
            qs = qs.filter(cond)
        return qs

    def create(self, request, *args, **kwargs):
        # La creación de cuentas internas va por el formulario de staff.
        if getattr(request.user, 'role', None) != 'SUPERADMIN':
            return Response({'detail': 'No autorizado para crear cuentas aquí.'},
                            status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) != 'SUPERADMIN':
            return Response({'detail': 'No autorizado para eliminar cuentas.'},
                            status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    def get_serializer_class(self):
        if self.action in ('update', 'partial_update'):
            return AdminUserUpdateSerializer
        return AdminUserSerializer

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        # Devolver la fila completa (rol, tienda, estado) para refrescar la tabla.
        return Response(AdminUserSerializer(instance).data)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        user = self.get_object()
        user.is_active = True
        user.is_email_verified = True
        user.save(update_fields=['is_active', 'is_email_verified'])
        return Response({'detail': 'Usuario activado.'})

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        user = self.get_object()
        user.is_active = False
        user.save(update_fields=['is_active'])
        return Response({'detail': 'Usuario desactivado.'})

    @action(detail=True, methods=['post'])
    def impersonate(self, request, pk=None):
        """Superadmin: genera tokens para entrar como el usuario objetivo.

        Pensado para que el superadmin pruebe la experiencia de cada cuenta
        (admin de local, vendedor, etc.). Devuelve el mismo shape que el login.
        """
        from rest_framework_simplejwt.tokens import RefreshToken
        if getattr(request.user, 'role', None) != 'SUPERADMIN':
            return Response({'detail': 'Solo el superadmin puede impersonar.'},
                            status=status.HTTP_403_FORBIDDEN)
        target = self.get_object()
        if not target.is_active:
            return Response({'detail': 'La cuenta esta inactiva.'}, status=status.HTTP_400_BAD_REQUEST)
        if target.id == request.user.id:
            return Response({'detail': 'Ya eres este usuario.'}, status=status.HTTP_400_BAD_REQUEST)
        refresh = RefreshToken.for_user(target)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(target).data,
            'impersonated': True,
        }, status=status.HTTP_200_OK)
