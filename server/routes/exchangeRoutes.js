const express = require('express');
const router = express.Router();
const {
  createExchange,
  getUserExchanges,
  getExchangeById,
  updateExchangeStatus,
  addMessage,
  addReview,
  deleteExchange,
  getLearnedSkills,
  getTaughtSkills
} = require('../controllers/exchangeController');
const { protect } = require('../middleware/auth');

// All routes are protected
router.use(protect);

router.post('/', createExchange);
router.get('/', getUserExchanges);
router.get('/learned', getLearnedSkills);
router.get('/taught', getTaughtSkills);
router.get('/:id', getExchangeById);
router.put('/:id/status', updateExchangeStatus);
router.post('/:id/messages', addMessage);
router.post('/:id/review', addReview);
router.delete('/:id', deleteExchange);

module.exports = router;
