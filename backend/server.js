const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./src/db/database');

const placesRoutes = require('./src/routes/placesRoutes');
const spatialRoutes = require('./src/routes/spatialRoutes');
const authRoutes = require('./src/routes/authRoutes');
const statsRoutes = require('./src/routes/statsRoutes');
const geojsonRoutes = require('./src/routes/geojsonRoutes');

const path = require('path');
const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend client
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Static uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/places', placesRoutes);
app.use('/api/spatial', spatialRoutes);
app.use('/api/admin', authRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/geojson', geojsonRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', service: 'GIS Pariwisata Bali REST API', time: new Date() });
});

// Initialize database and start listening
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 GIS Bali REST API Backend running on port ${PORT}`);
    console.log(`📍 Endpoint: http://localhost:${PORT}/api/health`);
    console.log(`🔑 Admin Auth: http://localhost:${PORT}/api/admin/login`);
    console.log(`===============================================`);
  });
}).catch(err => {
  console.error('Database initialization error:', err);
});

module.exports = app;
