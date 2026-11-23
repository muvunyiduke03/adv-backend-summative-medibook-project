const router = require('express').Router();
const control = require('../controllers/reportController');

router.get('/doctors', control.doctors_report);
router.get('/busy-days', control.busy_days_report);

module.exports = router;
