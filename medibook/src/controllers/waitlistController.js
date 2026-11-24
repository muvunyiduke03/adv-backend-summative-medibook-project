const appointmentModel = require('../models/appointmentModel');
const waitlistModel = require('../models/waitlistModel');
const AppError = require('./app_errors');
const { parseId, parse_date_time, parse_day, to_sql_date_time } = require('./validators');
const { catchAsync } = require('./errorControllers');
const { read_booking_request } = require('./booking_rules');
const { max_per_day } = require('./business_rules');
const { enqueue_slot_freed } = require('./waitlist_jobs');

//this will handle turning ?doctor_id=&appt_datetime= (a slot queue) or ?doctor_id=&date=  (a whole-day queue) into the Redis key and a description of the queue.

function queue_from_query(query) {
  const doctor_id = parseId(query.doctor_id, 'doctor_id');
  const has_slot = query.appt_datetime !== undefined;
  const has_day = query.date !== undefined;
  if (has_slot === has_day) {
    throw new AppError(400, 'Give exactly one of appt_datetime (a slot queue) or date (a whole-day queue)');
  }
  if (has_slot) {
    const slot = to_sql_date_time(parse_date_time(query.appt_datetime).date);
    return { kind: 'slot', doctor_id, slot, key: waitlistModel.slot_key(doctor_id, slot) };
  }
  const date = parse_day(query.date);
  return { kind: 'day', doctor_id, date, key: waitlistModel.day_key(doctor_id, date) };
}

//Only allowed booking would fail right now. POST /api/waitlist
const join_waitlist = catchAsync(async (req, res) => {
  const request = read_booking_request(req.body);
  const state = await appointmentModel.availability(request);

  if (!state.doctor_exists) throw new AppError(404, `Doctor ${request.doctor_id} not found`);
  if (!state.patient_exists) throw new AppError(404, `Patient ${request.patient_id} not found`);
  if (state.slot_holder === request.patient_id) {
    throw new AppError(409, 'This patient already holds that appointment');
  }

  let queue;
  if (state.slot_holder !== null) {
    //when the exact slot is taken: wait for THAT slot.
    queue = { kind: 'slot', slot: request.appt_datetime, key: waitlistModel.slot_key(request.doctor_id, request.appt_datetime) };
  } else if (state.booked >= max_per_day) {
    // when the slot is free but the doctor's day is full: wait for ANY slot that day.
    queue = { kind: 'day', date: request.date, key: waitlistModel.day_key(request.doctor_id, request.date) };
  } else {
    throw new AppError(409, 'That slot is available - book it directly with POST /api/appointments');
  }

  const position = await waitlistModel.join(queue.key, request.patient_id);
  if (position === null) throw new AppError(409, 'This patient is already on that waitlist');

  const after = await appointmentModel.availability(request);
  const free_now = queue.kind === 'slot' ? after.slot_holder === null : after.booked < max_per_day;
  if (free_now) await enqueue_slot_freed(request.doctor_id, request.appt_datetime, `recheck${request.patient_id}`);

  res.status(201).json({
    waitlist: queue.kind,
    doctor_id: request.doctor_id,
    patient_id: request.patient_id,
    ...(queue.kind === 'slot' ? { slot: queue.slot } : { date: queue.date }),
    position,
  });
});

// GET /api/waitlist?doctor_id=2&appt_datetime=2026-12-14 09:00   (or &date=2026-12-14)
const view_waitlist = catchAsync(async (req, res) => {
  const queue = queue_from_query(req.query);
  const ids = await waitlistModel.members(queue.key);
  res.json({
    waitlist: queue.kind,
    doctor_id: queue.doctor_id,
    ...(queue.kind === 'slot' ? { slot: queue.slot } : { date: queue.date }),
    length: ids.length,
    patients: ids.map((patient_id, i) => ({ position: i + 1, patient_id })),
  });
});

// DELETE /api/waitlist?patient_id=3&doctor_id=2&appt_datetime=...   (or &date=...)
const leave_waitlist = catchAsync(async (req, res) => {
  const patient_id = parseId(req.query.patient_id, 'patient_id');
  const queue = queue_from_query(req.query);
  const was_waiting = await waitlistModel.leave(queue.key, patient_id);
  if (!was_waiting) throw new AppError(404, `Patient ${patient_id} is not on that waitlist`);
  res.status(204).end();
});

module.exports = {join_waitlist, view_waitlist, leave_waitlist};
