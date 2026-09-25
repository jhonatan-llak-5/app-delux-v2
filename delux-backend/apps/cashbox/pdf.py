"""Arqueo del turno en PDF — el que se adjunta al correo del cierre.

Replica el mismo comprobante que la app descarga desde Caja -> Historial
(shared/utils/cash-report.util.ts): escala de grises, por secciones, con el
mismo orden, los mismos titulos y las mismas medidas, para que el gerente vea
siempre el mismo documento lo reciba por donde lo reciba.

La diferencia esta en donde se genera: el de la app lo arma el navegador con
jsPDF, y este lo arma el servidor con reportlab, porque el correo sale solo al
cerrar la caja (Celery) y ahi no hay navegador.
"""
import io
from decimal import Decimal

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether,
)

# Misma escala de grises que cash-report.util.ts.
SECTION = colors.Color(38 / 255, 38 / 255, 38 / 255)
HEAD = colors.Color(55 / 255, 55 / 255, 55 / 255)
INK = colors.Color(20 / 255, 20 / 255, 20 / 255)
MUTED = colors.Color(110 / 255, 110 / 255, 110 / 255)
LINE = colors.Color(200 / 255, 200 / 255, 200 / 255)
ALT = colors.Color(244 / 255, 244 / 255, 244 / 255)
HILITE = colors.Color(225 / 255, 225 / 255, 225 / 255)

MARGIN = 14 * mm
CONTENT_W = A4[0] - MARGIN * 2
LABEL_W = CONTENT_W * 0.62          # mismo reparto que el reporte del navegador
VALUE_W = CONTENT_W - LABEL_W


def _money(v) -> str:
    """Formato es-EC: $1.234,56 (miles con punto, decimales con coma)."""
    try:
        d = Decimal(str(v or 0)).quantize(Decimal('0.01'))
    except Exception:
        return f'${v}'
    entero, dec = f'{abs(d):,.2f}'.split('.')
    return f'{"-" if d < 0 else ""}${entero.replace(",", ".")},{dec}'


def _signed(v) -> str:
    d = Decimal(str(v or 0))
    return ('+' if d > 0 else '') + _money(d)


def _dt(value) -> str:
    return timezone.localtime(value).strftime('%d/%m/%Y %H:%M') if value else '—'


def _person(user) -> str:
    if not user:
        return '—'
    return (getattr(user, 'full_name', '') or getattr(user, 'email', '') or '—')


def close_outcome(session):
    """('ok'|'short'|'over', titulo, detalle) segun la diferencia del cierre."""
    diff = Decimal(str(session.difference or 0))
    if abs(diff) < Decimal('0.005'):
        return 'ok', 'La caja cuadró', 'Lo contado coincide con lo esperado.'
    if diff < 0:
        return 'short', f'Faltante de {_money(abs(diff))}', 'Hay MENOS efectivo del esperado.'
    return 'over', f'Sobrante de {_money(diff)}', 'Hay MÁS efectivo del esperado.'


# ── piezas del documento ──────────────────────────────────────────────────
def _section(text: str):
    """Barra de seccion: fondo oscuro, texto blanco en mayusculas."""
    t = Table([[text.upper()]], colWidths=[CONTENT_W], rowHeights=[8 * mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), SECTION),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 2 * mm),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    return t


def _kv_table(rows, hilite_last=False):
    """Dos columnas: concepto en negrita a la izquierda, monto a la derecha."""
    t = Table(rows, colWidths=[LABEL_W, VALUE_W])
    style = [
        ('GRID', (0, 0), (-1, -1), 0.1 * mm, LINE),
        ('TEXTCOLOR', (0, 0), (-1, -1), INK),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('TOPPADDING', (0, 0), (-1, -1), 2 * mm),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2 * mm),
        ('LEFTPADDING', (0, 0), (-1, -1), 2 * mm),
        ('RIGHTPADDING', (0, 0), (-1, -1), 2 * mm),
    ]
    if hilite_last:
        style += [
            ('BACKGROUND', (0, -1), (-1, -1), HILITE),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, -1), (-1, -1), 9),
        ]
    t.setStyle(TableStyle(style))
    return t


def _grid_table(head, body, widths, foot=None, right_from=1):
    """Tabla con cabecera oscura, filas alternadas y pie opcional."""
    rows = [head] + body + ([foot] if foot else [])
    t = Table(rows, colWidths=widths, repeatRows=1)
    style = [
        ('GRID', (0, 0), (-1, -1), 0.1 * mm, LINE),
        ('BACKGROUND', (0, 0), (-1, 0), HEAD),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('TEXTCOLOR', (0, 1), (-1, -1), INK),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 2 * mm),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2 * mm),
        ('LEFTPADDING', (0, 0), (-1, -1), 2 * mm),
        ('RIGHTPADDING', (0, 0), (-1, -1), 2 * mm),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]
    if right_from is not None:
        style.append(('ALIGN', (right_from, 0), (-1, -1), 'RIGHT'))
    for i in range(1, len(body) + 1):
        if i % 2 == 0:
            style.append(('BACKGROUND', (0, i), (-1, i), ALT))
    if foot:
        style += [
            ('BACKGROUND', (0, -1), (-1, -1), HILITE),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('ALIGN', (0, -1), (-1, -1), 'RIGHT'),
        ]
    t.setStyle(TableStyle(style))
    return t


def _count_rows(session, stage):
    """Lineas de conteo de una etapa, solo las denominaciones usadas."""
    from .models import PieceType

    out, total = [], Decimal('0')
    qs = (session.count_lines.filter(stage=stage, quantity__gt=0)
          .order_by('piece', '-denomination'))
    for line in qs:
        sub = line.subtotal
        total += sub
        out.append([
            'Billete' if line.piece == PieceType.BILL else 'Moneda',
            _money(line.denomination), str(line.quantity), _money(sub),
        ])
    return out, total


class _Numbered(pdfcanvas.Canvas):
    """Canvas en dos pasadas: hace falta para poner "Pagina 1 de 3"."""

    store = ''

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved = []

    def showPage(self):
        self._saved.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._saved)
        for state in self._saved:
            self.__dict__.update(state)
            self._footer(total)
            super().showPage()
        super().save()

    def _footer(self, total):
        w = A4[0]
        self.setStrokeColor(LINE)
        self.setLineWidth(0.2 * mm)
        self.line(MARGIN, 12 * mm, w - MARGIN, 12 * mm)
        self.setFont('Helvetica', 7.5)
        self.setFillColor(MUTED)
        self.drawString(MARGIN, 8 * mm, self.store)
        self.drawRightString(w - MARGIN, 8 * mm,
                             f'Página {self._pageNumber} de {total}')


def build_cash_close_pdf(session) -> bytes:
    """Arqueo del turno en PDF, igual al que se descarga desde el historial."""
    from apps.settings.models import PlatformSettings
    from .models import CountStage

    cfg = PlatformSettings.load()
    store = cfg.site_name or 'Tienda'
    kind, _title, _detail = close_outcome(session)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=12 * mm, bottomMargin=16 * mm,
        title=f'Arqueo {session.code or session.id}',
    )
    ss = getSampleStyleSheet()
    st_title = ParagraphStyle('t', parent=ss['Normal'], fontName='Helvetica-Bold',
                              fontSize=16, textColor=INK, leading=18)
    st_meta = ParagraphStyle('m', parent=ss['Normal'], fontSize=9,
                             textColor=MUTED, leading=11.5)
    st_note = ParagraphStyle('n', parent=ss['Normal'], fontSize=8, textColor=INK,
                             leading=10.5)
    st_foot = ParagraphStyle('f', parent=ss['Normal'], fontSize=7.5, textColor=MUTED)

    branch = getattr(session.branch, 'name', '') or '—'
    register = getattr(session.register, 'name', '') or 'Caja'
    closed = _dt(session.closed_at) if session.closed_at else 'en curso'

    flow = [
        Paragraph(f'Arqueo {session.code or session.id}', st_title),
        Spacer(1, 2 * mm),
        Paragraph(
            f'{store}<br/>'
            f'{branch} · {register} · {_person(session.opened_by)}<br/>'
            f'Apertura: {_dt(session.opened_at)} &nbsp; Cierre: {closed}<br/>'
            f'Generado: {_dt(timezone.now())}', st_meta),
        Spacer(1, 5 * mm),
    ]

    # ── Movimientos del turno ─────────────────────────────────────────────
    flow += [_section('Movimientos del turno'), Spacer(1, 2 * mm), _kv_table([
        ['Fondo inicial', _money(session.opening_amount)],
        [f'Ventas del turno ({session.sales_count or 0})', _money(session.sales_total)],
        ['      · en efectivo', _money(session.cash_sales)],
        ['      · con tarjeta', _money(session.card_sales)],
        ['      · por transferencia', _money(session.transfer_sales)],
        ['Diferencias de cambios cobradas', _money(session.change_in)],
        ['Ingresos manuales', _money(session.cash_in)],
        ['Gastos en efectivo', '-' + _money(session.expenses_cash)],
        ['Retiros', '-' + _money(session.cash_out)],
        ['Cambios devueltos al cliente', '-' + _money(session.change_out)],
    ]), Spacer(1, 8 * mm)]

    # ── Resultado del cierre ──────────────────────────────────────────────
    label = {'ok': 'Cuadre correcto', 'short': 'Faltante', 'over': 'Sobrante'}[kind]
    flow += [KeepTogether([
        _section('Resultado del cierre'), Spacer(1, 2 * mm), _kv_table([
            ['Efectivo esperado', _money(session.expected_amount)],
            ['Efectivo contado', _money(session.counted_amount)],
            [f'Diferencia — {label}', _signed(session.difference)],
        ], hilite_last=True),
    ]), Spacer(1, 8 * mm)]

    # ── Conteos de billetes y monedas ─────────────────────────────────────
    for title, stage in (('Conteo de apertura', CountStage.OPENING),
                         ('Conteo de cierre', CountStage.CLOSING)):
        rows, total = _count_rows(session, stage)
        if not rows:
            continue
        flow += [KeepTogether([
            _section(title), Spacer(1, 2 * mm),
            _grid_table(['Tipo', 'Denominación', 'Cantidad', 'Total'], rows,
                        [28 * mm, 34 * mm, 26 * mm, CONTENT_W - 88 * mm],
                        foot=['', '', 'Total', _money(total)]),
        ]), Spacer(1, 8 * mm)]

    # ── Ingresos y retiros ────────────────────────────────────────────────
    movs = list(session.movements.select_related('created_by').order_by('created_at'))
    if movs:
        body = [[
            _dt(m.created_at), m.get_type_display(),
            Paragraph(m.reason or '—', st_note), _person(m.created_by),
            ('+' if m.type == 'IN' else '-') + _money(m.amount),
        ] for m in movs]
        flow += [_section('Ingresos y retiros'), Spacer(1, 2 * mm),
                 _grid_table(['Fecha', 'Tipo', 'Motivo', 'Usuario', 'Monto'], body,
                             [30 * mm, 20 * mm, CONTENT_W - 106 * mm, 30 * mm, 26 * mm],
                             right_from=4),
                 Spacer(1, 8 * mm)]

    # ── Observaciones ─────────────────────────────────────────────────────
    obs = []
    if session.opening_note:
        obs.append(['Apertura', Paragraph(session.opening_note, st_note)])
    if session.closing_note:
        obs.append(['Cierre', Paragraph(session.closing_note, st_note)])
    if obs:
        t = Table(obs, colWidths=[28 * mm, CONTENT_W - 28 * mm])
        t.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.1 * mm, LINE),
            ('TEXTCOLOR', (0, 0), (-1, -1), INK),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 2 * mm),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2 * mm),
            ('LEFTPADDING', (0, 0), (-1, -1), 2 * mm),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        flow += [_section('Observaciones'), Spacer(1, 2 * mm), t, Spacer(1, 6 * mm)]

    flow.append(Paragraph(
        'Documento generado automáticamente al cerrar el turno. '
        'El mismo arqueo está en Caja → Historial.', st_foot))

    canvas_cls = type('_C', (_Numbered,), {'store': store})
    doc.build(flow, canvasmaker=canvas_cls)
    return buf.getvalue()
