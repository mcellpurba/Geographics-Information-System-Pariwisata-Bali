/**
 * GIS PARIWISATA PROVINSI BALI
 * Spatial Analysis Module: Radius Buffer Search, DBSCAN Clustering, and Heatmap
 */

const SpatialModule = {
  // State
  isRadiusActive: false,
  radiusCenter: { lat: -8.4095, lng: 115.1889 },
  radiusKm: 10,
  isPickingCenter: false,

  // Leaflet Layers
  radiusMarker: null,
  radiusCircle: null,
  dbscanClusterLayerGroup: null,
  heatmapLayer: null,

  // DBSCAN State
  isDbscanActive: false,
  dbscanResult: null,
  clusterColors: [
    '#06b6d4', '#f59e0b', '#10b981', '#8b5cf6', '#f43f5e',
    '#3b82f6', '#ec4899', '#14b8a6', '#d97706', '#6366f1'
  ],

  // Heatmap State
  heatmapPoints: [],
  heatmapRadius: 28,
  heatmapBlur: 18,
  heatmapMarkersHidden: false,

  init() {
    this.dbscanClusterLayerGroup = L.layerGroup().addTo(window.MapModule.map);
    this.initToolbarButtons();
    this.initRadiusTool();
    this.initDbscanTool();
    this.initHeatmapTool();
    this.initMapPickClick();
  },

  // Toggle floating tool windows
  initToolbarButtons() {
    const btnRadius = document.getElementById('tool-btn-radius');
    const btnDbscan = document.getElementById('tool-btn-dbscan');
    const btnHeatmap = document.getElementById('tool-btn-heatmap');

    const winRadius = document.getElementById('window-radius');
    const winDbscan = document.getElementById('window-dbscan');
    const winHeatmap = document.getElementById('window-heatmap');

    const toggleWindow = (btn, win) => {
      const isOpen = win.classList.contains('open');
      // Close all first
      [winRadius, winDbscan, winHeatmap].forEach(w => w.classList.remove('open'));
      [btnRadius, btnDbscan, btnHeatmap].forEach(b => b.classList.remove('active'));

      if (!isOpen) {
        win.classList.add('open');
        btn.classList.add('active');
      }
    };

    btnRadius.addEventListener('click', () => toggleWindow(btnRadius, winRadius));
    btnDbscan.addEventListener('click', () => toggleWindow(btnDbscan, winDbscan));
    btnHeatmap.addEventListener('click', () => {
      const willOpen = !winHeatmap.classList.contains('open');
      toggleWindow(btnHeatmap, winHeatmap);
      if (willOpen) {
        const toggleCheck = document.getElementById('toggle-heatmap');
        if (toggleCheck) toggleCheck.checked = true;
        this.showHeatmap();
      }
    });

    document.getElementById('close-radius-window').addEventListener('click', () => {
      winRadius.classList.remove('open');
      btnRadius.classList.remove('active');
    });

    document.getElementById('close-dbscan-window').addEventListener('click', () => {
      winDbscan.classList.remove('open');
      btnDbscan.classList.remove('active');
    });

    document.getElementById('close-heatmap-window').addEventListener('click', () => {
      winHeatmap.classList.remove('open');
      btnHeatmap.classList.remove('active');
    });
  },

  // --------------------------------------------------------------------------
  // 1. RADIUS SPATIAL SEARCH
  // --------------------------------------------------------------------------
  initRadiusTool() {
    const slider = document.getElementById('radius-slider');
    const display = document.getElementById('radius-val-display');

    slider.addEventListener('input', (e) => {
      this.radiusKm = parseFloat(e.target.value);
      display.innerText = `${this.radiusKm} km`;
      if (this.isRadiusActive) {
        this.updateRadiusBuffer();
      }
    });

    document.getElementById('btn-apply-radius').addEventListener('click', () => {
      this.executeRadiusSearch();
    });

    document.getElementById('btn-clear-radius').addEventListener('click', () => {
      this.clearRadiusSearch();
    });

    // Pick from map button
    document.getElementById('btn-pick-radius-center').addEventListener('click', () => {
      this.isPickingCenter = true;
      window.showToast('Klik titik mana saja di peta untuk menentukan pusat radius pencarian.', 'info');
      window.MapModule.map.getContainer().style.cursor = 'crosshair';
    });

    // Use my GPS location
    document.getElementById('btn-use-my-loc-radius').addEventListener('click', () => {
      if (window.AppState.userLocation) {
        this.setRadiusCenter(window.AppState.userLocation.lat, window.AppState.userLocation.lng);
        this.executeRadiusSearch();
      } else {
        window.showToast('Mendeteksi GPS Anda...', 'info');
        navigator.geolocation.getCurrentPosition(
          pos => {
            this.setRadiusCenter(pos.coords.latitude, pos.coords.longitude);
            this.executeRadiusSearch();
          },
          () => {
            window.showToast('Tidak dapat mendeteksi lokasi GPS.', 'error');
          }
        );
      }
    });
  },

  initMapPickClick() {
    window.MapModule.map.on('click', (e) => {
      if (this.isPickingCenter) {
        this.isPickingCenter = false;
        window.MapModule.map.getContainer().style.cursor = '';
        this.setRadiusCenter(e.latlng.lat, e.latlng.lng);
        this.executeRadiusSearch();
        window.showToast(`Pusat radius diatur: ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`, 'success');
      }
    });
  },

  setRadiusCenter(lat, lng) {
    this.radiusCenter = { lat, lng };
    document.getElementById('radius-center-coords').innerText = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  },

  updateRadiusBuffer() {
    if (this.radiusCircle) {
      this.radiusCircle.setRadius(this.radiusKm * 1000);
    }
    this.executeRadiusSearch(false);
  },

  async executeRadiusSearch(zoomToBounds = true) {
    this.isRadiusActive = true;
    document.getElementById('radius-active-indicator').style.display = 'inline-flex';

    const { lat, lng } = this.radiusCenter;

    // Render draggable center marker
    if (!this.radiusMarker) {
      const centerIcon = L.divIcon({
        className: 'radius-center-pin',
        html: `
          <div style="
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #ef4444;
            border: 3px solid #ffffff;
            box-shadow: 0 0 15px rgba(239, 68, 68, 0.8);
            cursor: grab;
          "></div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      this.radiusMarker = L.marker([lat, lng], {
        icon: centerIcon,
        draggable: true,
        zIndexOffset: 1200
      }).addTo(window.MapModule.map);

      this.radiusMarker.on('dragend', (e) => {
        const newPos = e.target.getLatLng();
        this.setRadiusCenter(newPos.lat, newPos.lng);
        this.updateRadiusBuffer();
      });
    } else {
      this.radiusMarker.setLatLng([lat, lng]);
    }

    // Render / update circle buffer polygon
    if (!this.radiusCircle) {
      this.radiusCircle = L.circle([lat, lng], {
        radius: this.radiusKm * 1000,
        color: '#0d9488',
        fillColor: '#0d9488',
        fillOpacity: 0.18,
        weight: 2,
        dashArray: '5, 5'
      }).addTo(window.MapModule.map);
    } else {
      this.radiusCircle.setLatLng([lat, lng]);
      this.radiusCircle.setRadius(this.radiusKm * 1000);
    }

    try {
      const res = await fetch('/api/spatial/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
          radius_km: this.radiusKm,
          category: window.AppState.selectedCategory,
          kabupaten: window.AppState.selectedKabupaten
        })
      });

      const result = await res.json();
      if (result.success) {
        const found = result.data;
        document.getElementById('radius-results-summary').style.display = 'block';
        document.getElementById('radius-found-count').innerText = `${found.length} Destinasi`;

        // Render markers in buffer
        window.MapModule.renderMarkers(found);
        window.renderPlacesSidebar(found);

        if (zoomToBounds && found.length > 0) {
          window.MapModule.map.fitBounds(this.radiusCircle.getBounds(), { padding: [30, 30] });
        }

        window.showToast(`Ditemukan ${found.length} destinasi dalam radius ${this.radiusKm} km`, 'success');
      }
    } catch (err) {
      console.error('Radius search error:', err);
      window.showToast('Gagal memproses pencarian radius.', 'error');
    }
  },

  clearRadiusSearch() {
    this.isRadiusActive = false;
    document.getElementById('radius-active-indicator').style.display = 'none';
    document.getElementById('radius-results-summary').style.display = 'none';

    if (this.radiusMarker) {
      window.MapModule.map.removeLayer(this.radiusMarker);
      this.radiusMarker = null;
    }
    if (this.radiusCircle) {
      window.MapModule.map.removeLayer(this.radiusCircle);
      this.radiusCircle = null;
    }

    window.applyFilters();
    window.showToast('Filter pencarian radius dibersihkan.', 'info');
  },

  // --------------------------------------------------------------------------
  // 2. DBSCAN DENSITY CLUSTERING
  // --------------------------------------------------------------------------
  initDbscanTool() {
    const epsSlider = document.getElementById('dbscan-eps-slider');
    const epsDisplay = document.getElementById('eps-val-display');
    const minptsSlider = document.getElementById('dbscan-minpts-slider');
    const minptsDisplay = document.getElementById('minpts-val-display');

    epsSlider.addEventListener('input', (e) => {
      epsDisplay.innerText = `${e.target.value} km`;
    });

    minptsSlider.addEventListener('input', (e) => {
      minptsDisplay.innerText = `${e.target.value} titik`;
    });

    document.getElementById('btn-run-dbscan').addEventListener('click', () => {
      const eps = parseFloat(epsSlider.value);
      const minpts = parseInt(minptsSlider.value);
      this.executeDbscan(eps, minpts);
    });

    document.getElementById('btn-clear-dbscan').addEventListener('click', () => {
      this.clearDbscan();
    });
  },

  async executeDbscan(epsKm = 8, minPts = 3) {
    window.showToast(`Menjalankan DBSCAN (Eps: ${epsKm} km, MinPts: ${minPts})...`, 'info');

    try {
      const res = await fetch('/api/spatial/dbscan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eps_km: epsKm,
          min_pts: minPts,
          category: window.AppState.selectedCategory,
          kabupaten: window.AppState.selectedKabupaten
        })
      });

      const result = await res.json();
      if (result.success) {
        this.isDbscanActive = true;
        this.dbscanResult = result;
        this.renderDbscanVisuals(result);
        window.showToast(`DBSCAN Selesai: Terbentuk ${result.total_clusters} kluster aglomerasi!`, 'success');
      }
    } catch (err) {
      console.error('DBSCAN error:', err);
      window.showToast('Gagal menjalankan algoritma DBSCAN.', 'error');
    }
  },

  renderDbscanVisuals(result) {
    this.dbscanClusterLayerGroup.clearLayers();

    // Hide normal markers so cluster markers are clearly prominent
    window.MapModule.markerClusterGroup.clearLayers();

    const clustersBox = document.getElementById('dbscan-results-box');
    const totalClusters = document.getElementById('dbscan-total-clusters');
    const totalNoise = document.getElementById('dbscan-total-noise');
    const listEl = document.getElementById('dbscan-clusters-list');

    clustersBox.style.display = 'block';
    totalClusters.innerText = `${result.total_clusters} Kluster`;
    totalNoise.innerText = `${result.total_noise_points} Titik`;

    let html = '';

    // Render each cluster
    result.clusters.forEach((cluster, idx) => {
      const color = this.clusterColors[idx % this.clusterColors.length];

      // 1. Build Convex Hull / Bounding Polygon using Turf.js
      if (cluster.places.length >= 3 && window.turf) {
        try {
          const pointsGeoJson = turf.featureCollection(
            cluster.places.map(p => turf.point([p.longitude, p.latitude]))
          );
          const hull = turf.convex(pointsGeoJson);

          if (hull) {
            const hullLayer = L.geoJSON(hull, {
              style: {
                color: color,
                weight: 2.5,
                dashArray: '4, 4',
                fillColor: color,
                fillOpacity: 0.22
              }
            });
            this.dbscanClusterLayerGroup.addLayer(hullLayer);
          }
        } catch (err) {
          console.warn('Convex hull error:', err);
        }
      } else if (cluster.places.length > 0) {
        // Fallback buffer circle around centroid
        const circle = L.circle([cluster.centroid.lat, cluster.centroid.lng], {
          radius: 4000,
          color: color,
          weight: 2,
          dashArray: '3, 4',
          fillColor: color,
          fillOpacity: 0.2
        });
        this.dbscanClusterLayerGroup.addLayer(circle);
      }

      // 2. Render Cluster Centroid Label
      const centroidIcon = L.divIcon({
        className: 'cluster-centroid-pin',
        html: `
          <div style="
            background: ${color};
            color: #ffffff;
            font-family: var(--font-heading);
            font-weight: 800;
            font-size: 0.75rem;
            padding: 3px 8px;
            border-radius: 999px;
            border: 2px solid #ffffff;
            box-shadow: 0 0 14px ${color};
            white-space: nowrap;
          ">
            Kluster ${cluster.cluster_id + 1} (${cluster.count})
          </div>
        `,
        iconAnchor: [30, 15]
      });

      const centroidMarker = L.marker([cluster.centroid.lat, cluster.centroid.lng], { icon: centroidIcon });
      centroidMarker.bindPopup(`<strong>${cluster.name}</strong><br>Anggota: ${cluster.count} objek wisata<br>Dominan: ${cluster.dominant_category}`);
      this.dbscanClusterLayerGroup.addLayer(centroidMarker);

      // 3. Render Clustered Place Markers
      cluster.places.forEach(place => {
        const pIcon = L.divIcon({
          className: 'cluster-point-marker',
          html: `
            <div style="
              width: 14px;
              height: 14px;
              border-radius: 50%;
              background: ${color};
              border: 2px solid #ffffff;
              box-shadow: 0 0 8px ${color};
              cursor: pointer;
            "></div>
          `,
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });

        const m = L.marker([place.latitude, place.longitude], { icon: pIcon });
        m.bindPopup(`
          <strong style="color:${color}">${cluster.name}</strong><br>
          <b>${place.name}</b> (${place.category})<br>
          Rating: ⭐ ${place.rating}
        `);
        m.on('click', () => window.openPlaceDetailModal(place));
        this.dbscanClusterLayerGroup.addLayer(m);
      });

      // Append to window list
      html += `
        <div class="cluster-card" style="border-left-color: ${color};" onclick="window.SpatialModule.zoomToCluster(${idx})">
          <div class="cluster-card-title">
            <span>${cluster.name}</span>
            <span class="cluster-badge" style="background: ${color}; color: #fff;">${cluster.count} Lokasi</span>
          </div>
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
            Kategori Dominan: ${cluster.dominant_category}
          </div>
        </div>
      `;
    });

    // 4. Render Noise (Outlier) Points
    result.noise.forEach(place => {
      const noiseIcon = L.divIcon({
        className: 'noise-point-marker',
        html: `
          <div style="
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #64748b;
            border: 2px solid #cbd5e1;
            cursor: pointer;
          "></div>
        `,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });

      const nm = L.marker([place.latitude, place.longitude], { icon: noiseIcon });
      nm.bindPopup(`
        <span class="badge-tag" style="background: rgba(244,63,94,0.2); color:#f43f5e; font-size: 0.65rem;">Titik Pencilan (Noise)</span><br>
        <b>${place.name}</b><br>
        <span style="font-size:0.75rem; color:#94a3b8;">Tidak masuk dalam kepadatan kluster manapun</span>
      `);
      this.dbscanClusterLayerGroup.addLayer(nm);
    });

    listEl.innerHTML = html;
  },

  zoomToCluster(clusterIdx) {
    if (!this.dbscanResult || !this.dbscanResult.clusters[clusterIdx]) return;
    const cluster = this.dbscanResult.clusters[clusterIdx];
    const group = L.featureGroup(
      cluster.places.map(p => L.marker([p.latitude, p.longitude]))
    );
    window.MapModule.map.fitBounds(group.getBounds(), { padding: [50, 50] });
  },

  clearDbscan() {
    this.isDbscanActive = false;
    this.dbscanClusterLayerGroup.clearLayers();
    document.getElementById('dbscan-results-box').style.display = 'none';

    // Restore normal markers
    window.applyFilters();
    window.showToast('Visualisasi kluster DBSCAN disembunyikan.', 'info');
  },

  // --------------------------------------------------------------------------
  // 3. HEATMAP DENSITY VISUALIZATION
  // --------------------------------------------------------------------------
  async initHeatmapTool() {
    const toggle = document.getElementById('toggle-heatmap');
    const hideMarkersToggle = document.getElementById('toggle-heatmap-hide-markers');
    const radiusSlider = document.getElementById('hm-radius-slider');
    const radiusDisplay = document.getElementById('hm-radius-display');
    const blurSlider = document.getElementById('hm-blur-slider');
    const blurDisplay = document.getElementById('hm-blur-display');

    if (radiusSlider && radiusDisplay) {
      radiusSlider.addEventListener('input', (e) => {
        this.heatmapRadius = parseInt(e.target.value);
        radiusDisplay.innerText = `${this.heatmapRadius} px`;
        if (this.heatmapLayer) {
          this.heatmapLayer.setOptions({ radius: this.heatmapRadius });
        }
      });
    }

    if (blurSlider && blurDisplay) {
      blurSlider.addEventListener('input', (e) => {
        this.heatmapBlur = parseInt(e.target.value);
        blurDisplay.innerText = `${this.heatmapBlur} px`;
        if (this.heatmapLayer) {
          this.heatmapLayer.setOptions({ blur: this.heatmapBlur });
        }
      });
    }

    if (toggle) {
      toggle.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.showHeatmap();
        } else {
          this.hideHeatmap();
        }
      });
    }

    if (hideMarkersToggle) {
      hideMarkersToggle.addEventListener('change', (e) => {
        this.heatmapMarkersHidden = e.target.checked;
        if (this.heatmapLayer && window.MapModule && window.MapModule.map && window.MapModule.map.hasLayer(this.heatmapLayer)) {
          this.setMarkersVisibility(!this.heatmapMarkersHidden);
        }
      });
    }

    // Preset buttons
    const btnSmooth = document.getElementById('btn-hm-preset-smooth');
    const btnDefault = document.getElementById('btn-hm-preset-default');
    const btnSharp = document.getElementById('btn-hm-preset-sharp');

    const applyPreset = (r, b) => {
      this.heatmapRadius = r;
      this.heatmapBlur = b;
      if (radiusSlider) radiusSlider.value = r;
      if (radiusDisplay) radiusDisplay.innerText = `${r} px`;
      if (blurSlider) blurSlider.value = b;
      if (blurDisplay) blurDisplay.innerText = `${b} px`;
      if (this.heatmapLayer) {
        this.heatmapLayer.setOptions({ radius: r, blur: b });
      }
    };

    if (btnSmooth) btnSmooth.addEventListener('click', () => applyPreset(38, 25));
    if (btnDefault) btnDefault.addEventListener('click', () => applyPreset(28, 18));
    if (btnSharp) btnSharp.addEventListener('click', () => applyPreset(16, 10));

    // Preload points
    await this.loadHeatmapData();
  },

  async loadHeatmapData() {
    try {
      const res = await fetch('/api/spatial/heatmap');
      const result = await res.json();
      if (result.success && Array.isArray(result.points)) {
        // Strict sanitization: ensure each point is strictly [lat, lng, intensity] numbers
        this.heatmapPoints = result.points
          .map(pt => {
            if (Array.isArray(pt)) {
              const lat = parseFloat(pt[0]);
              const lng = parseFloat(pt[1]);
              const intensity = parseFloat(pt[2]) || 0.7;
              return (!isNaN(lat) && !isNaN(lng)) ? [lat, lng, Math.min(1.0, Math.max(0.1, intensity))] : null;
            } else if (pt && typeof pt === 'object') {
              const lat = parseFloat(pt.latitude ?? pt.lat);
              const lng = parseFloat(pt.longitude ?? pt.lng);
              const intensity = parseFloat(pt.intensity ?? pt.rating ?? 0.7);
              return (!isNaN(lat) && !isNaN(lng)) ? [lat, lng, Math.min(1.0, Math.max(0.1, intensity))] : null;
            }
            return null;
          })
          .filter(Boolean);

        const countEl = document.getElementById('heatmap-points-count');
        if (countEl) countEl.innerText = `${this.heatmapPoints.length} Destinasi`;
      }
    } catch (err) {
      console.warn('Heatmap load error:', err.message);
    }
  },

  showHeatmap() {
    if (!window.MapModule || !window.MapModule.map) return;
    if (!this.heatmapPoints.length || typeof L === 'undefined' || !L.heatLayer) return;

    if (!this.heatmapLayer) {
      this.heatmapLayer = L.heatLayer(this.heatmapPoints, {
        radius: this.heatmapRadius,
        blur: this.heatmapBlur,
        maxZoom: 15,
        max: 1.0,
        minOpacity: 0.35,
        gradient: {
          0.15: '#2563eb', // Blue (Kerapatan Awal/Rendah)
          0.35: '#06b6d4', // Cyan (Kerapatan Menengah-Rendah)
          0.55: '#10b981', // Green (Kerapatan Sedang)
          0.75: '#f59e0b', // Amber (Kerapatan Tinggi)
          0.90: '#f97316', // Oranye (Sangat Padat)
          1.00: '#ef4444'  // Merah (Hotspot Utama Destinasi)
        }
      });
    } else {
      this.heatmapLayer.setLatLngs(this.heatmapPoints);
      this.heatmapLayer.setOptions({
        radius: this.heatmapRadius,
        blur: this.heatmapBlur
      });
    }

    if (!window.MapModule.map.hasLayer(this.heatmapLayer)) {
      this.heatmapLayer.addTo(window.MapModule.map);
    }

    // Check if user wants markers hidden to see pure heat glow
    const hideMarkersToggle = document.getElementById('toggle-heatmap-hide-markers');
    if (hideMarkersToggle && hideMarkersToggle.checked) {
      this.setMarkersVisibility(false);
    }

    // Toggle indicator chip
    const chipEl = document.getElementById('chip-heatmap-indicator');
    if (chipEl) chipEl.style.display = 'inline-flex';

    const toggle = document.getElementById('toggle-heatmap');
    if (toggle) toggle.checked = true;

    window.showToast(`🔥 Visualisasi Heatmap aktif (${this.heatmapPoints.length} titik konsentrasi wisata)`, 'success');
  },

  hideHeatmap() {
    if (this.heatmapLayer && window.MapModule && window.MapModule.map && window.MapModule.map.hasLayer(this.heatmapLayer)) {
      window.MapModule.map.removeLayer(this.heatmapLayer);
    }
    const toggle = document.getElementById('toggle-heatmap');
    if (toggle) toggle.checked = false;

    // Restore standard markers
    this.setMarkersVisibility(true);

    const chipEl = document.getElementById('chip-heatmap-indicator');
    if (chipEl) chipEl.style.display = 'none';

    window.showToast('Visualisasi Heatmap dinonaktifkan.', 'info');
  },

  setMarkersVisibility(visible) {
    if (!window.MapModule || !window.MapModule.map || !window.MapModule.markerClusterGroup) return;
    if (visible) {
      if (!window.MapModule.map.hasLayer(window.MapModule.markerClusterGroup)) {
        window.MapModule.map.addLayer(window.MapModule.markerClusterGroup);
      }
    } else {
      if (window.MapModule.map.hasLayer(window.MapModule.markerClusterGroup)) {
        window.MapModule.map.removeLayer(window.MapModule.markerClusterGroup);
      }
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  SpatialModule.init();
});

// Expose globally
window.SpatialModule = SpatialModule;
