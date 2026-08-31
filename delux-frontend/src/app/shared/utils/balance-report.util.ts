import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PdfLogo } from './export.util';

/**
 * Reporte PDF dedicado del módulo "Balance general" (Ingresos y egresos).
 *
 * Diseño en BLANCO Y NEGRO / escala de grises, organizado por secciones con
 * encabezado propio (no repite el nombre de sección en cada fila):
 *   1. RESUMEN
 *   2. VENTAS POR FORMA DE PAGO  (efectivo / tarjeta / transferencia)
 *   3. TRANSACCIONES  (con subtotales de ingresos / egresos / balance)
 *   4. PRODUCTOS MÁS VENDIDOS
 *   5. RECEPCIÓN DE MERCADERÍA
 *
 * No modifica ni depende de la utilidad genérica `exportPdf`; sólo reutiliza
 * el tipo `PdfLogo` para incrustar el logo tal como lo hace el resto de la app.
 */

export interface BalanceTopProduct {
  product: string;
  qty: number;
  revenue: number;
}

export interface BalancePayMethod {
  label: string;
  total: number;
  count: number;
}

export interface BalanceTxnRow {
  kind: 'INGRESO' | 'EGRESO';
  date: string;
  concept: string;
  party: string;
  method: string;
  amount: number;
}

export interface BalanceReportData {
  /** Nombre de tienda · sucursal para la cabecera y el pie. */
  storeName: string;
  /** Nombre de marca (branding) para el pie de página. */
  brandName: string;
  /** Logo ya escalado (mm) o null si no hay. */
  logo: PdfLogo | null;
  range: { from: string; to: string };
  ventas: number;
  gastos: number;
  balance: number;
  orders: number;
  compras: number;
  comprasUnits: number;
  topProducts: BalanceTopProduct[];
  /** Ventas desglosadas por forma de pago. Opcional por compatibilidad. */
  payMethods?: BalancePayMethod[];
  txns: BalanceTxnRow[];
  ingresosTotal: number;
  egresosTotal: number;
  txnBalance: number;
}

// ─── Colores en escala de grises ───
const C_SECTION: [number, number, number] = [38, 38, 38];   // barra de sección
const C_HEAD: [number, number, number] = [55, 55, 55];      // encabezado de tabla
const C_TEXT: [number, number, number] = [20, 20, 20];      // texto principal
const C_MUTED: [number, number, number] = [110, 110, 110];  // texto secundario
const C_LINE: [number, number, number] = [200, 200, 200];   // líneas finas
const C_ALT: [number, number, number] = [244, 244, 244];    // fila alterna
const C_HILITE: [number, number, number] = [225, 225, 225]; // fila destacada

const MARGIN = 14;
const TOP_CONT = 20; // margen superior en páginas continuadas

function money(n: number): string {
  return '$' + (Number(n) || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDay(iso: string): string {
  // Espera YYYY-MM-DD; devuelve DD/MM/YYYY.
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

/** Barra de sección gris oscuro con texto blanco. Devuelve la Y después de la barra. */
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

/** Garantiza espacio vertical; si no cabe, salta de página y devuelve la Y superior. */
function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - 16) {
    doc.addPage();
    return TOP_CONT;
  }
  return y;
}

function timestampedName(base: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${base}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.pdf`;
}

/** Genera y descarga el PDF del Balance general. */
/** Descarga el PDF del Balance general. */
export function exportBalancePdf(d: BalanceReportData): void {
  buildBalanceDoc(d).save(timestampedName('balance'));
}

/** El mismo PDF como Blob, para compartirlo por la hoja nativa. */
export function balancePdfBlob(d: BalanceReportData): Blob {
  return buildBalanceDoc(d).output('blob');
}

function buildBalanceDoc(d: BalanceReportData): jsPDF {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const rightX = pageW - MARGIN;

  // ── Cabecera del reporte ──
  let textX = MARGIN;
  if (d.logo) {
    try {
      doc.addImage(d.logo.dataUrl, d.logo.format || 'PNG', MARGIN, 9, d.logo.width, d.logo.height);
      textX = MARGIN + d.logo.width + 5;
    } catch { /* si falla el logo, seguimos con texto */ }
  }

  doc.setTextColor(...C_TEXT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Balance general', textX, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C_MUTED);
  const metaLines = [
    d.storeName,
    `Período: ${fmtDay(d.range.from)} a ${fmtDay(d.range.to)}`,
    `Generado: ${new Date().toLocaleString('es-EC')}  ·  ${d.txns.length} registro(s)`,
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
  y = ensureSpace(doc, y, 60);
  y = sectionBar(doc, 'Resumen', y);
  const resumenBody = [
    ['Ventas totales', money(d.ventas)],
    ['Gastos totales', money(d.gastos)],
    ['Balance (Ventas - Gastos)', money(d.balance)],
    ['Número de ventas', String(d.orders)],
    ['Recepción de mercadería', `${money(d.compras)}  ·  ${d.comprasUnits} u`],
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
      const row = data.row.index;
      if (row === 2) { // Balance destacado
        data.cell.styles.fillColor = C_HILITE;
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 9;
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 3;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...C_MUTED);
  doc.text('Nota: la recepción de mercadería es inversión en inventario y no afecta el balance.', MARGIN, y);
  y += 8;

  // ── 2. VENTAS POR FORMA DE PAGO ──
  const pays = (d.payMethods ?? []).filter(p => p.count > 0 || p.total !== 0);
  if (pays.length) {
    y = ensureSpace(doc, y, 40);
    y = sectionBar(doc, 'Ventas por forma de pago', y);
    const payTotal = pays.reduce((a, p) => a + p.total, 0);
    autoTable(doc, {
      startY: y,
      theme: tableTheme,
      head: [['Forma de pago', 'N.º de ventas', '% del total', 'Total']],
      body: pays.map(p => [
        p.label,
        String(p.count),
        payTotal ? ((p.total / payTotal) * 100).toFixed(1) + '%' : '0%',
        money(p.total),
      ]),
      foot: [['Total', String(pays.reduce((a, p) => a + p.count, 0)), '100%', money(payTotal)]],
      showFoot: 'lastPage',
      styles: baseStyles,
      headStyles,
      footStyles: { fillColor: [235, 235, 235], textColor: C_TEXT, fontStyle: 'bold', halign: 'right' },
      alternateRowStyles: { fillColor: C_ALT },
      margin: { left: MARGIN, right: MARGIN, top: TOP_CONT },
      columnStyles: {
        0: { cellWidth: (pageW - MARGIN * 2) * 0.4, fontStyle: 'bold' },
        1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── 3. TRANSACCIONES ──
  y = ensureSpace(doc, y, 40);
  y = sectionBar(doc, 'Transacciones', y);
  const txnBody = d.txns.map(t => [
    fmtDateTime(t.date),
    t.concept + (t.party ? `\n${t.party}` : ''),
    t.kind === 'INGRESO' ? 'Ingreso' : 'Egreso',
    (t.kind === 'INGRESO' ? '+' : '-') + money(t.amount),
  ]);
  autoTable(doc, {
    startY: y,
    theme: tableTheme,
    head: [['Fecha', 'Concepto', 'Tipo', 'Valor']],
    body: txnBody.length ? txnBody : [['—', 'Sin transacciones en el período', '—', '—']],
    foot: [
      ['', '', 'Total ingresos', '+' + money(d.ingresosTotal)],
      ['', '', 'Total egresos', '-' + money(d.egresosTotal)],
      ['', '', 'Balance', money(d.txnBalance)],
    ],
    showFoot: 'lastPage',
    styles: baseStyles,
    headStyles,
    footStyles: { fillColor: [235, 235, 235], textColor: C_TEXT, fontStyle: 'bold', halign: 'right' },
    alternateRowStyles: { fillColor: C_ALT },
    margin: { left: MARGIN, right: MARGIN, top: TOP_CONT },
    columnStyles: {
      0: { cellWidth: 34 },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── 3. PRODUCTOS MÁS VENDIDOS ──
  y = ensureSpace(doc, y, 40);
  y = sectionBar(doc, 'Productos más vendidos', y);
  const topBody = d.topProducts.map((p, i) => [
    String(i + 1),
    p.product,
    String(p.qty),
    money(p.revenue),
  ]);
  autoTable(doc, {
    startY: y,
    theme: tableTheme,
    head: [['#', 'Producto', 'Unidades', 'Valor']],
    body: topBody.length ? topBody : [['—', 'Sin ventas en el período', '—', '—']],
    styles: baseStyles,
    headStyles,
    alternateRowStyles: { fillColor: C_ALT },
    margin: { left: MARGIN, right: MARGIN, top: TOP_CONT },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      2: { cellWidth: 26, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── 4. RECEPCIÓN DE MERCADERÍA ──
  y = ensureSpace(doc, y, 34);
  y = sectionBar(doc, 'Recepción de mercadería', y);
  autoTable(doc, {
    startY: y,
    theme: tableTheme,
    body: [
      ['Valor total recibido', money(d.compras)],
      ['Unidades recibidas', `${d.comprasUnits} u`],
    ],
    styles: baseStyles,
    margin: { left: MARGIN, right: MARGIN, top: TOP_CONT },
    columnStyles: {
      0: { cellWidth: (pageW - MARGIN * 2) * 0.62, fontStyle: 'bold' },
      1: { halign: 'right' },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 3;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...C_MUTED);
  doc.text(
    'Inversión en inventario del período. No afecta el balance de ingresos y egresos.',
    MARGIN, y,
  );

  // ── Pie de página (número de página + tienda) en todas las páginas ──
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

  return doc;
}
