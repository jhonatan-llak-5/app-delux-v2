/** Datos de Ecuador para formularios (provincias) y países (código telefónico). */

export const EC_PROVINCES: string[] = [
  'Azuay', 'Bolívar', 'Cañar', 'Carchi', 'Chimborazo', 'Cotopaxi',
  'El Oro', 'Esmeraldas', 'Galápagos', 'Guayas', 'Imbabura', 'Loja',
  'Los Ríos', 'Manabí', 'Morona Santiago', 'Napo', 'Orellana', 'Pastaza',
  'Pichincha', 'Santa Elena', 'Santo Domingo de los Tsáchilas', 'Sucumbíos',
  'Tungurahua', 'Zamora Chinchipe',
];

export interface Country { code: string; name: string; dial: string; flag: string; }

/** Ecuador primero (por defecto), luego países comunes. */
export const COUNTRIES: Country[] = [
  { code: 'EC', name: 'Ecuador',        dial: '+593', flag: '🇪🇨' },
  { code: 'CO', name: 'Colombia',       dial: '+57',  flag: '🇨🇴' },
  { code: 'PE', name: 'Perú',           dial: '+51',  flag: '🇵🇪' },
  { code: 'US', name: 'Estados Unidos', dial: '+1',   flag: '🇺🇸' },
  { code: 'ES', name: 'España',         dial: '+34',  flag: '🇪🇸' },
  { code: 'MX', name: 'México',         dial: '+52',  flag: '🇲🇽' },
  { code: 'AR', name: 'Argentina',      dial: '+54',  flag: '🇦🇷' },
  { code: 'CL', name: 'Chile',          dial: '+56',  flag: '🇨🇱' },
  { code: 'VE', name: 'Venezuela',      dial: '+58',  flag: '🇻🇪' },
  { code: 'BO', name: 'Bolivia',        dial: '+591', flag: '🇧🇴' },
  { code: 'BR', name: 'Brasil',         dial: '+55',  flag: '🇧🇷' },
  { code: 'PA', name: 'Panamá',         dial: '+507', flag: '🇵🇦' },
  { code: 'UY', name: 'Uruguay',        dial: '+598', flag: '🇺🇾' },
  { code: 'PY', name: 'Paraguay',       dial: '+595', flag: '🇵🇾' },
  { code: 'CR', name: 'Costa Rica',     dial: '+506', flag: '🇨🇷' },
];
