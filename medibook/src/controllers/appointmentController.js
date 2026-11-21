const appointmentModel = require('../models/appointmentModel');
const AppError = require('./app_errors');
const {parseId, parse_date_time, to_sql_date_time} = require('./validators');
const {catchAsync} = require('./errorControllers');

//the business rules
const max_per_day = 12;
const first_slot = 9 * 60;
const last_slot = 16 * 60 + 30;
const statuses = ['BOOKED', 'CANCELLED', 'COMPLETED'];

const list_appointments = catchAsync(async(req, res) => {
  const {doctor_id, patient_id, status} = req.query;
  const filters = {};

  if (doctor_id !== undefined) {
    filters.doctor_id = parseId(doctor_id, 'doctor_id');
  }

  if (patient_id !== undefined) {
    filters.patient_id = parseId(patient_id, 'patient_id');
  }

  if (status !== undefined) {
    if (!statuses.includes(status)) {
      throw new AppError(400, `The status must be one of ${statuses.join(', ')}`);
    }
    filters.status = status;
  }
  res.json(await appointmentModel.find_all(filters));
});

const get_appointment = catchAsync(async(req, res) => {
  const id = parseId(req.params.id, 'appointment id');
  const appointment = await appointmentModel.find_by_id(id);

  if (!appointment) {
    throw new AppError(404, `Appointment with id ${id} was not found`);
  }
  res.json(appointment);
});

const book_appointment = catchAsync(async(req, res) => {
  const body = req.body;
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(400, 'Request body must be a JSON object');
  }

  // The following will handle requests and how they are formed
  const patient_id = parseId(body.patient_id, 'patient_id');
  const doctor_id = parseId(body.doctor_id, 'doctor_id');
  const when = parse_date_time(body.appt_datetime);

  if (when.second !== 0 || (when.minute !== 0 && when.minute !== 30)) {
    throw new AppError(422, 'Appointments must start within a 30 minutes interval');
  }

  const minutes = when.hour * 60 + when.minute;
  if (minutes < first_slot || minutes > last_slot){
    throw new AppError(422, 'Appointments must start 09:00 to 16:30')
  }

  if(when.date <= new Date()){
    throw new AppError(422, 'Appointments can only be booked on future dates');
  }

  const day_start = new Date(when.year, when.month - 1, when.day);
  const day_end = new Date(when.year, when.month - 1, when.day + 1);
  const result = await appointmentModel.booking({
    patient_id,
    doctor_id,
    appt_datetime: to_sql_date_time(when.date),
    day_start: to_sql_date_time(day_start),
    day_end: to_sql_date_time(day_end),
    max_per_day: max_per_day,
  });

  switch (result.outcome) {
    case 'DOCTOR_NOT_FOUND':
      throw new AppError(404, `Doctor with the id ${doctor_id} was not found`);
    case 'PATIENT_NOT_FOUND':
      throw new AppError(404, `Patient with id ${patient_id} was not found`);
    case 'SLOT_TAKEN':
      throw new AppError(409, 'The doctor is already booked at this time');
    case 'DAY_IS_FULL':
      throw new AppError(409, `Doctor ${doctor_id} is fully booked on this day`);
    default: {
      const appointment = await appointmentModel.find_by_id(result.appointment_id);
      res.status(201).location(`/api/appointments/${result.appointment_id}`).json(appointment);
    }
  }
});

module.exports = {list_appointments, get_appointment, book_appointment};
