/**
 * GIS PARIWISATA PROVINSI BALI
 * Main Application Controller & Global State
 */

const AppState = {
  places: [],            // All tourist places from API
  filteredPlaces: [],    // Places after search/category/kabupaten filters
  selectedCategory: 'Semua',
  selectedKabupaten: 'Semua',
  minRating: 0,
  searchQuery: '',
  userLocation: null,    // { lat, lng }
  activePlace: null,     // Currently selected place for modal
  adminToken: localStorage.getItem('gis_bali_admin_token') || null,
  adminUser: localStorage.getItem('gis_bali_admin_user') || null,
  activeTab: 'view-map'
};

// Toast notification helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'fa-info-circle';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-triangle-exclamation';

  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Category color helper
function getCategoryColor(category) {
  switch (category) {
    case 'Pantai': return '#0284c7';
    case 'Budaya & Pura': return '#d97706';
    case 'Alam & Gunung': return '#059669';
    case 'Air Terjun': return '#06b6d4';
    case 'Rekreasi & Edukasi': return '#8b5cf6';
    case 'Kuliner & Relaksasi': return '#e11d48';
    default: return '#0d9488';
  }
}

// Category icon helper
function getCategoryIcon(category) {
  switch (category) {
    case 'Pantai': return 'fa-umbrella-beach';
    case 'Budaya & Pura': return 'fa-synagogue';
    case 'Alam & Gunung': return 'fa-mountain-sun';
    case 'Air Terjun': return 'fa-water';
    case 'Rekreasi & Edukasi': return 'fa-ferris-wheel';
    case 'Kuliner & Relaksasi': return 'fa-spa';
    default: return 'fa-location-dot';
  }
}

// Format currency
function formatRupiah(val) {
  if (!val) return 'Gratis';
  return val;
}

// Fetch all places from API
async function loadPlaces() {
  try {
    const res = await fetch('/api/places');
    const result = await res.json();
    if (result.success) {
      AppState.places = result.data;
      AppState.filteredPlaces = [...result.data];
      renderPlacesSidebar(AppState.filteredPlaces);
      if (window.MapModule) {
        window.MapModule.renderMarkers(AppState.filteredPlaces);
      }
      document.getElementById('quick-chip-text').innerText = `${result.data.length} Destinasi Wisata`;
    }
  } catch (err) {
    console.error('Error fetching places:', err);
    showToast('Gagal mengambil data destinasi wisata.', 'error');
  }
}

// Word boundary matching helper
function hasWord(text, word) {
  if (!text || !word) return false;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('\\b' + escaped + '\\b', 'i').test(text);
}

// Detect category intent from search query string
function detectCategoryIntent(query) {
  if (!query) return null;
  const q = query.toLowerCase().trim();
  if (/\b(pantai|beach|pasih|pesisir)\b/i.test(q)) return 'Pantai';
  if (/\b(pura|candi|budaya|temple)\b/i.test(q)) return 'Budaya & Pura';
  if (/\b(gunung|mountain|alam|nature|danau|lake|hutan)\b/i.test(q)) return 'Alam & Gunung';
  if (/\b(air\s*terjun|waterfall|curug|terjun)\b/i.test(q)) return 'Air Terjun';
  if (/\b(rekreasi|edukasi|wahana|safari|zoo|waterbom)\b/i.test(q)) return 'Rekreasi & Edukasi';
  if (/\b(kuliner|relaksasi|spa|air\s*panas|hot\s*spring)\b/i.test(q)) return 'Kuliner & Relaksasi';
  return null;
}

// Intelligent GIS search matching
function matchSearchQuery(p, query) {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  if (!q) return true;

  const name = (p.name || '').toLowerCase();
  const category = (p.category || '').toLowerCase();
  const kabupaten = (p.kabupaten || '').toLowerCase();
  const address = (p.address || '').toLowerCase();
  const facilities = (p.facilities || '').toLowerCase();
  const description = (p.description || '').toLowerCase();

  // 1. EXACT CATEGORY / ENTITY TYPE KEYWORDS
  // Pantai / Beach (shows ALL 13 beaches, strictly excludes temples & mountains)
  if (/^(pantai|beach|pasih|pesisir|pantaii|pantai-pantai)$/i.test(q)) {
    return category === 'pantai' || name.includes('pantai') || name.includes('beach') || name.includes('pasih');
  }

  // Pura / Temple / Candi (shows ALL temples, strictly excludes monkey forests/beaches)
  if (/^(pura|temple|candi|pura-pura)$/i.test(q)) {
    return hasWord(name, 'pura') || hasWord(name, 'candi') || hasWord(name, 'temple');
  }

  // Gunung / Mountain (shows mountains, strictly excludes beaches/temples mentioning mountains)
  if (/^(gunung|mountain|gunung-gunung)$/i.test(q)) {
    return hasWord(name, 'gunung') || hasWord(name, 'mountain');
  }

  // Air Terjun / Waterfall / Curug
  if (/^(air\s*terjun|waterfall|curug|terjun)$/i.test(q)) {
    return category === 'air terjun' || name.includes('air terjun') || name.includes('waterfall') || name.includes('curug');
  }

  // Danau / Lake
  if (/^(danau|lake)$/i.test(q)) {
    return hasWord(name, 'danau') || hasWord(name, 'lake') || name.includes('danau');
  }

  // Alam / Nature
  if (/^(alam|nature)$/i.test(q)) {
    return category === 'alam & gunung';
  }

  // Budaya / Culture
  if (/^(budaya|culture)$/i.test(q)) {
    return category === 'budaya & pura';
  }

  // Rekreasi / Edukasi / Wahana
  if (/^(rekreasi|edukasi|wahana)$/i.test(q)) {
    return category === 'rekreasi & edukasi';
  }

  // Kuliner / Relaksasi / Spa / Air Panas
  if (/^(kuliner|relaksasi|spa|air\s*panas|hot\s*spring|pemandian)$/i.test(q)) {
    return category === 'kuliner & relaksasi' || name.includes('air panas') || name.includes('hot spring');
  }

  // 2. MULTI-WORD CATEGORY QUERIES (e.g. 'pantai kuta', 'pura besakih', 'gunung batur', 'air terjun sekumpul')
  const hasPantai = /\b(pantai|beach|pasih)\b/i.test(q);
  const hasPura = /\b(pura|candi|temple)\b/i.test(q);
  const hasGunung = /\b(gunung|mountain)\b/i.test(q);
  const hasAirTerjun = /\b(air\s*terjun|waterfall|curug)\b/i.test(q);

  if (hasPantai) {
    const isBeach = category === 'pantai' || name.includes('pantai') || name.includes('beach') || name.includes('pasih');
    if (!isBeach) return false;
    const rem = q.replace(/\b(pantai|beach|pasih)\b/gi, '').trim();
    if (!rem) return true;
    return name.includes(rem) || hasWord(address, rem) || hasWord(kabupaten, rem);
  }

  if (hasPura) {
    const isPura = hasWord(name, 'pura') || hasWord(name, 'candi') || hasWord(name, 'temple') || category === 'budaya & pura';
    if (!isPura) return false;
    const rem = q.replace(/\b(pura|candi|temple)\b/gi, '').trim();
    if (!rem) return true;
    return name.includes(rem) || hasWord(address, rem) || hasWord(kabupaten, rem);
  }

  if (hasGunung) {
    const isGunung = hasWord(name, 'gunung') || hasWord(name, 'mountain');
    if (!isGunung) return false;
    const rem = q.replace(/\b(gunung|mountain)\b/gi, '').trim();
    if (!rem) return true;
    return name.includes(rem) || hasWord(address, rem) || hasWord(kabupaten, rem);
  }

  if (hasAirTerjun) {
    const isWater = category === 'air terjun' || name.includes('air terjun') || name.includes('waterfall') || name.includes('curug');
    if (!isWater) return false;
    const rem = q.replace(/\b(air\s*terjun|waterfall|curug)\b/gi, '').trim();
    if (!rem) return true;
    return name.includes(rem) || hasWord(address, rem) || hasWord(kabupaten, rem);
  }

  // 3. GENERAL SEARCH (Name, Category, Kabupaten, Address, Facilities)
  const primaryMatch = name.includes(q) ||
    category.includes(q) ||
    kabupaten.includes(q) ||
    hasWord(address, q) ||
    (q.length >= 5 && address.includes(q)) ||
    facilities.includes(q);

  if (primaryMatch) return true;

  // Description fallback ONLY for specific activities / attractions (e.g. snorkeling, surfing, sunset, lumba-lumba)
  // NEVER allow category terms like pantai, pura, gunung to search narrative description
  const categoryTerms = ['pantai', 'pura', 'gunung', 'alam', 'candi', 'laut', 'danau', 'bukit', 'air', 'wisata', 'temple', 'beach'];
  if (!categoryTerms.some(term => q.includes(term))) {
    return description.includes(q);
  }

  return false;
}
window.matchSearchQuery = matchSearchQuery;
window.detectCategoryIntent = detectCategoryIntent;

// Apply client-side filters (Search, Category, Kabupaten, Rating)
function applyFilters() {
  const q = AppState.searchQuery.toLowerCase().trim();
  const cat = AppState.selectedCategory;
  const kab = AppState.selectedKabupaten;
  const minRat = AppState.minRating;

  AppState.filteredPlaces = AppState.places.filter(p => {
    // Search match
    const matchSearch = matchSearchQuery(p, q);

    // Category match
    const matchCat = (cat === 'Semua') || (p.category === cat);

    // Kabupaten match
    const matchKab = (kab === 'Semua') || (p.kabupaten.toUpperCase() === kab.toUpperCase());

    // Rating match
    const matchRat = (!minRat) || (p.rating >= minRat);

    return matchSearch && matchCat && matchKab && matchRat;
  });

  // Relevance ranking when search query is active
  if (q) {
    AppState.filteredPlaces.sort((a, b) => {
      const aName = (a.name || '').toLowerCase();
      const bName = (b.name || '').toLowerCase();
      const aStarts = aName.startsWith(q);
      const bStarts = bName.startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      const aIn = aName.includes(q);
      const bIn = bName.includes(q);
      if (aIn && !bIn) return -1;
      if (!aIn && bIn) return 1;

      return (b.rating || 0) - (a.rating || 0);
    });
  }

  renderPlacesSidebar(AppState.filteredPlaces);

  // If spatial radius search is not overriding markers, update map markers
  if (window.MapModule && (!window.SpatialModule || !window.SpatialModule.isRadiusActive)) {
    window.MapModule.renderMarkers(AppState.filteredPlaces);
  }
}

// Render place cards into the left sidebar
function renderPlacesSidebar(places) {
  const container = document.getElementById('places-list');
  const countLabel = document.getElementById('places-count-label');
  if (!container) return;

  countLabel.innerText = `Menampilkan ${places.length} dari ${AppState.places.length} destinasi`;

  if (places.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
        <i class="fa-solid fa-map-location-dot" style="font-size: 2.5rem; margin-bottom: 12px; opacity: 0.5;"></i>
        <p style="font-weight: 600;">Tidak ada destinasi yang cocok</p>
        <span style="font-size: 0.8rem;">Coba ubah kata kunci pencarian atau filter Anda.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = places.map(p => {
    const catClass = p.category ? 'badge-' + p.category.toLowerCase().replace(/[^a-z]/g, '-').replace(/-+/g, '-') : 'badge-pantai';
    const distBadge = p.distance_km !== undefined ? `
      <span class="place-distance">
        <i class="fa-solid fa-route"></i> ${p.distance_km} km
      </span>
    ` : '';

    return `
      <div class="place-card" data-id="${p.id}" onclick="onPlaceCardClick(${p.id})">
        <img class="place-card-thumb" src="${p.image_url || 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80'}" alt="${p.name}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80'">
        <div class="place-card-body">
          <div>
            <h4 class="place-card-title">${p.name}</h4>
            <div class="place-card-meta">
              <span class="badge-tag ${catClass}">${p.category}</span>
              <span class="place-card-kab"><i class="fa-solid fa-location-dot"></i> ${p.kabupaten}</span>
            </div>
          </div>
          <div class="place-card-footer">
            <span class="place-card-rating">
              <i class="fa-solid fa-star"></i> ${p.rating ? p.rating.toFixed(1) : '4.5'}
            </span>
            ${distBadge}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Click on a place card in sidebar
function onPlaceCardClick(id) {
  const place = AppState.places.find(p => p.id === id);
  if (!place) return;

  // Zoom map to place
  if (window.MapModule) {
    window.MapModule.focusPlace(place);
  }

  // Highlight card
  document.querySelectorAll('.place-card').forEach(c => c.classList.remove('active-card'));
  const card = document.querySelector(`.place-card[data-id="${id}"]`);
  if (card) {
    card.classList.add('active-card');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// Open detail modal for a place
function openPlaceDetailModal(place) {
  AppState.activePlace = place;
  const modal = document.getElementById('modal-place-detail');
  const title = document.getElementById('detail-title');
  const body = document.getElementById('detail-body');
  const mapsBtn = document.getElementById('btn-route-google-maps');
  const editBtn = document.getElementById('btn-detail-edit-place');

  title.innerText = place.name;
  mapsBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`;

  if (editBtn) {
    if (AppState.adminToken) {
      editBtn.style.display = 'inline-flex';
      editBtn.onclick = () => {
        modal.classList.remove('active');
        if (window.AdminModule) {
          window.AdminModule.openEditModal(place.id);
        }
      };
    } else {
      editBtn.style.display = 'none';
    }
  }

  body.innerHTML = `
    <img src="${place.image_url || 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80'}" class="detail-banner" alt="${place.name}">
    
    <div class="detail-tags">
      <span class="badge-tag badge-pantai">${place.category}</span>
      <span class="badge-tag" style="background: #f1f5f9; color: var(--text-secondary); border: 1px solid var(--border-light);">
        <i class="fa-solid fa-city" style="color: var(--primary);"></i> ${place.kabupaten}
      </span>
      <span class="badge-tag" style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a;">
        <i class="fa-solid fa-star" style="color: #f59e0b;"></i> ${place.rating ? place.rating.toFixed(1) : '4.5'} / 5.0
      </span>
    </div>

    <p style="font-size: 0.9rem; color: var(--text-sub); margin-bottom: 16px; line-height: 1.6;">
      ${place.description || 'Tidak ada deskripsi tersedia untuk destinasi ini.'}
    </p>

    <div class="detail-info-grid">
      <div class="detail-info-item">
        <span class="item-label"><i class="fa-solid fa-map-pin"></i> Alamat</span>
        <span class="item-val">${place.address || 'Provinsi Bali'}</span>
      </div>
      <div class="detail-info-item">
        <span class="item-label"><i class="fa-solid fa-ticket"></i> Tiket Masuk</span>
        <span class="item-val">${place.ticket_price || 'Gratis'}</span>
      </div>
      <div class="detail-info-item">
        <span class="item-label"><i class="fa-solid fa-clock"></i> Jam Buka</span>
        <span class="item-val">${place.opening_hours || '24 Jam'}</span>
      </div>
      <div class="detail-info-item">
        <span class="item-label"><i class="fa-solid fa-compass"></i> Koordinat Spasial</span>
        <span class="item-val">${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}</span>
      </div>
    </div>

    ${place.facilities ? `
      <div style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
        <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">
          <i class="fa-solid fa-list-check"></i> Fasilitas Tersedia:
        </span>
        <span style="font-size: 0.85rem; color: var(--text-main);">${place.facilities}</span>
      </div>
    ` : ''}
  `;

  modal.classList.add('active');
}

// Get user current geolocation
function getUserLocation() {
  if (!navigator.geolocation) {
    showToast('Browser Anda tidak mendukung Geolocation GPS.', 'error');
    return;
  }

  showToast('Mendeteksi posisi GPS Anda...', 'info');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      AppState.userLocation = { lat, lng };

      if (window.MapModule) {
        window.MapModule.setUserLocationMarker(lat, lng);
      }
      showToast(`Lokasi berhasil dideteksi: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, 'success');
    },
    (err) => {
      console.warn('Geolocation error:', err.message);
      // Fallback center Denpasar
      showToast('Izin lokasi ditolak. Menggunakan titik default Denpasar.', 'info');
      AppState.userLocation = { lat: -8.6705, lng: 115.2185 };
      if (window.MapModule) {
        window.MapModule.setUserLocationMarker(-8.6705, 115.2185);
      }
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// Navigation Tabs switching
function initNavigationTabs() {
  const tabBtns = document.querySelectorAll('.nav-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = btn.getAttribute('data-tab');
      if (!targetId) return;

      // Access control: 'view-admin' (Kelola Data) khusus untuk Administrator
      if (targetId === 'view-admin' && !AppState.adminToken) {
        if (e) e.preventDefault();
        showToast('Fitur Kelola Data dikhususkan untuk Administrator. Silakan login terlebih dahulu.', 'error');
        const loginModal = document.getElementById('modal-login');
        if (loginModal) loginModal.classList.add('active');
        return;
      }

      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add('active');
        AppState.activeTab = targetId;

        // If switching to map, invalidate map size for smooth rendering
        if (targetId === 'view-map' && window.MapModule && window.MapModule.map) {
          setTimeout(() => window.MapModule.map.invalidateSize(), 200);
        }

        // If switching to stats, load charts
        if (targetId === 'view-stats' && window.StatsModule) {
          setTimeout(() => window.StatsModule.loadStats(), 80);
        }

        // If switching to admin, refresh table
        if (targetId === 'view-admin' && window.AdminModule) {
          setTimeout(() => window.AdminModule.renderAdminTable(), 80);
        }
      }
    });
  });
}

// Initialize filters & search bindings
function initFilterBindings() {
  // Search input
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('btn-clear-search');

  searchInput.addEventListener('input', (e) => {
    AppState.searchQuery = e.target.value;
    clearBtn.style.display = AppState.searchQuery ? 'block' : 'none';

    // Auto-sync category pill if typed query explicitly targets a specific category
    if (AppState.searchQuery) {
      const detectedCat = detectCategoryIntent(AppState.searchQuery);
      if (detectedCat && AppState.selectedCategory !== 'Semua' && AppState.selectedCategory !== detectedCat) {
        const catPills = document.querySelectorAll('.cat-pill');
        catPills.forEach(p => {
          if (p.getAttribute('data-category') === detectedCat) {
            p.classList.add('active');
          } else {
            p.classList.remove('active');
          }
        });
        AppState.selectedCategory = detectedCat;
      }
    }

    applyFilters();
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    AppState.searchQuery = '';
    clearBtn.style.display = 'none';
    applyFilters();
  });

  // Category pills
  const catPills = document.querySelectorAll('.cat-pill');
  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      catPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      AppState.selectedCategory = pill.getAttribute('data-category');
      applyFilters();
    });
  });

  // Regency select
  const selectKab = document.getElementById('select-kabupaten');
  selectKab.addEventListener('change', (e) => {
    AppState.selectedKabupaten = e.target.value;
    applyFilters();

    // If a regency is chosen, zoom map to its feature if available
    if (window.MapModule && e.target.value !== 'Semua') {
      window.MapModule.zoomToRegency(e.target.value);
    }
  });

  // Rating select
  const selectRating = document.getElementById('select-rating');
  selectRating.addEventListener('change', (e) => {
    AppState.minRating = parseFloat(e.target.value) || 0;
    applyFilters();
  });

  // User location button
  document.getElementById('btn-user-location').addEventListener('click', getUserLocation);

  // Close modals
  document.getElementById('close-detail-modal').addEventListener('click', () => {
    document.getElementById('modal-place-detail').classList.remove('active');
  });
  document.getElementById('btn-close-detail').addEventListener('click', () => {
    document.getElementById('modal-place-detail').classList.remove('active');
  });
}

// Document ready bootstrap
document.addEventListener('DOMContentLoaded', () => {
  initNavigationTabs();
  initFilterBindings();
  loadPlaces();
});

// Expose globally
window.AppState = AppState;
window.showToast = showToast;
window.getCategoryColor = getCategoryColor;
window.getCategoryIcon = getCategoryIcon;
window.formatRupiah = formatRupiah;
window.loadPlaces = loadPlaces;
window.applyFilters = applyFilters;
window.openPlaceDetailModal = openPlaceDetailModal;
window.onPlaceCardClick = onPlaceCardClick;
