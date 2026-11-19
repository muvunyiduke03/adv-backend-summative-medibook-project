const AppError = require('./app_errors');

// These are messages that goes with the constraints in schema.sql
const unique_messages = {
  uq_patients_email: 'A patient with this email already exists.',
  uq_appt_ref: 'This appointment reference already exists',
  uq_doctor_slot: 'The doctor already has an appointment on this time',
};

const check_messages = {
  chk_doctor_fee: 'consultation_fee must be 0 and above',
  chk_slot_30min: 'Appointments must start on a 30-minute boundary',
  chk_working_hours: 'Appointments must be scheduled between 09:00 and 17:00',
  chk_amount_paid: 'amount_paid must be 0 or more',
  chk_refund_amount: "refund_amount can't be negative or exceed amount_paid",
  chk_cancel_state: 'Cancellation data is inconsistent with the appointment status',
};

// This will help to change mysql error into app error
function fromMySql(err){
  const sqlMessage = err.sqlMessage || '';
  const known = (map) => Object.keys(map).find((name) => sqlMessage.includes(name));

  switch (err.code){
    case 'ER_DUP_ENTRY':{
      const key = known(unique_messages);
      return new AppError(409, key ? unique_messages[key] : 'This duplicate value violates a unique rule.');
    }
    case 'ER_ROW_IS_REFERENCED_2':
      return new AppError(409, 'Cannot delete: this record is still referenced by appointments');
    case 'ER_NO_REFERENCED_ROW_2':
      return new AppError(422, 'The referenced patient or doctor does not exist');
    case 'ER_CHECK_CONSTRAINT_VIOLATED': {
      const key = known(check_messages);
      return new AppError(422, key ? check_messages[key]: 'Value violates a data rule');
    }
    case 'ER_DATA_LONG':
      return new AppError(400, 'A value is long for its column');
    case 'ER_LOCK_DEADLOCK':
    case 'ER_LOCK_WAIT_TIMEOUT':
      return new AppError(409, 'The request clashed with another request. Please try again later.');
    
    default:
      return null;
  }
}

// Wraps an async controller so a rejected promise reaches errorHandler.
const catchAsync = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// When no rout is matched
function router_not_matched(req, res, next){
  next(new AppError(404, `Router not found: ${req.method} ${req.originalUrl}`));
}

function errorHandler(err, req, res, next){
  if (res.headersSent) {
    return next(err);
  }

  let appError = err;
  if (err.type === 'entity.parse.failed'){
    appError = new AppError(400, 'Request body is not a valid JSON');
  } else if (err.type === 'entity.too.large'){
    appError = new AppError(413, 'Request body is too large');
  } else if (!(err instanceof AppError) && typeof err.code === 'string' && err.code.startsWith('ER_')){
    appError = fromMySql(err) || err;
  }

  if (appError instanceof AppError){
    const body = {error: appError.message};
    if (appError.details) {
      body.details = appError.details;
    }
    return res.status(appError.status).json(body);
  }

  // everythin else is a bug.
  console.error(err);
  return res.status(500).json({error: 'Interval server error'});
}

module.exports = {router_not_matched, errorHandler, catchAsync};
