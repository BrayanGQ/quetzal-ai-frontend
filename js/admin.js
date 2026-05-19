/**
 * Quetzal AI — Lógica del Panel Administrativo
 * Con soporte de slug + QR + compartir en redes
 */

const admin = {

  user: null,
  accessToken: null,
  business: null,    // info del negocio del usuario
  isAdvancedOpen: false,


  // -----------------------------
  //   NAVEGACIÓN
  // -----------------------------

  switchTab(tab, el) {
    document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
    if (el) el.classList.add("active");
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    document.getElementById(`tab-${tab}`).classList.add("active");

    const titles = {
      ventas: "Panel de Ventas",
      generator: "Generador de Contenido",
      "chatbot-config": "Configurar Chatbot",
      widget: "Compartí tu chatbot"
    };
    document.getElementById("page-title").textContent = titles[tab] || tab;
    history.replaceState(null, '', `#tab-${tab}`);
  },


  // -----------------------------
  //   API CALL AUTENTICADO
  // -----------------------------

  async apiCall(path, options = {}) {
    if (!this.accessToken) throw new Error('Sesión expirada');

    const response = await fetch(`${QUETZAL_CONFIG.API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
        ...(options.headers || {})
      }
    });

    if (response.status === 401) {
      await auth.logout();
      throw new Error('Sesión expirada');
    }
    return response;
  },


  // -----------------------------
  //   GENERADOR DE CONTENIDO
  // -----------------------------

  async generateContent() {
    const type = document.getElementById("content-type").value;
    const tone = document.getElementById("content-tone").value;
    const prompt = document.getElementById("content-prompt").value.trim();
    const wantImage = document.getElementById("gen-image").checked;
    const output = document.getElementById("generator-output-text");
    const imgWrap = document.getElementById("output-image-wrap");

    if (!prompt) {
      output.innerHTML = '<span style="color:#EF4444;">⚠️ Por favor, escribí lo que querés comunicar.</span>';
      imgWrap.style.display = "none";
      return;
    }

    output.innerHTML = '<span class="loading-dots"><span></span><span></span><span></span></span> &nbsp;La IA está redactando tu contenido...';
    imgWrap.style.display = "none";

    try {
      const response = await fetch(`${QUETZAL_CONFIG.API_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, tone, prompt })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      output.textContent = data.content;
    } catch (error) {
      output.innerHTML = `<span style="color:#EF4444;">⚠️ ${error.message}</span>`;
      return;
    }

    if (wantImage) await this._generateImage(prompt);
  },

  async _generateImage(userPrompt) {
    const imgWrap = document.getElementById("output-image-wrap");
    const imgEl = document.getElementById("output-image");
    const dlLink = document.getElementById("download-img");

    imgWrap.style.display = "block";
    imgEl.style.display = "none";

    let loading = imgWrap.querySelector(".loading-img");
    if (!loading) {
      loading = document.createElement("div");
      loading.className = "loading-img";
      imgWrap.appendChild(loading);
    }
    loading.textContent = "Generando imagen con Flux... ~5 segundos";
    loading.style.display = "flex";

    try {
      const response = await fetch(`${QUETZAL_CONFIG.API_URL}/api/generar-imagen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userPrompt })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      imgEl.src = data.image;
      dlLink.href = data.image;
      imgEl.onload = () => {
        loading.style.display = "none";
        imgEl.style.display = "block";
      };
    } catch (error) {
      loading.textContent = `⚠️ ${error.message}`;
    }
  },

  clearGenerator() {
    document.getElementById("content-prompt").value = "";
    document.getElementById("generator-output-text").textContent = "El contenido generado aparecerá aquí...";
    document.getElementById("output-image-wrap").style.display = "none";
  },

  copyOutput(id) {
    const text = document.getElementById(id).textContent;
    navigator.clipboard.writeText(text).then(() => this._toast('✅ Contenido copiado'));
  },


  // -----------------------------
  //   CONFIGURAR CHATBOT
  // -----------------------------

  async saveChatbotConfig() {
    const config = {
      name: document.getElementById("biz-name").value.trim(),
      type: document.getElementById("biz-type").value.trim(),
      location: document.getElementById("biz-location").value.trim(),
      hours: document.getElementById("biz-hours").value.trim(),
      delivery: document.getElementById("biz-delivery").value.trim(),
      payment: document.getElementById("biz-payment").value.trim(),
      products: document.getElementById("biz-products").value.trim()
    };

    if (!config.name) {
      this._toast('⚠️ El nombre es obligatorio', 'error');
      return;
    }

    try {
      const response = await this.apiCall('/api/business', {
        method: 'POST',
        body: JSON.stringify(config)
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      this.business = data.business;
      localStorage.setItem(QUETZAL_CONFIG.STORAGE_KEYS.BUSINESS_CACHE, JSON.stringify(config));
      this._updateWidgetSection(data.business);
      this._toast('✅ Configuración guardada');
    } catch (error) {
      this._toast(`⚠️ ${error.message}`, 'error');
    }
  },

  loadDefaultConfig() {
    document.getElementById("biz-name").value = DEMO_BUSINESS_CONFIG.name;
    document.getElementById("biz-type").value = DEMO_BUSINESS_CONFIG.type;
    document.getElementById("biz-location").value = DEMO_BUSINESS_CONFIG.location;
    document.getElementById("biz-hours").value = DEMO_BUSINESS_CONFIG.hours;
    document.getElementById("biz-delivery").value = DEMO_BUSINESS_CONFIG.delivery;
    document.getElementById("biz-payment").value = DEMO_BUSINESS_CONFIG.payment;
    document.getElementById("biz-products").value = DEMO_BUSINESS_CONFIG.products;
    this._toast('📋 Datos de ejemplo cargados — guardá para aplicarlos');
  },

  async _loadSavedConfig() {
    try {
      const response = await this.apiCall('/api/business');
      const data = await response.json();

      if (data.success && data.business) {
        const cfg = data.business;
        this.business = cfg;
        document.getElementById("biz-name").value = cfg.name || '';
        document.getElementById("biz-type").value = cfg.type || '';
        document.getElementById("biz-location").value = cfg.location || '';
        document.getElementById("biz-hours").value = cfg.hours || '';
        document.getElementById("biz-delivery").value = cfg.delivery || '';
        document.getElementById("biz-payment").value = cfg.payment || '';
        document.getElementById("biz-products").value = cfg.products || '';
        localStorage.setItem(QUETZAL_CONFIG.STORAGE_KEYS.BUSINESS_CACHE, JSON.stringify(cfg));
        this._updateWidgetSection(cfg);
      } else {
        this.loadDefaultConfig();
        this._updateWidgetSection(null);
      }
    } catch (error) {
      console.error('[Load config]', error);
    }
  },


  // -----------------------------
  //   WIDGET — URL + LINK + QR
  // -----------------------------

  _getFrontendBase() {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocalhost
      ? `${window.location.protocol}//${window.location.host}`
      : 'https://quetzal-ai.onrender.com';
  },

  _getShareUrl(business) {
    if (!business) return '';
    const slug = business.slug || business.id;
    return `${this._getFrontendBase()}/chat.html?biz=${slug}`;
  },

  _updateWidgetSection(business) {
    const noConfig = document.getElementById("widget-no-config");
    const widgetContent = document.getElementById("widget-content");

    if (!business || !business.id) {
      if (noConfig) noConfig.style.display = 'block';
      if (widgetContent) widgetContent.style.display = 'none';
      return;
    }

    if (noConfig) noConfig.style.display = 'none';
    if (widgetContent) widgetContent.style.display = 'block';

    // Link display
    const url = this._getShareUrl(business);
    const display = document.getElementById("share-link-display");
    if (display) display.textContent = url;

    // Botón preview
    const previewBtn = document.getElementById("btn-preview-link");
    if (previewBtn) previewBtn.href = `chat.html?biz=${business.slug || business.id}`;

    // Prefix del editor de slug
    const slugPrefix = document.getElementById("slug-prefix");
    if (slugPrefix) {
      const base = this._getFrontendBase().replace(/https?:\/\//, '');
      slugPrefix.textContent = `${base}/chat.html?biz=`;
    }

    // Slug input
    const slugInput = document.getElementById("slug-input");
    if (slugInput) slugInput.value = business.slug || '';

    // Código embebible
    const codeEl = document.getElementById("widget-code-text");
    if (codeEl) {
      const widgetUrl = `${this._getFrontendBase()}/widget.js`;
      codeEl.textContent = `<!-- Quetzal AI Widget -->
<script src="${widgetUrl}"
        data-business-id="${business.id}"><\/script>`;
    }

    // Generar QR
    this._renderQR(url);
  },

  _renderQR(url) {
    const container = document.getElementById("qr-container");
    if (!container) return;

    // Esperar hasta que la librería QRCode esté disponible (máx 3 segundos)
    let attempts = 0;
    const maxAttempts = 30;  // 30 * 100ms = 3 segundos

    const tryRender = () => {
      if (window.QRCode) {
        // Limpiar y crear canvas
        container.innerHTML = '<canvas id="qr-canvas"></canvas>';
        const canvas = document.getElementById("qr-canvas");

        QRCode.toCanvas(canvas, url, {
          width: 220,
          margin: 2,
          color: { dark: '#0F1E33', light: '#FFFFFF' },
          errorCorrectionLevel: 'M'
        }, function(error) {
          if (error) {
            console.error('[QR] Error al generar:', error);
            container.innerHTML = `
              <p style="color:#EF4444;font-size:13px;text-align:center;padding:20px;">
                ⚠️ No se pudo generar el QR<br>
                <a href="${url}" target="_blank" style="font-size:11px;color:#14B8A6;word-break:break-all;">Abrir link directo</a>
              </p>`;
          }
        });
        return;
      }

      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(tryRender, 100);
      } else {
        // Librería no cargó — fallback con servicio externo (gratis)
        console.warn('[QR] Librería local no disponible, usando fallback');
        const fallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}&bgcolor=FFFFFF&color=0F1E33&margin=10`;
        container.innerHTML = `<img id="qr-canvas" src="${fallbackUrl}" alt="QR del negocio" style="display:block;width:220px;height:220px;border-radius:8px;" />`;
      }
    };

    tryRender();
  },


  // -----------------------------
  //   COPIAR LINK
  // -----------------------------

  copyShareLink() {
    const url = document.getElementById("share-link-display").textContent;
    navigator.clipboard.writeText(url).then(() => {
      this._toast('✅ Link copiado al portapapeles');
      const btn = document.getElementById("btn-copy-link");
      if (btn) {
        const original = btn.innerHTML;
        btn.innerHTML = '<span>✓</span> ¡Copiado!';
        setTimeout(() => { btn.innerHTML = original; }, 1800);
      }
    }).catch(() => this._toast('⚠️ No se pudo copiar', 'error'));
  },

  copyWidgetCode() {
    const code = document.getElementById("widget-code-text").textContent;
    navigator.clipboard.writeText(code).then(() => {
      this._toast('✅ Código copiado — pegalo en tu sitio web');
    });
  },


  // -----------------------------
  //   COMPARTIR EN REDES
  // -----------------------------

  _getShareMessage() {
    const name = this.business?.name || 'mi negocio';
    return `¡Conocé el nuevo asistente virtual de ${name}! 🦜 Hablanos 24/7 y te ayudamos con tus consultas.`;
  },

  shareWhatsApp() {
    const url = this._getShareUrl(this.business);
    const message = `${this._getShareMessage()}\n\n👉 ${url}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  },

  shareFacebook() {
    const url = this._getShareUrl(this.business);
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    window.open(fbUrl, '_blank', 'width=600,height=500');
  },

  shareTwitter() {
    const url = this._getShareUrl(this.business);
    const message = this._getShareMessage();
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, '_blank', 'width=600,height=500');
  },

  shareInstagram() {
    // Instagram no permite compartir vía URL directo, copiamos el mensaje
    const url = this._getShareUrl(this.business);
    const message = `${this._getShareMessage()}\n\n👉 ${url}`;
    navigator.clipboard.writeText(message).then(() => {
      this._toast('📋 Mensaje copiado — pegalo en tu bio de Instagram o en una historia');
    });
  },


  // -----------------------------
  //   DESCARGAR QR
  // -----------------------------

  downloadQR() {
    const canvas = document.getElementById("qr-canvas");
    if (!canvas) return;

    const link = document.createElement('a');
    const name = (this.business?.name || 'mi-negocio')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-');

    link.download = `qr-${name}-quetzal-ai.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    this._toast('✅ QR descargado — imprimilo y pegalo en tu negocio');
  },


  // -----------------------------
  //   EDITAR SLUG
  // -----------------------------

  toggleSlugEditor() {
    const body = document.getElementById("slug-editor-body");
    const arrow = document.getElementById("slug-arrow");
    const isOpen = body.style.display !== 'none';

    body.style.display = isOpen ? 'none' : 'block';
    if (arrow) arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
  },

  async saveSlug() {
    const rawSlug = document.getElementById("slug-input").value.trim();
    const statusEl = document.getElementById("slug-status");
    const btn = document.getElementById("btn-save-slug");

    if (!rawSlug || rawSlug.length < 3) {
      statusEl.innerHTML = '<span style="color:#EF4444;">⚠️ El link debe tener al menos 3 caracteres</span>';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Guardando...';
    statusEl.innerHTML = '<span style="color:#64748B;">⌛ Verificando disponibilidad...</span>';

    try {
      const response = await this.apiCall('/api/business/slug', {
        method: 'POST',
        body: JSON.stringify({ slug: rawSlug })
      });
      const data = await response.json();

      if (!data.success) {
        statusEl.innerHTML = `<span style="color:#EF4444;">⚠️ ${data.error}</span>`;
        btn.disabled = false;
        btn.textContent = 'Guardar nuevo link';
        return;
      }

      this.business = data.business;
      this._updateWidgetSection(data.business);
      statusEl.innerHTML = '<span style="color:#10B981;">✅ Link actualizado correctamente</span>';
      btn.disabled = false;
      btn.textContent = 'Guardar nuevo link';
      this._toast('✅ Tu link fue actualizado');

      setTimeout(() => {
        this.toggleSlugEditor();
        statusEl.innerHTML = '';
      }, 1500);
    } catch (error) {
      statusEl.innerHTML = `<span style="color:#EF4444;">⚠️ ${error.message}</span>`;
      btn.disabled = false;
      btn.textContent = 'Guardar nuevo link';
    }
  },


  // -----------------------------
  //   SECCIÓN AVANZADA
  // -----------------------------

  toggleAdvanced() {
    const body = document.getElementById("advanced-body");
    const arrow = document.getElementById("advanced-arrow");
    this.isAdvancedOpen = !this.isAdvancedOpen;
    body.style.display = this.isAdvancedOpen ? 'block' : 'none';
    if (arrow) arrow.style.transform = this.isAdvancedOpen ? 'rotate(180deg)' : 'rotate(0deg)';
  },


  // -----------------------------
  //   TOAST
  // -----------------------------

  _toast(message, type = 'success') {
    const existing = document.querySelector('.qa-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'qa-toast';
    toast.style.cssText = `
      position: fixed; bottom: 30px; right: 30px;
      padding: 14px 20px;
      background: ${type === 'error' ? '#EF4444' : '#0F1E33'};
      color: white; border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.18);
      font-size: 13.5px; font-weight: 500;
      z-index: 1000; animation: slideUp 0.3s ease;
      max-width: 320px;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },


  // -----------------------------
  //   INICIALIZACIÓN
  // -----------------------------

  async init() {
    this.user = await auth.requireAuth();
    if (!this.user) return;

    this.accessToken = await auth.getAccessToken();

    const emailEl = document.getElementById("user-email");
    if (emailEl) emailEl.textContent = this.user.email;

    await this._loadSavedConfig();

    const hash = window.location.hash.replace('#tab-', '');
    if (hash) {
      const tabBtn = document.querySelector(`[data-tab="${hash}"]`);
      if (tabBtn) this.switchTab(hash, tabBtn);
    }

    if (!document.getElementById('qa-toast-style')) {
      const style = document.createElement('style');
      style.id = 'qa-toast-style';
      style.textContent = `@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`;
      document.head.appendChild(style);
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('welcome') === '1') {
      setTimeout(() => this._toast('🎉 ¡Bienvenido a Quetzal AI! Configurá tu negocio para empezar.'), 500);
    }
  }
};

window.addEventListener("DOMContentLoaded", () => {
  admin.init();
});