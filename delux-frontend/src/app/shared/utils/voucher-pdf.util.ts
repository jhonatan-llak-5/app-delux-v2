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
  environment: string; // Ambiente SRI configurado: 'TEST' | 'PROD'
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

/** Fecha + hora corta (dd/mm/aaaa hh:mm), para la línea de emisión del RIDE. */
function fmtDateHm(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${fmtDate(iso)} ${hh}:${mi}`;
}

/**
 * Ambiente SRI del comprobante. Manda la clave de acceso — su dígito 24 es el
 * ambiente (1 = pruebas, 2 = producción) y es justo lo que ve el SRI. Si la
 * clave todavía no llegó, se usa el ambiente configurado en Ajustes.
 */
function sriEnvironment(accessKey: string, configured?: string): string {
  const d = accessKey.length === 49 ? accessKey.charAt(23) : '';
  if (d === '1') return 'PRUEBAS';
  if (d === '2') return 'PRODUCCIÓN';
  const c = (configured || '').toUpperCase();
  if (c.startsWith('PROD')) return 'PRODUCCIÓN';
  if (c === 'TEST' || c.startsWith('PRUEB')) return 'PRUEBAS';
  return '';
}

/** Tipo de emisión SRI: dígito 48 de la clave de acceso (1 = NORMAL). */
function sriEmissionType(accessKey: string): string {
  const d = accessKey.length === 49 ? accessKey.charAt(47) : '';
  return (!d || d === '1') ? 'NORMAL' : 'INDISPONIBILIDAD';
}

/**
 * Construye el COMPROBANTE DE VENTA en formato de recibo para impresora
 * térmica (ancho ~80 mm). Un solo formato, usado en el POS y en el detalle
 * de venta. Réplica del recibo del cliente: encabezado del emisor, datos de
 * la factura y del cliente, ítems, totales (Neto + IVA), vendedor y la
 * autorización / clave de acceso del SRI.
 */
function renderReceipt(
  order: Order, biz: Partial<ReceiptBusiness> | undefined, pageHeight: number,
): { doc: jsPDF; endY: number } {
  const W = 80;                 // ancho del papel (mm)
  const L = 4, R = W - 4;       // márgenes
  const C = W / 2;              // centro
  const rate = (biz?.taxRate != null && !isNaN(+biz.taxRate) ? +biz.taxRate : 15) / 100;

  // ¿Esta venta tiene factura electrónica? Si no se pidió factura, es una
  // simple NOTA DE VENTA (comprobante interno) y NO lleva "Factura N°".
  const st = (order.invoice_status || '').toUpperCase();
  const hasFactura = !!order.invoice_number || ['PROCESSING', 'PENDING_SRI', 'AUTHORIZED'].includes(st);

  const doc = new jsPDF({ unit: 'mm', format: [W, pageHeight] });

  let y = 11;   // margen superior
  // Cada regla lleva un poco de aire arriba y abajo para que el texto no quede pegado.
  const rule = (weight = 0.2) => { y += 1.5; doc.setLineWidth(weight); doc.setDrawColor(0); doc.line(L, y, R, y); y += 5; };
  const dashRule = () => {
    y += 1.5; doc.setLineWidth(0.15); doc.setDrawColor(0);
    doc.setLineDashPattern([0.6, 0.6], 0); doc.line(L, y, R, y);
    doc.setLineDashPattern([], 0); y += 5;
  };

  // ── Encabezado del emisor ──
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text((biz?.tradeName || 'DELUX').toUpperCase(), C, y, { align: 'center' }); y += 5;
  // El encabezado lleva solo el nombre del negocio: el rótulo del tipo de
  // documento se quitó a pedido. La factura ya se identifica por su número
  // ("Factura N°") y por la clave de acceso del pie.
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2);
  const emitter: string[] = [];
  if (biz?.legalName) emitter.push(biz.legalName.toUpperCase());
  if (biz?.ruc) emitter.push(`RUC: ${biz.ruc}`);
  if (biz?.address) emitter.push(biz.address.toUpperCase());
  if (biz?.phone) emitter.push(`Tel: ${biz.phone}`);
  for (const e of emitter) {
    const ln = doc.splitTextToSize(e, R - L);
    doc.text(ln, C, y, { align: 'center' }); y += 3.1 * ln.length;
  }
  y += 2.5; rule(0.4);

  // ── Datos del comprobante / cliente ──
  doc.setFontSize(8);
  const row = (label: string, value: string, boldLabel = false) => {
    doc.setFont('helvetica', boldLabel ? 'bold' : 'normal');
    doc.text(label, L, y);
    const lbW = doc.getTextWidth(label) + 1.6;   // separación clara etiqueta/valor
    doc.setFont('helvetica', 'normal');
    const val = doc.splitTextToSize(value, R - L - lbW);
    doc.text(val, L + lbW, y); y += 4.2 * val.length;
  };
  // ¿Consumidor Final? (sin identificación real o con el placeholder del SRI).
  const docId = (order.customer_document || '').trim();
  const isCF = !docId || docId === '9999999999999';
  const custAddr = (order.customer_address || order.customer_city || '').trim();
  const custTlf = (order.customer_phone || '').trim() || (isCF ? '9999999999' : '—');

  // El N° de venta ya se muestra abajo ("Venta: …"); arriba solo va el N° de
  // factura cuando corresponde (para no duplicar el código).
  if (hasFactura) {
    row('Factura N°: ', order.invoice_number || 'En proceso', true);
  }
  row('Fecha emisión: ', fmtDateHm(order.created_at));
  row('Cliente: ', (order.customer_name || 'CONSUMIDOR FINAL').toUpperCase());
  if (custAddr) row('Direcc: ', custAddr);
  if (hasFactura || docId) row('CI/RUC: ', docId || '9999999999999');
  row('Tel: ', custTlf);
  y += 1; dashRule();

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
  dashRule();

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

  // Total en barra negra (blanco sobre negro) — toque moderno, como la etiqueta.
  y += 1.5;
  doc.setFillColor(0, 0, 0);
  doc.rect(L, y, R - L, 7, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
  doc.text('TOTAL', L + 2.5, y + 4.9);
  doc.text('$' + money(total), R - 2.5, y + 4.9, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  y += 11;

  // ── Vendedor / entrega / fecha ──
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  const units = (order.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  doc.text(`Venta: ${order.code || '—'}`, L, y); y += 4.2;
  doc.text(`Artículos entregados: ${units}`, L, y); y += 4.2;
  // Vendedor: nombre del vendedor; en ventas web (sin vendedor) muestra "Venta web".
  const sellerLabel = order.seller_name || ((order as any).channel === 'WEB' ? 'Venta web' : '—');
  doc.text(`Vendedor: ${sellerLabel}`, L, y); y += 4.2;
  doc.text(fmtDateTime(order.created_at), L, y); y += 5;

  // ── Cierre amable ──
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
  doc.text('¡Gracias por tu compra!', C, y, { align: 'center' }); y += 4;
  doc.setFont('helvetica', 'normal');

  // ── Firma cliente ──
  // Más espacio arriba de la línea para que el cliente tenga dónde firmar.
  y += 13;
  doc.setLineWidth(0.2); doc.line(C - 22, y, C + 22, y); y += 4;
  doc.text('Cliente', C, y, { align: 'center' }); y += 6;

  // ── Pie: cambios + autorización ──
  doc.setFontSize(7);
  const changes = doc.splitTextToSize('Para cambios es INDISPENSABLE presentar este documento', R - L);
  doc.text(changes, C, y, { align: 'center' }); y += 3.2 * changes.length + 1;

  // Pie de identificación de la factura. La clave de acceso llega con el
  // webhook del SRI y puede tardar; mientras tanto se imprime el número de
  // factura, que el backend guarda apenas NovaFactura responde. Así el
  // comprobante nunca sale sin un código con el que ubicar la venta.
  const auth = order.invoice_access_key || order.invoice_authorization || '';
  if (hasFactura && auth) {
    doc.setFont('helvetica', 'bold');
    doc.text('AUTORIZACIÓN / CLAVE ACCESO', C, y, { align: 'center' }); y += 3.4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
    const wrapped = doc.splitTextToSize(auth, R - L);
    doc.text(wrapped, C, y, { align: 'center' }); y += 3 * wrapped.length;
  } else if (hasFactura && order.invoice_number) {
    doc.setFont('helvetica', 'bold');
    doc.text('FACTURA N°', C, y, { align: 'center' }); y += 3.4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    doc.text(order.invoice_number, C, y, { align: 'center' }); y += 3;
  }

  // Ambiente y tipo de emisión: el RIDE del SRI los exige junto a la
  // autorización. Se leen de la propia clave de acceso cuando ya existe y, si
  // todavía no llegó, del ambiente configurado en Ajustes.
  if (hasFactura) {
    const env = sriEnvironment(auth, biz?.environment);
    const parts: string[] = [];
    if (env) parts.push(`AMBIENTE: ${env}`);
    parts.push(`EMISIÓN: ${sriEmissionType(auth)}`);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2);
    y += 1.2;
    doc.text(parts.join('   ·   '), C, y, { align: 'center' }); y += 3;
  }

  return { doc, endY: y };
}

/**
 * Construye el comprobante con el alto EXACTO del contenido: una primera
 * pasada sobre un papel holgado mide dónde termina y la segunda se dibuja ya
 * con esa medida. Así el ticket no sale con palmos de papel en blanco al final
 * ni se corta cuando la venta trae muchos ítems.
 */
function buildReceiptDoc(order: Order, biz?: Partial<ReceiptBusiness>): jsPDF {
  const probe = renderReceipt(order, biz, 600);
  return renderReceipt(order, biz, Math.ceil(probe.endY) + 5).doc;
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
