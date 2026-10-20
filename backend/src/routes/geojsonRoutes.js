const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

router.get('/bali-kabupaten', (req, res) => {
  const geojsonPath = path.join(__dirname, '..', '..', 'data', 'bali-kabupaten.geojson');
  if (fs.existsSync(geojsonPath)) {
    res.sendFile(geojsonPath);
  } else {
    res.status(404).json({ error: 'GeoJSON file not found' });
  }
});

module.exports = router;
