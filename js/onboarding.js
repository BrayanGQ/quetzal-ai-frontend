/**
 * Quetzal AI — Onboarding guiado
 *
 * Tour interactivo para usuarios nuevos.
 * Se dispara automáticamente al registrarse (?welcome=1)
 * O manualmente desde el botón "Ver tour" en la sidebar.
 */

const onboarding = {

  currentStep: 0,
  isActive: false,

  // -----------------------------
  //   DEFINICIÓN DEL TOUR
  // -----------------------------

  steps: [
    {
      title: '👋 ¡Bienvenido a Quetzal AI!',
      content: `Hola, qué bueno tenerte por acá. Vamos a configurar tu negocio en <strong>3 pasos rápidos</strong>.<br><br>Al final vas a tener tu propio chatbot con inteligencia artificial, listo para atender a tus clientes 24 horas al día. ¡A darle!`,
      targetTab: null,
      targetElement: null,
      position: 'center',
      buttonText: 'Empezar →'
    },
    {
      title: '1️⃣ Configurá tu negocio',
      content: `Lo primero es contarle a la IA sobre tu negocio: el nombre, qué vendés, tus horarios, formas de pago y entregas.<br><br>Con esa información, la IA va a responder a tus clientes como si fuera vos mismo. <strong>No hay que saber programación</strong> — solo llenar un formulario simple.`,
      targetTab: 'chatbot-config',
      targetElement: '[data-tab="chatbot-config"]',
      position: 'right',
      buttonText: 'Siguiente →'
    },
    {
      title: '2️⃣ Registrá tus ventas',
      content: `Acá vas a poder llevar el control de tus ventas: producto, cantidad, precio y fecha.<br><br>Cuando registrés 3 o más ventas, la IA empieza a darte <strong>análisis automáticos</strong>: cuáles son tus productos estrella, qué días vendés más, predicciones para la próxima semana, y consejos personalizados.`,
      targetTab: 'ventas',
      targetElement: '[data-tab="ventas"]',
      position: 'right',
      buttonText: 'Siguiente →'
    },
    {
      title: '3️⃣ Compartí tu chatbot',
      content: `Cuando termines de configurar, acá vas a obtener:<br><br>📱 <strong>Tu link único</strong> para Instagram/Facebook<br>📷 <strong>Tu código QR</strong> para imprimir<br>💬 <strong>Botones</strong> para compartir directo<br><br>No necesitás sitio web. Solo compartí y tus clientes ya pueden hablar con tu asistente virtual.`,
      targetTab: 'widget',
      targetElement: '[data-tab="widget"]',
      position: 'right',
      buttonText: 'Siguiente →'
    },
    {
      title: '🎉 ¡Listo para empezar!',
      content: `Ya conocés las tres áreas principales. Te recomiendo empezar por el paso 1 (<strong>Configurar Chatbot</strong>) para que la IA tenga la información de tu negocio.<br><br>Cualquier duda, podés volver a ver este tour desde el botón <strong>"🎓 Ver tour"</strong> en el menú de la izquierda.<br><br>¡A darle nomás! 🦜`,
      targetTab: 'chatbot-config',
      targetElement: null,
      position: 'center',
      buttonText: '¡Empezar a configurar!'
    }
  ],


  // -----------------------------
  //   CONTROL DEL TOUR
  // -----------------------------

  start(skipWelcomeCheck = false) {
    // Si no es manual, verificar si ya hizo el tour
    if (!skipWelcomeCheck && localStorage.getItem('quetzal_onboarding_completed')) {
      return;
    }

    this.currentStep = 0;
    this.isActive = true;
    this._render();
  },

  next() {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;

      // Cambiar de tab si es necesario
      const step = this.steps[this.currentStep];
      if (step.targetTab) {
        const tabBtn = document.querySelector(`[data-tab="${step.targetTab}"]`);
        if (tabBtn && typeof admin !== 'undefined') {
          admin.switchTab(step.targetTab, tabBtn);
        }
      }

      this._render();
    } else {
      this.finish();
    }
  },

  prev() {
    if (this.currentStep > 0) {
      this.currentStep--;
      const step = this.steps[this.currentStep];
      if (step.targetTab) {
        const tabBtn = document.querySelector(`[data-tab="${step.targetTab}"]`);
        if (tabBtn && typeof admin !== 'undefined') {
          admin.switchTab(step.targetTab, tabBtn);
        }
      }
      this._render();
    }
  },

  skip() {
    this.finish();
  },

  finish() {
    this.isActive = false;
    localStorage.setItem('quetzal_onboarding_completed', '1');
    this._removeOverlay();

    // Si es el último paso, llevar a configurar chatbot
    const finalStep = this.steps[this.steps.length - 1];
    if (finalStep.targetTab && typeof admin !== 'undefined') {
      const tabBtn = document.querySelector(`[data-tab="${finalStep.targetTab}"]`);
      if (tabBtn) admin.switchTab(finalStep.targetTab, tabBtn);
    }
  },


  // -----------------------------
  //   RENDERIZADO
  // -----------------------------

  _render() {
    this._removeOverlay();

    const step = this.steps[this.currentStep];
    const totalSteps = this.steps.length;
    const stepNumber = this.currentStep + 1;

    // Overlay
    const overlay = document.createElement('div');
    overlay.id = 'onboarding-overlay';
    overlay.className = 'onb-overlay';
    overlay.innerHTML = `
      <div class="onb-backdrop"></div>
      <div class="onb-card onb-card-${step.position}" id="onb-card">
        <div class="onb-progress">
          ${this.steps.map((_, i) => `
            <div class="onb-progress-dot ${i === this.currentStep ? 'active' : ''} ${i < this.currentStep ? 'done' : ''}"></div>
          `).join('')}
        </div>

        <div class="onb-step-number">Paso ${stepNumber} de ${totalSteps}</div>

        <h2 class="onb-title">${step.title}</h2>
        <p class="onb-content">${step.content}</p>

        <div class="onb-actions">
          ${this.currentStep > 0 ? `
            <button class="onb-btn-secondary" onclick="onboarding.prev()">← Atrás</button>
          ` : ''}

          ${this.currentStep === 0 ? `
            <button class="onb-btn-skip" onclick="onboarding.skip()">Omitir tour</button>
          ` : ''}

          <button class="onb-btn-primary" onclick="onboarding.next()">${step.buttonText}</button>
        </div>
      </div>

      ${step.targetElement ? '<div class="onb-spotlight" id="onb-spotlight"></div>' : ''}
    `;

    document.body.appendChild(overlay);

    // Posicionar el spotlight si hay elemento target
    if (step.targetElement) {
      requestAnimationFrame(() => {
        this._positionSpotlight(step);
      });
    }
  },

  _positionSpotlight(step) {
    const target = document.querySelector(step.targetElement);
    const spotlight = document.getElementById('onb-spotlight');
    const card = document.getElementById('onb-card');

    if (!target || !spotlight) return;

    const rect = target.getBoundingClientRect();
    const padding = 8;

    spotlight.style.top = `${rect.top - padding}px`;
    spotlight.style.left = `${rect.left - padding}px`;
    spotlight.style.width = `${rect.width + (padding * 2)}px`;
    spotlight.style.height = `${rect.height + (padding * 2)}px`;

    // Posicionar la card cerca del elemento (no encima)
    if (step.position === 'right' && card) {
      // Si el sidebar está a la izquierda, la card va a la derecha
      const cardRect = card.getBoundingClientRect();
      const newLeft = rect.right + 30;
      const maxLeft = window.innerWidth - cardRect.width - 30;

      if (newLeft + cardRect.width < window.innerWidth) {
        card.style.position = 'fixed';
        card.style.left = `${newLeft}px`;
        card.style.top = `${Math.max(20, rect.top - 30)}px`;
        card.style.transform = 'none';
      }
    }
  },

  _removeOverlay() {
    const existing = document.getElementById('onboarding-overlay');
    if (existing) existing.remove();
  },


  // -----------------------------
  //   RESET (para testing)
  // -----------------------------

  reset() {
    localStorage.removeItem('quetzal_onboarding_completed');
    this.start(true);
  }
};

// -----------------------------
//   AUTO-START EN ?welcome=1
// -----------------------------

window.addEventListener('DOMContentLoaded', () => {
  // Esperar a que admin.init termine
  const checkAndStart = setInterval(() => {
    if (typeof admin !== 'undefined' && admin.accessToken) {
      clearInterval(checkAndStart);

      const params = new URLSearchParams(window.location.search);
      if (params.get('welcome') === '1') {
        // Pequeño delay para que el panel cargue bien
        setTimeout(() => onboarding.start(), 600);
      }
    }
  }, 100);
});