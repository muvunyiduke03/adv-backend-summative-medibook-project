const router = require('express').Router();
const control = require('../controllers/waitlistController');

router.route('/')
  .post(control.join_waitlist)
  .get(control.view_waitlist)
  .delete(control.leave_waitlist);

module.exports = router;
