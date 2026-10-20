const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbRun, dbAll, dbGet, initDatabase } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'gis_bali_secret_key_2026';

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'backend/uploads')));

// --- SPATIAL MATH HELPERS ---
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius bumi dalam kilometer
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// DBSCAN Clustering Algorithm implementation
function runDBSCAN(points, epsKm = 10, minPts = 3) {
  const UNVISITED = 0;
  const VISITED = 1;
  const NOISE = -1;

  const status = new Array(points.length).fill(UNVISITED);
  const clusterAssignments = new Array(points.length).fill(null);
  let clusterId = 0;

  function regionQuery(pIdx) {
    const neighbors = [];
    const p = points[pIdx];
    for (let i = 0; i < points.length; i++) {
      const dist = haversineDistance(p.latitude, p.longitude, points[i].latitude, points[i].longitude);
      if (dist <= epsKm) {
        neighbors.push(i);
      }
    }
    return neighbors;
  }

  for (let i = 0; i < points.length; i++) {
    if (status[i] === VISITED) continue;
    status[i] = VISITED;

    const neighbors = regionQuery(i);
    if (neighbors.length < minPts) {
      clusterAssignments[i] = NOISE;
    } else {
      clusterAssignments[i] = clusterId;
      const queue = [...neighbors];
      let qIdx = 0;
      while (qIdx < queue.length) {
        const neighborIdx = queue[qIdx++];
        if (status[neighborIdx] === UNVISITED) {
          status[neighborIdx] = VISITED;
          const nNeighbors = regionQuery(neighborIdx);
          if (nNeighbors.length >= minPts) {
            for (const n of nNeighbors) {
              if (!queue.includes(n)) queue.push(n);
            }
          }
        }
        if (clusterAssignments[neighborIdx] === null || clusterAssignments[neighborIdx] === NOISE) {
          clusterAssignments[neighborIdx] = clusterId;
        }
      }
      clusterId++;
    }
  }

  // Group clusters
  const clusters = [];
  for (let c = 0; c < clusterId; c++) {
    const cPoints = [];
    for (let i = 0; i < points.length; i++) {
      if (clusterAssignments[i] === c) {
        cPoints.push({ ...points[i], cluster_id: c });
      }
    }
    if (cPoints.length > 0) {
      const avgLat = cPoints.reduce((acc, cur) => acc + cur.latitude, 0) / cPoints.length;
      const avgLng = cPoints.reduce((acc, cur) => acc + cur.longitude, 0) / cPoints.length;

      // dominant kabupaten
      const kabCounts = {};
      cPoints.forEach(p => { kabCounts[p.kabupaten] = (kabCounts[p.kabupaten] || 0) + 1; });
      const topKab = Object.keys(kabCounts).sort((a, b) => kabCounts[b] - kabCounts[a])[0];

      // dominant category
      const catCounts = {};
      cPoints.forEach(p => { catCounts[p.category] = (catCounts[p.category] || 0) + 1; });
      const topCat = Object.keys(catCounts).sort((a, b) => catCounts[b] - catCounts[a])[0];

      clusters.push({
        cluster_id: c,
        name: `Kluster ${c + 1} (${topKab})`,
        count: cPoints.length,
        centroid: { lat: avgLat, lng: avgLng },
        dominant_kabupaten: topKab,
        dominant_category: topCat,
        places: cPoints
      });
    }
  }

  const noisePoints = [];
  for (let i = 0; i < points.length; i++) {
    if (clusterAssignments[i] === NOISE) {
      noisePoints.push({ ...points[i], cluster_id: -1 });
    }
  }

  return {
    clusters,
    noise: noisePoints,
    total_clusters: clusters.length,
    total_clustered_points: points.length - noisePoints.length,
    total_noise_points: noisePoints.length,
    params: { epsKm, minPts }
  };
}

// Authentication middleware for admin routes
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Akses ditolak. Token autentikasi tidak ditemukan.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token tidak valid atau telah kedaluwarsa.' });
  }
}

// --- API ROUTES ---

// 1. Get all tourism places with optional search & filters
app.get('/api/places', async (req, res) => {
  try {
    const { q, category, kabupaten, min_rating } = req.query;
    let sql = 'SELECT * FROM places WHERE 1=1';
    const params = [];

    if (q) {
      sql += ' AND (name LIKE ? OR address LIKE ? OR description LIKE ?)';
      const queryParam = `%${q}%`;
      params.push(queryParam, queryParam, queryParam);
    }
    if (category && category !== 'Semua') {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (kabupaten && kabupaten !== 'Semua') {
      sql += ' AND UPPER(kabupaten) = UPPER(?)';
      params.push(kabupaten);
    }
    if (min_rating) {
      sql += ' AND rating >= ?';
      params.push(parseFloat(min_rating));
    }

    sql += ' ORDER BY rating DESC, name ASC';
    const places = await dbAll(sql, params);
    res.json({ success: true, count: places.length, data: places });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get single place detail
app.get('/api/places/:id', async (req, res) => {
  try {
    const place = await dbGet('SELECT * FROM places WHERE id = ?', [req.params.id]);
    if (!place) return res.status(404).json({ error: 'Destinasi wisata tidak ditemukan' });
    res.json({ success: true, data: place });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Admin login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan password wajib diisi' });
    }
    const admin = await dbGet('SELECT * FROM admins WHERE username = ?', [username]);
    if (!admin) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }
    const valid = bcrypt.compareSync(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }
    const token = jwt.sign({ id: admin.id, username: admin.username, role: admin.role }, JWT_SECRET, {
      expiresIn: '24h'
    });
    res.json({ success: true, token, username: admin.username, role: admin.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Verify admin token
app.get('/api/admin/verify', authMiddleware, (req, res) => {
  res.json({ success: true, user: req.user });
});

// Helper to save base64 image to local uploads directory
function processUploadedImage(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return imageUrl;
  if (imageUrl.startsWith('data:image/')) {
    try {
      const matches = imageUrl.match(/^data:image\/([a-zA-Z0-9.+]+);base64,(.+)$/);
      if (matches) {
        let ext = matches[1].toLowerCase();
        if (ext === 'jpeg') ext = 'jpg';
        const base64Data = matches[2];
        const uploadsDir = path.join(__dirname, 'backend/uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const filename = `destinasi_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
        const filePath = path.join(uploadsDir, filename);
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
        return `/uploads/${filename}`;
      }
    } catch (err) {
      console.warn('Gagal menyimpan file gambar base64, menggunakan data URI langsung:', err.message);
    }
  }
  return imageUrl;
}

// 5. Create new place (Admin only)
app.post('/api/places', authMiddleware, async (req, res) => {
  try {
    const {
      name, category, kabupaten, latitude, longitude, address,
      ticket_price, opening_hours, rating, image_url, description, facilities
    } = req.body;

    if (!name || !category || !kabupaten || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Nama, kategori, kabupaten, dan koordinat (lat/lng) wajib diisi' });
    }

    const finalImageUrl = processUploadedImage(image_url) || 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80';

    const result = await dbRun(`
      INSERT INTO places (
        name, category, kabupaten, latitude, longitude, address,
        ticket_price, opening_hours, rating, image_url, description, facilities
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name, category, kabupaten.toUpperCase(), parseFloat(latitude), parseFloat(longitude),
      address || '', ticket_price || 'Gratis', opening_hours || '08:00 - 18:00 WITA',
      rating ? parseFloat(rating) : 4.5, finalImageUrl,
      description || '', facilities || ''
    ]);

    const created = await dbGet('SELECT * FROM places WHERE id = ?', [result.lastID]);
    res.status(201).json({ success: true, message: 'Destinasi berhasil ditambahkan', data: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Update place (Admin only)
app.put('/api/places/:id', authMiddleware, async (req, res) => {
  try {
    const {
      name, category, kabupaten, latitude, longitude, address,
      ticket_price, opening_hours, rating, image_url, description, facilities
    } = req.body;

    const existing = await dbGet('SELECT * FROM places WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Destinasi wisata tidak ditemukan' });

    const finalImageUrl = image_url !== undefined ? processUploadedImage(image_url) : existing.image_url;

    await dbRun(`
      UPDATE places SET
        name = ?, category = ?, kabupaten = ?, latitude = ?, longitude = ?, address = ?,
        ticket_price = ?, opening_hours = ?, rating = ?, image_url = ?, description = ?,
        facilities = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      name || existing.name,
      category || existing.category,
      kabupaten ? kabupaten.toUpperCase() : existing.kabupaten,
      latitude !== undefined ? parseFloat(latitude) : existing.latitude,
      longitude !== undefined ? parseFloat(longitude) : existing.longitude,
      address !== undefined ? address : existing.address,
      ticket_price !== undefined ? ticket_price : existing.ticket_price,
      opening_hours !== undefined ? opening_hours : existing.opening_hours,
      rating !== undefined ? parseFloat(rating) : existing.rating,
      finalImageUrl,
      description !== undefined ? description : existing.description,
      facilities !== undefined ? facilities : existing.facilities,
      req.params.id
    ]);

    const updated = await dbGet('SELECT * FROM places WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Destinasi berhasil diperbarui', data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Delete place (Admin only)
app.delete('/api/places/:id', authMiddleware, async (req, res) => {
  try {
    const existing = await dbGet('SELECT * FROM places WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Destinasi wisata tidak ditemukan' });

    await dbRun('DELETE FROM places WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: `Destinasi "${existing.name}" berhasil dihapus` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SPATIAL ANALYSIS ENDPOINTS ---

// 8. Spatial Radius Search: Find places within radius (km) of given coordinates
app.post('/api/spatial/radius', async (req, res) => {
  try {
    const { latitude, longitude, radius_km, category, kabupaten } = req.body;
    if (latitude === undefined || longitude === undefined || radius_km === undefined) {
      return res.status(400).json({ error: 'Latitude, longitude, dan radius_km wajib disertakan' });
    }

    const cLat = parseFloat(latitude);
    const cLng = parseFloat(longitude);
    const rad = parseFloat(radius_km);

    let sql = 'SELECT * FROM places WHERE 1=1';
    const params = [];
    if (category && category !== 'Semua') {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (kabupaten && kabupaten !== 'Semua') {
      sql += ' AND UPPER(kabupaten) = UPPER(?)';
      params.push(kabupaten);
    }

    const allPlaces = await dbAll(sql, params);
    const results = [];

    for (const place of allPlaces) {
      const dist = haversineDistance(cLat, cLng, place.latitude, place.longitude);
      if (dist <= rad) {
        results.push({
          ...place,
          distance_km: Math.round(dist * 100) / 100
        });
      }
    }

    results.sort((a, b) => a.distance_km - b.distance_km);

    res.json({
      success: true,
      center: { latitude: cLat, longitude: cLng },
      radius_km: rad,
      count: results.length,
      data: results
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Spatial DBSCAN Clustering Analysis
app.post('/api/spatial/dbscan', async (req, res) => {
  try {
    const { eps_km, min_pts, category, kabupaten } = req.body;
    const eps = eps_km ? parseFloat(eps_km) : 8; // default 8 km
    const minPoints = min_pts ? parseInt(min_pts) : 3; // default 3 points

    let sql = 'SELECT * FROM places WHERE 1=1';
    const params = [];
    if (category && category !== 'Semua') {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (kabupaten && kabupaten !== 'Semua') {
      sql += ' AND UPPER(kabupaten) = UPPER(?)';
      params.push(kabupaten);
    }

    const places = await dbAll(sql, params);
    const clusteringResult = runDBSCAN(places, eps, minPoints);

    res.json({
      success: true,
      ...clusteringResult
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Spatial Heatmap weighted data
app.get('/api/spatial/heatmap', async (req, res) => {
  try {
    const places = await dbAll('SELECT id, name, latitude, longitude, rating, category, kabupaten FROM places');
    // Heatmap data format: [lat, lng, intensity]
    const heatmapPoints = places.map(p => {
      // Normalize rating 4.0-5.0 to intensity 0.5 - 1.0
      const intensity = Math.min(1.0, Math.max(0.4, (p.rating - 3.5) / 1.5));
      return [p.latitude, p.longitude, parseFloat(intensity.toFixed(2))];
    });

    res.json({
      success: true,
      count: heatmapPoints.length,
      points: heatmapPoints
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 11. GeoJSON of Bali regencies
app.get('/api/geojson/bali-kabupaten', (req, res) => {
  const geojsonPath = path.join(__dirname, 'public', 'data', 'bali-kabupaten.geojson');
  if (fs.existsSync(geojsonPath)) {
    res.sendFile(geojsonPath);
  } else {
    res.status(404).json({ error: 'GeoJSON file not found' });
  }
});

// 12. General GIS Statistics
app.get('/api/stats', async (req, res) => {
  try {
    const total = await dbGet('SELECT COUNT(*) as count FROM places');
    const byCategory = await dbAll('SELECT category, COUNT(*) as count FROM places GROUP BY category ORDER BY count DESC');
    const byKabupaten = await dbAll('SELECT kabupaten, COUNT(*) as count FROM places GROUP BY kabupaten ORDER BY count DESC');
    const avgRating = await dbGet('SELECT AVG(rating) as avg_rating FROM places');
    const topRated = await dbAll('SELECT * FROM places ORDER BY rating DESC, name ASC LIMIT 5');

    res.json({
      success: true,
      total_destinations: total.count,
      avg_rating: avgRating.avg_rating ? parseFloat(avgRating.avg_rating.toFixed(2)) : 0,
      by_category: byCategory,
      by_kabupaten: byKabupaten,
      top_rated: topRated
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server after DB init
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🗺️  GIS Pariwisata Bali Server is running!`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`🔑 Default Admin: username "admin", password "admin123"`);
    console.log(`===============================================`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
});
