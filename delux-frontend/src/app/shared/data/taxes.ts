/**
 * Tasas de IVA según el estándar del SRI (Ecuador), usadas de forma consistente
 * en el formulario de producto y en la Configuración general.
 * (0% incluye los casos de exento / no objeto para efectos de precio de venta.)
 */
export const SRI_IVA_RATES: number[] = [0, 5, 12, 14, 15];

export interface IvaOption { value: number | null; label: string; }

/** Opciones con etiqueta para selectores (incluye "IVA global"). */
export const SRI_IVA_OPTIONS: IvaOption[] = [
  { value: null, label: 'IVA global' },
  { value: 0, label: 'IVA 0%' },
  { value: 5, label: 'IVA 5%' },
  { value: 12, label: 'IVA 12%' },
  { value: 14, label: 'IVA 14%' },
  { value: 15, label: 'IVA 15%' },
];
