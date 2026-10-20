const express = require('express');
const router = express.Router();
const spatialController = require('../controllers/spatialController');

router.post('/radius', spatialController.searchRadius);
router.post('/dbscan', spatialController.runDbscanClustering);
router.get('/heatmap', spatialController.getHeatmapData);

module.exports = router;
