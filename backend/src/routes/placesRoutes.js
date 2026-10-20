const express = require('express');
const router = express.Router();
const placesController = require('../controllers/placesController');
const { authMiddleware } = require('../controllers/authController');

router.get('/', placesController.getPlaces);
router.get('/:id', placesController.getPlaceById);
router.post('/', authMiddleware, placesController.createPlace);
router.put('/:id', authMiddleware, placesController.updatePlace);
router.delete('/:id', authMiddleware, placesController.deletePlace);

module.exports = router;
