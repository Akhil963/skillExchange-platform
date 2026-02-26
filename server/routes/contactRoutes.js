const express = require('express');
const router = express.Router();
const { sendContactMessage } = require('../controllers/contactController');

// POST /api/contact - Send contact form message
router.post('/', sendContactMessage);

module.exports = router;
