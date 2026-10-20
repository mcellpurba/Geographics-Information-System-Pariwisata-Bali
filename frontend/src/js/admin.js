/**
 * GIS PARIWISATA PROVINSI BALI
 * Admin Management Module: CRUD, Map Coordinate Picker, Auth, and GeoJSON Export
 */

const AdminModule = {
  pickerMap: null,
  pickerMarker: null,
  editingPlaceId: null,

  init() {
    this.updateAuthUI();
    this.initAuthListeners();
    this.initCrudListeners();
    this.initExportListener();
  },

  // Update navbar button, role badge, tabs, and guards based on login status
  updateAuthUI() {
    const authBtn = document.getElementById('btn-admin-auth');
    const adminTab = document.getElementById('tab-btn-admin');
    const roleBadge = document.getElementById('user-role-badge');
    const adminContentWrap = document.getElementById('admin-content-wrap');
    const adminGuestGuard = document.getElementById('admin-guest-guard');
    const detailEditBtn = document.getElementById('btn-detail-edit-place');

    if (window.AppState.adminToken) {
      document.body.classList.add('is-admin');

      // Admin Tab visible
      if (adminTab) {
        adminTab.style.display = 'inline-flex';
      }

      // Role badge indicator
      if (roleBadge) {
        roleBadge.className = 'badge-role role-admin';
        roleBadge.innerHTML = `<i class="fa-solid fa-user-shield"></i> <span>Administrator</span>`;
        roleBadge.title = `Login sebagai: ${window.AppState.adminUser || 'admin'}`;
      }

      // Header button
      if (authBtn) {
        authBtn.title = 'Klik untuk keluar dari sesi admin';
        authBtn.style.borderColor = 'rgba(239, 68, 68, 0.4)';
        authBtn.style.color = '#f87171';
        authBtn.innerHTML = `<i class="fa-solid fa-arrow-right-from-bracket"></i> <span id="admin-auth-label">Keluar Admin</span>`;
      }

      // Show admin table & controls, hide guard
      if (adminContentWrap) adminContentWrap.style.display = 'block';
      if (adminGuestGuard) adminGuestGuard.style.display = 'none';
      if (detailEditBtn) detailEditBtn.style.display = 'inline-flex';

    } else {
      document.body.classList.remove('is-admin');

      // Admin Tab hidden for tourists/public
      if (adminTab) {
        adminTab.style.display = 'none';
        adminTab.classList.remove('active');
      }

      // Role badge indicator
      if (roleBadge) {
        roleBadge.className = 'badge-role role-tourist';
        roleBadge.innerHTML = `<i class="fa-solid fa-user"></i> <span>Wisatawan</span>`;
        roleBadge.title = 'Mode Wisatawan (Akses Publik)';
      }

      // Header button
      if (authBtn) {
        authBtn.title = 'Masuk sebagai administrator untuk mengelola data SIG';
        authBtn.style.borderColor = '';
        authBtn.style.color = '';
        authBtn.innerHTML = `<i class="fa-solid fa-user-shield"></i> <span id="admin-auth-label">Login Admin</span>`;
      }

      // Hide admin table & controls, show guard if view-admin is accessed
      if (adminContentWrap) adminContentWrap.style.display = 'none';
      if (adminGuestGuard) adminGuestGuard.style.display = 'block';
      if (detailEditBtn) detailEditBtn.style.display = 'none';

      // If user was on view-admin when logged out or unauthenticated, switch back to map
      if (window.AppState.activeTab === 'view-admin') {
        const mapTabBtn = document.getElementById('tab-btn-map');
        if (mapTabBtn) mapTabBtn.click();
      }
    }
  },

  initAuthListeners() {
    const authBtn = document.getElementById('btn-admin-auth');
    const loginModal = document.getElementById('modal-login');
    const formLogin = document.getElementById('form-login');

    authBtn.addEventListener('click', () => {
      if (window.AppState.adminToken) {
        // Logout confirmation
        if (confirm('Apakah Anda ingin keluar (logout) dari sesi admin?')) {
          localStorage.removeItem('gis_bali_admin_token');
          localStorage.removeItem('gis_bali_admin_user');
          window.AppState.adminToken = null;
          window.AppState.adminUser = null;
          this.updateAuthUI();
          window.showToast('Berhasil logout dari sesi admin. Anda kembali ke Mode Wisatawan.', 'info');
        }
      } else {
        loginModal.classList.add('active');
      }
    });

    document.getElementById('close-login-modal').addEventListener('click', () => {
      loginModal.classList.remove('active');
    });
    document.getElementById('btn-cancel-login').addEventListener('click', () => {
      loginModal.classList.remove('active');
    });

    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;

      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const result = await res.json();

        if (result.success) {
          localStorage.setItem('gis_bali_admin_token', result.token);
          localStorage.setItem('gis_bali_admin_user', result.username);
          window.AppState.adminToken = result.token;
          window.AppState.adminUser = result.username;

          loginModal.classList.remove('active');
          formLogin.reset();
          this.updateAuthUI();
          this.renderAdminTable();
          window.showToast(`Selamat datang, Admin ${result.username}! Mode pengelolaan data aktif.`, 'success');

          // Smoothly switch to Kelola Data tab on successful login
          const adminTabBtn = document.getElementById('tab-btn-admin');
          if (adminTabBtn) {
            adminTabBtn.click();
          }
        } else {
          window.showToast(result.error || 'Login gagal. Cek username dan password.', 'error');
        }
      } catch (err) {
        window.showToast('Gagal terhubung ke server login.', 'error');
      }
    });
  },

  // --------------------------------------------------------------------------
  // CRUD OPERATIONS & TABLE
  // --------------------------------------------------------------------------
  renderAdminTable() {
    const tbody = document.getElementById('admin-table-body');
    if (!tbody) return;

    const search = (document.getElementById('admin-table-search').value || '').toLowerCase().trim();
    const kab = document.getElementById('admin-table-kab').value;

    const filtered = window.AppState.places.filter(p => {
      const matchSearch = window.matchSearchQuery
        ? window.matchSearchQuery(p, search)
        : (!search ||
           p.name.toLowerCase().includes(search) ||
           p.category.toLowerCase().includes(search) ||
           p.kabupaten.toLowerCase().includes(search));
      const matchKab = (kab === 'Semua') || (p.kabupaten.toUpperCase() === kab.toUpperCase());
      return matchSearch && matchKab;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 30px; color: var(--text-muted);">
            Tidak ada data destinasi wisata yang cocok dengan kriteria pencarian tabel.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(p => {
      return `
        <tr>
          <td>
            <img class="table-thumb" src="${p.image_url || 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80'}" alt="${p.name}" onerror="this.src='https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80'">
          </td>
          <td>
            <strong style="color: var(--text-primary); font-weight: 700;">${p.name}</strong>
            <div style="font-size: 0.72rem; color: var(--text-muted); max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${p.address || '-'}
            </div>
          </td>
          <td>
            <span class="badge-tag badge-pantai">${p.category}</span>
          </td>
          <td>
            <span style="font-weight: 600;">${p.kabupaten}</span>
          </td>
          <td style="font-family: monospace; font-size: 0.78rem;">
            ${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}
          </td>
          <td>
            <span style="color: var(--secondary-light); font-weight: 700;">
              <i class="fa-solid fa-star"></i> ${p.rating ? p.rating.toFixed(1) : '4.5'}
            </span>
          </td>
          <td>
            <span style="font-size: 0.8rem;">${p.ticket_price || 'Gratis'}</span>
          </td>
          <td>
            <div class="table-actions">
              <button class="btn-table-action" title="Lihat di Peta" onclick="window.AdminModule.viewOnMap(${p.id})">
                <i class="fa-solid fa-map-location-dot"></i>
              </button>
              <button class="btn-table-action" title="Edit Data" onclick="window.AdminModule.openEditModal(${p.id})">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button class="btn-table-action delete" title="Hapus Data" onclick="window.AdminModule.confirmDelete(${p.id})">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  viewOnMap(id) {
    const place = window.AppState.places.find(p => p.id === id);
    if (!place) return;
    document.getElementById('tab-btn-map').click();
    window.MapModule.focusPlace(place);
  },

  initCrudListeners() {
    // Search & Filter in Table
    document.getElementById('admin-table-search').addEventListener('input', () => this.renderAdminTable());
    document.getElementById('admin-table-kab').addEventListener('change', () => this.renderAdminTable());

    // Open Add Place Modal
    document.getElementById('btn-open-add-place').addEventListener('click', () => {
      this.openAddModal();
    });

    // Close Modal buttons
    document.getElementById('close-place-form-modal').addEventListener('click', () => {
      document.getElementById('modal-place-form').classList.remove('active');
    });
    document.getElementById('btn-cancel-place-form').addEventListener('click', () => {
      document.getElementById('modal-place-form').classList.remove('active');
    });

    // Form submit
    document.getElementById('form-place').addEventListener('submit', (e) => this.handlePlaceFormSubmit(e));

    // Initialize Image Upload & Live Preview Handlers
    this.initImageUploadHandlers();
  },

  // Initialize file upload (JPG/JPEG/PNG) and URL link with instant live preview
  initImageUploadHandlers() {
    const tabUpload = document.getElementById('btn-tab-upload-file');
    const tabUrl = document.getElementById('btn-tab-url-link');
    const panelUpload = document.getElementById('panel-upload-file');
    const panelUrl = document.getElementById('panel-url-link');
    const fileInput = document.getElementById('form-image-file');
    const urlInput = document.getElementById('form-image-url');
    const hiddenInput = document.getElementById('form-image');
    const previewContainer = document.getElementById('image-preview-container');
    const previewImg = document.getElementById('image-preview-img');
    const previewFilename = document.getElementById('image-preview-filename');
    const btnClear = document.getElementById('btn-clear-image');
    const dropzone = document.getElementById('dropzone-label');

    // Tab switching: Upload File vs URL Link
    if (tabUpload && tabUrl) {
      tabUpload.addEventListener('click', () => {
        tabUpload.classList.add('active');
        tabUrl.classList.remove('active');
        if (panelUpload) panelUpload.style.display = 'block';
        if (panelUrl) panelUrl.style.display = 'none';
      });

      tabUrl.addEventListener('click', () => {
        tabUrl.classList.add('active');
        tabUpload.classList.remove('active');
        if (panelUrl) panelUrl.style.display = 'block';
        if (panelUpload) panelUpload.style.display = 'none';
      });
    }

    // Process file upload (JPG, JPEG, PNG)
    const handleFile = (file) => {
      if (!file) return;

      // Validate format
      const validExtensions = ['image/jpeg', 'image/jpg', 'image/png'];
      const isExtValid = /\.(jpe?g|png)$/i.test(file.name);
      if (!validExtensions.includes(file.type) && !isExtValid) {
        window.showToast('Format file tidak didukung! Harap unggah format JPG, JPEG, atau PNG.', 'error');
        if (fileInput) fileInput.value = '';
        return;
      }

      // Validate size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        window.showToast('Ukuran gambar terlalu besar! Maksimal 10 MB.', 'error');
        if (fileInput) fileInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        hiddenInput.value = dataUrl;
        if (urlInput) urlInput.value = ''; // clear url input
        previewImg.src = dataUrl;
        previewContainer.style.display = 'block';
        previewFilename.innerHTML = `<strong>File Berhasil Diunggah:</strong> ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        window.showToast('Gambar berhasil dimuat dalam pratinjau!', 'success');
      };
      reader.readAsDataURL(file);
    };

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handleFile(e.target.files[0]);
        }
      });
    }

    // Drag and drop support on dropzone
    if (dropzone) {
      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('dragover');
        });
      });

      dropzone.addEventListener('drop', (e) => {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleFile(e.dataTransfer.files[0]);
        }
      });
    }

    // URL input live change / paste handler
    if (urlInput) {
      const handleUrlInput = () => {
        const url = urlInput.value.trim();
        if (url) {
          hiddenInput.value = url;
          if (fileInput) fileInput.value = ''; // clear file input
          previewImg.src = url;
          previewContainer.style.display = 'block';
          previewFilename.innerHTML = `<strong>Sumber Tautan Web:</strong> <span style="word-break: break-all;">${url}</span>`;
        } else {
          if (!fileInput || !fileInput.value) {
            previewContainer.style.display = 'none';
            hiddenInput.value = '';
          }
        }
      };

      urlInput.addEventListener('input', handleUrlInput);
      urlInput.addEventListener('change', handleUrlInput);
    }

    // Image load error fallback
    if (previewImg) {
      previewImg.onerror = () => {
        previewFilename.innerHTML = '<span style="color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Gagal memuat gambar dari sumber ini. Pastikan link atau file valid!</span>';
      };
    }

    // Clear preview button
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        hiddenInput.value = '';
        if (fileInput) fileInput.value = '';
        if (urlInput) urlInput.value = '';
        previewImg.src = '';
        previewContainer.style.display = 'none';
        window.showToast('Foto pratinjau dihapus. Anda dapat memilih gambar baru.', 'info');
      });
    }
  },

  // Initialize or re-render interactive mini Leaflet map in form modal
  initPickerMap(defaultLat = -8.4095, defaultLng = 115.1889) {
    const container = document.getElementById('picker-map');
    if (!container) return;

    if (!this.pickerMap) {
      this.pickerMap = L.map('picker-map', {
        center: [defaultLat, defaultLng],
        zoom: 10,
        zoomControl: true
      });

      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'
      }).addTo(this.pickerMap);

      this.pickerMarker = L.marker([defaultLat, defaultLng], {
        draggable: true
      }).addTo(this.pickerMap);

      // Drag listener
      this.pickerMarker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        document.getElementById('form-lat').value = pos.lat.toFixed(6);
        document.getElementById('form-lng').value = pos.lng.toFixed(6);
      });

      // Click listener on mini map
      this.pickerMap.on('click', (e) => {
        this.pickerMarker.setLatLng(e.latlng);
        document.getElementById('form-lat').value = e.latlng.lat.toFixed(6);
        document.getElementById('form-lng').value = e.latlng.lng.toFixed(6);
      });

      // Input changes reflect on mini map
      const updateMarkerFromInputs = () => {
        const lat = parseFloat(document.getElementById('form-lat').value);
        const lng = parseFloat(document.getElementById('form-lng').value);
        if (!isNaN(lat) && !isNaN(lng)) {
          this.pickerMarker.setLatLng([lat, lng]);
          this.pickerMap.panTo([lat, lng]);
        }
      };

      document.getElementById('form-lat').addEventListener('input', updateMarkerFromInputs);
      document.getElementById('form-lng').addEventListener('input', updateMarkerFromInputs);
    } else {
      this.pickerMarker.setLatLng([defaultLat, defaultLng]);
      this.pickerMap.setView([defaultLat, defaultLng], 11);
    }

    setTimeout(() => {
      this.pickerMap.invalidateSize();
    }, 250);
  },

  openAddModal() {
    if (!window.AppState.adminToken) {
      window.showToast('Silakan login sebagai administrator terlebih dahulu untuk menambah data.', 'error');
      document.getElementById('modal-login').classList.add('active');
      return;
    }

    this.editingPlaceId = null;
    document.getElementById('place-form-title').innerHTML = '<i class="fa-solid fa-plus" style="color: var(--primary); margin-right: 8px;"></i> Tambah Destinasi Wisata';
    document.getElementById('form-place').reset();
    document.getElementById('place-id').value = '';

    // Reset image inputs & preview
    document.getElementById('form-image').value = '';
    const fileInput = document.getElementById('form-image-file');
    if (fileInput) fileInput.value = '';
    const urlInput = document.getElementById('form-image-url');
    if (urlInput) urlInput.value = '';
    const previewContainer = document.getElementById('image-preview-container');
    if (previewContainer) previewContainer.style.display = 'none';
    const previewImg = document.getElementById('image-preview-img');
    if (previewImg) previewImg.src = '';
    document.getElementById('btn-tab-upload-file')?.click();

    // Default center Bali
    const defLat = -8.4095;
    const defLng = 115.1889;
    document.getElementById('form-lat').value = defLat.toFixed(6);
    document.getElementById('form-lng').value = defLng.toFixed(6);
    document.getElementById('form-rating').value = '4.7';

    document.getElementById('modal-place-form').classList.add('active');
    this.initPickerMap(defLat, defLng);
  },

  openEditModal(id) {
    if (!window.AppState.adminToken) {
      window.showToast('Silakan login sebagai administrator terlebih dahulu untuk mengubah data.', 'error');
      document.getElementById('modal-login').classList.add('active');
      return;
    }

    const place = window.AppState.places.find(p => p.id === id);
    if (!place) return;

    this.editingPlaceId = id;
    document.getElementById('place-form-title').innerHTML = `<i class="fa-solid fa-pen-to-square" style="color: var(--secondary-light); margin-right: 8px;"></i> Edit Destinasi: ${place.name}`;
    document.getElementById('place-id').value = place.id;
    document.getElementById('form-name').value = place.name;
    document.getElementById('form-category').value = place.category;
    document.getElementById('form-kabupaten').value = place.kabupaten;
    document.getElementById('form-lat').value = place.latitude;
    document.getElementById('form-lng').value = place.longitude;
    document.getElementById('form-rating').value = place.rating || 4.5;
    document.getElementById('form-address').value = place.address || '';
    document.getElementById('form-ticket').value = place.ticket_price || '';
    document.getElementById('form-hours').value = place.opening_hours || '';
    document.getElementById('form-facilities').value = place.facilities || '';
    document.getElementById('form-desc').value = place.description || '';

    // Set image inputs & live preview for existing place
    const hiddenImage = document.getElementById('form-image');
    const urlInput = document.getElementById('form-image-url');
    const fileInput = document.getElementById('form-image-file');
    const previewContainer = document.getElementById('image-preview-container');
    const previewImg = document.getElementById('image-preview-img');
    const previewFilename = document.getElementById('image-preview-filename');

    if (fileInput) fileInput.value = '';

    if (place.image_url) {
      hiddenImage.value = place.image_url;
      const isBase64 = place.image_url.startsWith('data:');
      if (urlInput) urlInput.value = isBase64 ? '' : place.image_url;
      if (previewImg) previewImg.src = place.image_url;
      if (previewContainer) previewContainer.style.display = 'block';
      if (previewFilename) {
        previewFilename.innerHTML = `<strong>Foto Saat Ini:</strong> ${place.name}`;
      }
      if (isBase64) {
        document.getElementById('btn-tab-upload-file')?.click();
      } else {
        document.getElementById('btn-tab-url-link')?.click();
      }
    } else {
      hiddenImage.value = '';
      if (urlInput) urlInput.value = '';
      if (previewContainer) previewContainer.style.display = 'none';
      document.getElementById('btn-tab-upload-file')?.click();
    }

    document.getElementById('modal-place-form').classList.add('active');
    this.initPickerMap(place.latitude, place.longitude);
  },

  async handlePlaceFormSubmit(e) {
    e.preventDefault();

    if (!window.AppState.adminToken) {
      window.showToast('Sesi admin kedaluwarsa. Silakan login kembali.', 'error');
      document.getElementById('modal-login').classList.add('active');
      return;
    }

    const payload = {
      name: document.getElementById('form-name').value.trim(),
      category: document.getElementById('form-category').value,
      kabupaten: document.getElementById('form-kabupaten').value,
      latitude: parseFloat(document.getElementById('form-lat').value),
      longitude: parseFloat(document.getElementById('form-lng').value),
      rating: parseFloat(document.getElementById('form-rating').value),
      address: document.getElementById('form-address').value.trim(),
      ticket_price: document.getElementById('form-ticket').value.trim(),
      opening_hours: document.getElementById('form-hours').value.trim(),
      image_url: document.getElementById('form-image').value.trim(),
      facilities: document.getElementById('form-facilities').value.trim(),
      description: document.getElementById('form-desc').value.trim()
    };

    const isEdit = !!this.editingPlaceId;
    const url = isEdit ? `/api/places/${this.editingPlaceId}` : '/api/places';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${window.AppState.adminToken}`
        },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (result.success) {
        window.showToast(result.message || 'Data berhasil disimpan!', 'success');
        document.getElementById('modal-place-form').classList.remove('active');
        await window.loadPlaces();
        this.renderAdminTable();
        if (window.StatsModule) window.StatsModule.loadStats();
      } else {
        window.showToast(result.error || 'Gagal menyimpan data destinasi.', 'error');
      }
    } catch (err) {
      console.error('Save place error:', err);
      window.showToast('Gagal terhubung ke server saat menyimpan.', 'error');
    }
  },

  async confirmDelete(id) {
    if (!window.AppState.adminToken) {
      window.showToast('Silakan login sebagai administrator terlebih dahulu untuk menghapus data.', 'error');
      document.getElementById('modal-login').classList.add('active');
      return;
    }

    const place = window.AppState.places.find(p => p.id === id);
    if (!place) return;

    if (!confirm(`Apakah Anda yakin ingin menghapus "${place.name}" secara permanen dari basis data spasial?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/places/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${window.AppState.adminToken}`
        }
      });
      const result = await res.json();
      if (result.success) {
        window.showToast(result.message || 'Data destinasi berhasil dihapus', 'success');
        await window.loadPlaces();
        this.renderAdminTable();
        if (window.StatsModule) window.StatsModule.loadStats();
      } else {
        window.showToast(result.error || 'Gagal menghapus data.', 'error');
      }
    } catch (err) {
      window.showToast('Gagal terhubung ke server saat menghapus.', 'error');
    }
  },

  // --------------------------------------------------------------------------
  // EXPORT SPATIAL DATA (GEOJSON)
  // --------------------------------------------------------------------------
  initExportListener() {
    // 1. Export GeoJSON
    const btnGeo = document.getElementById('btn-export-geojson');
    if (btnGeo) {
      btnGeo.addEventListener('click', () => {
        const places = window.AppState.places;
        if (!places || places.length === 0) {
          window.showToast('Tidak ada data untuk diekspor.', 'error');
          return;
        }

        // Format to standard GeoJSON FeatureCollection
        const geojson = {
          type: "FeatureCollection",
          metadata: {
            title: "Pariwisata Provinsi Bali GIS Data",
            generator: "GIS Pariwisata Bali SIG v2.0",
            timestamp: new Date().toISOString(),
            total_features: places.length
          },
          features: places.map(p => ({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [p.longitude, p.latitude]
            },
            properties: {
              id: p.id,
              name: p.name,
              category: p.category,
              kabupaten: p.kabupaten,
              address: p.address,
              ticket_price: p.ticket_price,
              opening_hours: p.opening_hours,
              rating: p.rating,
              facilities: p.facilities,
              description: p.description,
              image_url: p.image_url
            }
          }))
        };

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geojson, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `gis_pariwisata_bali_${Date.now()}.geojson`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();

        window.showToast('File GeoJSON (.geojson) berhasil diunduh!', 'success');
      });
    }

    // 2. Export CSV / Excel
    const btnCsv = document.getElementById('btn-export-csv');
    if (btnCsv) {
      btnCsv.addEventListener('click', () => {
        const places = window.AppState.places;
        if (!places || places.length === 0) {
          window.showToast('Tidak ada data untuk diekspor.', 'error');
          return;
        }

        const headers = ["ID", "Nama Destinasi", "Kategori", "Kabupaten", "Latitude", "Longitude", "Rating", "Harga Tiket (Rp)", "Jam Operasional", "Fasilitas", "Deskripsi"];
        const rows = places.map(p => [
          p.id,
          `"${(p.name || '').replace(/"/g, '""')}"`,
          `"${(p.category || '').replace(/"/g, '""')}"`,
          `"${(p.kabupaten || '').replace(/"/g, '""')}"`,
          p.latitude,
          p.longitude,
          p.rating,
          p.ticket_price || 0,
          `"${(p.opening_hours || '').replace(/"/g, '""')}"`,
          `"${(p.facilities || '').replace(/"/g, '""')}"`,
          `"${(p.description || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `data_destinasi_bali_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        window.showToast('File CSV (.csv) berhasil diunduh!', 'success');
      });
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  AdminModule.init();
});

// Expose globally
window.AdminModule = AdminModule;
