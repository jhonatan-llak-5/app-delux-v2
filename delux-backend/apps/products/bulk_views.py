"""Views para bulk import de productos."""
from __future__ import annotations

import json

from django.http import HttpResponse
from rest_framework import permissions, status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsSuperadmin

from . import bulk_import as bi


class ProductBulkTemplateView(APIView):
    """GET /api/v1/admin/products/bulk-import/template/  → xlsx descargable."""
    permission_classes = [permissions.IsAuthenticated, IsSuperadmin]

    def get(self, request):
        tenant = getattr(request.user, 'tenant', None)
        data = bi.build_template_xlsx(tenant=tenant)
        resp = HttpResponse(
            data,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        resp['Content-Disposition'] = 'attachment; filename="delux-productos-plantilla.xlsx"'
        return resp


class ProductBulkDryRunView(APIView):
    """POST multipart/form-data con file=<xlsx>  → preview validado."""
    permission_classes = [permissions.IsAuthenticated, IsSuperadmin]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        f = request.FILES.get('file')
        if not f:
            return Response({'detail': 'Falta el archivo xlsx (field "file").'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            rows = bi.parse_xlsx(f)
        except Exception as exc:
            return Response({'detail': f'No se pudo leer el archivo: {exc}'},
                            status=status.HTTP_400_BAD_REQUEST)

        tenant = getattr(request.user, 'tenant', None)
        validated = bi.validate_rows(rows, tenant=tenant)

        # Resumen + payload listo para commit
        ok = sum(1 for r in validated if r['_status'] == 'ok')
        warn = sum(1 for r in validated if r['_status'] == 'warning')
        err = sum(1 for r in validated if r['_status'] == 'error')

        # Serializar Decimals para JSON
        def _ser(row):
            out = {}
            for k, v in row.items():
                if hasattr(v, 'quantize'):  # Decimal
                    out[k] = str(v)
                else:
                    out[k] = v
            return out

        return Response({
            'summary': {
                'total': len(validated),
                'ok': ok, 'warning': warn, 'error': err,
            },
            'rows': [_ser(r) for r in validated],
        })


class ProductBulkCommitView(APIView):
    """
    POST multipart/form-data:
      rows: JSON serializado del array validado
      zip:  ZIP opcional con imágenes (nombres = slug-N.ext)
    """
    permission_classes = [permissions.IsAuthenticated, IsSuperadmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        rows_json = request.data.get('rows')
        if not rows_json:
            return Response({'detail': 'Falta "rows" (JSON con filas validadas).'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            rows = json.loads(rows_json) if isinstance(rows_json, str) else rows_json
        except json.JSONDecodeError:
            return Response({'detail': 'JSON inválido en "rows".'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Re-validar en backend (no confiamos en el cliente)
        # Normalizar tipos primero
        for r in rows:
            if isinstance(r.get('base_price'), str):
                try:
                    from decimal import Decimal
                    r['base_price'] = Decimal(r['base_price'])
                except Exception:
                    pass
            if isinstance(r.get('compare_at_price'), str):
                try:
                    from decimal import Decimal
                    r['compare_at_price'] = Decimal(r['compare_at_price'])
                except Exception:
                    pass

        tenant = getattr(request.user, 'tenant', None)
        validated = bi.validate_rows(rows, tenant=tenant)

        # Procesar ZIP de imágenes si viene
        image_map = {}
        zf = request.FILES.get('zip')
        if zf:
            try:
                image_map = bi.extract_zip_images(zf)
            except Exception as exc:
                return Response({'detail': f'Error procesando ZIP: {exc}'},
                                status=status.HTTP_400_BAD_REQUEST)

        result = bi.commit_rows(validated, image_map=image_map, tenant=tenant)
        return Response(result, status=status.HTTP_201_CREATED)
