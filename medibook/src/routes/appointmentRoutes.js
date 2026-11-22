const router = require('express').Router();
const control = require('../controllers/appointmentController');

router.route('/')
  .get(control.list_appointments)
  .post(control.book_appointment);

router.get('/:id', control.get_appointment);
router.post('/:id/cancellation', control.cancel_appointment);

module.exports = router;
