"""Comprobante de pedido en PDF (con QR de respaldo).

Genera un PDF profesional con los datos del pedido y un código QR que apunta
al propio comprobante, de modo que comprador, vendedor y tienda puedan
escanearlo para verificar/recuperar el pedido.
Usa reportlab (ya incluido en requirements) — el QR es nativo de reportlab.
"""
import io
import os
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
)
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics import renderPDF

NAVY = colors.HexColor('#1e3a8a')
SLATE = colors.HexColor('#475569')
LIGHT = colors.HexColor('#f1f5f9')


def _money(v):
    try:
        return f'${Decimal(str(v)).quantize(Decimal("0.01"))}'
    except Exception:
        return f'${v}'


def receipt_public_url(order, request=None):
    """URL absoluta al comprobante (lo que codifica el QR)."""
    base = (os.getenv('FRONTEND_URL') or '').rstrip('/')
    if not base and request is not None:
        base = request.build_absolute_uri('/').rstrip('/')
    return f'{base}/api/v1/admin/checkout/receipt/{order.code}/'


def _qr_drawing(data: str, size_mm: float = 32):
    size = size_mm * mm
    qr = QrCodeWidget(data)
    b = qr.getBounds()
    w = b[2] - b[0]
    h = b[3] - b[1]
    d = Drawing(size, size, transform=[size / w, 0, 0, size / h, 0, 0])
    d.add(qr)
    return d


def build_order_receipt_pdf(order, request=None) -> bytes:
    from apps.settings.models import PlatformSettings
    cfg = PlatformSettings.load()
    store_name = (getattr(cfg, 'site_name', None)
                  or getattr(cfg, 'platform_name', None) or 'Delux')

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=16 * mm, bottomMargin=16 * mm,
        title=f'Comprobante {order.code}',
    )
    styles = getSampleStyleSheet()
    h_title = ParagraphStyle('t', parent=styles['Title'], textColor=NAVY,
                             fontSize=20, spaceAfter=2)
    h_sub = ParagraphStyle('s', parent=styles['Normal'], textColor=SLATE,
                           fontSize=9)
    label = ParagraphStyle('l', parent=styles['Normal'], textColor=SLATE,
                           fontSize=8, leading=11)
    val = ParagraphStyle('v', parent=styles['Normal'], fontSize=10, leading=13)
    small = ParagraphStyle('sm', parent=styles['Normal'], textColor=SLATE,
                           fontSize=8, leading=11)

    story = []

    # ── Encabezado: título + QR ──
    qr_url = receipt_public_url(order, request)
    header = Table([[
        [Paragraph(store_name, h_title),
         Paragraph('COMPROBANTE DE PEDIDO', h_sub),
         Spacer(1, 4),
         Paragraph(f'<b>{order.code}</b>', val),
         Paragraph(order.created_at.strftime('%d/%m/%Y %H:%M'), small)],
        _qr_drawing(qr_url, 30),
    ]], colWidths=[110 * mm, 40 * mm])
    header.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
    ]))
    story.append(header)
    story.append(Spacer(1, 6))
    story.append(Paragraph('Escanea el QR para verificar este pedido.', small))
    story.append(Spacer(1, 10))

    # ── Cliente + Despacho ──
    cust = order.customer
    branch = order.branch
    info = Table([[
        [Paragraph('CLIENTE', label),
         Paragraph(getattr(cust, 'full_name', '') or '—', val),
         Paragraph(getattr(cust, 'email', '') or '', small),
         Paragraph(getattr(cust, 'phone', '') or '', small),
         Paragraph((getattr(cust, 'document_id', '') or ''), small)],
        [Paragraph('DESPACHO', label),
         Paragraph(order.get_fulfillment_display(), val),
         Paragraph(getattr(branch, 'name', '') or '', small),
         Paragraph(getattr(branch, 'address', '') or '', small),
         Paragraph(f'Estado: {order.get_status_display()}', small)],
    ]], colWidths=[75 * mm, 75 * mm])
    info.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(info)
    story.append(Spacer(1, 14))

    # ── Tabla de ítems ──
    rows = [['Producto', 'Variante', 'Cant.', 'P. Unit.', 'Subtotal']]
    for it in order.items.all():
        rows.append([
            Paragraph(it.product_name, small),
            Paragraph(f'{it.size or "—"} / {it.color or "—"}', small),
            str(it.quantity),
            _money(it.unit_price),
            _money(it.subtotal),
        ])
    items = Table(rows, colWidths=[62 * mm, 38 * mm, 15 * mm, 17 * mm, 18 * mm])
    items.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT]),
        ('LINEBELOW', (0, 0), (-1, -1), 0.3, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(items)
    story.append(Spacer(1, 10))

    # ── Totales ──
    tot_rows = [['Subtotal', _money(order.subtotal)]]
    if order.discount and Decimal(str(order.discount)) > 0:
        dlabel = 'Descuento'
        if order.coupon_code:
            dlabel += f' ({order.coupon_code})'
        tot_rows.append([dlabel, '-' + _money(order.discount)])
    tot_rows.append(['TOTAL', _money(order.total)])
    totals = Table(tot_rows, colWidths=[40 * mm, 30 * mm], hAlign='RIGHT')
    totals.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0, -1), (-1, -1), NAVY),
        ('LINEABOVE', (0, -1), (-1, -1), 0.6, NAVY),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(totals)
    story.append(Spacer(1, 16))

    # ── Pago + pie ──
    pay = order.payments.order_by('-created_at').first()
    if pay:
        story.append(Paragraph(
            f'Método de pago: <b>{pay.get_method_display()}</b> '
            f'· {pay.get_status_display()}', val))

    # Seguimiento (si el pedido es a domicilio y tiene envío)
    try:
        from apps.shipping.models import Shipment
        sh = Shipment.objects.filter(order=order).first()
    except Exception:
        sh = None
    if sh:
        base = (os.getenv('FRONTEND_URL') or '').rstrip('/')
        if not base and request is not None:
            base = request.build_absolute_uri('/').rstrip('/')
        track_url = f'{base}/tracking/{sh.tracking_code}'
        story.append(Spacer(1, 4))
        story.append(Paragraph(
            f'Seguimiento: <b>{sh.tracking_code}</b>', val))
        story.append(Paragraph(f'Rastrea tu pedido en: {track_url}', small))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        'Este comprobante es un respaldo para el comprador, el vendedor y la '
        'tienda. Consérvalo y preséntalo al retirar o recibir tu pedido.', small))
    if getattr(cfg, 'support_email', None):
        story.append(Paragraph(f'Soporte: {cfg.support_email}', small))

    doc.build(story)
    return buf.getvalue()
