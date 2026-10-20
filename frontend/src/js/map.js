/**
 * GIS PARIWISATA PROVINSI BALI
 * Map Module: Leaflet Map Setup, Basemaps, Boundaries, Markers & Clusters
 */

const MapModule = {
  map: null,
  baseLayers: {},
  overlayLayers: {},
  markerClusterGroup: null,
  regencyGeoJsonLayer: null,
  userLocationMarker: null,
  userLocationCircle: null,
  activeMarkers: [],
  defaultCenter: [-8.4095, 115.1889],
  defaultZoom: 10,

  init() {
    this.initMap();
    this.initBasemaps();
    this.loadRegencyBoundaries();
    this.initEventListeners();
  },

  initMap() {
    this.map = L.map('map', {
      center: this.defaultCenter,
      zoom: this.defaultZoom,
      zoomControl: false,
      minZoom: 8,
      maxZoom: 18
    });

    // Custom positioned zoom control on bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    // Initialize marker cluster group with Modern Blue & Amber styling
    this.markerClusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        let diameter = 38;
        if (count > 10) diameter = 44;
        if (count > 25) diameter = 52;

        return L.divIcon({
          html: `<div style="
            width: ${diameter}px;
            height: ${diameter}px;
            border-radius: 50%;
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            color: #ffffff;
            font-family: var(--font-heading);
            font-weight: 800;
            font-size: 0.85rem;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.45);
            border: 2px solid #ffffff;
          ">${count}</div>`,
          className: 'custom-cluster-icon',
          iconSize: [diameter, diameter]
        });
      }
    });

    this.map.addLayer(this.markerClusterGroup);
  },

  initBasemaps() {
    // 1. ESRI World Street Map (Clean, Modern, No Watermark, No API Key)
    const esriStreet = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Bali GIS',
      maxZoom: 19
    });

    // 2. OpenStreetMap Standard (Free, Open, No Watermark)
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    });

    // 3. ESRI World Topo Map (Topographic Landscape)
    const esriTopo = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19
    });

    // 4. ESRI World Imagery (High-Definition Satellite)
    const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri Satellite',
      maxZoom: 19
    });

    // Add default basemap
    esriStreet.addTo(this.map);

    this.baseLayers = {
      '<i class="fa-solid fa-map-location-dot"></i> ESRI Street (Default)': esriStreet,
      '<i class="fa-solid fa-earth-asia"></i> OpenStreetMap': osm,
      '<i class="fa-solid fa-mountain-sun"></i> ESRI Topografi': esriTopo,
      '<i class="fa-solid fa-satellite"></i> ESRI Satelit HD': esriSat
    };

    // Add Leaflet layer control on top left
    L.control.layers(this.baseLayers, null, { position: 'topleft' }).addTo(this.map);
  },

  // Load Bali regencies GeoJSON polygons
  async loadRegencyBoundaries() {
    try {
      const res = await fetch('/api/geojson/bali-kabupaten');
      const geojson = await res.json();

      const regencyColors = {
        'BADUNG': '#2563eb',
        'DENPASAR': '#f59e0b',
        'GIANYAR': '#10b981',
        'TABANAN': '#8b5cf6',
        'BULELENG': '#06b6d4',
        'BANGLI': '#ec4899',
        'KARANGASEM': '#f97316',
        'KLUNGKUNG': '#14b8a6',
        'JEMBRANA': '#6366f1'
      };

      this.regencyGeoJsonLayer = L.geoJSON(geojson, {
        style: (feature) => {
          const name = (feature.properties.nm_kabkota || feature.properties.name || '').toUpperCase();
          const color = regencyColors[name] || '#2563eb';
          return {
            fillColor: color,
            fillOpacity: 0.12,
            color: color,
            weight: 2,
            dashArray: '4, 4'
          };
        },
        onEachFeature: (feature, layer) => {
          const name = (feature.properties.nm_kabkota || feature.properties.name || '').toUpperCase();
          
          // Tooltip on hover
          layer.bindTooltip(`
            <div style="font-family: var(--font-heading); font-weight: 700; font-size: 0.85rem; color: #0f172a;">
              Kabupaten/Kota: ${name}
            </div>
            <div style="font-size: 0.75rem; color: #64748b;">Klik untuk filter wilayah ini</div>
          `, { sticky: true, className: 'leaflet-popup-content-wrapper' });

          // Mouse interactions
          layer.on({
            mouseover: (e) => {
              const l = e.target;
              l.setStyle({
                fillOpacity: 0.28,
                weight: 3,
                dashArray: ''
              });
            },
            mouseout: (e) => {
              this.regencyGeoJsonLayer.resetStyle(e.target);
            },
            click: (e) => {
              // Filter places by this kabupaten
              const selKab = document.getElementById('select-kabupaten');
              if (selKab) {
                selKab.value = name;
                selKab.dispatchEvent(new Event('change'));
              }
              this.map.fitBounds(e.target.getBounds(), { padding: [40, 40] });
            }
          });
        }
      });

      this.regencyGeoJsonLayer.addTo(this.map);
    } catch (err) {
      console.warn('Failed to load regency boundaries:', err.message);
    }
  },

  // Create custom HTML marker for a place
  createPlaceIcon(category) {
    const color = window.getCategoryColor(category);
    const iconClass = window.getCategoryIcon(category);

    return L.divIcon({
      className: 'custom-marker-icon',
      html: `
        <div class="custom-pin" style="background: ${color};">
          <i class="fa-solid ${iconClass}"></i>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -36]
    });
  },

  // Render tourist place markers
  renderMarkers(places) {
    this.markerClusterGroup.clearLayers();
    this.activeMarkers = [];

    places.forEach(place => {
      const icon = this.createPlaceIcon(place.category);
      const marker = L.marker([place.latitude, place.longitude], { icon });

      // Custom Popup HTML (Crisp Clean Modern White)
      const popupContent = `
        <div style="width: 250px; overflow: hidden; font-family: var(--font-body); background: #ffffff;">
          <img src="${place.image_url || 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80'}" style="width: 100%; height: 110px; object-fit: cover;" alt="${place.name}">
          <div style="padding: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span class="badge-tag" style="background: #e0f2fe; color: #0369a1; font-size: 0.65rem; border: 1px solid #bae6fd;">${place.category}</span>
              <span style="font-size: 0.75rem; font-weight: 700; color: #b45309;"><i class="fa-solid fa-star"></i> ${place.rating ? place.rating.toFixed(1) : '4.5'}</span>
            </div>
            <h4 style="font-family: var(--font-heading); font-size: 0.95rem; font-weight: 700; color: #0f172a; margin-bottom: 4px;">${place.name}</h4>
            <div style="font-size: 0.72rem; color: #64748b; margin-bottom: 10px;">
              <i class="fa-solid fa-location-dot"></i> ${place.kabupaten}
            </div>
            <button onclick="window.openPlaceDetailModal(window.AppState.places.find(p => p.id === ${place.id}))" style="
              width: 100%;
              padding: 7px 10px;
              border-radius: 6px;
              border: none;
              background: #2563eb;
              color: #ffffff;
              font-size: 0.75rem;
              font-weight: 700;
              cursor: pointer;
            ">
              <i class="fa-solid fa-circle-info"></i> Lihat Informasi Lengkap
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, { maxWidth: 280, closeButton: false });
      
      marker.on('click', () => {
        window.onPlaceCardClick(place.id);
      });

      marker.placeData = place;
      this.markerClusterGroup.addLayer(marker);
      this.activeMarkers.push(marker);
    });
  },

  // Focus map on specific place and trigger popup
  focusPlace(place) {
    this.map.flyTo([place.latitude, place.longitude], 15, {
      duration: 1.2,
      easeLinearity: 0.25
    });

    setTimeout(() => {
      const marker = this.activeMarkers.find(m => m.placeData && m.placeData.id === place.id);
      if (marker) {
        this.markerClusterGroup.zoomToShowLayer(marker, () => {
          marker.openPopup();
        });
      }
    }, 1200);
  },

  // Zoom to a specific regency polygon
  zoomToRegency(kabName) {
    if (!this.regencyGeoJsonLayer) return;
    this.regencyGeoJsonLayer.eachLayer(layer => {
      const name = (layer.feature.properties.nm_kabkota || layer.feature.properties.name || '').toUpperCase();
      if (name === kabName.toUpperCase()) {
        this.map.fitBounds(layer.getBounds(), { padding: [40, 40] });
      }
    });
  },

  // Set user current GPS location marker
  setUserLocationMarker(lat, lng) {
    if (this.userLocationMarker) {
      this.map.removeLayer(this.userLocationMarker);
    }
    if (this.userLocationCircle) {
      this.map.removeLayer(this.userLocationCircle);
    }

    const userIcon = L.divIcon({
      className: 'user-radar-marker',
      html: `
        <div style="
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #2563eb;
          border: 3px solid #ffffff;
          box-shadow: 0 0 16px rgba(37, 99, 235, 0.8);
        "></div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    this.userLocationMarker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(this.map);
    this.userLocationMarker.bindPopup(`<strong>Posisi Anda</strong><br>Koordinat: ${lat.toFixed(4)}, ${lng.toFixed(4)}`).openPopup();

    this.userLocationCircle = L.circle([lat, lng], {
      radius: 400,
      color: '#2563eb',
      fillColor: '#2563eb',
      fillOpacity: 0.15,
      weight: 1.5
    }).addTo(this.map);

    this.map.flyTo([lat, lng], 13);
  },

  // Reset map view to Bali overview
  resetMapView() {
    this.map.flyTo(this.defaultCenter, this.defaultZoom, { duration: 1.0 });
  },

  // Toggle boundary layer on/off
  toggleBoundaryLayer() {
    if (!this.regencyGeoJsonLayer) return;
    const btn = document.getElementById('chip-boundary-toggle');
    if (this.map.hasLayer(this.regencyGeoJsonLayer)) {
      this.map.removeLayer(this.regencyGeoJsonLayer);
      if (btn) btn.innerHTML = '<i class="fa-solid fa-draw-polygon" style="color: var(--text-muted);"></i> Batas Kabupaten Bali: OFF';
      window.showToast('Layer Batas Wilayah Kabupaten dinonaktifkan', 'info');
    } else {
      this.regencyGeoJsonLayer.addTo(this.map);
      if (btn) btn.innerHTML = '<i class="fa-solid fa-draw-polygon" style="color: var(--primary);"></i> Batas Kabupaten Bali: ON';
      window.showToast('Layer Batas Wilayah Kabupaten diaktifkan', 'success');
    }
  },

  initEventListeners() {
    document.getElementById('tool-btn-reset').addEventListener('click', () => {
      this.resetMapView();
    });

    document.getElementById('chip-boundary-toggle').addEventListener('click', () => {
      this.toggleBoundaryLayer();
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  MapModule.init();
});

// Expose globally
window.MapModule = MapModule;
