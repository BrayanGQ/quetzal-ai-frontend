/**
 * Quetzal AI — Lógica del Panel Administrativo
 * Con tooltips, mejores mensajes, exportar CSV, confirmaciones
 */

const admin = {

  user: null,
  accessToken: null,
  business: null,
  isAdvancedOpen: false,


  // -----------------------------
  //   NAVEGACIÓN
  // -----------------------------

  switchTab(tab, el) {
    document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
    if (el) el.classList.add("active");

    // Animación suave entre tabs
    const currentActive = document.querySelector(".tab-panel.active");
    if (currentActive) {
      currentActive.style.opacity = '0';
      setTimeout(() => {
        document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
        const newTab = document.getElementById(`tab-${tab}`);
        newTab.classList.add("active");
        newTab.style.opacity = '0';
        setTimeout(() => { newTab.style.opacity = '1'; }, 30);
      }, 150);
    } else {
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      document.getElementById(`tab-${tab}`).classList.add("active");
    }

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
      output.innerHTML = '<span style="color:var(--danger);">⚠️ Escribí primero lo que querés comunicar antes de generar el contenido.</span>';
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
      output.innerHTML = `<span style="color:var(--danger);">⚠️ No pudimos generar el contenido. Probá de nuevo en un momento.</span>`;
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
    loading.textContent = "Generando imagen con IA... ~5 segundos";
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
      loading.textContent = `⚠️ No pudimos generar la imagen. Probá de nuevo.`;
    }
  },

  clearGenerator() {
    document.getElementById("content-prompt").value = "";
    document.getElementById("generator-output-text").textContent = "El contenido generado aparecerá aquí...";
    document.getElementById("output-image-wrap").style.display = "none";
  },

  copyOutput(id) {
    const text = document.getElementById(id).textContent;
    navigator.clipboard.writeText(text).then(() => this._toast('✅ Contenido copiado al portapapeles'));
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
      this._toast('⚠️ Falta el nombre de tu negocio. Es lo único obligatorio.', 'error');
      document.getElementById("biz-name").focus();
      return;
    }

    // Indicador de "guardando"
    const saveBtn = document.querySelector('#tab-chatbot-config .btn-primary');
    const originalText = saveBtn ? saveBtn.textContent : '';
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="loading-dots"><span></span><span></span><span></span></span> Guardando...';
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
      this._toast('✅ Configuración guardada — tu chatbot ya está listo');
    } catch (error) {
      this._toast(`⚠️ No pudimos guardar la configuración. Probá de nuevo.`, 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
      }
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
    this._toast('📋 Ejemplo cargado — modificá los datos por los de tu negocio y guardá');
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
        this._clearConfigFields();
        this._updateWidgetSection(null);
      }
    } catch (error) {
      console.error('[Load config]', error);
    }
  },

  _clearConfigFields() {
    ['biz-name', 'biz-type', 'biz-location', 'biz-hours', 'biz-delivery', 'biz-payment', 'biz-products']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
  },


  // -----------------------------
  //   WIDGET — URL + LINK + QR
  // -----------------------------

  _getFrontendBase() {
    return `${window.location.protocol}//${window.location.host}`;
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

    const url = this._getShareUrl(business);
    const display = document.getElementById("share-link-display");
    if (display) display.textContent = url;

    const previewBtn = document.getElementById("btn-preview-link");
    if (previewBtn) previewBtn.href = `chat.html?biz=${business.slug || business.id}`;

    const slugPrefix = document.getElementById("slug-prefix");
    if (slugPrefix) {
      const base = this._getFrontendBase().replace(/https?:\/\//, '');
      slugPrefix.textContent = `${base}/chat.html?biz=`;
    }

    const slugInput = document.getElementById("slug-input");
    if (slugInput) slugInput.value = business.slug || '';

    const codeEl = document.getElementById("widget-code-text");
    if (codeEl) {
      const widgetUrl = `${this._getFrontendBase()}/widget.js`;
      codeEl.textContent = `<!-- Quetzal AI Widget -->
<script src="${widgetUrl}"
        data-business-id="${business.id}"><\/script>`;
    }

    this._renderQR(url);
  },

  _renderQR(url) {
    const container = document.getElementById("qr-container");
    if (!container) return;

    let attempts = 0;
    const maxAttempts = 30;

    const tryRender = () => {
      if (window.QRCode) {
        container.innerHTML = '<canvas id="qr-canvas"></canvas>';
        const canvas = document.getElementById("qr-canvas");

        QRCode.toCanvas(canvas, url, {
          width: 220,
          margin: 2,
          color: { dark: '#0F1E33', light: '#FFFFFF' },
          errorCorrectionLevel: 'M'
        }, function(error) {
          if (error) {
            console.error('[QR]', error);
            container.innerHTML = `<p style="color:var(--danger);font-size:13px;">⚠️ No se pudo generar el QR</p>`;
          }
        });
        return;
      }

      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(tryRender, 100);
      } else {
        const fallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}&bgcolor=FFFFFF&color=0F1E33&margin=10`;
        container.innerHTML = `<img id="qr-canvas" src="${fallbackUrl}" alt="QR" style="display:block;width:220px;height:220px;border-radius:8px;" />`;
      }
    };

    tryRender();
  },


  // -----------------------------
  //   COMPARTIR LINK
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
    }).catch(() => this._toast('⚠️ No se pudo copiar el link', 'error'));
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
    const type = this.business?.type ? ` (${this.business.type})` : '';
    return `🦜 ¡Hola! Conocé el asistente virtual de *${name}*${type}.\n\n✅ Disponible 24/7\n✅ Te respondemos al instante\n✅ Consultá horarios, productos, entregas y más\n\nProbalo gratis 👇`;
  },

  shareWhatsApp() {
    const url = this._getShareUrl(this.business);
    const message = `${this._getShareMessage()}\n\n👉 ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  },

  shareFacebook() {
    const url = this._getShareUrl(this.business);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'width=600,height=500');
  },

  shareTwitter() {
    const url = this._getShareUrl(this.business);
    const message = this._getShareMessage();
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(url)}`, '_blank', 'width=600,height=500');
  },

  shareInstagram() {
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
    link.href = canvas.toDataURL ? canvas.toDataURL('image/png') : canvas.src;
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
      statusEl.innerHTML = '<span style="color:var(--danger);">⚠️ El link debe tener al menos 3 caracteres</span>';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Guardando...';
    statusEl.innerHTML = '<span style="color:var(--text-muted);">⌛ Verificando disponibilidad...</span>';

    try {
      const response = await this.apiCall('/api/business/slug', {
        method: 'POST',
        body: JSON.stringify({ slug: rawSlug })
      });
      const data = await response.json();

      if (!data.success) {
        statusEl.innerHTML = `<span style="color:var(--danger);">⚠️ ${data.error}</span>`;
        btn.disabled = false;
        btn.textContent = 'Guardar nuevo link';
        return;
      }

      this.business = data.business;
      this._updateWidgetSection(data.business);
      statusEl.innerHTML = '<span style="color:var(--success);">✅ Link actualizado correctamente</span>';
      btn.disabled = false;
      btn.textContent = 'Guardar nuevo link';
      this._toast('✅ Tu link fue actualizado');

      setTimeout(() => {
        this.toggleSlugEditor();
        statusEl.innerHTML = '';
      }, 1500);
    } catch (error) {
      statusEl.innerHTML = `<span style="color:var(--danger);">⚠️ ${error.message}</span>`;
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
    toast.className = `qa-toast qa-toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Animación de entrada
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
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

    const params = new URLSearchParams(window.location.search);
    if (params.get('welcome') === '1') {
      setTimeout(() => this._toast('🎉 ¡Bienvenido a Quetzal AI! Empezamos un tour rápido.'), 500);
    }
  },
  // -----------------------------
  //   MODAL DE CONFIRMACIÓN BONITO
  // -----------------------------

  confirmModal({ title, message, confirmText = 'Aceptar', cancelText = 'Cancelar', type = 'default', icon = '❓' }) {
    return new Promise((resolve) => {
      // Quitar modal existente si lo hay
      const existing = document.getElementById('qa-confirm-overlay');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = 'qa-confirm-overlay';
      overlay.className = 'qa-confirm-overlay';
      overlay.innerHTML = `
        <div class="qa-confirm-backdrop"></div>
        <div class="qa-confirm-card qa-confirm-${type}">
          <div class="qa-confirm-icon qa-confirm-icon-${type}">${icon}</div>
          <h3 class="qa-confirm-title">${title}</h3>
          <p class="qa-confirm-message">${message}</p>
          <div class="qa-confirm-actions">
            <button class="qa-confirm-cancel" id="qa-confirm-cancel-btn">${cancelText}</button>
            <button class="qa-confirm-ok qa-confirm-ok-${type}" id="qa-confirm-ok-btn">${confirmText}</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      // Animación de entrada
      requestAnimationFrame(() => overlay.classList.add('show'));

      const close = (result) => {
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 250);
        resolve(result);
      };

      document.getElementById('qa-confirm-ok-btn').onclick = () => close(true);
      document.getElementById('qa-confirm-cancel-btn').onclick = () => close(false);
      overlay.querySelector('.qa-confirm-backdrop').onclick = () => close(false);

      // ESC para cancelar
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          close(false);
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);
    });
  },


  // -----------------------------
  //   CONFIRMACIÓN DE LOGOUT (actualizada)
  // -----------------------------

  async confirmLogout() {
    const ok = await this.confirmModal({
      title: '¿Cerrar sesión?',
      message: 'Tu información queda guardada y podés volver cuando quieras.',
      confirmText: 'Sí, cerrar sesión',
      cancelText: 'Quedarme',
      type: 'logout',
      icon: '👋'
    });
    if (ok) auth.logout();
  }
};

window.addEventListener("DOMContentLoaded", () => {
  admin.init();
});