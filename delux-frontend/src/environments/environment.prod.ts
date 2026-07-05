export const environment = {
  production: true,
  appVersion: '0.0.2',
  // Rutas relativas: el mismo build funciona por IP:puerto o por dominio.
  // nginx (contenedor web) hace proxy de /api, /admin, /media, /static y /ws al backend.
  apiUrl: '/api/v1',
  wsUrl: '',
  tenant: 'delux',
  brand: {
    name: 'Delux',
    tagline: 'Sneakers, Ropa y más',
    primaryDomain: ''
  }
};
