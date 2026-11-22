const appointmentModel = require('../models/appointmentModel');
const AppError = require('./app_errors');
const {parseId, parse_date_time, to_sql_date_time} = require('./validators');
const {catchAsync} = require('./errorControllers');

//the business rules
const max_per_day = 12;
const first_slot = 9 * 60;
const last_slot = 16 * 60 + 30;
const statuses = ['BOOKED', 'CANCELLED', 'COMPLETED'];

// The refund policy is that notice given before 48hour get 100% amount paid and notice of 24hrs - 48hrs you get 50% of amount paid
const full_refund_hours = 48;
const half_refund_hours = 24;

function refund_percentage_for(notice_hours) {
  if (notice_hours > full_refund_hours) {
    return 100;
  }

  if (notice_hours >= half_refund_hours) {
    return 50;
  }

  return 0;
}

function not_cancelleable_mssg(id, status) {
  return status === 'CANCELLED'
    ? `Appointment ${id} is already cancelled`
    : `Appointment ${id} is ${status.toLowerCase()} and cannot be cancelled!`;
}

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

const cancel_appointment = catchAsync(async(req, res) => {
  const id = parseId(req.params.id, 'appointment_id');
  const appointment = await appointmentModel.find_by_id(id);

  if (!appointment) {
    throw new AppError(404, `Appointment with id: ${id} was not found`);
  }

  if (appointment.status !== 'BOOKED') {
    throw new AppError(409, not_cancelleable_mssg(id, appointment.status));
  }

  //this will handle the refund based on the notice given
  const now = new Date();
  const starts_at = parse_date_time(appointment.appt_datetime).date;

  if (starts_at <= now){
    throw new AppError(422, 'An appointment that is already started cannot be cancelled!');
  }

  const notice_hours = (starts_at - now) / 3600000;
  const refund_percentage = refund_percentage_for(notice_hours);
  const result = await appointmentModel.cancellation({
    appointment_id: id,
    cancelled_at: to_sql_date_time(now),
    refund_percentage,
  });

  if (result.outcome === 'NOT_FOUND') {
    throw new AppError(404, `An appointment with id ${id} was not found!`);
  }

  if (result.outcome === 'NOT_CANCELLABLE'){
    throw new AppError(409, not_cancelleable_mssg(id, result.status));
  }

  // this will notify about the now free slot on the doctor's list of appointments
  const cancelled = await appointmentModel.find_by_id(id);
  res.status(201).location(`/api/appointments/${id}`).json({
    appointment: cancelled,
    refund: {
      notice_hours: Math.round(notice_hours * 100) / 100,
      refund_percentage,
      amount_paid: cancelled.amount_paid,
      refund_amount: cancelled.refund_amount,
    },
  });
});

module.exports = {list_appointments, get_appointment, book_appointment, cancel_appointment, refund_percentage_for};
