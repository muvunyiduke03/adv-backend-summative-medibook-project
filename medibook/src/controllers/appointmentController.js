const appointmentModel = require('../models/appointmentModel');
const AppError = require('./app_errors');
const {parseId, parse_date_time, to_sql_date_time} = require('./validators');
const {catchAsync} = require('./errorControllers');
const {audit_log} = require('./audit_log');
const {read_booking_request} = require('./booking_rules');
const {enqueue_confirmation} = require('./notifications');
const waiting_line = 'Wanna join the waitlist? POST /api/waitlist'
const {enqueue_slot_freed} = require('./waitlist_jobs');

//the business rules
const {max_per_day, refund_percentage_for} = require('./business_rules');
const statuses = ['BOOKED', 'CANCELLED', 'COMPLETED'];


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
  const request = read_booking_request(req.body);
  const {patient_id, doctor_id} = request;

  const result = await appointmentModel.booking({
    patient_id,
    doctor_id,
    appt_datetime: request.appt_datetime,
    day_start: request.day_start,
    day_end: request.day_end,
    max_per_day: max_per_day,
  });

  switch (result.outcome) {
    case 'DOCTOR_NOT_FOUND':
      throw new AppError(404, `Doctor with the id ${doctor_id} was not found`);
    case 'PATIENT_NOT_FOUND':
      throw new AppError(404, `Patient with id ${patient_id} was not found`);
    case 'SLOT_TAKEN':
      throw new AppError(409, 'The doctor is already booked at this time',[waiting_line]);
    case 'DAY_IS_FULL':
      throw new AppError(409, `Doctor ${doctor_id} is fully booked on this day`, [waiting_line]);
    default: {
      const appointment = await appointmentModel.find_by_id(result.appointment_id);
      await audit_log('BOOKING_CREATED', {
        appointment_id: appointment.appointment_id,
        appt_ref: appointment.appt_ref,
        patient_id: appointment.patient_id,
        doctor_id: appointment.doctor_id,
        appt_datetime: appointment.appt_datetime,
        amount_paid: appointment.amount_paid,
        ip: req.ip,
      });
      await enqueue_confirmation(appointment.appointment_id);
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
  await audit_log('APPOINTMENT_CANCELLED', {
    appointment_id: cancelled.appointment_id,
    appt_ref: cancelled.appt_ref,
    patient_id: cancelled.patient_id,
    doctor_id: cancelled.doctor_id,
    appt_datetime: cancelled.appt_datetime,
    notice_hours: Math.round(notice_hours * 100) / 100,
    refund_percentage,
    amount_paid: cancelled.amount_paid,
    refund_amount: cancelled.refund_amount,
    ip: req.ip,
  });
  await enqueue_slot_freed(cancelled.doctor_id, cancelled.appt_datetime, `cancel${id}`);

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
