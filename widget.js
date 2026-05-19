/**
 * Quetzal AI — Widget embebible
 *
 * Uso:
 *   <script src="https://quetzal-ai.onrender.com/widget.js"
 *           data-business-id="UUID-DEL-NEGOCIO">
 *   </script>
 *
 * Esto inyecta un chatbot flotante en la esquina inferior derecha
 * del sitio web del cliente, que responde con IA usando la info
 * del negocio.
 */

(function() {
  'use strict';

  // -----------------------------
  //   CONFIGURACIÓN
  // -----------------------------

  // Detectar el script que cargó este archivo
  const currentScript = document.currentScript || (function() {
    const scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  const businessId = currentScript.getAttribute('data-business-id');
  if (!businessId) {
    console.error('[Quetzal AI Widget] data-business-id es requerido');
    return;
  }

  // Detectar API URL desde el origen del script
  const scriptSrc = currentScript.src;
  const apiUrl = scriptSrc.includes('localhost') || scriptSrc.includes('127.0.0.1')
    ? 'http://localhost:3000'
    : 'https://quetzal-ai-backend.onrender.com';


  // -----------------------------
  //   ESTADO
  // -----------------------------

  let business = null;
  let isOpen = false;
  let conversationHistory = [];
  let isWaiting = false;


  // -----------------------------
  //   ESTILOS (inyectados en <head>)
  // -----------------------------

  const css = `
    .qa-widget-root, .qa-widget-root * {
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    }

    .qa-widget-root {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 999999;
    }

    .qa-toggle {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #14B8A6, #0F766E);
      border: none;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(20, 184, 166, 0.4);
      position: relative;
      transition: transform 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }

    .qa-toggle:hover { transform: scale(1.05); }

    .qa-toggle-pulse {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      border-radius: 50%;
      background: #14B8A6;
      opacity: 0.3;
      animation: qa-pulse 2s infinite;
      pointer-events: none;
    }

    @keyframes qa-pulse {
      0% { transform: scale(1); opacity: 0.4; }
      100% { transform: scale(1.5); opacity: 0; }
    }

    .qa-window {
      position: absolute;
      right: 0;
      bottom: 76px;
      width: 380px;
      max-width: calc(100vw - 32px);
      height: 560px;
      max-height: calc(100vh - 110px);
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(15, 30, 51, 0.25);
      display: none;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid #E2E8F0;
      animation: qa-slideUp 0.3s ease;
    }

    @keyframes qa-slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .qa-window.open { display: flex; }

    .qa-header {
      padding: 14px 16px;
      background: linear-gradient(135deg, #1E3A5F, #0F1E33);
      color: white;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .qa-avatar {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #FEE2C7, #F4D2A8);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      border: 2px solid white;
      flex-shrink: 0;
    }

    .qa-info { flex: 1; min-width: 0; }

    .qa-name {
      font-size: 14px;
      font-weight: 700;
      color: white;
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .qa-status {
      font-size: 11.5px;
      color: rgba(255,255,255,0.75);
      display: flex;
      align-items: center;
      gap: 5px;
      margin-top: 1px;
    }

    .qa-online-dot {
      width: 6px; height: 6px;
      background: #4ADE80;
      border-radius: 50%;
    }

    .qa-powered {
      background: rgba(255,255,255,0.1);
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 10px;
      color: rgba(255,255,255,0.8);
      font-weight: 600;
      flex-shrink: 0;
    }

    .qa-messages {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      background: #F8FAFC;
    }

    .qa-msg { margin-bottom: 12px; display: flex; }
    .qa-msg-user { justify-content: flex-end; }

    .qa-bubble {
      max-width: 80%;
      padding: 10px 14px;
      border-radius: 14px;
      font-size: 13.5px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .qa-msg-bot .qa-bubble {
      background: white;
      color: #0F1E33;
      border: 1px solid #E2E8F0;
      border-bottom-left-radius: 4px;
    }

    .qa-msg-user .qa-bubble {
      background: linear-gradient(135deg, #14B8A6, #0F766E);
      color: white;
      border-bottom-right-radius: 4px;
    }

    .qa-typing {
      display: inline-flex;
      gap: 4px;
      padding: 4px 0;
    }

    .qa-typing span {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #14B8A6;
      animation: qa-bounce 1.2s infinite ease-in-out both;
    }

    .qa-typing span:nth-child(1) { animation-delay: -0.32s; }
    .qa-typing span:nth-child(2) { animation-delay: -0.16s; }

    @keyframes qa-bounce {
      0%, 80%, 100% { transform: scale(0.5); opacity: 0.5; }
      40% { transform: scale(1); opacity: 1; }
    }

    .qa-suggestions {
      padding: 10px 14px;
      background: white;
      border-top: 1px solid #E2E8F0;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .qa-chip {
      background: #F1F5F9;
      border: 1px solid #E2E8F0;
      color: #0F1E33;
      padding: 5px 11px;
      border-radius: 999px;
      font-family: inherit;
      font-size: 11.5px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .qa-chip:hover {
      background: #CCFBF1;
      border-color: #14B8A6;
      color: #0F766E;
    }

    .qa-input-row {
      padding: 12px 14px;
      border-top: 1px solid #E2E8F0;
      display: flex;
      gap: 8px;
      background: white;
    }

    .qa-input {
      flex: 1;
      padding: 9px 14px;
      border: 1px solid #E2E8F0;
      border-radius: 999px;
      font-family: inherit;
      font-size: 13px;
      background: #F8FAFC;
      outline: none;
    }

    .qa-input:focus {
      border-color: #14B8A6;
      background: white;
    }

    .qa-send {
      width: 38px;
      height: 38px;
      border: none;
      border-radius: 50%;
      background: #14B8A6;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.15s;
    }

    .qa-send:hover { transform: scale(1.05); background: #0F766E; }
  `;


  // -----------------------------
  //   HTML DEL WIDGET
  // -----------------------------

  function buildWidgetHTML() {
    return `
      <div class="qa-widget-root">
        <button class="qa-toggle" id="qa-toggle-btn" aria-label="Abrir chat">
          <svg id="qa-icon-open" width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" fill="white"/>
            <circle cx="9" cy="10" r="1.5" fill="white"/>
            <circle cx="12" cy="10" r="1.5" fill="white"/>
            <circle cx="15" cy="10" r="1.5" fill="white"/>
          </svg>
          <svg id="qa-icon-close" width="20" height="20" viewBox="0 0 24 24" fill="none" style="display:none;">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="white"/>
          </svg>
          <span class="qa-toggle-pulse"></span>
        </button>

        <div class="qa-window" id="qa-window">
          <div class="qa-header">
            <div class="qa-avatar" id="qa-avatar">🏪</div>
            <div class="qa-info">
              <div class="qa-name" id="qa-name">Cargando...</div>
              <div class="qa-status">
                <span class="qa-online-dot"></span>
                En línea — responde al instante
              </div>
            </div>
            <div class="qa-powered" title="Powered by Quetzal AI">Quetzal AI</div>
          </div>

          <div class="qa-messages" id="qa-messages">
            <div class="qa-msg qa-msg-bot">
              <div class="qa-bubble" id="qa-welcome">¡Hola! 👋 Cargando información del negocio...</div>
            </div>
          </div>

          <div class="qa-suggestions" id="qa-suggestions">
            <button class="qa-chip" data-q="¿Cuál es el horario?">¿Horarios?</button>
            <button class="qa-chip" data-q="¿Hacen entregas a domicilio?">¿Entregas?</button>
            <button class="qa-chip" data-q="¿Aceptan tarjeta?">¿Aceptan tarjeta?</button>
          </div>

          <div class="qa-input-row">
            <input type="text" class="qa-input" id="qa-input" placeholder="Escribe tu pregunta..." />
            <button class="qa-send" id="qa-send-btn" aria-label="Enviar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }


  // -----------------------------
  //   LÓGICA DEL CHATBOT
  // -----------------------------

  function getEmojiForType(type) {
    if (!type) return '🏪';
    const t = type.toLowerCase();
    if (t.includes('panaderia') || t.includes('panadería') || t.includes('pan')) return '🥖';
    if (t.includes('comedor') || t.includes('restaurante')) return '🍽️';
    if (t.includes('cafe') || t.includes('café')) return '☕';
    if (t.includes('belleza') || t.includes('salon')) return '💇';
    if (t.includes('farmacia')) return '💊';
    if (t.includes('libreria')) return '📚';
    if (t.includes('ferreteria')) return '🔧';
    if (t.includes('veterinaria')) return '🐾';
    if (t.includes('pizza')) return '🍕';
    if (t.includes('flor')) return '🌸';
    if (t.includes('taller')) return '🔩';
    if (t.includes('ropa')) return '👕';
    return '🏪';
  }

  function escape(text) {
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  function toggle() {
    const window_ = document.getElementById('qa-window');
    const iconOpen = document.getElementById('qa-icon-open');
    const iconClose = document.getElementById('qa-icon-close');

    isOpen = !isOpen;
    if (isOpen) {
      window_.classList.add('open');
      iconOpen.style.display = 'none';
      iconClose.style.display = 'block';
      setTimeout(() => document.getElementById('qa-input').focus(), 200);
    } else {
      window_.classList.remove('open');
      iconOpen.style.display = 'block';
      iconClose.style.display = 'none';
    }
  }

  function addMessage(text, type) {
    const container = document.getElementById('qa-messages');
    const msg = document.createElement('div');
    msg.className = `qa-msg qa-msg-${type}`;
    msg.innerHTML = `<div class="qa-bubble">${escape(text)}</div>`;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
  }

  function addTyping() {
    const container = document.getElementById('qa-messages');
    const id = 'qa-typing-' + Date.now();
    const msg = document.createElement('div');
    msg.id = id;
    msg.className = 'qa-msg qa-msg-bot';
    msg.innerHTML = `<div class="qa-bubble"><span class="qa-typing"><span></span><span></span><span></span></span></div>`;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    return id;
  }

  async function sendMessage(text) {
    if (isWaiting) return;
    const message = (text || document.getElementById('qa-input').value).trim();
    if (!message) return;

    addMessage(message, 'user');
    document.getElementById('qa-input').value = '';

    const suggestions = document.getElementById('qa-suggestions');
    if (suggestions && conversationHistory.length === 0) suggestions.style.display = 'none';

    isWaiting = true;
    const typingId = addTyping();

    try {
      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          businessInfo: business,
          history: conversationHistory.slice(-6)
        })
      });

      const data = await response.json();
      document.getElementById(typingId).remove();
      isWaiting = false;

      if (!data.success) throw new Error(data.error || 'Error');

      addMessage(data.response, 'bot');
      conversationHistory.push({ role: 'user', content: message });
      conversationHistory.push({ role: 'assistant', content: data.response });
    } catch (error) {
      document.getElementById(typingId).remove();
      isWaiting = false;
      console.error('[Quetzal AI Widget]', error);
      addMessage('⚠️ Disculpá, no pude responder. Intentá de nuevo en un momento.', 'bot');
    }
  }


  // -----------------------------
  //   CARGAR INFO DEL NEGOCIO Y RENDERIZAR
  // -----------------------------

  async function loadBusiness() {
    try {
      const response = await fetch(`${apiUrl}/api/public/business/${businessId}`);
      const data = await response.json();

      if (!data.success || !data.business) {
        console.error('[Quetzal AI Widget] Negocio no encontrado:', businessId);
        return null;
      }
      return data.business;
    } catch (error) {
      console.error('[Quetzal AI Widget] Error al cargar negocio:', error);
      return null;
    }
  }

  async function init() {
    // Inyectar estilos
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // Inyectar HTML
    const container = document.createElement('div');
    container.innerHTML = buildWidgetHTML();
    document.body.appendChild(container);

    // Conectar listeners
    document.getElementById('qa-toggle-btn').addEventListener('click', toggle);
    document.getElementById('qa-send-btn').addEventListener('click', () => sendMessage());
    document.getElementById('qa-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
    document.querySelectorAll('.qa-chip').forEach(chip => {
      chip.addEventListener('click', () => sendMessage(chip.getAttribute('data-q')));
    });

    // Cargar info del negocio
    business = await loadBusiness();

    if (!business) {
      document.getElementById('qa-name').textContent = 'Negocio no encontrado';
      document.getElementById('qa-welcome').textContent = '⚠️ No se pudo cargar la información del negocio. Verificá el ID.';
      return;
    }

    // Personalizar UI con datos del negocio
    document.getElementById('qa-name').textContent = business.name;
    document.getElementById('qa-avatar').textContent = getEmojiForType(business.type);
    document.getElementById('qa-welcome').textContent = `¡Hola! 👋 Soy el asistente virtual de ${business.name}. Pregúntame sobre nuestros productos, horarios, entregas o lo que necesités. ¿En qué te puedo ayudar?`;
  }

  // Esperar a que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();