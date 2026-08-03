import { Order } from '@features/superadmin/services/order.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Datos del negocio (emisor) que van en el encabezado del comprobante.
 * Se leen del BrandingService (public-config) y se pasan al construir el PDF.
 */
export interface ReceiptBusiness {
  tradeName: string;   // Nombre comercial (site_name), p.ej. "DE LUX"
  legalName: string;   // Razón social
  ruc: string;
  address: string;
  phone: string;
  taxRate: number;     // % IVA (15)
}

function money(v: any): string {
  const n = Number(v);
  return (isNaN(n) ? 0 : n).toFixed(2);
}

function fmtDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function fmtDateTime(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleString('es-EC', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });
}

/**
 * Construye el COMPROBANTE DE VENTA en formato de recibo para impresora
 * térmica (ancho ~80 mm). Un solo formato, usado en el POS y en el detalle
 * de venta. Réplica del recibo del cliente: encabezado del emisor, datos de
 * la factura y del cliente, ítems, totales (Neto + IVA), vendedor y la
 * autorización / clave de acceso del SRI.
 */
function buildReceiptDoc(order: Order, biz?: Partial<ReceiptBusiness>): jsPDF {
  const W = 80;                 // ancho del papel (mm)
  const L = 4, R = W - 4;       // márgenes
  const C = W / 2;              // centro
  const rate = (biz?.taxRate != null && !isNaN(+biz.taxRate) ? +biz.taxRate : 15) / 100;

  // Altura estimada para no desperdiciar papel (crece con los ítems).
  const nItems = order.items?.length || 0;
  const height = Math.max(162, 132 + nItems * 9);
  const doc = new jsPDF({ unit: 'mm', format: [W, height] });

  let y = 11;   // margen superior
  const line = () => { doc.setLineWidth(0.2); doc.line(L, y, R, y); y += 3.5; };

  // ── Encabezado del emisor (TODO en negrilla) ──
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text((biz?.tradeName || 'DELUX').toUpperCase(), C, y, { align: 'center' }); y += 5;
  doc.setFontSize(8);   // sigue en 'bold'
  if (biz?.legalName) {
    const ln = doc.splitTextToSize(biz.legalName.toUpperCase(), R - L);
    doc.text(ln, C, y, { align: 'center' }); y += 3.5 * ln.length;
  }
  if (biz?.ruc) { doc.text(`RUC: ${biz.ruc}`, C, y, { align: 'center' }); y += 3.5; }
  if (biz?.phone) { doc.text(`TLF: ${biz.phone}`, C, y, { align: 'center' }); y += 3.5; }
  if (biz?.address) {
    const addr = doc.splitTextToSize(biz.address.toUpperCase(), R - L);
    doc.text(addr, C, y, { align: 'center' }); y += 3.5 * addr.length;
  }
  doc.setFont('helvetica', 'normal');
  y += 4;   // solo espacio, sin línea (el original no lleva línea bajo el encabezado)

  // ── Datos de la factura / cliente ──
  doc.setFontSize(8);
  const row = (label: string, value: string, boldLabel = false) => {
    doc.setFont('helvetica', boldLabel ? 'bold' : 'normal');
    doc.text(label, L, y);
    const lbW = doc.getTextWidth(label) + 1.6;   // separación clara etiqueta/valor
    doc.setFont('helvetica', 'normal');
    const val = doc.splitTextToSize(value, R - L - lbW);
    doc.text(val, L + lbW, y); y += 3.6 * val.length;
  };
  // ¿Consumidor Final? (sin identificación real o con el placeholder del SRI).
  const docId = (order.customer_document || '').trim();
  const isCF = !docId || docId === '9999999999999';
  // Dirección del CLIENTE (no la sucursal); ciudad como respaldo.
  const custAddr = (order.customer_address || order.customer_city || '').trim();
  // Teléfono real del cliente; para Consumidor Final el placeholder del SRI.
  const custTlf = (order.customer_phone || '').trim() || (isCF ? '9999999999' : '—');

  row('Factura Electrónica N°: ', order.invoice_number || 'En proceso', true);
  row('Emisión: ', fmtDate(order.created_at));
  row('Cliente: ', (order.customer_name || 'CONSUMIDOR FINAL').toUpperCase());
  row('Direcc: ', custAddr || '—');
  row('RUC/CI: ', docId || '9999999999999');
  row('Tlf: ', custTlf);
  y += 1; line();

  // ── Ítems (precios sin IVA, estilo factura) ──
  autoTable(doc, {
    startY: y,
    head: [['Cant.', 'Descrip.', 'P.Unit', 'Total']],
    body: (order.items || []).map(it => {
      const desc = it.sku || `${it.size || ''}${it.color ? ' ' + it.color : ''}`.trim() || it.product_name;
      const baseUnit = Number(it.unit_price) / (1 + rate);
      const baseTot = Number(it.subtotal) / (1 + rate);
      return [String(it.quantity), desc, money(baseUnit), money(baseTot)];
    }),
    theme: 'plain',
    margin: { left: L, right: L },
    styles: { fontSize: 7.5, cellPadding: 0.6, textColor: [0, 0, 0] },
    headStyles: { fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 8, halign: 'left' },
      1: { cellWidth: 36, halign: 'left' },
      2: { cellWidth: 14, halign: 'right' },
      3: { cellWidth: 14, halign: 'right' },
    },
    // Fuerza que el ENCABEZADO de P.Unit y Total también vaya a la derecha,
    // alineado con sus valores (algunas versiones no lo heredan de columnStyles).
    didParseCell: (data: any) => {
      if (data.section === 'head' && (data.column.index === 2 || data.column.index === 3)) {
        data.cell.styles.halign = 'right';
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 2;
  line();

  // ── Totales (Neto + IVA = Total) ──
  // El IVA se CALCULA desde el total y la tasa (igual que el SRI): los precios
  // incluyen IVA, así que neto = total / (1 + tasa) e IVA = total − neto.
  // Solo si el backend trae un impuesto ya calculado (> 0) se respeta ese valor.
  const total = Number(order.total) || 0;
  const iva = (order.tax != null && +order.tax > 0) ? +order.tax : (total - total / (1 + rate));
  const neto = total - iva;
  const discount = Number(order.discount) || 0;
  const subTotal = neto + discount;
  const ivaPct = Math.round(rate * 100);

  doc.setFontSize(8.5);
  // Etiqueta a la IZQUIERDA (a media hoja) EN NEGRILLA y valor a la DERECHA,
  // para que la columna de montos quede perfectamente alineada.
  const totLabelX = R - 32;
  const tot = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, totLabelX, y, { align: 'left' });
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(`${value}`, R, y, { align: 'right' });
    y += 4;
  };
  tot('SubTotal', money(subTotal));
  tot('Dscto.', money(discount));
  tot('Neto', money(neto));
  tot(`${ivaPct}% IVA`, money(iva));
  tot('Total', money(total), true);
  y += 1; line();

  // ── Vendedor / entrega / fecha ──
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  const units = (order.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  doc.text(`Artículos entregados: ${units}`, L, y); y += 3.6;
  // Vendedor: nombre del vendedor; en ventas web (sin vendedor) muestra "Venta web".
  const sellerLabel = order.seller_name || ((order as any).channel === 'WEB' ? 'Venta web' : '—');
  doc.text(`Vendedor: ${sellerLabel}`, L, y); y += 3.6;
  doc.text(fmtDateTime(order.created_at), L, y); y += 4;

  // ── Firma cliente ──
  // Más espacio arriba de la línea para que el cliente tenga dónde firmar.
  y += 12;
  doc.setLineWidth(0.2); doc.line(C - 22, y, C + 22, y); y += 3.5;
  doc.text('Cliente', C, y, { align: 'center' }); y += 5;

  // ── Pie: cambios + autorización ──
  doc.setFontSize(7);
  const changes = doc.splitTextToSize('Para cambios es INDISPENSABLE presentar este documento', R - L);
  doc.text(changes, C, y, { align: 'center' }); y += 3.2 * changes.length + 1;

  const auth = order.invoice_access_key || order.invoice_authorization || '';
  if (auth) {
    doc.setFont('helvetica', 'bold');
    doc.text('AUTORIZACIÓN / CLAVE ACCESO', C, y, { align: 'center' }); y += 3.4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
    const wrapped = doc.splitTextToSize(auth, R - L);
    doc.text(wrapped, C, y, { align: 'center' }); y += 3 * wrapped.length;
  }

  return doc;
}

/** Descarga el comprobante como PDF. */
export function generateVoucherPDF(order: Order, biz?: Partial<ReceiptBusiness>): void {
  buildReceiptDoc(order, biz).save(`comprobante-${order.code}.pdf`);
}

/**
 * Abre el comprobante y lanza el diálogo de impresión del navegador (el usuario
 * elige la impresora térmica). Si el navegador bloquea el popup, descarga el PDF.
 */
export function printVoucherPDF(order: Order, biz?: Partial<ReceiptBusiness>): void {
  const doc = buildReceiptDoc(order, biz);
  try {
    doc.autoPrint();
    const url = doc.output('bloburl');
    const win = window.open(url as any, '_blank');
    if (!win) { doc.save(`comprobante-${order.code}.pdf`); }
  } catch {
    doc.save(`comprobante-${order.code}.pdf`);
  }
}
