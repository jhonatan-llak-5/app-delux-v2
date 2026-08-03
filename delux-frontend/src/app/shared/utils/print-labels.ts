import { code128BSvg } from './code128';

export interface LabelItem {
  sku: string;
  name: string;
  size?: string;
  price: number;
  quantity?: number;
}

/**
 * Abre una ventana de impresión con etiquetas (50×30 mm) para una lista de
 * productos. Diseño: nombre de la tienda arriba-izquierda, precio arriba-derecha
 * con fondo negro y letras blancas, código de barras Code128 a lo ancho, y
 * debajo el código interno y el nombre del producto. Sin QR.
 * Reutilizable en Recepción, historial de recepciones e Inventario/Etiquetas.
 */
export function printProductLabels(
  items: LabelItem[],
  opts: { store?: string; taxRate?: number; onError?: (msg: string) => void } = {},
): void {
  if (typeof window === 'undefined' || !items.length) return;
  const store = (opts.store || 'DELUX').toUpperCase();
  let html = '';
  for (const it of items) {
    const copies = Math.max(1, it.quantity || 1);
    const finalP = (+it.price || 0);  // el precio ya incluye IVA
    const price = '$' + (Math.round(finalP * 100) / 100).toFixed(2);
    const bc = code128BSvg(it.sku, { height: 60, moduleWidth: 1.6, margin: 4 });
    const sizeTxt = it.size ? ('Talla ' + it.size) : '';
    for (let i = 0; i < copies; i++) {
      html += `<div class="lbl">
        <div class="row"><span class="store">${store}</span><span class="price">${price}</span></div>
        <div class="bc">${bc}</div>
        <div class="code">${it.sku}</div>
        <div class="name">${it.name}${sizeTxt ? ' · ' + sizeTxt : ''}</div>
      </div>`;
    }
  }
  const w = window.open('', '_blank', 'width=480,height=640');
  if (!w) { opts.onError?.('Permite las ventanas emergentes para imprimir.'); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas</title>
    <style>
      @page { size: 50mm 30mm; margin: 0; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Arial, sans-serif; }
      .lbl { width: 50mm; height: 30mm; padding: 1.5mm 2mm; page-break-after: always; display: flex; flex-direction: column; justify-content: space-between; }
      .row { display: flex; justify-content: space-between; align-items: center; }
      .store { font-weight: 800; font-size: 9pt; letter-spacing: .5px; }
      .price { font-weight: 800; font-size: 11pt; background: #000; color: #fff; padding: 0 5px; }
      .bc { width: 100%; height: 13mm; }
      .bc svg { height: 100%; width: 100%; }
      .code { font-size: 7pt; text-align: center; letter-spacing: 1px; margin-top: -0.5mm; }
      .name { font-size: 7.5pt; text-align: center; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
