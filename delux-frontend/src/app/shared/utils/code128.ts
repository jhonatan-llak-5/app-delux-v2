/**
 * Generador de código de barras Code128-B en SVG (sin dependencias).
 * Suficiente para imprimir etiquetas escaneables con códigos alfanuméricos
 * como "P00000249". Devuelve una cadena <svg>...</svg>.
 */
const PATTERNS = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
  '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
  '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
  '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
  '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
  '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
  '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
  '114131','311141','411131','211412','211214','211232','2331112',
];

const START_B = 104;
const STOP = 106;

export function code128BSvg(
  data: string,
  opts: { height?: number; moduleWidth?: number; margin?: number } = {},
): string {
  const height = opts.height ?? 60;
  const mw = opts.moduleWidth ?? 2;
  const margin = opts.margin ?? 10;

  const clean = (data || '').replace(/[^\x20-\x7E]/g, '');
  const values: number[] = [START_B];
  let sum = START_B;
  for (let i = 0; i < clean.length; i++) {
    const v = clean.charCodeAt(i) - 32;
    values.push(v);
    sum += v * (i + 1);
  }
  values.push(sum % 103);
  values.push(STOP);

  let widths = '';
  for (const v of values) widths += PATTERNS[v];

  let x = margin;
  let isBar = true;
  let rects = '';
  for (const ch of widths) {
    const w = parseInt(ch, 10) * mw;
    if (isBar) {
      rects += `<rect x="${x}" y="0" width="${w}" height="${height}" fill="#000"/>`;
    }
    x += w;
    isBar = !isBar;
  }
  const totalW = x + margin;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${height}" width="100%" preserveAspectRatio="xMidYMid meet">${rects}</svg>`;
}
