import { Pipe, PipeTransform } from '@angular/core';

/** Etiquetas y colores canónicos para el estado de un pedido/venta. */
const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente', PAID: 'Pagada', PREPARING: 'Preparando', READY: 'Lista',
  SHIPPED: 'Enviada', DELIVERED: 'Entregada', CANCELLED: 'Cancelada', REFUNDED: 'Devuelta',
};

const ORDER_STATUS_CLASSES: Record<string, string> = {
  PENDING:   'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  PAID:      'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  PREPARING: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  READY:     'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
  SHIPPED:   'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
  DELIVERED: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
  CANCELLED: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  REFUNDED:  'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
};
const ORDER_STATUS_DEFAULT = 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white/70';

@Pipe({ name: 'orderStatusLabel', standalone: true })
export class OrderStatusLabelPipe implements PipeTransform {
  transform(s: string | null | undefined): string { return (s && ORDER_STATUS_LABELS[s]) || s || ''; }
}

@Pipe({ name: 'orderStatusClass', standalone: true })
export class OrderStatusClassPipe implements PipeTransform {
  transform(s: string | null | undefined): string { return (s && ORDER_STATUS_CLASSES[s]) || ORDER_STATUS_DEFAULT; }
}
