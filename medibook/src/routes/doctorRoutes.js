const router = require('express').Router();
const control = require('../controllers/doctorController');

router.route('/')
  .get(control.list_doctors)
  .post(control.create_doctor);

router.get('/:id/stats', control.get_doctor_stats);

router.route('/:id')
  .get(control.get_doctor)
  .put(control.update_doctor)
  .delete(control.delete_doctor);

module.exports = router;