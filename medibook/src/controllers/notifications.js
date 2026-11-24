const { UnrecoverableError } = require('bullmq');
const appointmentModel = require('../models/appointmentModel');
const patientModel = require('../models/patientModel');
const { write_audit } = require('./audit_log');
const { get_notification_queue } = require('../config/queue');

//This will handle queueing rhw "your appointment is confirmed" job.
async function enqueue_confirmation(appointment_id) {
  try {
    // The job id makes a duplicate request for the same appointment a no-op while the job exists.
    await get_notification_queue().add('confirmation', { appointment_id }, {
      jobId: `confirmation-${appointment_id}`,
    });
  } catch (err) {
    console.error(`notification queue: could not queue confirmation for appointment ${appointment_id}:`, err.message);
  }
}

//this will handle hiding the most of the recipient's number.
const mask_email = (email) => email.replace(/^(.).*(@.*)$/, '$1***$2');
const mask_phone = (phone) => phone.replace(/\d(?=(?:\D*\d){3})/g, '*');

async function process_confirmation(job) {
  const { appointment_id } = job.data;

  const appointment = await appointmentModel.find_by_id(appointment_id);
  if (!appointment) throw new UnrecoverableError(`Appointment ${appointment_id} does not exist`);

  // Cancelled (or otherwise changed) before we got round to it: do not confirm something that is gone.
  if (appointment.status !== 'BOOKED') {
    await write_audit('NOTIFICATION_SKIPPED', {
      appointment_id,
      appt_ref: appointment.appt_ref,
      reason: `appointment is ${appointment.status}`,
    });
    return 'skipped';
  }

  const patient = await patientModel.find_by_id(appointment.patient_id);
  if (!patient) throw new UnrecoverableError(`Patient ${appointment.patient_id} does not exist`);

  const when = appointment.appt_datetime.slice(0, 16);
  const first_name = patient.patient_name.split(' ')[0];
  const messages = [
    {
      channel: 'email',
      to: mask_email(patient.patient_email),
      message: `Hello ${first_name}, your appointment with ${appointment.doctor_name} (${appointment.speciality}) is confirmed for ${when}, room ${appointment.room}. Reference: ${appointment.appt_ref}.`,
    },
    {
      channel: 'sms',
      to: mask_phone(patient.patient_phone),
      message: `MediBook: ${appointment.appt_ref} confirmed - ${appointment.doctor_name}, ${when}, room ${appointment.room}.`,
    },
  ];

  for (const m of messages) {
    await write_audit('NOTIFICATION_SENT', {
      appointment_id,
      appt_ref: appointment.appt_ref,
      ...m,
    });
  }
  return 'sent';
}

module.exports = { enqueue_confirmation, process_confirmation };
