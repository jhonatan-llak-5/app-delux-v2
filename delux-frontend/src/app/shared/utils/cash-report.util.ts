import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PdfLogo } from './export.util';

/**
 * Reportes PDF de Caja — mismo diseño que Ventas y Balance general (blanco y
 * negro, por secciones).
 *
 * Dos formatos:
 *  - `buildCashSessionsDoc`  → varios turnos, agrupados por día (arqueo del período).
 *  - `buildCashSessionDoc`   → un turno concreto, con su conteo y movimientos.
 *
 * Cada uno tiene su `export…Pdf` (descarga) y su `…Blob` (para compartir por la
 * hoja nativa sin pasar por el disco).
 */

export interface CashReportCount {
  piece: 'BILL' | 'COIN';
  denomination: string;
  quantity: number;
  subtotal: string;
}

export interface CashReportMovement {
  type: 'IN' | 'OUT';
  type_label: string;
  amount: string;
  reason: string;
  created_by_name: string;
  created_at: string;
}

export interface CashReportSession {
  code: string;
  status: string;
  branch_name: string;
  register_name: string;
  opened_by_name: string;
  opened_at: string;
  closed_by_name?: string;
  closed_at: string | null;
  opening_amount: string | number;
  opening_note?: string;
  closing_note?: string;
  sales_count: number;
  sales_total: string | number;
  cash_sales: string | number;
  card_sales: string | number;
  transfer_sales: string | number;
  other_sales?: string | number;
  change_in?: string | number;
  change_out?: string | number;
  expenses_cash: string | number;
  cash_in: string | number;
  cash_out: string | number;
  expected_amount: string | number;
  counted_amount: string | number;
  difference: string | number;
  opening_count?: CashReportCount[];
  closing_count?: CashReportCount[];
  movements?: CashReportMovement[];
}

export interface CashReportMeta {
  storeName: string;
  brandName: string;
  logo: PdfLogo | null;
  range?: { from: string; to: string };
}

// ─── Escala de grises (idéntica a los otros reportes) ───
const C_SECTION: [number, number, number] = [38, 38, 38];
const C_HEAD: [number, number, number] = [55, 55, 55];
const C_TEXT: [number, number, number] = [20, 20, 20];
const C_MUTED: [number, number, number] = [110, 110, 110];
const C_LINE: [number, number, number] = [200, 200, 200];
const C_ALT: [number, number, number] = [244, 244, 244];
const C_HILITE: [number, number, number] = [225, 225, 225];

const MARGIN = 14;
const TOP_CONT = 20;

const n = (v: unknown): number => Number(v) || 0;

function money(v: unknown): string {
  return '$' + n(v).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function signed(v: unknown): string {
  const x = n(v);
  return (x > 0 ? '+' : x < 0 ? '-' : '') + '$' +
    Math.abs(x).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDay(iso?: string | null): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('es-EC');
}

function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Clave de día local (YYYY-MM-DD) para agrupar los turnos. */
function dayKey(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0, 10);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function statusLabel(s: string): string {
  return s === 'OPEN' ? 'Abierta' : 'Cerrada';
}

function sectionBar(doc: jsPDF, text: string, y: number): number {
  const pageW = doc.internal.pageSize.getWidth();
  const h = 8;
  doc.setFillColor(...C_SECTION);
  doc.rect(MARGIN, y, pageW - MARGIN * 2, h, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(text.toUpperCase(), MARGIN + 2, y + 5.6);
  return y + h + 2;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - 16) { doc.addPage(); return TOP_CONT; }
  return y;
}

function timestampedName(base: string): string {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, '0');
  return `${base}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.pdf`;
}

const BASE_STYLES = { fontSize: 8, cellPadding: 2, textColor: C_TEXT, lineColor: C_LINE, lineWidth: 0.1 };
const HEAD_STYLES = { fillColor: C_HEAD, textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const };

/** Cabecera común: logo + título + metadatos. Devuelve la Y donde seguir. */
function header(doc: jsPDF, meta: CashReportMeta, title: string, extraLines: string[]): number {
  const pageW = doc.internal.pageSize.getWidth();
  const rightX = pageW - MARGIN;
  let textX = MARGIN;

  if (meta.logo) {
    try {
      doc.addImage(meta.logo.dataUrl, meta.logo.format || 'PNG', MARGIN, 9, meta.logo.width, meta.logo.height);
      textX = MARGIN + meta.logo.width + 5;
    } catch { /* seguimos sin logo */ }
  }

  doc.setTextColor(...C_TEXT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, textX, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C_MUTED);
  const lines = [meta.storeName, ...extraLines];
  doc.text(lines, textX, 22);

  let y = Math.max(9 + (meta.logo ? meta.logo.height : 0) + 4, 22 + lines.length * 4 + 2);
  doc.setDrawColor(...C_LINE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, rightX, y);
  return y + 6;
}

function footer(doc: jsPDF, brandName: string): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const rightX = pageW - MARGIN;
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C_LINE);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, pageH - 12, rightX, pageH - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C_MUTED);
    doc.text(brandName, MARGIN, pageH - 8);
    doc.text(`Página ${i} de ${total}`, rightX, pageH - 8, { align: 'right' });
  }
}

// ═══════════════════════════════════════════════════════════
// 1. Varios turnos (arqueo del período, agrupado por día)
// ═══════════════════════════════════════════════════════════
export function buildCashSessionsDoc(sessions: CashReportSession[], meta: CashReportMeta): jsPDF {
  const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  const closed = sessions.filter(s => s.status === 'CLOSED');
  const sum = (f: (s: CashReportSession) => unknown) => sessions.reduce((a, s) => a + n(f(s)), 0);
  const sumClosed = (f: (s: CashReportSession) => unknown) => closed.reduce((a, s) => a + n(f(s)), 0);

  const extra: string[] = [];
  if (meta.range?.from || meta.range?.to) {
    extra.push(`Período: ${fmtDay(meta.range.from) } a ${fmtDay(meta.range.to)}`);
  }
  extra.push(`Generado: ${new Date().toLocaleString('es-EC')}  ·  ${sessions.length} turno(s)`);

  let y = header(doc, meta, 'Arqueo de Caja', extra);

  // ── RESUMEN ──
  y = ensureSpace(doc, y, 50);
  y = sectionBar(doc, 'Resumen del período', y);
  const mismatched = closed.filter(s => Math.abs(n(s.difference)) >= 0.005).length;
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    body: [
      ['Turnos (abiertos / cerrados)', `${sessions.length}  (${sessions.length - closed.length} / ${closed.length})`],
      ['Ventas del período', money(sum(s => s.sales_total))],
      ['   · en efectivo', money(sum(s => s.cash_sales))],
      ['   · con tarjeta', money(sum(s => s.card_sales))],
      ['   · por transferencia', money(sum(s => s.transfer_sales))],
      ['Gastos en efectivo', '-' + money(sum(s => s.expenses_cash))],
      ['Ingresos manuales / retiros', `${money(sum(s => s.cash_in))}  /  -${money(sum(s => s.cash_out))}`],
      ['Efectivo esperado (turnos cerrados)', money(sumClosed(s => s.expected_amount))],
      ['Efectivo contado (turnos cerrados)', money(sumClosed(s => s.counted_amount))],
      ['Descuadre acumulado', signed(sumClosed(s => s.difference))],
      ['Turnos con diferencia', String(mismatched)],
    ],
    styles: BASE_STYLES,
    margin: { left: MARGIN, right: MARGIN },
    columnStyles: {
      0: { cellWidth: (pageW - MARGIN * 2) * 0.5, fontStyle: 'bold' },
      1: { halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.row.index === 9) {   // Descuadre acumulado
        data.cell.styles.fillColor = C_HILITE;
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 9;
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── TURNOS AGRUPADOS POR DÍA ──
  const byDay = new Map<string, CashReportSession[]>();
  for (const s of [...sessions].sort((a, b) => a.opened_at.localeCompare(b.opened_at))) {
    const k = dayKey(s.opened_at);
    const bucket = byDay.get(k);
    if (bucket) bucket.push(s);
    else byDay.set(k, [s]);
  }

  for (const [day, rows] of byDay) {
    y = ensureSpace(doc, y, 40);
    y = sectionBar(doc, `Turnos del ${fmtDay(day)}`, y);
    const dTotal = rows.reduce((a, s) => a + n(s.sales_total), 0);
    const dDiff = rows.filter(s => s.status === 'CLOSED').reduce((a, s) => a + n(s.difference), 0);
    autoTable(doc, {
      startY: y,
      theme: 'grid',
      head: [['Turno', 'Caja', 'Sucursal', 'Usuario', 'Apertura', 'Cierre', 'Fondo',
              'Ventas', 'Efectivo', 'Tarjeta', 'Transfer.', 'Esperado', 'Contado', 'Dif.']],
      body: rows.map(s => [
        s.code,
        s.register_name || 'Caja',
        s.branch_name,
        s.opened_by_name,
        fmtDateTime(s.opened_at),
        s.closed_at ? fmtDateTime(s.closed_at) : statusLabel(s.status),
        money(s.opening_amount),
        money(s.sales_total),
        money(s.cash_sales),
        money(s.card_sales),
        money(s.transfer_sales),
        s.status === 'CLOSED' ? money(s.expected_amount) : '—',
        s.status === 'CLOSED' ? money(s.counted_amount) : '—',
        s.status === 'CLOSED' ? signed(s.difference) : '—',
      ]),
      foot: [['', '', '', '', '', '', 'Totales del día', money(dTotal), '', '', '', '', 'Descuadre', signed(dDiff)]],
      showFoot: 'lastPage',
      styles: { ...BASE_STYLES, fontSize: 7.5 },
      headStyles: HEAD_STYLES,
      footStyles: { fillColor: [235, 235, 235], textColor: C_TEXT, fontStyle: 'bold', halign: 'right' },
      alternateRowStyles: { fillColor: C_ALT },
      margin: { left: MARGIN, right: MARGIN, top: TOP_CONT },
      columnStyles: {
        6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' },
        9: { halign: 'right' }, 10: { halign: 'right' }, 11: { halign: 'right' },
        12: { halign: 'right' }, 13: { halign: 'right' },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── ANEXO: CONTEO DE BILLETES Y MONEDAS POR TURNO ──
  // Solo aparece si los turnos vienen con su desglose (listado con ?detail=1).
  const withCount = sessions.filter(
    s => (s.opening_count?.some(r => r.quantity > 0)) || (s.closing_count?.some(r => r.quantity > 0)));

  if (withCount.length) {
    y = ensureSpace(doc, y, 46);
    y = sectionBar(doc, 'Anexo · Conteo de billetes y monedas', y);

    for (const s of withCount) {
      // Una fila por denominación usada en la apertura o en el cierre.
      const keys = new Map<string, { piece: string; denom: string; open: number; close: number }>();
      const put = (rows: CashReportCount[] | undefined, field: 'open' | 'close') => {
        for (const r of rows || []) {
          if (!r.quantity) continue;
          const k = `${r.piece}|${r.denomination}`;
          const row = keys.get(k) ?? { piece: r.piece, denom: r.denomination, open: 0, close: 0 };
          row[field] = r.quantity;
          keys.set(k, row);
        }
      };
      put(s.opening_count, 'open');
      put(s.closing_count, 'close');
      const rows = [...keys.values()].sort((a, b) =>
        (a.piece === b.piece ? n(b.denom) - n(a.denom) : a.piece === 'BILL' ? -1 : 1));

      y = ensureSpace(doc, y, 30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...C_TEXT);
      doc.text(`${s.code} · ${s.register_name || 'Caja'} · ${fmtDay(s.opened_at)}`, MARGIN, y + 3);
      y += 6;

      autoTable(doc, {
        startY: y,
        theme: 'grid',
        head: [['Tipo', 'Denominación', 'Cant. apertura', 'Total apertura', 'Cant. cierre', 'Total cierre']],
        body: rows.map(r => [
          r.piece === 'BILL' ? 'Billete' : 'Moneda',
          money(r.denom),
          r.open ? String(r.open) : '—',
          r.open ? money(n(r.denom) * r.open) : '—',
          r.close ? String(r.close) : '—',
          r.close ? money(n(r.denom) * r.close) : '—',
        ]),
        foot: [[
          '', 'Totales',
          String(rows.reduce((a, r) => a + r.open, 0)),
          money(rows.reduce((a, r) => a + n(r.denom) * r.open, 0)),
          String(rows.reduce((a, r) => a + r.close, 0)),
          money(rows.reduce((a, r) => a + n(r.denom) * r.close, 0)),
        ]],
        showFoot: 'lastPage',
        styles: { ...BASE_STYLES, fontSize: 7.5 },
        headStyles: HEAD_STYLES,
        footStyles: { fillColor: [235, 235, 235], textColor: C_TEXT, fontStyle: 'bold', halign: 'right' },
        alternateRowStyles: { fillColor: C_ALT },
        margin: { left: MARGIN, right: MARGIN, top: TOP_CONT },
        columnStyles: {
          0: { cellWidth: 22 }, 1: { cellWidth: 28, halign: 'right' },
          2: { cellWidth: 28, halign: 'right' }, 3: { cellWidth: 30, halign: 'right' },
          4: { cellWidth: 28, halign: 'right' }, 5: { cellWidth: 30, halign: 'right' },
        },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }
  }

  footer(doc, meta.brandName);
  return doc;
}

export function exportCashSessionsPdf(sessions: CashReportSession[], meta: CashReportMeta): void {
  buildCashSessionsDoc(sessions, meta).save(timestampedName('arqueo-caja'));
}

export function cashSessionsPdfBlob(sessions: CashReportSession[], meta: CashReportMeta): Blob {
  return buildCashSessionsDoc(sessions, meta).output('blob');
}

// ═══════════════════════════════════════════════════════════
// 2. Un turno (comprobante de arqueo)
// ═══════════════════════════════════════════════════════════
export function buildCashSessionDoc(s: CashReportSession, meta: CashReportMeta): jsPDF {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const halfW = (pageW - MARGIN * 2) * 0.62;

  let y = header(doc, meta, `Arqueo ${s.code}`, [
    `${s.branch_name} · ${s.register_name || 'Caja'} · ${s.opened_by_name}`,
    `Apertura: ${fmtDateTime(s.opened_at)}   Cierre: ${s.closed_at ? fmtDateTime(s.closed_at) : 'en curso'}`,
    `Generado: ${new Date().toLocaleString('es-EC')}`,
  ]);

  // ── MOVIMIENTOS DEL TURNO ──
  y = ensureSpace(doc, y, 60);
  y = sectionBar(doc, 'Movimientos del turno', y);
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    body: [
      ['Fondo inicial', money(s.opening_amount)],
      [`Ventas del turno (${s.sales_count})`, money(s.sales_total)],
      ['   · en efectivo', money(s.cash_sales)],
      ['   · con tarjeta', money(s.card_sales)],
      ['   · por transferencia', money(s.transfer_sales)],
      ['Diferencias de cambios cobradas', money(s.change_in)],
      ['Ingresos manuales', money(s.cash_in)],
      ['Gastos en efectivo', '-' + money(s.expenses_cash)],
      ['Retiros', '-' + money(s.cash_out)],
      ['Cambios devueltos al cliente', '-' + money(s.change_out)],
    ],
    styles: BASE_STYLES,
    margin: { left: MARGIN, right: MARGIN },
    columnStyles: { 0: { cellWidth: halfW, fontStyle: 'bold' }, 1: { halign: 'right' } },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── RESULTADO ──
  y = ensureSpace(doc, y, 40);
  y = sectionBar(doc, 'Resultado del cierre', y);
  const diff = n(s.difference);
  const diffLabel = Math.abs(diff) < 0.005 ? 'Cuadre correcto'
    : (diff > 0 ? 'Sobrante' : 'Faltante');
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    body: [
      ['Efectivo esperado', money(s.expected_amount)],
      ['Efectivo contado', s.status === 'CLOSED' ? money(s.counted_amount) : '—'],
      [`Diferencia — ${diffLabel}`, s.status === 'CLOSED' ? signed(s.difference) : '—'],
    ],
    styles: BASE_STYLES,
    margin: { left: MARGIN, right: MARGIN },
    columnStyles: { 0: { cellWidth: halfW, fontStyle: 'bold' }, 1: { halign: 'right' } },
    didParseCell: (data) => {
      if (data.row.index === 2) {
        data.cell.styles.fillColor = C_HILITE;
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 9;
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── CONTEO DE BILLETES Y MONEDAS ──
  const counts: [string, CashReportCount[] | undefined][] = [
    ['Conteo de apertura', s.opening_count],
    ['Conteo de cierre', s.closing_count],
  ];
  for (const [label, rows] of counts) {
    const used = (rows || []).filter(r => r.quantity > 0);
    if (!used.length) continue;
    y = ensureSpace(doc, y, 40);
    y = sectionBar(doc, label, y);
    autoTable(doc, {
      startY: y,
      theme: 'grid',
      head: [['Tipo', 'Denominación', 'Cantidad', 'Total']],
      body: used.map(r => [
        r.piece === 'BILL' ? 'Billete' : 'Moneda',
        money(r.denomination),
        String(r.quantity),
        money(r.subtotal),
      ]),
      foot: [['', '', 'Total', money(used.reduce((a, r) => a + n(r.subtotal), 0))]],
      showFoot: 'lastPage',
      styles: BASE_STYLES,
      headStyles: HEAD_STYLES,
      footStyles: { fillColor: [235, 235, 235], textColor: C_TEXT, fontStyle: 'bold', halign: 'right' },
      alternateRowStyles: { fillColor: C_ALT },
      margin: { left: MARGIN, right: MARGIN, top: TOP_CONT },
      columnStyles: {
        0: { cellWidth: 28 }, 1: { cellWidth: 34, halign: 'right' },
        2: { cellWidth: 26, halign: 'right' }, 3: { halign: 'right' },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── INGRESOS Y RETIROS ──
  if (s.movements?.length) {
    y = ensureSpace(doc, y, 40);
    y = sectionBar(doc, 'Ingresos y retiros', y);
    autoTable(doc, {
      startY: y,
      theme: 'grid',
      head: [['Fecha', 'Tipo', 'Motivo', 'Usuario', 'Monto']],
      body: s.movements.map(m => [
        fmtDateTime(m.created_at), m.type_label, m.reason || '—',
        m.created_by_name || '—', (m.type === 'IN' ? '+' : '-') + money(m.amount),
      ]),
      styles: BASE_STYLES,
      headStyles: HEAD_STYLES,
      alternateRowStyles: { fillColor: C_ALT },
      margin: { left: MARGIN, right: MARGIN, top: TOP_CONT },
      columnStyles: { 2: { cellWidth: 'auto' }, 4: { cellWidth: 26, halign: 'right' } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── OBSERVACIONES ──
  if (s.opening_note || s.closing_note) {
    y = ensureSpace(doc, y, 26);
    y = sectionBar(doc, 'Observaciones', y);
    autoTable(doc, {
      startY: y,
      theme: 'grid',
      body: [
        ...(s.opening_note ? [['Apertura', s.opening_note]] : []),
        ...(s.closing_note ? [['Cierre', s.closing_note]] : []),
      ],
      styles: BASE_STYLES,
      margin: { left: MARGIN, right: MARGIN },
      columnStyles: { 0: { cellWidth: 28, fontStyle: 'bold' } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── FIRMAS ──
  y = ensureSpace(doc, y, 30);
  const colW = (pageW - MARGIN * 2) / 2;
  doc.setDrawColor(...C_LINE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN + 6, y + 14, MARGIN + colW - 6, y + 14);
  doc.line(MARGIN + colW + 6, y + 14, pageW - MARGIN - 6, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C_MUTED);
  doc.text(`Entrega — ${s.opened_by_name}`, MARGIN + 6, y + 18);
  doc.text(`Recibe — ${s.closed_by_name || ''}`, MARGIN + colW + 6, y + 18);

  footer(doc, meta.brandName);
  return doc;
}

export function exportCashSessionPdf(s: CashReportSession, meta: CashReportMeta): void {
  buildCashSessionDoc(s, meta).save(`arqueo-${s.code}.pdf`);
}

export function cashSessionPdfBlob(s: CashReportSession, meta: CashReportMeta): Blob {
  return buildCashSessionDoc(s, meta).output('blob');
}
