from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.db.models import Q
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, Role


class UserSerializer(serializers.ModelSerializer):
    branch_id = serializers.IntegerField(source='branch.id', read_only=True, default=None)
    tenant_id = serializers.IntegerField(source='tenant.id', read_only=True, default=None)

    class Meta:
        model = User
        fields = (
            'id', 'email', 'username', 'full_name', 'role',
            'tenant_id', 'branch_id',
            'is_email_verified', 'is_active', 'date_joined',
        )


class LoginSerializer(serializers.Serializer):
    """Acepta username o email + password."""
    identifier = serializers.CharField(write_only=True, help_text='Usuario o email')
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        identifier = attrs['identifier'].strip()
        # Buscar por email o username (case-insensitive)
        user_obj = User.objects.filter(
            Q(email__iexact=identifier) | Q(username__iexact=identifier)
        ).first()
        if not user_obj:
            raise serializers.ValidationError({'detail': 'Credenciales invalidas.'})

        # USERNAME_FIELD del modelo es 'email', por eso ModelBackend identifica
        # por email. Pasamos el email del usuario hallado (no el username), o las
        # cuentas registradas con username != email nunca podrian iniciar sesion.
        user = authenticate(
            request=self.context.get('request'),
            username=user_obj.email,
            password=attrs['password'],
        )
        if not user:
            raise serializers.ValidationError({'detail': 'Credenciales invalidas.'})
        if not user.is_active:
            raise serializers.ValidationError({'detail': 'Cuenta desactivada o sin verificar.'})

        refresh = RefreshToken.for_user(user)
        return {
            'access':  str(refresh.access_token),
            'refresh': str(refresh),
            'user':    UserSerializer(user).data,
        }


class RegisterSerializer(serializers.Serializer):
    """Registro público: username + email + nombre + contraseña."""
    full_name = serializers.CharField(max_length=160, min_length=2)
    username = serializers.CharField(max_length=40, min_length=3)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)

    def validate_email(self, v):
        if User.objects.filter(email__iexact=v).exists():
            raise serializers.ValidationError('Ese correo ya esta registrado.')
        return v.lower()

    def validate_username(self, v):
        v = v.strip().lower()
        if not v.replace('_', '').replace('.', '').isalnum():
            raise serializers.ValidationError(
                'Solo letras, numeros, punto y guion bajo.'
            )
        if User.objects.filter(username__iexact=v).exists():
            raise serializers.ValidationError('Ese nombre de usuario ya esta tomado.')
        return v

    def validate_password(self, v):
        validate_password(v)
        return v

    def create(self, validated_data):
        user = User(
            email=validated_data['email'],
            username=validated_data['username'],
            full_name=validated_data['full_name'],
            role=Role.CUSTOMER,
            is_active=False,
            is_email_verified=False,
        )
        user.set_password(validated_data['password'])
        user.save()
        return user


class ActivationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6, min_length=6)


class ResendCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6, min_length=6)
    new_password = serializers.CharField(min_length=8)

    def validate_new_password(self, v):
        validate_password(v)
        return v


class AdminUserSerializer(serializers.ModelSerializer):
    branch_id = serializers.IntegerField(source='branch.id', read_only=True, default=None)
    tenant_id = serializers.IntegerField(source='tenant.id', read_only=True, default=None)
    tenant_name = serializers.CharField(source='tenant.name', read_only=True, default=None)
    branch_name = serializers.CharField(source='branch.name', read_only=True, default=None)

    class Meta:
        model = User
        fields = (
            'id', 'email', 'username', 'full_name', 'role',
            'phone', 'document_id',
            'tenant_id', 'tenant_name', 'branch_id', 'branch_name',
            'is_email_verified', 'is_active', 'date_joined', 'last_login',
        )


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    """Edicion de datos basicos de una cuenta por el superadmin.

    Permite cambiar el email (validando que no exista en otra cuenta), el
    nombre, el telefono y el documento, y opcionalmente la contrasena.
    El ROL y la asignacion de tienda/sucursal NO se modifican aqui.
    """
    password = serializers.CharField(
        write_only=True, required=False, allow_blank=True, min_length=8,
    )

    class Meta:
        model = User
        fields = ('email', 'full_name', 'phone', 'document_id', 'password')

    def validate_email(self, v):
        v = (v or '').strip().lower()
        if not v:
            raise serializers.ValidationError('El correo es obligatorio.')
        qs = User.objects.filter(email__iexact=v)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Ese correo ya esta en uso por otra cuenta.')
        return v

    def validate_password(self, v):
        if v:
            validate_password(v)
        return v

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance
