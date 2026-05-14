/**
 * Quetzal AI — Lógica del Panel Administrativo
 *
 * Maneja:
 *   - Navegación entre tabs (ventas, generador, configurar chatbot)
 *   - Generador de contenido (llama al backend → Groq)
 *   - Configuración del chatbot (guarda en localStorage)
 */

const admin = {

  // -----------------------------
  //   NAVEGACIÓN
  // -----------------------------

  switchTab(tab, el) {
    document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
    el.classList.add("active");
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    document.getElementById(`tab-${tab}`).classList.add("active");

    const titles = {
      ventas:           "Panel de Ventas",
      generator:        "Generador de Contenido",
      "chatbot-config": "Configurar Chatbot"
    };
    document.getElementById("page-title").textContent = titles[tab] || tab;

    // Actualizar URL hash sin scroll
    history.replaceState(null, '', `#tab-${tab}`);
  },


  // -----------------------------
  //   MÓDULO: GENERADOR
  // -----------------------------

  async generateContent() {
    const type   = document.getElementById("content-type").value;
    const tone   = document.getElementById("content-tone").value;
    const prompt = document.getElementById("content-prompt").value.trim();
    const wantImage = document.getElementById("gen-image").checked;
    const output = document.getElementById("generator-output-text");
    const imgWrap = document.getElementById("output-image-wrap");

    if (!prompt) {
      output.innerHTML = '<span style="color:#EF4444;">⚠️ Por favor, escribí lo que querés comunicar antes de generar el contenido.</span>';
      imgWrap.style.display = "none";
      return;
    }

    // Loading
    output.innerHTML = '<span class="loading-dots"><span></span><span></span><span></span></span> &nbsp;La IA está redactando tu contenido...';
    imgWrap.style.display = "none";

    try {
      const response = await fetch(`${QUETZAL_CONFIG.API_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, tone, prompt })
      });

      const data = await response.json();

      if (!data.success) throw new Error(data.error || 'Error desconocido');

      output.textContent = data.content;

    } catch (error) {
      console.error('[Generador]', error);
      output.innerHTML = `<span style="color:#EF4444;">⚠️ No se pudo conectar con la IA.<br><br>Asegurate de que el servidor backend esté corriendo en <code>${QUETZAL_CONFIG.API_URL}</code>.<br><br><small>Detalle: ${error.message}</small></span>`;
      return;
    }

    if (wantImage) {
      await this._generateImage(prompt);
    }
  },

  async _generateImage(userPrompt) {
    const imgWrap = document.getElementById("output-image-wrap");
    const imgEl   = document.getElementById("output-image");
    const dlLink  = document.getElementById("download-img");

    imgWrap.style.display = "block";
    imgEl.style.display = "none";

    let loading = imgWrap.querySelector(".loading-img");
    if (!loading) {
      loading = document.createElement("div");
      loading.className = "loading-img";
      imgWrap.appendChild(loading);
    }
    loading.textContent = "Generando imagen con Flux (Cloudflare)... ~5 segundos";
    loading.style.display = "flex";

    try {
      // Llamar al backend (que a su vez llama a Cloudflare Workers AI)
      const response = await fetch(`${QUETZAL_CONFIG.API_URL}/api/generar-imagen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userPrompt })
      });

      const data = await response.json();

      if (!data.success) throw new Error(data.error || 'Error al generar imagen');

      // La imagen viene en base64 (data:image/png;base64,...)
      imgEl.src = data.image;
      dlLink.href = data.image;

      imgEl.onload = () => {
        loading.style.display = "none";
        imgEl.style.display = "block";
      };

    } catch (error) {
      console.error('[Imagen]', error);
      loading.textContent = `⚠️ No se pudo generar la imagen: ${error.message}`;
    }
  },

  clearGenerator() {
    document.getElementById("content-prompt").value = "";
    document.getElementById("generator-output-text").textContent = "El contenido generado aparecerá aquí...";
    document.getElementById("output-image-wrap").style.display = "none";
  },

  copyOutput(id) {
    const text = document.getElementById(id).textContent;
    navigator.clipboard.writeText(text).then(() => {
      this._toast('✅ Contenido copiado al portapapeles');
    });
  },


  // -----------------------------
  //   MÓDULO: CONFIGURAR CHATBOT
  // -----------------------------

  saveChatbotConfig() {
    const config = {
      name:     document.getElementById("biz-name").value.trim(),
      type:     document.getElementById("biz-type").value.trim(),
      location: document.getElementById("biz-location").value.trim(),
      hours:    document.getElementById("biz-hours").value.trim(),
      delivery: document.getElementById("biz-delivery").value.trim(),
      payment:  document.getElementById("biz-payment").value.trim(),
      products: document.getElementById("biz-products").value.trim()
    };

    if (!config.name) {
      this._toast('⚠️ El nombre del negocio es obligatorio', 'error');
      return;
    }

    localStorage.setItem(QUETZAL_CONFIG.STORAGE_KEYS.CONFIG, JSON.stringify(config));
    this._toast('✅ Configuración guardada. El chatbot ya usa esta información.');
  },

  loadDefaultConfig() {
    document.getElementById("biz-name").value     = DEMO_BUSINESS_CONFIG.name;
    document.getElementById("biz-type").value     = DEMO_BUSINESS_CONFIG.type;
    document.getElementById("biz-location").value = DEMO_BUSINESS_CONFIG.location;
    document.getElementById("biz-hours").value    = DEMO_BUSINESS_CONFIG.hours;
    document.getElementById("biz-delivery").value = DEMO_BUSINESS_CONFIG.delivery;
    document.getElementById("biz-payment").value  = DEMO_BUSINESS_CONFIG.payment;
    document.getElementById("biz-products").value = DEMO_BUSINESS_CONFIG.products;

    this._toast('📋 Datos de ejemplo cargados — guardá para aplicar al chatbot.');
  },

  _loadSavedConfig() {
    const saved = localStorage.getItem(QUETZAL_CONFIG.STORAGE_KEYS.CONFIG);
    if (saved) {
      try {
        const cfg = JSON.parse(saved);
        document.getElementById("biz-name").value     = cfg.name     || '';
        document.getElementById("biz-type").value     = cfg.type     || '';
        document.getElementById("biz-location").value = cfg.location || '';
        document.getElementById("biz-hours").value    = cfg.hours    || '';
        document.getElementById("biz-delivery").value = cfg.delivery || '';
        document.getElementById("biz-payment").value  = cfg.payment  || '';
        document.getElementById("biz-products").value = cfg.products || '';
      } catch (e) {
        console.warn('No se pudo cargar config guardada', e);
      }
    } else {
      // Si no hay nada guardado, cargar el demo automáticamente
      this.loadDefaultConfig();
      // Y guardarlo también para que el chatbot funcione desde el inicio
      this.saveChatbotConfig();
    }
  },


  // -----------------------------
  //   UTILIDADES
  // -----------------------------

  _toast(message, type = 'success') {
    // Toast simple sin librerías
    const existing = document.querySelector('.qa-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'qa-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 30px;
      right: 30px;
      padding: 14px 20px;
      background: ${type === 'error' ? '#EF4444' : '#0F1E33'};
      color: white;
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.18);
      font-size: 13.5px;
      font-weight: 500;
      z-index: 1000;
      animation: slideUp 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  },


  // -----------------------------
  //   INICIALIZACIÓN
  // -----------------------------

  init() {
    // Cargar config guardada del chatbot
    this._loadSavedConfig();

    // Si la URL tiene #tab-xxx, abrir esa tab
    const hash = window.location.hash.replace('#tab-', '');
    if (hash) {
      const tabBtn = document.querySelector(`[data-tab="${hash}"]`);
      if (tabBtn) this.switchTab(hash, tabBtn);
    }

    // Animación CSS para el toast
    if (!document.getElementById('qa-toast-style')) {
      const style = document.createElement('style');
      style.id = 'qa-toast-style';
      style.textContent = `
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
  }
};

window.addEventListener("DOMContentLoaded", () => {
  admin.init();
});
