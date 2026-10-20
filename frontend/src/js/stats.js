/**
 * GIS PARIWISATA PROVINSI BALI
 * Statistics & Analytics Module: Chart.js Visualizations & Spatial Metrics
 * Theme: Modern Tech Blue & White (High Contrast, Professional GIS)
 */

const StatsModule = {
  charts: {},

  init() {
    // Only fetch if visible or on load
    this.loadStats();
  },

  async loadStats() {
    try {
      const res = await fetch('/api/stats');
      const stats = await res.json();
      if (!stats.success) return;

      // 1. Update KPI numbers
      const elTotal = document.getElementById('stat-total-dest');
      const elRating = document.getElementById('stat-avg-rating');
      const elKab = document.getElementById('stat-top-kab');
      const elCat = document.getElementById('stat-top-cat');

      if (elTotal) elTotal.innerText = stats.total_destinations;
      if (elRating) elRating.innerText = `${stats.avg_rating} ⭐`;

      const topKab = stats.by_kabupaten && stats.by_kabupaten[0] ? stats.by_kabupaten[0].kabupaten : 'BADUNG';
      if (elKab) elKab.innerText = topKab;

      const topCat = stats.by_category && stats.by_category[0] ? stats.by_category[0].category : 'Pantai';
      if (elCat) elCat.innerText = topCat;

      // 2. Render Charts with slight delay to ensure tab reflow is complete
      setTimeout(() => {
        this.renderKabupatenChart(stats.by_kabupaten);
        this.renderCategoryChart(stats.by_category);
        this.renderTopRatedChart(stats.top_rated);
        this.renderDensityChart();
      }, 60);

    } catch (err) {
      console.warn('Failed to load stats:', err.message);
    }
  },

  renderKabupatenChart(data = []) {
    const ctx = document.getElementById('chart-kabupaten');
    if (!ctx) return;

    if (this.charts.kabupaten) {
      this.charts.kabupaten.destroy();
    }

    const labels = data.map(d => d.kabupaten);
    const counts = data.map(d => d.count);

    this.charts.kabupaten = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Jumlah Objek Wisata',
          data: counts,
          backgroundColor: '#2563eb',
          hoverBackgroundColor: '#1d4ed8',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            padding: 10,
            cornerRadius: 6
          }
        },
        scales: {
          x: {
            ticks: { color: '#475569', font: { family: 'Plus Jakarta Sans', weight: '600', size: 11 } },
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            ticks: { color: '#64748b', stepSize: 2, font: { family: 'Plus Jakarta Sans', size: 11 } },
            grid: { color: '#e2e8f0' }
          }
        }
      }
    });
  },

  renderCategoryChart(data = []) {
    const ctx = document.getElementById('chart-category');
    if (!ctx) return;

    if (this.charts.category) {
      this.charts.category.destroy();
    }

    const labels = data.map(d => d.category);
    const counts = data.map(d => d.count);

    const modernCategoryColors = [
      '#0284c7', // Pantai (Ocean Blue)
      '#d97706', // Budaya (Amber Gold)
      '#059669', // Alam (Emerald)
      '#06b6d4', // Air Terjun (Cyan)
      '#7c3aed', // Rekreasi (Purple)
      '#e11d48'  // Kuliner (Rose)
    ];

    this.charts.category = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: counts,
          backgroundColor: modernCategoryColors,
          borderColor: '#ffffff',
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#334155',
              font: { family: 'Plus Jakarta Sans', size: 12, weight: '600' },
              boxWidth: 14,
              padding: 14
            }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 10,
            cornerRadius: 6
          }
        },
        cutout: '65%'
      }
    });
  },

  renderTopRatedChart(data = []) {
    const ctx = document.getElementById('chart-top-rated');
    if (!ctx) return;

    if (this.charts.topRated) {
      this.charts.topRated.destroy();
    }

    const labels = data.map(d => d.name);
    const ratings = data.map(d => d.rating);

    this.charts.topRated = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Rating Pengunjung',
          data: ratings,
          backgroundColor: '#f59e0b',
          hoverBackgroundColor: '#d97706',
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 10,
            cornerRadius: 6
          }
        },
        scales: {
          x: {
            min: 4.0,
            max: 5.0,
            ticks: { color: '#64748b', stepSize: 0.2, font: { family: 'Plus Jakarta Sans', size: 11 } },
            grid: { color: '#e2e8f0' }
          },
          y: {
            ticks: { color: '#1e293b', font: { family: 'Plus Jakarta Sans', weight: '600', size: 11 } },
            grid: { display: false }
          }
        }
      }
    });
  },

  async renderDensityChart() {
    const ctx = document.getElementById('chart-density');
    if (!ctx) return;

    if (this.charts.density) {
      this.charts.density.destroy();
    }

    let clustered = 31;
    let noise = 16;

    if (window.SpatialModule && window.SpatialModule.dbscanResult) {
      clustered = window.SpatialModule.dbscanResult.total_clustered_points;
      noise = window.SpatialModule.dbscanResult.total_noise_points;
    }

    this.charts.density = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Titik Teraglomerasi (Dalam Kluster)', 'Titik Pencilan (Noise / Luar Kluster)'],
        datasets: [{
          data: [clustered, noise],
          backgroundColor: ['#2563eb', '#94a3b8'],
          borderColor: '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#334155',
              font: { family: 'Plus Jakarta Sans', size: 12, weight: '600' },
              padding: 14
            }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 10,
            cornerRadius: 6
          }
        }
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  StatsModule.init();
});

// Expose globally
window.StatsModule = StatsModule;
