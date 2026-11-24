const appointmentModel = require('../models/appointmentModel');
const waitlistModel = require('../models/waitlistModel');
const { get_waitlist_queue } = require('../config/queue');
const { audit_log } = require('./audit_log');
const { enqueue_confirmation } = require('./notifications');
const { parse_date_time, to_sql_date_time } = require('./validators');
const { max_per_day } = require('./business_rules');

// ---- web server side -------------------------------------------------------------------------
async function enqueue_slot_freed(doctor_id, slot, source) {
  try {
    await get_waitlist_queue().add('slot-freed', { doctor_id, slot }, {
      jobId: `slot-freed-${doctor_id}-${slot.replace(/\D/g, '')}-${source}`,
    });
  } catch (err) {
    console.error(`waitlist queue: could not queue slot-freed for doctor ${doctor_id} at ${slot}:`, err.message);
  }
}

// ---- worker side -----------------------------------------------------------------------------
async function process_slot_freed(job) {
  const { doctor_id, slot } = job.data;
  const when = parse_date_time(slot);

  if (when.date <= new Date()) {
    await audit_log('WAITLIST_PROMOTION_SKIPPED', { doctor_id, slot, reason: 'the slot is in the past' });
    return 'skipped: slot is in the past';
  }

  const day = slot.slice(0, 10);
  const day_start = to_sql_date_time(new Date(when.year, when.month - 1, when.day));
  const day_end = to_sql_date_time(new Date(when.year, when.month - 1, when.day + 1));
  const queues = [
    { kind: 'slot', key: waitlistModel.slot_key(doctor_id, slot) },
    { kind: 'day', key: waitlistModel.day_key(doctor_id, day) },
  ];

  // A previous attempt of this job may have died half way: restore anyone left "in processing".
  for (const queue of queues) await waitlistModel.recover(queue.key);

  for (const queue of queues) {
    for (;;) {
      const entry = await waitlistModel.claim_next(queue.key);
      if (entry === null) break;
      const patient_id = Number(entry);

      let result;
      try {
        result = await appointmentModel.booking({
          patient_id, doctor_id, appt_datetime: slot, day_start, day_end, max_per_day,
        });
      } catch (err) {
        await waitlistModel.requeue_front(queue.key, entry);
        throw err;
      }

      if (result.outcome === 'BOOKED') {
        await waitlistModel.complete(queue.key, entry);
        try {
          await waitlistModel.leave_day(doctor_id, day, patient_id);
        } catch (err) {
          console.error('waitlist: could not clean up other queues:', err.message);
        }
        const appointment = await appointmentModel.find_by_id(result.appointment_id);
        await audit_log('BOOKING_CREATED', {
          source: 'waitlist',
          waitlist: queue.kind,
          appointment_id: appointment.appointment_id,
          appt_ref: appointment.appt_ref,
          patient_id,
          doctor_id,
          appt_datetime: appointment.appt_datetime,
          amount_paid: appointment.amount_paid,
        });
        await enqueue_confirmation(appointment.appointment_id);
        return `promoted patient ${patient_id} from the ${queue.kind} queue into ${appointment.appt_ref}`;
      }

      if (result.outcome === 'PATIENT_NOT_FOUND') {
        // This person no longer exists, so there is nobody to book. Drop the entry, try the next one.
        await waitlistModel.complete(queue.key, entry);
        await audit_log('WAITLIST_ENTRY_DROPPED', { patient_id, doctor_id, slot, reason: 'patient no longer exists' });
        continue;
      }

      // SLOT_TAKEN, DAY_FULL, DOCTOR_NOT_FOUND: someone else got there first.
      // The patient keeps their place at the FRONT and waits for the next cancellation.
      await waitlistModel.requeue_front(queue.key, entry);
      await audit_log('WAITLIST_PROMOTION_FAILED', { patient_id, doctor_id, slot, reason: result.outcome });
      return `not promoted: ${result.outcome} (patient ${patient_id} keeps their place)`;
    }
  }
  return 'nobody waiting';
}

module.exports = { enqueue_slot_freed, process_slot_freed };