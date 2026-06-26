import { HttpErrorResponse } from '@angular/common/http';

export interface ParsedApiError {
  /** Errores por campo: { email: 'Ese correo ya...', username: '...' } */
  fieldErrors: Record<string, string>;
  /** Mensaje general (no asociado a un campo). null si todo fue por campo. */
  message: string | null;
}

const NON_FIELD_KEYS = ['detail', 'non_field_errors', '__all__'];

/**
 * Normaliza el error del API al formato unificado del backend:
 *   { success:false, error:{ code, detail } }
 * donde `detail` puede ser un string (error general) o un objeto
 * { campo: [mensajes] } (errores de validación por campo).
 *
 * Devuelve { fieldErrors, message } para que el formulario muestre cada error
 * bajo su campo y los errores generales en un toast.
 */
export function parseApiError(err: unknown): ParsedApiError {
  const out: ParsedApiError = { fieldErrors: {}, message: null };

  const body = (err instanceof HttpErrorResponse) ? err.error : (err as any)?.error ?? err;

  // Respuesta no-JSON (HTML de un 500, etc.)
  if (typeof body === 'string') {
    out.message = body.length < 200 ? body : 'Ocurrió un error en el servidor.';
    return out;
  }

  // Formato unificado: body.error.detail ; o body.detail ; o body mismo
  const root = (body && typeof body === 'object' && 'error' in body) ? (body as any).error : body;
  const detail = (root && typeof root === 'object' && 'detail' in root) ? (root as any).detail : root;

  if (typeof detail === 'string') {
    out.message = detail;
  } else if (Array.isArray(detail)) {
    out.message = String(detail[0]);
  } else if (detail && typeof detail === 'object') {
    for (const [key, val] of Object.entries(detail)) {
      const msg = Array.isArray(val) ? String(val[0])
        : (typeof val === 'string' ? val : JSON.stringify(val));
      if (NON_FIELD_KEYS.includes(key)) out.message = msg;
      else out.fieldErrors[key] = msg;
    }
  }

  return out;
}
