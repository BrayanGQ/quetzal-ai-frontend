/**
 * Quetzal AI — Chatbot público (lado del cliente final)
 *
 * Lee la configuración del negocio desde la cache de localStorage
 * (que es actualizada por el admin.js cuando el dueño guarda su config).
 *
 * Toda la UI de la página (nombre, productos, hero, footer) se adapta
 * dinámicamente al tipo y configuración del negocio.
 */

const chatPublico = {

  isOpen: false,
  conversationHistory: [],
  isWaiting: false,


  // -----------------------------
  //   ABRIR / CERRAR WIDGET
  // -----------------------------

  toggle() {
    const widget = document.getElementById("chat-widget");
    const iconOpen = document.getElementById("chat-icon-open");
    const iconClose = document.getElementById("chat-icon-close");

    this.isOpen = !this.isOpen;

    if (this.isOpen) {
      widget.classList.add("open");
      iconOpen.style.display = "none";
      iconClose.style.display = "block";
      setTimeout(() => {
        const input = document.getElementById("chat-input");
        if (input) input.focus();
      }, 200);
    } else {
      widget.classList.remove("open");
      iconOpen.style.display = "block";
      iconClose.style.display = "none";
    }
  },


  // -----------------------------
  //   ENVIAR MENSAJES
  // -----------------------------

  async sendMessage() {
    if (this.isWaiting) return;

    const input = document.getElementById("chat-input");
    const message = input.value.trim();
    if (!message) return;

    this._addMessage(message, "user");
    input.value = "";

    const suggestions = document.getElementById("chat-suggestions");
    if (suggestions && this.conversationHistory.length === 0) {
      suggestions.style.display = "none";
    }

    this.isWaiting = true;
    const typingId = this._addTypingIndicator();

    try {
      const businessInfo = this._getBusinessInfo();

      const response = await fetch(`${QUETZAL_CONFIG.API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          businessInfo,
          history: this.conversationHistory.slice(-6)
        })
      });

      const data = await response.json();
      this._removeTypingIndicator(typingId);
      this.isWaiting = false;

      if (!data.success) throw new Error(data.error || 'Error desconocido');

      this._addMessage(data.response, "bot");
      this.conversationHistory.push({ role: 'user', content: message });
      this.conversationHistory.push({ role: 'assistant', content: data.response });

    } catch (error) {
      this._removeTypingIndicator(typingId);
      this.isWaiting = false;
      console.error('[Chat]', error);
      this._addMessage(`⚠️ Disculpá, en este momento no puedo responder. El servidor está caído o tardando demasiado.\n\nIntentá de nuevo en un momento.`, "bot");
    }
  },

  quickAsk(question) {
    document.getElementById("chat-input").value = question;
    this.sendMessage();
  },


  // -----------------------------
  //   RECUPERAR CONFIG (DESDE CACHE LOCALSTORAGE)
  // -----------------------------

  _getBusinessInfo() {
    // El admin.js guarda la config en BUSINESS_CACHE cada vez que el dueño guarda
    const raw = localStorage.getItem(QUETZAL_CONFIG.STORAGE_KEYS.BUSINESS_CACHE);
    if (!raw) return null;

    try {
      const cfg = JSON.parse(raw);
      return {
        name: cfg.name,
        type: cfg.type,
        location: cfg.location,
        hours: cfg.hours,
        delivery: cfg.delivery,
        payment: cfg.payment,
        products: cfg.products
      };
    } catch (e) {
      return null;
    }
  },


  // -----------------------------
  //   ACTUALIZAR LA UI SEGÚN EL NEGOCIO
  // -----------------------------

  _updateBusinessUI() {
    const config = this._getBusinessInfo();
    if (!config || !config.name) {
      // Si no hay config, mostrar mensaje amigable
      const welcome = document.querySelector('#chat-messages .message.bot:first-child .bubble');
      if (welcome) {
        welcome.textContent = `¡Hola! 👋 Soy el asistente virtual. El dueño aún no terminó de configurar este chatbot. Por favor, vuelve a intentarlo más tarde.`;
      }
      return;
    }

    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el && text) el.textContent = text;
    };

    setText("chat-biz-name", config.name);
    setText("biz-display-name", config.name);
    setText("biz-footer", `© ${config.name}` + (config.location ? ` · ${config.location}` : ''));
    setText("biz-banner-text",
      `Esta es una simulación de cómo el chatbot se vería en el sitio web de un negocio real (en este caso, ${config.name}).`);

    document.title = `${config.name} — Atención al cliente`;

    const tagParts = [];
    if (config.type) tagParts.push(this._capitalize(config.type));
    if (config.location) tagParts.push(config.location);
    setText("biz-display-tag", tagParts.join(' · ') || 'Atención al cliente');

    const emoji = this._getEmojiForType(config.type);
    setText("biz-emoji", emoji);
    setText("chat-avatar-emoji", emoji);

    setText("biz-hero-title", this._getHeroTitle(config.type, config.name));
    setText("biz-hero-text",
      `Tu negocio de confianza${config.location ? ' en ' + config.location : ''}. Atendemos tus consultas con nuestro asistente virtual las 24 horas.`);

    setText("biz-delivery-summary", this._summarize(config.delivery, "Consultá zonas"));
    setText("biz-hours-summary", this._summarize(config.hours, "Consultá horarios"));
    setText("biz-payment-summary", this._summarize(config.payment, "Varias formas"));

    this._renderProducts(config.products);

    const welcome = document.querySelector('#chat-messages .message.bot:first-child .bubble');
    if (welcome && config.name) {
      welcome.textContent = `¡Hola! 👋 Soy el asistente virtual de ${config.name}. Pregúntame sobre nuestros productos, horarios, entregas o lo que necesités. ¿En qué te puedo ayudar?`;
    }
  },


  // -----------------------------
  //   HELPERS DE UI DINÁMICA
  // -----------------------------

  _capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  _summarize(text, fallback) {
    if (!text) return fallback;
    const firstSentence = text.split(/[.!?]/)[0];
    const words = firstSentence.trim().split(/\s+/);
    if (words.length <= 8) return firstSentence.trim();
    return words.slice(0, 7).join(' ') + '...';
  },

  _getEmojiForType(type) {
    if (!type) return '🏪';
    const t = type.toLowerCase();
    if (t.includes('panaderia') || t.includes('panadería') || t.includes('pan')) return '🥖';
    if (t.includes('comedor') || t.includes('restaurante') || t.includes('comida')) return '🍽️';
    if (t.includes('cafe') || t.includes('café') || t.includes('cafetería')) return '☕';
    if (t.includes('belleza') || t.includes('salon') || t.includes('salón') || t.includes('peluquer')) return '💇';
    if (t.includes('farmacia') || t.includes('farma')) return '💊';
    if (t.includes('libreria') || t.includes('librería') || t.includes('libros')) return '📚';
    if (t.includes('ferreteria') || t.includes('ferretería')) return '🔧';
    if (t.includes('veterinaria') || t.includes('mascota')) return '🐾';
    if (t.includes('pizzeria') || t.includes('pizzería') || t.includes('pizza')) return '🍕';
    if (t.includes('floreria') || t.includes('florería') || t.includes('flores')) return '🌸';
    if (t.includes('taller') || t.includes('mecánica') || t.includes('mecanica')) return '🔩';
    if (t.includes('ropa') || t.includes('boutique')) return '👕';
    if (t.includes('helado') || t.includes('postre')) return '🍦';
    if (t.includes('frutería') || t.includes('fruteria') || t.includes('verduler')) return '🥬';
    return '🏪';
  },

  _getHeroTitle(type, name) {
    if (!type) return `Bienvenido a ${name}`;
    const t = type.toLowerCase();
    if (t.includes('panaderia') || t.includes('panadería')) return 'Pan recién horneado, hecho con amor';
    if (t.includes('comedor') || t.includes('restaurante')) return 'Comida casera, como en tu casa';
    if (t.includes('cafe') || t.includes('café')) return 'El mejor café de la zona';
    if (t.includes('belleza') || t.includes('salon')) return 'Lucí radiante con nosotros';
    if (t.includes('farmacia')) return 'Tu salud, nuestra prioridad';
    if (t.includes('libreria')) return 'Libros, útiles y mucho más';
    if (t.includes('ferreteria')) return 'Todo para tu obra y hogar';
    if (t.includes('veterinaria')) return 'Cuidamos a tus mejores amigos';
    if (t.includes('pizzeria')) return 'Las mejores pizzas de la zona';
    if (t.includes('floreria')) return 'Flores frescas para cada ocasión';
    if (t.includes('taller')) return 'Tu vehículo en buenas manos';
    if (t.includes('ropa') || t.includes('boutique')) return 'Vestí tu mejor versión';
    if (t.includes('helado')) return 'Postres y helados artesanales';
    if (t.includes('frutería') || t.includes('fruteria')) return 'Frutas y verduras frescas';
    return 'Productos frescos, a la puerta de tu casa';
  },

  _renderProducts(productsText) {
    const grid = document.getElementById("biz-product-grid");
    if (!grid) return;

    if (!productsText || !productsText.trim()) {
      grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #94A3B8; padding: 30px;">Pronto vas a ver nuestros productos aquí. Mientras tanto, preguntá al asistente virtual.</p>';
      return;
    }

    const lines = productsText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const products = lines.slice(0, 4).map(line => this._parseProductLine(line));

    grid.innerHTML = products.map(p => `
      <div class="product-card">
        <div class="product-img">${p.emoji}</div>
        <h3>${this._escape(p.name)}</h3>
        <p class="product-price">${this._escape(p.price)}</p>
      </div>
    `).join('');
  },

  _parseProductLine(line) {
    let name = line;
    let price = '';

    if (line.includes(':')) {
      const parts = line.split(':');
      name = parts[0].trim();
      price = parts.slice(1).join(':').trim();
    } else {
      const match = line.match(/(.*?)(Q\s*\d.*)/i);
      if (match) {
        name = match[1].trim();
        price = match[2].trim();
      }
    }

    if (price.includes(',')) price = price.split(',')[0].trim();
    if (!price) price = 'Consultá precio';

    return { name, price, emoji: this._getEmojiForProduct(name) };
  },

  _getEmojiForProduct(name) {
    if (!name) return '🛒';
    const n = name.toLowerCase();
    if (n.includes('pan dulce') || n.includes('shecas') || n.includes('champurrada')) return '🍩';
    if (n.includes('pan')) return '🍞';
    if (n.includes('tortilla')) return '🌽';
    if (n.includes('pastel') || n.includes('torta')) return '🎂';
    if (n.includes('galleta')) return '🍪';
    if (n.includes('cafe') || n.includes('café')) return '☕';
    if (n.includes('jugo') || n.includes('refresco') || n.includes('agua')) return '🥤';
    if (n.includes('frijol')) return '🫘';
    if (n.includes('azúcar') || n.includes('azucar')) return '🍬';
    if (n.includes('leche')) return '🥛';
    if (n.includes('huevo')) return '🥚';
    if (n.includes('queso')) return '🧀';
    if (n.includes('arroz')) return '🍚';
    if (n.includes('flor') || n.includes('rosa')) return '🌹';
    if (n.includes('libro') || n.includes('cuaderno')) return '📓';
    if (n.includes('pizza')) return '🍕';
    if (n.includes('hamburguesa')) return '🍔';
    if (n.includes('shampoo') || n.includes('champú')) return '🧴';
    if (n.includes('medicina') || n.includes('pastilla')) return '💊';
    if (n.includes('helado')) return '🍦';
    if (n.includes('fruta') || n.includes('manzana') || n.includes('banano')) return '🍎';
    return '🛒';
  },


  // -----------------------------
  //   UI DEL CHAT
  // -----------------------------

  _addMessage(text, type) {
    const container = document.getElementById("chat-messages");
    if (!container) return;
    const msg = document.createElement("div");
    msg.className = `message ${type}`;
    msg.innerHTML = `<div class="bubble">${this._escape(text)}</div>`;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
  },

  _addTypingIndicator() {
    const container = document.getElementById("chat-messages");
    const id = `typing-${Date.now()}`;
    const msg = document.createElement("div");
    msg.id = id;
    msg.className = "message bot";
    msg.innerHTML = `<div class="bubble"><span class="loading-dots"><span></span><span></span><span></span></span></div>`;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    return id;
  },

  _removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  },

  _escape(text) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(String(text)));
    return div.innerHTML;
  },


  // -----------------------------
  //   INICIALIZACIÓN
  // -----------------------------

  init() {
    this._updateBusinessUI();
    setTimeout(() => {
      if (!this.isOpen) this.toggle();
    }, 1500);
  }
};

window.addEventListener("DOMContentLoaded", () => {
  chatPublico.init();
});