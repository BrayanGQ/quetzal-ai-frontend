/**
 * Quetzal AI — Panel de Ventas (con Supabase)
 * Las ventas se guardan en la base de datos del usuario logueado
 */

const ventas = {

  sales: [],
  isAnalyzing: false,
  isPredicting: false,
  isAdvising: false,


  // -----------------------------
  //   PERSISTENCIA (vía API + Supabase)
  // -----------------------------

  async _loadFromAPI() {
    try {
      const response = await admin.apiCall('/api/sales');
      const data = await response.json();
      if (data.success) {
        this.sales = data.sales || [];
      }
    } catch (error) {
      console.error('[Load sales]', error);
      this.sales = [];
    }
  },


  // -----------------------------
  //   AGREGAR / ELIMINAR VENTAS
  // -----------------------------

  async addSale() {
    const productInput = document.getElementById("sale-product");
    const qtyInput = document.getElementById("sale-qty");
    const priceInput = document.getElementById("sale-price");
    const dateInput = document.getElementById("sale-date");

    const product = productInput.value.trim();
    const qty = parseInt(qtyInput.value);
    const price = parseFloat(priceInput.value);
    const dateStr = dateInput.value;

    if (!product) { admin._toast('⚠️ Indicá el nombre del producto', 'error'); productInput.focus(); return; }
    if (!qty || qty < 1) { admin._toast('⚠️ La cantidad debe ser al menos 1', 'error'); qtyInput.focus(); return; }
    if (!price || price <= 0) { admin._toast('⚠️ El precio debe ser mayor a 0', 'error'); priceInput.focus(); return; }

    const date = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();

    try {
      const response = await admin.apiCall('/api/sales', {
        method: 'POST',
        body: JSON.stringify({ product, qty, price, date })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Error al registrar venta');

      this.sales.unshift(data.sale);
      this._renderAll();

      productInput.value = '';
      qtyInput.value = '1';
      priceInput.value = '';

      admin._toast('✅ Venta registrada en la base de datos');

      if (this.sales.length >= 3 && !this.isAnalyzing) {
        this.requestAIAnalysis();
      }
    } catch (error) {
      console.error('[Add sale]', error);
      admin._toast(`⚠️ No se pudo registrar: ${error.message}`, 'error');
    }
  },

  async deleteSale(id) {
    if (!confirm('¿Borrar esta venta del historial?')) return;

    try {
      const response = await admin.apiCall(`/api/sales/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      this.sales = this.sales.filter(s => s.id !== id);
      this._renderAll();
      admin._toast('Venta eliminada');
    } catch (error) {
      console.error('[Delete sale]', error);
      admin._toast(`⚠️ No se pudo borrar: ${error.message}`, 'error');
    }
  },

  async loadSampleData() {
    if (this.sales.length > 0) {
      if (!confirm('Ya hay ventas registradas. ¿Reemplazar con datos de ejemplo?')) return;
      await this.clearAll(true);
    }

    try {
      const response = await admin.apiCall('/api/sales/bulk', {
        method: 'POST',
        body: JSON.stringify({ sales: SAMPLE_SALES })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      await this._loadFromAPI();
      this._renderAll();
      this.requestAIAnalysis();
      admin._toast(`📋 ${data.count} ventas de ejemplo cargadas`);
    } catch (error) {
      console.error('[Load sample]', error);
      admin._toast(`⚠️ No se pudo cargar: ${error.message}`, 'error');
    }
  },

  async clearAll(skipConfirm = false) {
    if (!skipConfirm && !confirm('¿Borrar TODAS las ventas registradas?')) return;

    try {
      const response = await admin.apiCall('/api/sales', { method: 'DELETE' });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      this.sales = [];
      this._renderAll();
      this.closePrediction();
      this.closeConsejos();
      if (!skipConfirm) admin._toast('Todas las ventas fueron eliminadas');
    } catch (error) {
      console.error('[Clear all]', error);
      admin._toast(`⚠️ No se pudo borrar: ${error.message}`, 'error');
    }
  },


  // -----------------------------
  //   CÁLCULOS
  // -----------------------------

  _computeKPIs() {
    if (this.sales.length === 0) return { totalRevenue: 0, totalSales: 0, avgTicket: 0, peakHour: '—' };

    const totalRevenue = this.sales.reduce((sum, s) => sum + (s.qty * s.price), 0);
    const totalSales = this.sales.length;
    const avgTicket = totalRevenue / totalSales;

    const hourTotals = {};
    this.sales.forEach(s => {
      const hour = new Date(s.date).getHours();
      hourTotals[hour] = (hourTotals[hour] || 0) + (s.qty * s.price);
    });
    const peakEntry = Object.entries(hourTotals).sort((a, b) => b[1] - a[1])[0];
    const peakHour = peakEntry ? `${peakEntry[0]}:00` : '—';

    return { totalRevenue, totalSales, avgTicket, peakHour };
  },

  _computeDailyTotals() {
    const days = [];
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    for (let i = 6; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(day.getDate() - i);
      day.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      const dayName = day.toLocaleDateString('es-GT', { weekday: 'short' });
      const dayShort = dayName.charAt(0).toUpperCase() + dayName.slice(1, 3);

      const total = this.sales
        .filter(s => { const sd = new Date(s.date); return sd >= day && sd <= dayEnd; })
        .reduce((sum, s) => sum + (s.qty * s.price), 0);

      const dayOfWeek = day.getDay();
      days.push({ label: dayShort, amount: total, weekend: dayOfWeek === 0 || dayOfWeek === 6 });
    }
    return days;
  },


  // -----------------------------
  //   RENDERIZADO
  // -----------------------------

  _renderAll() {
    this._renderKPIs();
    this._renderChart();
    this._renderTable();
  },

  _renderKPIs() {
    const kpis = this._computeKPIs();
    const grid = document.getElementById("kpi-grid");
    if (!grid) return;
    grid.innerHTML = `
      <div class="kpi-card">
        <div class="kpi-label">Ingresos totales</div>
        <div class="kpi-value">Q ${kpis.totalRevenue.toFixed(2)}</div>
        <div class="kpi-delta">${kpis.totalSales} ventas registradas</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Ticket promedio</div>
        <div class="kpi-value">Q ${kpis.avgTicket.toFixed(2)}</div>
        <div class="kpi-delta">por transacción</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total de ventas</div>
        <div class="kpi-value">${kpis.totalSales}</div>
        <div class="kpi-delta">transacciones</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Hora pico</div>
        <div class="kpi-value">${kpis.peakHour}</div>
        <div class="kpi-delta">mayor volumen</div>
      </div>
    `;
  },

  _renderChart() {
    const chartContainer = document.getElementById("bar-chart");
    const labelsContainer = document.getElementById("chart-labels");
    const subtitleEl = document.getElementById("chart-subtitle");
    if (!chartContainer || !labelsContainer) return;

    chartContainer.innerHTML = "";
    labelsContainer.innerHTML = "";

    if (this.sales.length === 0) {
      chartContainer.innerHTML = '<div class="empty-chart">Registrá tu primera venta para ver el gráfico</div>';
      if (subtitleEl) subtitleEl.textContent = 'Sin datos aún';
      return;
    }

    const days = this._computeDailyTotals();
    const maxAmount = Math.max(...days.map(d => d.amount), 1);

    if (subtitleEl) {
      const total = days.reduce((s, d) => s + d.amount, 0);
      subtitleEl.textContent = `Últimos 7 días — Q ${total.toFixed(2)} en total`;
    }

    days.forEach(({ label, amount, weekend }) => {
      const wrap = document.createElement("div");
      wrap.className = "bar-wrap";

      if (amount > 0) {
        const valTip = document.createElement("div");
        valTip.className = "bar-tip";
        valTip.textContent = amount >= 1000 ? `Q${(amount/1000).toFixed(1)}k` : `Q${Math.round(amount)}`;
        wrap.appendChild(valTip);
      }

      const bar = document.createElement("div");
      bar.className = `bar ${weekend ? "weekend" : ""}`;
      const heightPx = Math.max(Math.round((amount / maxAmount) * 150), amount > 0 ? 10 : 2);
      bar.style.height = `${heightPx}px`;
      bar.title = `${label}: Q${amount.toFixed(2)}`;
      if (amount === 0) bar.style.opacity = '0.25';

      wrap.appendChild(bar);
      chartContainer.appendChild(wrap);

      const dayLabel = document.createElement("div");
      dayLabel.className = "bar-day";
      dayLabel.textContent = label;
      labelsContainer.appendChild(dayLabel);
    });
  },

  _renderTable() {
    const tbody = document.getElementById("sales-tbody");
    const empty = document.getElementById("sales-empty");
    if (!tbody) return;

    if (this.sales.length === 0) {
      tbody.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    const sorted = [...this.sales].sort((a, b) => new Date(b.date) - new Date(a.date));
    tbody.innerHTML = sorted.map(s => {
      const date = new Date(s.date);
      const dateStr = date.toLocaleString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
      const total = (s.qty * s.price).toFixed(2);
      return `<tr>
        <td>${this._escape(dateStr)}</td>
        <td>${this._escape(s.product)}</td>
        <td>${s.qty}</td>
        <td>Q ${s.price.toFixed(2)}</td>
        <td><strong>Q ${total}</strong></td>
        <td><button class="btn-delete-row" onclick="ventas.deleteSale('${s.id}')" title="Eliminar">×</button></td>
      </tr>`;
    }).join('');
  },


  // -----------------------------
  //   IA #1 — ANÁLISIS AUTOMÁTICO
  // -----------------------------

  async requestAIAnalysis() {
    const container = document.getElementById("insights-container");
    if (!container) return;

    if (this.sales.length < 3) {
      container.innerHTML = `<div class="insight-empty"><p>Registrá al menos 3 ventas y la IA te dará insights automáticos sobre tu negocio.</p></div>`;
      return;
    }

    if (this.isAnalyzing) return;
    this.isAnalyzing = true;

    container.innerHTML = `<div class="insight-loading"><span class="loading-dots"><span></span><span></span><span></span></span>🧠 Llama 3.3 analizando tus ${this.sales.length} ventas...</div>`;

    try {
      const response = await admin.apiCall('/api/analizar-ventas', {
        method: 'POST',
        body: JSON.stringify({})
      });
      const data = await response.json();
      this.isAnalyzing = false;
      if (!data.success) throw new Error(data.error || 'Error en análisis');
      this._renderInsights(data.insights);
    } catch (error) {
      this.isAnalyzing = false;
      console.error('[Análisis IA]', error);
      container.innerHTML = `<div class="insight-empty"><p>⚠️ ${error.message}</p><button class="btn-secondary" style="margin-top:12px;" onclick="ventas.requestAIAnalysis()">Reintentar</button></div>`;
    }
  },

  _renderInsights(insights) {
    const container = document.getElementById("insights-container");
    if (!container || !Array.isArray(insights)) return;
    container.innerHTML = insights.map(text => `<div class="insight"><div class="insight-text">${this._escape(text)}</div></div>`).join('');
  },


  // -----------------------------
  //   IA #2 — PREDICCIÓN
  // -----------------------------

  async requestPrediction() {
    if (this.isPredicting) return;
    if (this.sales.length < 5) {
      admin._toast('⚠️ Necesitás al menos 5 ventas para una predicción confiable', 'error');
      return;
    }

    this.isPredicting = true;
    const card = document.getElementById("prediction-card");
    const content = document.getElementById("prediction-content");
    card.style.display = "block";
    content.innerHTML = `<div class="insight-loading"><span class="loading-dots"><span></span><span></span><span></span></span>🧠 Llama 3.3 proyectando los próximos 7 días...</div>`;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });

    try {
      const response = await admin.apiCall('/api/predecir-ventas', {
        method: 'POST',
        body: JSON.stringify({})
      });
      const data = await response.json();
      this.isPredicting = false;
      if (!data.success) throw new Error(data.error);
      this._renderPrediction(data.prediction);
    } catch (error) {
      this.isPredicting = false;
      console.error('[Predicción]', error);
      content.innerHTML = `<p style="color:#EF4444;padding:14px;">⚠️ ${error.message}</p>`;
    }
  },

  _renderPrediction(p) {
    const content = document.getElementById("prediction-content");
    if (!content || !p) return;
    content.innerHTML = `
      <div class="prediction-grid">
        <div class="prediction-stat">
          <div class="prediction-stat-label">📈 Ingresos estimados</div>
          <div class="prediction-stat-value range">Q ${p.ingresos_min} – Q ${p.ingresos_max}</div>
        </div>
        <div class="prediction-stat">
          <div class="prediction-stat-label">🎯 Día más fuerte</div>
          <div class="prediction-stat-value">${this._escape(p.dia_mas_fuerte || '—')}</div>
        </div>
        <div class="prediction-stat">
          <div class="prediction-stat-label">🛒 Producto estrella</div>
          <div class="prediction-stat-value">${this._escape(p.producto_estrella || '—')}</div>
        </div>
        <div class="prediction-stat">
          <div class="prediction-stat-label">⏰ Hora pico esperada</div>
          <div class="prediction-stat-value">${this._escape(p.hora_pico || '—')}</div>
        </div>
      </div>
      <div class="prediction-recomendacion">
        <strong>💡 Recomendación de la IA</strong>
        ${this._escape(p.recomendacion || 'Mantené el ritmo actual del negocio.')}
      </div>
    `;
  },

  closePrediction() {
    document.getElementById("prediction-card").style.display = "none";
  },


  // -----------------------------
  //   IA #3 — CONSEJOS
  // -----------------------------

  async requestConsejos() {
    if (this.isAdvising) return;
    if (this.sales.length < 3) {
      admin._toast('⚠️ Necesitás al menos 3 ventas para recibir consejos', 'error');
      return;
    }

    this.isAdvising = true;
    const card = document.getElementById("consejos-card");
    const content = document.getElementById("consejos-content");
    card.style.display = "block";
    content.innerHTML = `<div class="insight-loading"><span class="loading-dots"><span></span><span></span><span></span></span>🧠 Llama 3.3 generando tu plan de acción...</div>`;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });

    try {
      const response = await admin.apiCall('/api/consejos-negocio', {
        method: 'POST',
        body: JSON.stringify({})
      });
      const data = await response.json();
      this.isAdvising = false;
      if (!data.success) throw new Error(data.error);
      this._renderConsejos(data.consejos);
    } catch (error) {
      this.isAdvising = false;
      console.error('[Consejos]', error);
      content.innerHTML = `<p style="color:#EF4444;padding:14px;">⚠️ ${error.message}</p>`;
    }
  },

  _renderConsejos(consejos) {
    const content = document.getElementById("consejos-content");
    if (!content || !Array.isArray(consejos)) return;
    content.innerHTML = `<div class="consejos-list">${consejos.map(c => `
      <div class="consejo-item">
        <div class="consejo-emoji">${this._escape(c.emoji || '💡')}</div>
        <div>
          <div class="consejo-titulo">${this._escape(c.titulo || '')}</div>
          <div class="consejo-accion">${this._escape(c.accion || '')}</div>
        </div>
      </div>`).join('')}</div>`;
  },

  closeConsejos() {
    document.getElementById("consejos-card").style.display = "none";
  },


  // -----------------------------
  //   UTILIDADES
  // -----------------------------

  _escape(text) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(String(text)));
    return div.innerHTML;
  },

  _setDefaultDate() {
    const dateInput = document.getElementById("sale-date");
    if (dateInput && !dateInput.value) {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      dateInput.value = now.toISOString().slice(0, 16);
    }
  },


  // -----------------------------
  //   INICIALIZACIÓN
  // -----------------------------

  async init() {
    this._setDefaultDate();
    await this._loadFromAPI();
    this._renderAll();

    if (this.sales.length >= 3) {
      setTimeout(() => this.requestAIAnalysis(), 600);
    }
  }
};

// Se inicializa DESPUÉS de admin.init() (que valida la sesión)
window.addEventListener("DOMContentLoaded", () => {
  // Esperar a que admin.init termine (necesitamos accessToken)
  const waitForAdmin = setInterval(() => {
    if (admin.accessToken) {
      clearInterval(waitForAdmin);
      ventas.init();
    }
  }, 100);
});