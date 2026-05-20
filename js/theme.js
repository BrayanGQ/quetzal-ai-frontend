/**
 * Quetzal AI — Manejo de tema (claro/oscuro)
 *
 * Detecta preferencia del usuario y la mantiene en localStorage.
 * Si nunca ha elegido, usa la preferencia del sistema operativo.
 */

const theme = {

  STORAGE_KEY: 'quetzal_theme',


  // -----------------------------
  //   OBTENER TEMA ACTUAL
  // -----------------------------

  getCurrent() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;

    // Si no hay preferencia guardada, detectar del sistema
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  },


  // -----------------------------
  //   APLICAR TEMA
  // -----------------------------

  apply(themeName) {
    if (themeName !== 'dark' && themeName !== 'light') return;

    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem(this.STORAGE_KEY, themeName);

    // Actualizar meta theme-color (para barra de móvil)
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', themeName === 'dark' ? '#0A0F1A' : '#1E3A5F');
    }

    // Actualizar íconos de los botones toggle
    this._updateToggleButtons(themeName);
  },


  // -----------------------------
  //   ALTERNAR (TOGGLE)
  // -----------------------------

  toggle() {
    const current = this.getCurrent();
    const newTheme = current === 'dark' ? 'light' : 'dark';
    this.apply(newTheme);
  },


  // -----------------------------
  //   ACTUALIZAR ÍCONOS DE BOTONES
  // -----------------------------

  _updateToggleButtons(themeName) {
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      const iconSun = btn.querySelector('.theme-icon-sun');
      const iconMoon = btn.querySelector('.theme-icon-moon');
      const label = btn.querySelector('.theme-label');

      if (themeName === 'dark') {
        if (iconSun) iconSun.style.display = 'inline-block';
        if (iconMoon) iconMoon.style.display = 'none';
        if (label) label.textContent = 'Modo claro';
      } else {
        if (iconSun) iconSun.style.display = 'none';
        if (iconMoon) iconMoon.style.display = 'inline-block';
        if (label) label.textContent = 'Modo oscuro';
      }
    });
  },


  // -----------------------------
  //   INICIALIZACIÓN
  // -----------------------------

  init() {
    this.apply(this.getCurrent());
  }
};

// Aplicar antes de que la página renderice (evita "flash")
theme.init();

// Re-aplicar cuando el DOM esté listo (para botones)
window.addEventListener('DOMContentLoaded', () => {
  theme.apply(theme.getCurrent());
});