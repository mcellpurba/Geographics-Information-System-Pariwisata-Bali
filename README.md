# 🏝️ GIS Pariwisata Bali — Fullstack Web Geographic Information System

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-5.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-199900?style=for-the-badge&logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

Aplikasi **Fullstack Web Geographic Information System (Web GIS)** untuk pemetaan, eksplorasi, dan analisis spasial persebaran destinasi wisata di Provinsi Bali. Dibangun dengan arsitektur terpisah (*decoupled architecture*) antara **Frontend Client** berbasis Vite & Leaflet dengan **Backend REST API** berbasis Express & SQLite Spasial.

Aplikasi ini mengintegrasikan algoritma analisis spasial mutakhir seperti **Pencarian Radius (Spatial Buffer Haversine)**, **Density-Based Spatial Clustering of Applications with Noise (DBSCAN)**, dan **Visualisasi Konsentrasi Panas (Weighted Heatmap)**.

---

## 🌟 Fitur Utama

### 1. 🗺️ Peta Interaktif & Multi-Layer GIS
* **Multi-Basemap Switching**: Mendukung 4 layer peta dasar:
  * *ESRI World Street Map* (Default, modern dan beresolusi tinggi)
  * *OpenStreetMap Standard* (Peta jalan terbuka global)
  * *ESRI Topografi* (Kontur elevasi dan lanskap pegunungan)
  * *ESRI World Imagery HD Satellite* (Citra satelit fotorealistik)
* **Batas Wilayah Administratif**: Poligon GeoJSON presisi untuk 9 Kabupaten/Kota se-Provinsi Bali dengan deteksi *hover highlight* dan filter wilayah dinamis.
* **Smart Marker Clustering**: Pengelompokan titik otomatis (*Leaflet MarkerCluster*) dengan badge penanda kategori warna dan penghitung kepadatan.
* **Eksplorasi Lengkap**: Pencarian instan (*live search*), filter kategori (Pantai, Budaya & Pura, Alam & Gunung, Air Terjun, Rekreasi, Kuliner), dan filter rating bintang.
* **Deteksi Geolocation GPS**: Fitur *"Lokasi Saya"* untuk mendeteksi posisi pengguna secara real-time.
* **Modal Detail Destinasi**: Galeri foto, jam operasional, harga tiket masuk, tag fasilitas lengkap, dan rute navigasi instan ke Google Maps.

### 2. 📍 Analisis Spasial Buffer Radius (Pencarian Jangkauan)
* Perhitungan radius dinamis mulai dari **1 km hingga 50 km** menggunakan **Formula Haversine**.
* Lingkaran spasial (*spatial buffer circle*) interaktif dengan titik pusat fleksibel (klik di peta atau koordinat kustom).
* Filter kategori spesifik di dalam lingkaran radius.

### 3. 🔬 Analisis Kluster Kepadatan DBSCAN
* Pengelompokan kluster otomatis berbasis densitas spasial (*Density-Based Spatial Clustering*).
* Parameter yang dapat disesuaikan:
  * **Epsilon ($\epsilon$)**: Jarak batas jangkauan tetangga (2 km – 25 km).
  * **MinPts**: Jumlah minimum titik untuk membentuk suatu kluster (2 – 8 titik).
* Identifikasi otomatis untuk **Titik Pencilan (*Noise Points*)** yang berada di luar konsentrasi kluster.
* Ringkasan daftar kluster, jumlah anggota, dan navigasi *zoom-to-cluster*.

### 4. 🔥 Visualisasi Heatmap Spektrum Panas
* Visualisasi kepadatan spasial (*Kernel Density Heatmap*) dengan bobot rating pengunjung.
* Spektrum warna termal: 🔵 Rendah ➔ 🟢 Sedang ➔ 🟡 Padat ➔ 🔴 Hotspot Utama.
* Kontrol interaktif: slider radius pijar, tingkat blur (kehalusan), dan tombol preset (*Halus*, *Standar*, *Fokus*).
* Fitur *"Sembunyikan Marker Pin"* untuk memfokuskan pandangan pada pancaran gradasi warna termal tanpa terhalang pin marker.

### 5. 📊 Dashboard Statistik & Analitik GIS
* Visualisasi grafik statistik interaktif menggunakan **Chart.js**:
  * Distribusi destinasi per Kabupaten/Kota.
  * Komposisi sebaran kategori wisata.
  * Metrik rata-rata rating destinasi wisata.

### 6. 🛡️ Panel Administrasi & CRUD Data Spasial
* Autentikasi berbasis **JSON Web Token (JWT)** dan pengamanan *password hash* dengan **Bcrypt**.
* **Manajemen CRUD Penuh**: Tambah, ubah, dan hapus data objek wisata.
* **Interactive Map Coordinate Picker**: Penentuan koordinat latitude & longitude secara visual dengan mengeklik peta mini.
* **Ekspor Data GeoJSON**: Unduh seluruh koleksi fitur spasial dalam format standar GeoJSON (`.geojson`) untuk integrasi dengan perangkat lunak desktop GIS seperti QGIS atau ArcGIS.

---

## 🏗️ Struktur Arsitektur Proyek

Proyek ini menggunakan arsitektur *decoupled* yang modular, rapi, dan mudah dirawat:

```text
proyek-gis-bali/
├── package.json                 # Root script runner (Concurrently)
│
├── backend/                     # 🚀 REST API & DATABASE ENGINE (Port 5000)
│   ├── package.json             # Dependensi: express, cors, sqlite3, bcryptjs, jsonwebtoken
│   ├── server.js                # Entry point server Express
│   ├── data/
│   │   └── bali-kabupaten.geojson # Poligon batas administrasi 9 kabupaten di Bali
│   └── src/
│       ├── controllers/         # Business logic & controller
│       │   ├── placesController.js   # CRUD & filter destinasi
│       │   ├── spatialController.js  # Buffer radius, DBSCAN, & Heatmap
│       │   ├── authController.js     # JWT admin authentication
│       │   └── statsController.js    # Metrik agregasi statistik
│       ├── routes/              # Deklarasi rute REST API
│       │   ├── placesRoutes.js
│       │   ├── spatialRoutes.js
│       │   ├── authRoutes.js
│       │   ├── statsRoutes.js
│       │   └── geojsonRoutes.js
│       ├── db/                  # SQLite spatial database & seeder
│       │   ├── database.js      # Koneksi database & schema migration
│       │   ├── seed-data.js     # Dataset awal 47 destinasi wisata Bali
│       │   └── gis_bali.db      # File database SQLite
│       └── utils/               # Modul kalkulasi matematika spasial
│           ├── haversine.js     # Perhitungan jarak Haversine bola bumi
│           └── dbscan.js        # Implementasi algoritma DBSCAN clustering
│
└── frontend/                    # 🎨 FRONTEND CLIENT APPLICATION (Port 3000)
    ├── package.json             # Dependensi frontend: vite
    ├── vite.config.js           # Konfigurasi reverse proxy /api -> http://localhost:5000
    ├── index.html               # Halaman antarmuka utama (HTML5)
    ├── public/
    │   └── data/
    │       └── bali-kabupaten.geojson
    └── src/
        ├── css/
        │   └── style.css        # Desain Vanilla CSS (Modern Blue-Slate UI System)
        └── js/
            ├── app.js           # State manajemen utama & event handlers
            ├── map.js           # Leaflet map, basemaps, cluster, & layer batas
            ├── spatial.js       # Buffer radius, DBSCAN, & visualisasi Heatmap
            ├── admin.js         # Panel admin CRUD, picker koordinat, & ekspor GeoJSON
            └── stats.js         # Rendering grafik analitik Chart.js
```

---

## 🚀 Panduan Memulai & Menjalankan Aplikasi

### 1. Prasyarat Sistem
* [Node.js](https://nodejs.org/) (versi 18.0.0 atau yang lebih baru)
* [npm](https://www.npmjs.com/) (versi 9.0.0 atau yang lebih baru)
* Git

### 2. Kloning Repositori
```bash
git clone https://github.com/username/proyek-gis-bali.git
cd proyek-gis-bali
```

### 3. Instalasi Seluruh Dependensi
Instal semua modul yang diperlukan untuk root, backend, dan frontend hanya dengan satu perintah:
```bash
npm run install:all
```

### 4. Menjalankan Aplikasi (Development Mode)
Jalankan Frontend dan Backend secara bersamaan:
```bash
npm run dev
```
*(atau gunakan perintah `npm start`)*

Terminal akan menjalankan dua proses sekaligus:
* `[BACKEND]` berjalan pada `http://localhost:5000`
* `[FRONTEND]` berjalan pada `http://localhost:3000`

### 5. Buka di Peramban Web
Akses antarmuka aplikasi melalui peramban:
```
http://localhost:3000
```

> **Catatan Reverse Proxy:** Frontend Vite telah dilengkapi reverse proxy otomatis, sehingga setiap request menuju `/api/*` langsung diarahkan ke server backend (`http://localhost:5000/api/*`) tanpa masalah CORS.

---

## 🔑 Kredensial Administrator Bawaan

Untuk menguji fitur kelola data (CRUD), gunakan akun admin bawaan:

* **Username**: `admin`
* **Password**: `admin123`

*(Setelah login, tab **"Kelola Data"** akan muncul di bar navigasi atas).*

---

## 📡 Dokumentasi Endpoint REST API

Backend menyediakan endpoint RESTful yang siap diintegrasikan:

| Metode | Endpoint | Deskripsi | Akses |
| :---: | :--- | :--- | :---: |
| `GET` | `/api/health` | Pemeriksaan status kesehatan server backend | Publik |
| `GET` | `/api/places` | Mengambil semua destinasi wisata (mendukung query `q`, `category`, `kabupaten`, `min_rating`) | Publik |
| `GET` | `/api/places/:id` | Mengambil informasi detail satu destinasi | Publik |
| `POST` | `/api/places` | Menambahkan data destinasi baru | Admin (JWT) |
| `PUT` | `/api/places/:id` | Memperbarui data destinasi yang sudah ada | Admin (JWT) |
| `DELETE`| `/api/places/:id` | Menghapus destinasi dari basis data | Admin (JWT) |
| `POST` | `/api/spatial/radius` | Pencarian spasial dalam radius lingkaran buffer (Haversine) | Publik |
| `POST` | `/api/spatial/dbscan` | Menjalankan analisis spasial kluster DBSCAN | Publik |
| `GET` | `/api/spatial/heatmap` | Mengambil data koordinat tertimbang untuk layer Heatmap | Publik |
| `GET` | `/api/stats` | Agregasi data statistik untuk diagram analitik | Publik |
| `POST` | `/api/admin/login` | Autentikasi administrator & penerbitan token JWT | Publik |
| `GET` | `/api/geojson/bali-kabupaten` | Data poligon batas administratif 9 kabupaten/kota | Publik |

---

## 🗺️ Format Data Spasial

### Skema Data Objek Wisata
Setiap data destinasi wisata dalam sistem menyimpan informasi atribut berikut:
```json
{
  "id": 1,
  "name": "Pantai Kuta",
  "category": "Pantai",
  "kabupaten": "Badung",
  "latitude": -8.7180,
  "longitude": 115.1686,
  "rating": 4.6,
  "ticket_price": 0,
  "opening_hours": "24 Jam",
  "facilities": "Parkir, Toilet, Restoran, Penyewaan Papan Selancar, Tempat Ibadah",
  "description": "Pantai berpasir putih legendaris dengan pemandangan matahari terbenam spektakuler...",
  "image_url": "https://..."
}
```

### Format Ekspor GeoJSON
Data dapat diekspor langsung dari panel admin ke format standar RFC 7946 GeoJSON FeatureCollection:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [115.1686, -8.7180]
      },
      "properties": {
        "id": 1,
        "name": "Pantai Kuta",
        "category": "Pantai",
        "kabupaten": "Badung",
        "rating": 4.6
      }
    }
  ]
}
```

---

## 💻 Teknologi yang Digunakan

* **Frontend**: HTML5, Vanilla CSS3 (Custom Design System), JavaScript (ES6+), Leaflet 1.9.4, Leaflet.heat, Leaflet.markercluster, Turf.js 6.5, Chart.js 4.4, Vite 5.4, FontAwesome 6.
* **Backend**: Node.js, Express.js 5, SQLite3, BcryptJS, JSON Web Token (JWT), CORS.
* **Format Geospasial**: GeoJSON, WGS 84 (EPSG:4326), Spatial Haversine Distance, DBSCAN.

---

## 📄 Lisensi

Proyek ini didistribusikan di bawah lisensi **MIT License**. Silakan gunakan, pelajari, dan kembangkan secara bebas untuk keperluan portofolio maupun pengembangan aplikasi geospasial lainnya.