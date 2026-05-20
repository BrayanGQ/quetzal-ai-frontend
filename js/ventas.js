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
  //   IA #4 — REPORTE MENSUAL PDF
  // -----------------------------

  isReporting: false,

  async requestReporteMensual() {
    if (this.isReporting) return;

    if (this.sales.length < 5) {
      admin._toast('⚠️ Necesitás al menos 5 ventas para generar un reporte útil', 'error');
      return;
    }

    if (!window.jspdf) {
      admin._toast('⚠️ Cargando librería PDF, intentá de nuevo en 2 segundos', 'error');
      return;
    }

    this.isReporting = true;
    const card = document.getElementById("reporte-card");
    const content = document.getElementById("reporte-content");
    card.style.display = "block";
    content.innerHTML = `<div class="insight-loading"><span class="loading-dots"><span></span><span></span><span></span></span>🧠 Generando reporte profesional del mes...</div>`;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });

    try {
      const response = await admin.apiCall('/api/reporte-mensual', {
        method: 'POST',
        body: JSON.stringify({})
      });
      const data = await response.json();
      this.isReporting = false;

      if (!data.success) throw new Error(data.error);

      this._renderReportePreview(data.report);
    } catch (error) {
      this.isReporting = false;
      console.error('[Reporte]', error);
      content.innerHTML = `<p style="color:#EF4444;padding:14px;">⚠️ ${error.message}</p>`;
    }
  },

  _renderReportePreview(report) {
    const content = document.getElementById("reporte-content");
    if (!content || !report) return;

    const k = report.kpis;
    const products = report.topProducts.slice(0, 3).map(p =>
      `<li><strong>${this._escape(p.name)}</strong> — ${p.units} unidades · Q ${p.revenue.toFixed(2)}</li>`
    ).join('');

    content.innerHTML = `
      <div class="reporte-preview">
        <div class="reporte-meta">
          <div>
            <strong>${this._escape(report.business.name)}</strong>
            <div class="reporte-period">${this._escape(report.period.monthName)} ${report.period.year}</div>
          </div>
          <div class="reporte-stamp">Generado con IA</div>
        </div>

        <div class="reporte-kpis">
          <div class="reporte-kpi">
            <div class="reporte-kpi-label">Ingresos totales</div>
            <div class="reporte-kpi-value">Q ${k.totalRevenue.toFixed(2)}</div>
          </div>
          <div class="reporte-kpi">
            <div class="reporte-kpi-label">Transacciones</div>
            <div class="reporte-kpi-value">${k.totalTransactions}</div>
          </div>
          <div class="reporte-kpi">
            <div class="reporte-kpi-label">Ticket promedio</div>
            <div class="reporte-kpi-value">Q ${k.avgTicket.toFixed(2)}</div>
          </div>
        </div>

        <div class="reporte-section">
          <h4>🛒 Productos más vendidos</h4>
          <ul class="reporte-list">${products}</ul>
        </div>

        <div class="reporte-section">
          <h4>🧠 Análisis profesional</h4>
          <p class="reporte-text">${this._escape(report.analysis.hallazgos || '')}</p>
        </div>

        <div class="reporte-actions">
          <button class="btn-primary btn-download-pdf" onclick="ventas._generatePDF()">
            ⬇️ Descargar reporte completo en PDF
          </button>
        </div>
      </div>
    `;

    // Guardar para usar al descargar
    this._currentReport = report;
  },

  async _generatePDF() {
    const report = this._currentReport;
    if (!report) {
      admin._toast('⚠️ No hay reporte para descargar', 'error');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });

    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 18;
    const contentWidth = pageWidth - (marginX * 2);
    let y = 20;

    const COLOR_NAVY = [15, 30, 51];
    const COLOR_PRIMARY = [20, 184, 166];
    const COLOR_MUTED = [100, 116, 139];
    const COLOR_GOLD = [180, 83, 9];

    // ========== HEADER ==========
    doc.setFillColor(...COLOR_NAVY);
    doc.rect(0, 0, pageWidth, 35, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(report.business.name || 'Reporte mensual', marginX, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const periodLine = `Reporte de ${report.period.monthName} ${report.period.year}`;
    doc.text(periodLine, marginX, 26);

    doc.setFontSize(9);
    doc.setTextColor(180, 200, 220);
    doc.text('Generado con Quetzal AI', pageWidth - marginX, 18, { align: 'right' });
    const dateStr = new Date(report.period.generatedAt).toLocaleDateString('es-GT', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
    doc.text(dateStr, pageWidth - marginX, 26, { align: 'right' });

    y = 50;

    // ========== RESUMEN EJECUTIVO ==========
    doc.setTextColor(...COLOR_NAVY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('RESUMEN EJECUTIVO', marginX, y);
    y += 2;
    doc.setDrawColor(...COLOR_PRIMARY);
    doc.setLineWidth(0.6);
    doc.line(marginX, y, marginX + 50, y);
    y += 10;

    const k = report.kpis;
    const kpiData = [
      ['Ingresos totales:', `Q ${k.totalRevenue.toFixed(2)}`],
      ['Total de transacciones:', `${k.totalTransactions}`],
      ['Ticket promedio:', `Q ${k.avgTicket.toFixed(2)}`],
      ['Día con mayor venta:', `${k.strongestDay} (Q ${k.strongestDayRevenue.toFixed(2)})`],
      ['Hora pico:', k.peakHour]
    ];

    doc.setFontSize(11);
    kpiData.forEach(([label, value]) => {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLOR_MUTED);
      doc.text(label, marginX, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLOR_NAVY);
      doc.text(value, marginX + 70, y);
      y += 7;
    });

    y += 6;

    // ========== PRODUCTOS TOP ==========
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLOR_NAVY);
    doc.text('PRODUCTOS MÁS VENDIDOS', marginX, y);
    y += 2;
    doc.line(marginX, y, marginX + 70, y);
    y += 6;

    // Tabla de productos
    doc.autoTable({
      startY: y,
      head: [['#', 'Producto', 'Unidades', 'Ingresos']],
      body: report.topProducts.slice(0, 5).map((p, i) => [
        i + 1,
        p.name,
        p.units,
        `Q ${p.revenue.toFixed(2)}`
      ]),
      theme: 'striped',
      headStyles: {
        fillColor: COLOR_PRIMARY,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: { fontSize: 10 },
      margin: { left: marginX, right: marginX }
    });
    y = doc.lastAutoTable.finalY + 10;

    // ========== VENTAS POR DÍA ==========
    if (y > 220) { doc.addPage(); y = 20; }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLOR_NAVY);
    doc.text('VENTAS POR DÍA DE LA SEMANA', marginX, y);
    y += 2;
    doc.line(marginX, y, marginX + 80, y);
    y += 6;

    doc.autoTable({
      startY: y,
      head: [['Día', 'Transacciones', 'Ingresos', 'Promedio']],
      body: report.dayBreakdown.map(d => [
        d.name,
        d.count,
        `Q ${d.revenue.toFixed(2)}`,
        d.count > 0 ? `Q ${(d.revenue / d.count).toFixed(2)}` : '—'
      ]),
      theme: 'grid',
      headStyles: {
        fillColor: COLOR_NAVY,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: { fontSize: 10 },
      margin: { left: marginX, right: marginX }
    });
    y = doc.lastAutoTable.finalY + 12;

    // ========== ANÁLISIS DE LA IA ==========
    if (y > 220) { doc.addPage(); y = 20; }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLOR_NAVY);
    doc.text('ANÁLISIS PROFESIONAL', marginX, y);
    y += 2;
    doc.line(marginX, y, marginX + 65, y);
    y += 8;

    // Hallazgos
    if (report.analysis.hallazgos) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLOR_PRIMARY);
      doc.text('Hallazgos del mes:', marginX, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLOR_NAVY);
      doc.setFontSize(10);
      const hallazgosLines = doc.splitTextToSize(report.analysis.hallazgos, contentWidth);
      doc.text(hallazgosLines, marginX, y);
      y += hallazgosLines.length * 5 + 8;
    }

    // Oportunidades
    if (report.analysis.oportunidades && report.analysis.oportunidades.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLOR_GOLD);
      doc.text('Oportunidades identificadas:', marginX, y);
      y += 7;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLOR_NAVY);
      doc.setFontSize(10);
      report.analysis.oportunidades.forEach((op, i) => {
        const text = `${i + 1}.  ${op}`;
        const lines = doc.splitTextToSize(text, contentWidth - 4);
        if (y + (lines.length * 5) > 270) { doc.addPage(); y = 20; }
        doc.text(lines, marginX, y);
        y += lines.length * 5 + 3;
      });
      y += 5;
    }

    // Recomendaciones
    if (report.analysis.recomendaciones && report.analysis.recomendaciones.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLOR_NAVY);
      doc.text('RECOMENDACIONES PARA EL PRÓXIMO MES', marginX, y);
      y += 2;
      doc.line(marginX, y, marginX + 95, y);
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLOR_NAVY);
      doc.setFontSize(10);
      report.analysis.recomendaciones.forEach((rec, i) => {
        const text = `${i + 1}.  ${rec}`;
        const lines = doc.splitTextToSize(text, contentWidth - 4);
        if (y + (lines.length * 5) > 270) { doc.addPage(); y = 20; }
        doc.text(lines, marginX, y);
        y += lines.length * 5 + 4;
      });
      y += 5;
    }

    // Proyección
    if (report.analysis.proyeccion) {
      if (y > 230) { doc.addPage(); y = 20; }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLOR_NAVY);
      doc.text('PROYECCIÓN', marginX, y);
      y += 2;
      doc.line(marginX, y, marginX + 30, y);
      y += 8;

      // Recuadro
      const projLines = doc.splitTextToSize(report.analysis.proyeccion, contentWidth - 10);
      const boxHeight = projLines.length * 5 + 10;

      doc.setFillColor(245, 250, 252);
      doc.setDrawColor(...COLOR_PRIMARY);
      doc.setLineWidth(0.5);
      doc.roundedRect(marginX, y, contentWidth, boxHeight, 2, 2, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...COLOR_NAVY);
      doc.text(projLines, marginX + 5, y + 7);
      y += boxHeight + 8;
    }

    // ========== FOOTER ==========
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);

      // Línea
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.3);
      doc.line(marginX, 280, pageWidth - marginX, 280);

      // Texto
      doc.setFontSize(8);
      doc.setTextColor(...COLOR_MUTED);
      doc.setFont('helvetica', 'normal');
      doc.text('Generado por Quetzal AI · Asistente Inteligente para PYMES', marginX, 285);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - marginX, 285, { align: 'right' });
    }

    // ========== GUARDAR ==========
    const safeName = (report.business.name || 'reporte')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-');
    const filename = `reporte-${safeName}-${report.period.monthName.toLowerCase()}-${report.period.year}.pdf`;

    doc.save(filename);
    admin._toast('✅ Reporte descargado correctamente');
  },

  closeReporte() {
    document.getElementById("reporte-card").style.display = "none";
    this._currentReport = null;
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