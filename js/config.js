/**
 * Quetzal AI — Configuración del frontend
 *
 * IMPORTANTE: Cambiar API_URL por la URL real del backend cuando se despliegue.
 *
 * Local:        http://localhost:3000
 * En Render:    https://quetzal-ai-backend.onrender.com
 */

const QUETZAL_CONFIG = {

  // URL del backend.
  // - Para desarrollo local: 'http://localhost:3000'
  // - Para producción: la URL que te dé Render (ej: 'https://quetzal-ai-backend.onrender.com')
  API_URL: 'https://quetzal-ai-backend.onrender.com/',

  // Versión actual (se muestra en el header)
  VERSION: 'v1.1.0',

  // Llaves de localStorage
  STORAGE_KEYS: {
    SALES:        'quetzal_sales',
    CONFIG:       'quetzal_business_config',
    CHAT_HISTORY: 'quetzal_chat_history'
  }
};

// Auto-detectar entorno: si estás en localhost, usa localhost; si no, asume producción
if (typeof window !== 'undefined') {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '') {
    // Desarrollo local — usa el backend local
    QUETZAL_CONFIG.API_URL = 'https://quetzal-ai-backend.onrender.com';
  }
  // Si NO es localhost, mantiene el valor de arriba (producción)
  // → cambiar manualmente a la URL de Render antes de desplegar
}
