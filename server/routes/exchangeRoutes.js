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
  getTaughtSkills,
  checkLearningCompletion
} = require('../controllers/exchangeController');
const { protect } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// Specific routes BEFORE :id wildcard
router.post('/', createExchange);
router.get('/', getUserExchanges);
router.get('/learned', getLearnedSkills);
router.get('/taught', getTaughtSkills);

// :id wildcard routes - specific sub-routes before parent
router.get('/:id/completion-status', checkLearningCompletion);
router.put('/:id/status', updateExchangeStatus);
router.post('/:id/messages', addMessage);
router.post('/:id/review', addReview);
router.get('/:id', getExchangeById);
router.delete('/:id', deleteExchange);

module.exports = router;

