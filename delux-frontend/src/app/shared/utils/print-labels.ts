import { code128BSvg } from './code128';

export interface LabelItem {
  sku: string;
  name: string;
  size?: string;
  price: number;
  quantity?: number;
}

/** Tamaños de etiqueta soportados (ancho x alto en mm). */
export type LabelSizeId = '50x30' | '40x30' | '40x25' | '35x25' | '30x20';

/**
 * Preset de etiqueta: medida física + tipografía/alturas ajustadas para que
 * el contenido quepa sin cortarse. Las medidas van en mm y las fuentes en pt.
 */
export interface LabelSizePreset {
  id: LabelSizeId;
  w: number;
  h: number;
  title: string;
  hint: string;
  /** Muestra el nombre de la tienda (en tamaños muy chicos se omite). */
  showStore: boolean;
  padX: number;
  padY: number;
  storePt: number;
  pricePt: number;
  barcodeMm: number;
  codePt: number;
  namePt: number;
}

export const DEFAULT_LABEL_SIZE: LabelSizeId = '50x30';

export const LABEL_SIZES: readonly LabelSizePreset[] = [
  { id: '50x30', w: 50, h: 30, title: '50 × 30 mm', hint: 'Ropa, calzado y cajas medianas.',
    showStore: true, padX: 2, padY: 1.5, storePt: 9, pricePt: 11, barcodeMm: 13, codePt: 7, namePt: 7.5 },
  { id: '40x30', w: 40, h: 30, title: '40 × 30 mm', hint: 'Uso general, accesorios.',
    showStore: true, padX: 1.5, padY: 1.5, storePt: 8, pricePt: 10, barcodeMm: 12, codePt: 6.5, namePt: 7 },
  { id: '40x25', w: 40, h: 25, title: '40 × 25 mm', hint: 'Accesorios, juguetes, artículos de bazar.',
    showStore: true, padX: 1.5, padY: 1.2, storePt: 7.5, pricePt: 10, barcodeMm: 10, codePt: 6, namePt: 6.5 },
  { id: '35x25', w: 35, h: 25, title: '35 × 25 mm', hint: 'Bisutería, cosméticos, papelería.',
    showStore: true, padX: 1.2, padY: 1.2, storePt: 6.5, pricePt: 9, barcodeMm: 10, codePt: 6, namePt: 6 },
  { id: '30x20', w: 30, h: 20, title: '30 × 20 mm', hint: 'Artículos muy pequeños (sin nombre de tienda).',
    showStore: false, padX: 1, padY: 1, storePt: 6, pricePt: 8, barcodeMm: 8, codePt: 5.5, namePt: 5.5 },
];

/** Devuelve el preset para un id (o el de 50×30 si no es válido). */
export function labelSizePreset(id?: string | null): LabelSizePreset {
  return LABEL_SIZES.find(s => s.id === id) ?? LABEL_SIZES.find(s => s.id === DEFAULT_LABEL_SIZE)!;
}

function esc(v: string): string {
  return String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c]);
}

/**
 * Abre una ventana de impresión con etiquetas para una lista de productos.
 * El tamaño sale de la configuración global (`opts.size`, por defecto 50×30).
 * Diseño: nombre de la tienda arriba-izquierda, precio arriba-derecha
 * con fondo negro y letras blancas, código de barras Code128 a lo ancho, y
 * debajo el código interno y el nombre del producto. Sin QR.
 * Reutilizable en Recepción, historial de recepciones e Inventario/Etiquetas.
 */
export function printProductLabels(
  items: LabelItem[],
  opts: { store?: string; taxRate?: number; size?: string | null; onError?: (msg: string) => void } = {},
): void {
  if (typeof window === 'undefined' || !items.length) return;
  const p = labelSizePreset(opts.size);
  const store = esc((opts.store || 'DELUX').toUpperCase());
  let html = '';
  for (const it of items) {
    const copies = Math.max(1, it.quantity || 1);
    const finalP = (+it.price || 0);  // el precio ya incluye IVA
    const price = '$' + (Math.round(finalP * 100) / 100).toFixed(2);
    const bc = code128BSvg(it.sku, { height: 60, moduleWidth: 1.6, margin: p.w < 40 ? 2 : 4 });
    const sizeTxt = it.size ? ('Talla ' + it.size) : '';
    for (let i = 0; i < copies; i++) {
      html += `<div class="lbl">
        <div class="row">${p.showStore ? `<span class="store">${store}</span>` : '<span></span>'}<span class="price">${price}</span></div>
        <div class="bc">${bc}</div>
        <div class="code">${esc(it.sku)}</div>
        <div class="name">${esc(it.name)}${sizeTxt ? ' · ' + esc(sizeTxt) : ''}</div>
      </div>`;
    }
  }
  const w = window.open('', '_blank', 'width=480,height=640');
  if (!w) { opts.onError?.('Permite las ventanas emergentes para imprimir.'); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas ${p.w}x${p.h}</title>
    <style>
      @page { size: ${p.w}mm ${p.h}mm; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; width: ${p.w}mm; }
      body { font-family: Arial, sans-serif; }
      .lbl { width: ${p.w}mm; height: ${p.h}mm; padding: ${p.padY}mm ${p.padX}mm; overflow: hidden; page-break-after: always; break-after: page; display: flex; flex-direction: column; justify-content: space-between; }
      .row { display: flex; justify-content: space-between; align-items: center; gap: 1mm; min-width: 0; }
      .store { font-weight: 800; font-size: ${p.storePt}pt; letter-spacing: .5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
      .price { font-weight: 800; font-size: ${p.pricePt}pt; background: #000; color: #fff; padding: 0 1.2mm; white-space: nowrap; flex-shrink: 0; }
      .bc { width: 100%; height: ${p.barcodeMm}mm; }
      .bc svg { height: 100%; width: 100%; }
      .code { font-size: ${p.codePt}pt; text-align: center; letter-spacing: 1px; margin-top: -0.5mm; line-height: 1.1; }
      .name { font-size: ${p.namePt}pt; text-align: center; font-weight: 600; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    </style></head><body>${html}
    <scr`+`ipt>
      window.onload=function(){
        var imgs=document.images, left=imgs.length;
        if(!left){ window.print(); return; }
        function done(){ if(--left<=0) window.print(); }
        for(var i=0;i<imgs.length;i++){ if(imgs[i].complete) done(); else { imgs[i].onload=done; imgs[i].onerror=done; } }
      };
    </scr`+`ipt></body></html>`);
  w.document.close();
}
