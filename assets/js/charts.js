/**
 * TrialTrack — Charts Module
 * Chart.js wrappers for all chart types
 */

const charts = (() => {
  // Chart instances storage
  const instances = {};

  // Treatment colors (matching design system)
  const treatmentColors = {
    I: { bg: 'rgba(249, 115, 22, 0.7)', border: '#F97316' },
    B: { bg: 'rgba(22, 163, 74, 0.7)', border: '#16A34A' },
    O: { bg: 'rgba(37, 99, 235, 0.7)', border: '#2563EB' },
    OI: { bg: 'rgba(124, 58, 237, 0.7)', border: '#7C3AED' },
    BO: { bg: 'rgba(220, 38, 38, 0.7)', border: '#DC2626' },
    BI: { bg: 'rgba(8, 145, 178, 0.7)', border: '#0891B2' }
  };

  // Default chart options
  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          font: { family: "'DM Sans', sans-serif", size: 12 },
          color: '#64748B',
          usePointStyle: true,
          padding: 16
        }
      },
      tooltip: {
        backgroundColor: '#0F172A',
        titleFont: { family: "'DM Sans', sans-serif", size: 13 },
        bodyFont: { family: "'JetBrains Mono', monospace", size: 12 },
        padding: 12,
        cornerRadius: 8
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { family: "'DM Sans', sans-serif", size: 11 },
          color: '#94A3B8'
        }
      },
      y: {
        grid: { color: '#E2E8F0' },
        ticks: {
          font: { family: "'JetBrains Mono', monospace", size: 11 },
          color: '#94A3B8'
        }
      }
    }
  };

  /**
   * Destroy a chart instance
   * @param {string} id - Chart ID
   */
  function destroy(id) {
    if (instances[id]) {
      instances[id].destroy();
      delete instances[id];
    }
  }

  /**
   * Destroy all chart instances
   */
  function destroyAll() {
    Object.keys(instances).forEach(destroy);
  }

  /**
   * Create Treatment Performance Bar Chart
   * @param {string} canvasId - Canvas element ID
   * @param {Array} data - [{ treatment, value, label }]
   * @param {string} title - Chart title
   * @returns {Chart}
   */
  function createTreatmentBarChart(canvasId, data, title = '') {
    destroy(canvasId);

    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    const labels = data.map(d => d.treatment);
    const values = data.map(d => d.value);
    const colors = data.map(d => treatmentColors[d.treatment] || treatmentColors.I);

    instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: title,
          data: values,
          backgroundColor: colors.map(c => c.bg),
          borderColor: colors.map(c => c.border),
          borderWidth: 2,
          borderRadius: 4
        }]
      },
      options: {
        ...defaultOptions,
        plugins: {
          ...defaultOptions.plugins,
          legend: { display: false }
        }
      }
    });

    return instances[canvasId];
  }

  /**
   * Create Trend Line Chart
   * @param {string} canvasId - Canvas element ID
   * @param {Object} data - { rounds: [1,2,3...], treatments: { I: [v1,v2], B: [...] } }
   * @param {string} title - Chart title
   * @returns {Chart}
   */
  function createTrendLineChart(canvasId, data, title = '') {
    destroy(canvasId);

    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    const datasets = Object.entries(data.treatments).map(([treatment, values]) => ({
      label: CONFIG.TREATMENTS[treatment],
      data: values,
      borderColor: treatmentColors[treatment]?.border || '#64748B',
      backgroundColor: treatmentColors[treatment]?.bg || 'rgba(100,116,139,0.1)',
      tension: 0.3,
      fill: false,
      pointRadius: 4,
      pointHoverRadius: 6
    }));

    instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.rounds.map(r => `Round ${r}`),
        datasets
      },
      options: {
        ...defaultOptions,
        plugins: {
          ...defaultOptions.plugins,
          legend: {
            position: 'bottom',
            labels: {
              font: { family: "'DM Sans', sans-serif", size: 11 },
              color: '#64748B',
              usePointStyle: true,
              padding: 12
            }
          }
        },
        scales: {
          ...defaultOptions.scales,
          y: {
            ...defaultOptions.scales.y,
            beginAtZero: true
          }
        }
      }
    });

    return instances[canvasId];
  }

  /**
   * Create Completion Donut Chart
   * @param {string} canvasId - Canvas element ID
   * @param {Object} data - { entered, total }
   * @returns {Chart}
   */
  function createCompletionDonut(canvasId, data) {
    destroy(canvasId);

    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    const pending = data.total - data.entered;

    instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Entered', 'Pending'],
        datasets: [{
          data: [data.entered, pending],
          backgroundColor: ['#16A34A', '#E2E8F0'],
          borderColor: ['#16A34A', '#E2E8F0'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: { family: "'DM Sans', sans-serif", size: 12 },
              color: '#64748B',
              usePointStyle: true,
              padding: 16
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.raw;
                const total = data.total;
                const percent = Math.round((value / total) * 100);
                return `${context.label}: ${value} (${percent}%)`;
              }
            }
          }
        }
      }
    });

    return instances[canvasId];
  }

  /**
   * Create Block Comparison Bar Chart
   * @param {string} canvasId - Canvas element ID
   * @param {Array} data - [{ block, treatments: { I: val, B: val, ... } }]
   * @returns {Chart}
   */
  function createBlockComparisonChart(canvasId, data) {
    destroy(canvasId);

    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    const labels = data.map(d => `Block ${d.block}`);
    const treatments = CONFIG.TREATMENT_ORDER;

    const datasets = treatments.map(treatment => ({
      label: treatment,
      data: data.map(d => d.treatments[treatment] || 0),
      backgroundColor: treatmentColors[treatment]?.bg || 'rgba(100,116,139,0.7)',
      borderColor: treatmentColors[treatment]?.border || '#64748B',
      borderWidth: 1,
      borderRadius: 2
    }));

    instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        ...defaultOptions,
        scales: {
          x: {
            ...defaultOptions.scales.x,
            stacked: false
          },
          y: {
            ...defaultOptions.scales.y,
            beginAtZero: true
          }
        }
      }
    });

    return instances[canvasId];
  }

  /**
   * Get color scale for heatmap
   * @param {number} value - Value to get color for
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {string} - CSS color
   */
  function getHeatmapColor(value, min, max) {
    if (value === null || value === undefined) {
      return '#F8FAFC'; // Empty cell
    }

    const range = max - min;
    if (range === 0) {
      return '#DCFCE7'; // All same values
    }

    const normalized = (value - min) / range;

    // Green gradient: low = white, high = green
    if (normalized < 0.5) {
      const factor = normalized * 2;
      const r = Math.round(248 + (220 - 248) * factor);
      const g = Math.round(250 + (252 - 250) * factor);
      const b = Math.round(252 + (231 - 252) * factor);
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      const factor = (normalized - 0.5) * 2;
      const r = Math.round(220 - (220 - 22) * factor);
      const g = Math.round(252 - (252 - 163) * factor);
      const b = Math.round(231 - (231 - 74) * factor);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }

  /**
   * Generate heatmap table HTML
   * @param {Object} data - { plots: [1-30], rounds: [{number, entries: {plot: value}}] }
   * @param {string} containerId - Container element ID
   */
  function generateHeatmapTable(data, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Calculate min/max for color scale
    let min = Infinity;
    let max = -Infinity;

    data.rounds.forEach(round => {
      Object.values(round.entries).forEach(val => {
        if (val !== null && val !== undefined) {
          min = Math.min(min, val);
          max = Math.max(max, val);
        }
      });
    });

    if (min === Infinity) min = 0;
    if (max === -Infinity) max = 0;

    let html = '<table class="heatmap-table">';
    html += '<thead><tr><th>Plot</th>';
    data.rounds.forEach(round => {
      html += `<th>R${round.number}</th>`;
    });
    html += '</tr></thead><tbody>';

    data.plots.forEach(plot => {
      html += `<tr><td><span class="chip chip-treatment-${utils.getPlotInfo(plot)?.treatment || 'I'} chip-sm">${plot}</span></td>`;
      data.rounds.forEach(round => {
        const value = round.entries[plot];
        const color = getHeatmapColor(value, min, max);
        const displayValue = value !== null && value !== undefined ? utils.formatNumber(value, 1) : '—';
        html += `<td class="heatmap-cell" style="background-color: ${color}">${displayValue}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table>';

    // Add legend
    html += `
      <div class="heatmap-legend">
        <span>Low</span>
        <div class="heatmap-legend-scale">
          <div class="heatmap-legend-cell" style="background-color: #F8FAFC"></div>
          <div class="heatmap-legend-cell" style="background-color: #DCFCE7"></div>
          <div class="heatmap-legend-cell" style="background-color: #86EFAC"></div>
          <div class="heatmap-legend-cell" style="background-color: #22C55E"></div>
          <div class="heatmap-legend-cell" style="background-color: #16A34A"></div>
        </div>
        <span>High</span>
      </div>
    `;

    container.innerHTML = html;
  }

  // Public API
  return {
    destroy,
    destroyAll,
    createTreatmentBarChart,
    createTrendLineChart,
    createCompletionDonut,
    createBlockComparisonChart,
    getHeatmapColor,
    generateHeatmapTable,
    treatmentColors
  };
})();

// Freeze charts object
Object.freeze(charts);
