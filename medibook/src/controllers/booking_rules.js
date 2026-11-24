const AppError = require('./app_errors');
const { parseId, parse_date_time, to_sql_date_time } = require('./validators');

const first_slot = 9 * 60;
const last_slot = 16 * 60 + 30;

function read_booking_request(body){
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(400, 'Request body must be a JSON object');
  }

  const patient_id = parseId(body.patient_id, 'patient_id');
  const doctor_id = parseId(body.doctor_id, 'doctor_id');
  const when = parse_date_time(body.appt_datetime);

  if (when.second !== 0 || (when.minute !== 0 && when.minute !== 30)) {
    throw new AppError(422, 'Appointments must start on a 30-minute boundary (:00 or :30)');
  }
  const minutes = when.hour * 60 + when.minute;
  if (minutes < first_slot || minutes > last_slot) {
    throw new AppError(422, 'Appointments must start between 09:00 and 16:30 (the last slot ends at 17:00)');
  }
  if (when.date <= new Date()) {
    throw new AppError(422, 'Appointments can only be booked in the future');
  }

  const appt_datetime = to_sql_date_time(when.date);
  return {
    patient_id,
    doctor_id,
    appt_datetime,
    date: appt_datetime.slice(0, 10),
    day_start: to_sql_date_time(new Date(when.year, when.month - 1, when.day)),
    day_end: to_sql_date_time(new Date(when.year, when.month - 1, when.day + 1)),
  };
}

module.exports = {read_booking_request};
