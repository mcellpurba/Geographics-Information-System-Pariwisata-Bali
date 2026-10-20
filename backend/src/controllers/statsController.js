const { dbAll, dbGet } = require('../db/database');

// GET /api/stats
async function getStats(req, res) {
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
}

module.exports = {
  getStats
};
