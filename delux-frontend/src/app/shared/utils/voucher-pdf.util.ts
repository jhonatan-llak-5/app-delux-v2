import { Order } from '@features/superadmin/services/order.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function generateVoucherPDF(order: Order): void {
  const doc = new jsPDF({ unit: 'mm', format: [80, 220] });

  let y = 8;
  const center = 40;

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('DELUX', center, y, { align: 'center' });
  y += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Streetwear premium', center, y, { align: 'center' });
  y += 4;
  doc.text(order.branch_name, center, y, { align: 'center' });
  y += 6;

  doc.setLineWidth(0.2);
  doc.line(4, y, 76, y);
  y += 4;

  // Voucher info
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Voucher #${order.code}`, 4, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.text(`Fecha: ${new Date(order.created_at).toLocaleString('es-EC')}`, 4, y);
  y += 4;
  if (order.customer_name) {
    doc.text(`Cliente: ${order.customer_name}`, 4, y);
    y += 4;
  }
  if (order.seller_name) {
    doc.text(`Vendedor: ${order.seller_name}`, 4, y);
    y += 4;
  }
  y += 2;

  // Items table
  autoTable(doc, {
    startY: y,
    head: [['Producto', 'Cant', 'Precio', 'Total']],
    body: order.items.map(it => [
      `${it.product_name}\n${it.sku} · ${it.size} · ${it.color}`,
      it.quantity.toString(),
      `$${it.unit_price}`,
      `$${it.subtotal}`,
    ]),
    margin: { left: 4, right: 4 },
    styles: { fontSize: 7, cellPadding: 1 },
    headStyles: { fillColor: [11, 14, 22], textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 36 },
      1: { cellWidth: 8, halign: 'center' },
      2: { cellWidth: 14, halign: 'right' },
      3: { cellWidth: 14, halign: 'right' },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // Totals
  doc.setFontSize(9);
  doc.text('Subtotal', 4, y);
  doc.text(`$${order.subtotal}`, 76, y, { align: 'right' });
  y += 4;
  if (+order.tax > 0) {
    doc.text('IVA incluido', 4, y);
    doc.text(`$${order.tax}`, 76, y, { align: 'right' });
    y += 4;
  }
  if (+order.discount > 0) {
    doc.text('Descuento', 4, y);
    doc.text(`-$${order.discount}`, 76, y, { align: 'right' });
    y += 4;
  }
  doc.setLineWidth(0.3);
  doc.line(4, y, 76, y);
  y += 4;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', 4, y);
  doc.text(`$${order.total}`, 76, y, { align: 'right' });
  y += 8;

  // Footer
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('¡Gracias por tu compra!', center, y, { align: 'center' });
  y += 3;
  doc.text('delux.com.ec', center, y, { align: 'center' });

  doc.save(`voucher-${order.code}.pdf`);
}
