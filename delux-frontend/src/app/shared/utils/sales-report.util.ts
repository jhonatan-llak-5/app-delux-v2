import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PdfLogo } from './export.util';

/**
 * Reporte PDF dedicado del "Historial de ventas" — mismo diseño que el Balance
 * general (blanco y negro, por secciones): RESUMEN + VENTAS con totales.
 *
 * Respeta el período (rango de fechas) que venga en `range`. Muestra por venta
 * si hubo productos devueltos (cambios) y el total neto, más los totales del
 * período. Las ventas canceladas/anuladas NO se incluyen (no son ventas reales).
 */

export interface SalesReportRow {
  date: string;       // created_at ISO
  code: string;
  party: string;      // cliente / 'Mostrador'
  channel: string;    // 'POS' | 'WEB' | ...
  products: string;   // productos vendidos ("Zapatilla (2), Gorra (1)")
  total: number;      // total bruto
  returned: number;   // total_changes (valor devuelto por cambios)
  net: number;        // total neto (total - devuelto)
}

export interface SalesReportData {
  storeName: string;
  brandName: string;
  logo: PdfLogo | null;
  range: { from: string; to: string };
  rows: SalesReportRow[];
  totalGross: number;
  totalReturned: number;
  totalNet: number;
  count: number;
}

// ─── Colores en escala de grises (idénticos al balance) ───
const C_SECTION: [number, number, number] = [38, 38, 38];
const C_HEAD: [number, number, number] = [55, 55, 55];
const C_TEXT: [number, number, number] = [20, 20, 20];
const C_MUTED: [number, number, number] = [110, 110, 110];
const C_LINE: [number, number, number] = [200, 200, 200];
const C_ALT: [number, number, number] = [244, 244, 244];
const C_HILITE: [number, number, number] = [225, 225, 225];

const MARGIN = 14;
const TOP_CONT = 20;

function money(n: number): string {
  return '$' + (Number(n) || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  const base = `${dd}/${mm}/${yy}`;
  return iso.includes('T')
    ? `${base} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    : base;
}

function channelLabel(c: string): string {
  return ({ POS: 'POS', WEB: 'Web', KIOSK: 'Kiosko' } as Record<string, string>)[c] || c || '—';
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
  const p = (n: number) => String(n).padStart(2, '0');
  return `${base}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.pdf`;
}

/** Genera y descarga el PDF del reporte de Ventas. */
export function exportSalesPdf(d: SalesReportData): void {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const rightX = pageW - MARGIN;

  // ── Cabecera ──
  let textX = MARGIN;
  if (d.logo) {
    try {
      doc.addImage(d.logo.dataUrl, d.logo.format || 'PNG', MARGIN, 9, d.logo.width, d.logo.height);
      textX = MARGIN + d.logo.width + 5;
    } catch { /* seguimos sin logo */ }
  }

  doc.setTextColor(...C_TEXT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Ventas', textX, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C_MUTED);
  const metaLines = [
    d.storeName,
    `Período: ${fmtDay(d.range.from)} a ${fmtDay(d.range.to)}`,
    `Generado: ${new Date().toLocaleString('es-EC')}  ·  ${d.count} venta(s)`,
  ];
  doc.text(metaLines, textX, 22);

  let y = Math.max(9 + (d.logo ? d.logo.height : 0) + 4, 22 + metaLines.length * 4 + 2);
  doc.setDrawColor(...C_LINE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, rightX, y);
  y += 6;

  const tableTheme = 'grid' as const;
  const baseStyles = { fontSize: 8, cellPadding: 2, textColor: C_TEXT, lineColor: C_LINE, lineWidth: 0.1 };
  const headStyles = { fillColor: C_HEAD, textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const };

  // ── 1. RESUMEN ──
  y = ensureSpace(doc, y, 50);
  y = sectionBar(doc, 'Resumen', y);
  const resumenBody = [
    ['Ventas brutas', money(d.totalGross)],
    ['Productos devueltos (cambios)', '-' + money(d.totalReturned)],
    ['Ventas netas', money(d.totalNet)],
    ['Número de ventas', String(d.count)],
  ];
  autoTable(doc, {
    startY: y,
    theme: tableTheme,
    body: resumenBody,
    styles: baseStyles,
    margin: { left: MARGIN, right: MARGIN },
    columnStyles: {
      0: { cellWidth: (pageW - MARGIN * 2) * 0.62, fontStyle: 'bold' },
      1: { halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.row.index === 2) { // Ventas netas destacado
        data.cell.styles.fillColor = C_HILITE;
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 9;
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── 2. VENTAS (detalle) ──
  y = ensureSpace(doc, y, 40);
  y = sectionBar(doc, 'Ventas', y);
  const body = d.rows.map(r => [
    fmtDateTime(r.date),
    r.code + (r.party ? `\n${r.party}` : ''),
    r.products || '—',
    channelLabel(r.channel),
    r.returned > 0 ? '-' + money(r.returned) : '—',
    money(r.net),
  ]);
  autoTable(doc, {
    startY: y,
    theme: tableTheme,
    head: [['Fecha', 'Venta', 'Productos', 'Canal', 'Devuelto', 'Total']],
    body: body.length ? body : [['—', 'Sin ventas en el período', '—', '—', '—', '—']],
    foot: [
      ['', '', '', '', 'Ventas brutas', money(d.totalGross)],
      ['', '', '', '', 'Devuelto', '-' + money(d.totalReturned)],
      ['', '', '', '', 'Ventas netas', money(d.totalNet)],
    ],
    showFoot: 'lastPage',
    styles: baseStyles,
    headStyles,
    footStyles: { fillColor: [235, 235, 235], textColor: C_TEXT, fontStyle: 'bold', halign: 'right' },
    alternateRowStyles: { fillColor: C_ALT },
    margin: { left: MARGIN, right: MARGIN, top: TOP_CONT },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 40 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 22, halign: 'right' },
    },
  });

  // ── Pie de página ──
  const pageH = doc.internal.pageSize.getHeight();
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C_LINE);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, pageH - 12, rightX, pageH - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C_MUTED);
    doc.text(d.brandName, MARGIN, pageH - 8);
    doc.text(`Página ${i} de ${total}`, rightX, pageH - 8, { align: 'right' });
  }

  doc.save(timestampedName('ventas'));
}
