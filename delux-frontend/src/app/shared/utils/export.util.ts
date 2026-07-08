import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

/**
 * Columna de exportación. `key` puede ser el nombre de la propiedad
 * o una función que deriva el valor de la fila.
 */
export interface ExportColumn<T = any> {
  header: string;
  key: keyof T | ((row: T) => string | number | null | undefined);
}

export interface PdfLogo {
  dataUrl: string;
  /** Ancho y alto en mm ya escalados (mantén proporción antes de pasarlos). */
  width: number;
  height: number;
  format?: 'PNG' | 'JPEG';
}

export interface PdfOptions {
  title?: string;
  subtitle?: string;
  orientation?: 'p' | 'l';
  logo?: PdfLogo | null;
  brandName?: string;
}

function cell<T>(row: T, col: ExportColumn<T>): string {
  const v = typeof col.key === 'function' ? col.key(row) : (row as any)[col.key];
  return v == null ? '' : String(v);
}

function timestampedName(base: string, ext: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `${base}_${stamp}.${ext}`;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Exporta a CSV (UTF-8 con BOM para Excel/tildes). */
export function exportCsv<T>(rows: T[], columns: ExportColumn<T>[], filename: string): void {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const head = columns.map(c => esc(c.header)).join(',');
  const body = rows.map(r => columns.map(c => esc(cell(r, c))).join(',')).join('\r\n');
  const csv = '﻿' + head + '\r\n' + body;
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), timestampedName(filename, 'csv'));
}

/** Exporta a Excel (.xlsx) con anchos de columna automáticos. */
export function exportXlsx<T>(rows: T[], columns: ExportColumn<T>[], filename: string, sheetName = 'Datos'): void {
  const aoa: (string | number)[][] = [columns.map(c => c.header)];
  for (const r of rows) aoa.push(columns.map(c => cell(r, c)));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Anchos aproximados según contenido.
  ws['!cols'] = columns.map((c, i) => {
    const max = Math.max(c.header.length, ...rows.map(r => cell(r, columns[i]).length));
    return { wch: Math.min(Math.max(max + 2, 10), 40) };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, timestampedName(filename, 'xlsx'));
}

/** Exporta a PDF con encabezado (título + fecha) y tabla formateada. */
export function exportPdf<T>(rows: T[], columns: ExportColumn<T>[], filename: string, opts: PdfOptions = {}): void {
  const doc = new jsPDF({ orientation: opts.orientation || 'p', unit: 'mm', format: 'a4' });
  const title = opts.title || filename;
  let textX = 14;
  let startY = 26;

  // Logo (si se provee) arriba a la izquierda; el título se corre a su derecha.
  if (opts.logo) {
    try {
      doc.addImage(opts.logo.dataUrl, opts.logo.format || 'PNG', 14, 9, opts.logo.width, opts.logo.height);
      textX = 14 + opts.logo.width + 5;
      startY = Math.max(startY, 9 + opts.logo.height + 4);
    } catch { /* si falla, seguimos con texto */ }
  }

  doc.setFontSize(15);
  doc.setTextColor(30, 58, 138);
  doc.text(title, textX, 16);
  doc.setFontSize(9);
  doc.setTextColor(100);
  const meta = `Generado: ${new Date().toLocaleString('es-EC')}  ·  ${rows.length} registro(s)`;
  const sub = opts.subtitle ? `${opts.subtitle}  —  ${meta}` : meta;
  doc.text(opts.brandName ? `${opts.brandName}  ·  ${sub}` : sub, textX, 22);

  autoTable(doc, {
    startY,
    head: [columns.map(c => c.header)],
    body: rows.map(r => columns.map(c => cell(r, c))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [241, 245, 249] },
    margin: { left: 14, right: 14 },
  });

  doc.save(timestampedName(filename, 'pdf'));
}
