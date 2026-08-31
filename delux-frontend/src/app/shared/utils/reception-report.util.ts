import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PdfLogo } from './export.util';

/**
 * Reporte PDF detallado del "Historial de recepciones" (entradas de mercadería).
 *
 * Pensado para conciliar contra la factura del proveedor: por cada recepción se
 * imprime su encabezado (código, fecha, proveedor, sucursal, usuario que la
 * registró) y la tabla de productos con cantidad, costo unitario y subtotal, más
 * los totales generales del período/filtros aplicados.
 *
 * Diseño en BLANCO Y NEGRO / escala de grises, con el mismo header (logo + datos)
 * del resto de PDFs de la app. Reutiliza el tipo `PdfLogo`.
 */

export interface ReceptionReportItem {
  code: string;      // SKU interno
  product: string;
  variant: string;   // talla / color
  qty: number;
  unitCost: number;
}

export interface ReceptionReportRow {
  code: string;
  date: string;      // ISO
  supplier: string;
  branch: string;
  user: string;
  items: ReceptionReportItem[];
  totalUnits: number;
  totalCost: number;
}

export interface ReceptionReportData {
  storeName: string;
  brandName: string;
  logo: PdfLogo | null;
  range: { from: string; to: string };
  /** Texto de filtros aplicados (proveedor / usuario), o '' si ninguno. */
  filters: string;
  receptions: ReceptionReportRow[];
  grandUnits: number;
  grandCost: number;
}

// ─── Escala de grises ───
const C_SECTION: [number, number, number] = [0, 0, 0];
const C_HEAD: [number, number, number] = [0, 0, 0];
const C_TEXT: [number, number, number] = [20, 20, 20];
const C_MUTED: [number, number, number] = [110, 110, 110];
const C_LINE: [number, number, number] = [200, 200, 200];
const C_ALT: [number, number, number] = [244, 244, 244];

const MARGIN = 14;

function money(n: number): string {
  return '$' + (Number(n) || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || '—');
  }
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Salta de página si no cabe el bloque; devuelve la Y a usar. */
function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - 16) { doc.addPage(); return 20; }
  return y;
}

/** Descarga el PDF de recepciones. */
export function exportReceptionsPdf(d: ReceptionReportData): void {
  const stamp = new Date().toISOString().slice(0, 10);
  buildReceptionsDoc(d).save(`recepciones_${stamp}.pdf`);
}

/** El mismo PDF como Blob, para compartirlo por la hoja nativa. */
export function receptionsPdfBlob(d: ReceptionReportData): Blob {
  return buildReceptionsDoc(d).output('blob');
}

function buildReceptionsDoc(d: ReceptionReportData): jsPDF {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  // ─── Header (logo + título + meta) ───
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
  doc.text('Reporte de recepciones', textX, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C_MUTED);
  const meta = [
    d.storeName,
    `Período: ${fmtDay(d.range.from) || '—'} a ${fmtDay(d.range.to) || '—'}`,
  ];
  if (d.filters) meta.push(d.filters);
  meta.push(`Generado: ${new Date().toLocaleString('es-EC')}  ·  ${d.receptions.length} recepción(es)`);
  doc.text(meta, textX, 22);

  let y = Math.max(9 + (d.logo ? d.logo.height : 0) + 4, 22 + meta.length * 4 + 2);
  doc.setDrawColor(...C_LINE);
  doc.line(MARGIN, y, pageW - MARGIN, y);
  y += 6;

  if (!d.receptions.length) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...C_MUTED);
    doc.text('No hay recepciones con los filtros seleccionados.', MARGIN, y + 4);
  }

  // ─── Una sección por recepción ───
  for (const r of d.receptions) {
    y = ensureSpace(doc, y, 34);

    // Barra de encabezado de la recepción (código izq. / fecha der.)
    const barH = 8;
    doc.setFillColor(...C_SECTION);
    doc.rect(MARGIN, y, pageW - MARGIN * 2, barH, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(r.code || 'Recepción', MARGIN + 2, y + 5.6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(fmtDate(r.date), pageW - MARGIN - 2, y + 5.6, { align: 'right' });
    y += barH + 1.5;

    // Sub-línea: proveedor · sucursal · usuario
    doc.setTextColor(...C_TEXT);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(
      `Proveedor: ${r.supplier || '—'}    ·    Sucursal: ${r.branch || '—'}    ·    Registró: ${r.user || '—'}`,
      MARGIN + 1, y + 3,
    );
    y += 6;

    // Tabla de ítems
    autoTable(doc, {
      startY: y,
      head: [['Código', 'Producto', 'Variante', 'Cant.', 'Costo unit.', 'Subtotal']],
      body: r.items.map(it => [
        it.code || '—',
        it.product || '—',
        it.variant || '—',
        String(it.qty),
        money(it.unitCost),
        money(it.qty * it.unitCost),
      ]),
      foot: [[
        { content: 'Subtotal recepción', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: String(r.totalUnits), styles: { halign: 'center', fontStyle: 'bold' } },
        { content: '', styles: {} },
        { content: money(r.totalCost), styles: { halign: 'right', fontStyle: 'bold' } },
      ]],
      theme: 'grid',
      margin: { left: MARGIN, right: MARGIN },
      styles: { fontSize: 8, cellPadding: 1.6, textColor: C_TEXT, lineColor: C_LINE, lineWidth: 0.1 },
      headStyles: { fillColor: C_HEAD, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      footStyles: { fillColor: C_ALT, textColor: C_TEXT },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: {
        0: { cellWidth: 24 },
        3: { halign: 'center', cellWidth: 14 },
        4: { halign: 'right', cellWidth: 24 },
        5: { halign: 'right', cellWidth: 26 },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 7;
  }

  // ─── Totales generales ───
  if (d.receptions.length) {
    y = ensureSpace(doc, y, 20);
    doc.setDrawColor(...C_LINE);
    doc.line(MARGIN, y, pageW - MARGIN, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C_TEXT);
    doc.text(`Recepciones: ${d.receptions.length}`, MARGIN, y);
    doc.text(`Unidades: ${d.grandUnits}`, pageW / 2 - 10, y);
    doc.text(`Costo total: ${money(d.grandCost)}`, pageW - MARGIN, y, { align: 'right' });
  }

  // ─── Pie de página con numeración ───
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C_MUTED);
    doc.text(d.brandName || '', MARGIN, pageH - 8);
    doc.text(`Página ${i} de ${pages}`, pageW - MARGIN, pageH - 8, { align: 'right' });
  }

  return doc;
}
