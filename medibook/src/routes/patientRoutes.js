const router = require('express').Router();
const control = require('../controllers/patientController');

router.route('/')
  .get(control.listPatients)
  .post(control.createPatient);

router.route('/:id')
  .get(control.getPatient)
  .put(control.updatePatient)
  .delete(control.deletePatient);

module.exports = router;
