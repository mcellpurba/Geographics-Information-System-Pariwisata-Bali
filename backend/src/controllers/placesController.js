const fs = require('fs');
const path = require('path');
const { dbAll, dbGet, dbRun } = require('../db/database');
const { matchSearchQuery } = require('../utils/searchHelper');

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
        const uploadsDir = path.join(__dirname, '../../uploads');
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

// GET /api/places with search, category, kabupaten, rating
async function getPlaces(req, res) {
  try {
    const { q, category, kabupaten, min_rating } = req.query;
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
    if (min_rating) {
      sql += ' AND rating >= ?';
      params.push(parseFloat(min_rating));
    }

    sql += ' ORDER BY rating DESC, name ASC';
    let places = await dbAll(sql, params);

    // Apply intelligent keyword matching if search query q is provided
    if (q) {
      const cleanQ = q.toLowerCase().trim();
      places = places.filter(p => matchSearchQuery(p, cleanQ));

      // Rank results by relevance
      places.sort((a, b) => {
        const aName = (a.name || '').toLowerCase();
        const bName = (b.name || '').toLowerCase();
        const aExact = aName.startsWith(cleanQ);
        const bExact = bName.startsWith(cleanQ);
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        const aIn = aName.includes(cleanQ);
        const bIn = bName.includes(cleanQ);
        if (aIn && !bIn) return -1;
        if (!aIn && bIn) return 1;

        return (b.rating || 0) - (a.rating || 0);
      });
    }

    res.json({ success: true, count: places.length, data: places });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/places/:id
async function getPlaceById(req, res) {
  try {
    const place = await dbGet('SELECT * FROM places WHERE id = ?', [req.params.id]);
    if (!place) return res.status(404).json({ error: 'Destinasi wisata tidak ditemukan' });
    res.json({ success: true, data: place });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/places (Create - Admin only)
async function createPlace(req, res) {
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
      rating ? parseFloat(rating) : 4.5,
      finalImageUrl,
      description || '', facilities || ''
    ]);

    const created = await dbGet('SELECT * FROM places WHERE id = ?', [result.lastID]);
    res.status(201).json({ success: true, message: 'Destinasi berhasil ditambahkan', data: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PUT /api/places/:id (Update - Admin only)
async function updatePlace(req, res) {
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
}

// DELETE /api/places/:id (Delete - Admin only)
async function deletePlace(req, res) {
  try {
    const existing = await dbGet('SELECT * FROM places WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Destinasi wisata tidak ditemukan' });

    await dbRun('DELETE FROM places WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: `Destinasi "${existing.name}" berhasil dihapus` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getPlaces,
  getPlaceById,
  createPlace,
  updatePlace,
  deletePlace
};
