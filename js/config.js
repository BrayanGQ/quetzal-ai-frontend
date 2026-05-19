/**
 * Quetzal AI — Configuración del frontend
 */

const QUETZAL_CONFIG = {

  // URL del backend en producción
  API_URL: 'https://quetzal-ai-backend.onrender.com',

  // Supabase — credenciales públicas (seguras de exponer)
  SUPABASE_URL: 'https://jaiounvcnvzebnwmxclq.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_T6O6CYecB0z1wReRsrzqvg_CVk0VcjD',

  VERSION: 'v2.0.0',

  STORAGE_KEYS: {
    // Caches locales (no son la fuente de verdad, solo para UX rápida)
    BUSINESS_CACHE: 'quetzal_business_cache',
    USER_CACHE: 'quetzal_user_cache'
  }
};

// Auto-detectar entorno
if (typeof window !== 'undefined') {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '') {
    QUETZAL_CONFIG.API_URL = 'http://localhost:3000';
  }
}

// Cliente Supabase (se inicializa cuando se carga el SDK)
let supabaseClient = null;
if (typeof window !== 'undefined' && window.supabase) {
  supabaseClient = window.supabase.createClient(
    QUETZAL_CONFIG.SUPABASE_URL,
    QUETZAL_CONFIG.SUPABASE_ANON_KEY
  );
}