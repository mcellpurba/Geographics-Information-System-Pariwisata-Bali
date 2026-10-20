const { dbAll } = require('../db/database');
const { haversineDistance } = require('../utils/haversine');
const { runDBSCAN } = require('../utils/dbscan');

// POST /api/spatial/radius
async function searchRadius(req, res) {
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
}

// POST /api/spatial/dbscan
async function runDbscanClustering(req, res) {
  try {
    const { eps_km, min_pts, category, kabupaten } = req.body;
    const eps = eps_km ? parseFloat(eps_km) : 8;
    const minPoints = min_pts ? parseInt(min_pts) : 3;

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
}

// GET /api/spatial/heatmap
async function getHeatmapData(req, res) {
  try {
    const places = await dbAll('SELECT id, name, latitude, longitude, rating, category, kabupaten FROM places');
    const heatmapPoints = places.map(p => {
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
}

module.exports = {
  searchRadius,
  runDbscanClustering,
  getHeatmapData
};
