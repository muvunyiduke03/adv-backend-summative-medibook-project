const express = require('express');
const control = require('../controllers/feedbackController');

const router = express.Router();

router.get('/', control.show_feedback_page);

module.exports = router;
