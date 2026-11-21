const pooling = require('../config/mysql_db');
const select_joined = `SELECT a.appointment_id, a.appt_ref, a.appt_datetime, a.amount_paid, a.status, a.booked_on, a.cancelled_at, a.refund_amount, a.patient_id, p.patient_name, a.doctor_id, d.doctor_name, d.speciality, d.room
                      FROM appointments a
                      JOIN patients p ON p.patient_id = a.patient_id
                      JOIN doctors d ON d.doctor_id = a.doctor_id`;

async function find_all({doctor_id, patient_id, status} = {}) {
  const where = [];
  const params = [];
  
  if (doctor_id) {
    where.push('a.doctor_id = ?');
    params.push(doctor_id);
  }

  if(patient_id) {
    where.push('a.patient_id = ?');
    params.push(patient_id);
  }

  if (status) {
    where.push('a.status = ?');
    params.push(status);
  }

  const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pooling.execute(
    `${select_joined}${clause} ORDER BY a.appt_datetime, a.appointment_id`,
    params
  );
  return rows;
}

async function find_by_id(id) {
  const [rows] = await pooling.execute(
    `${select_joined} WHERE a.appointment_id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function booking({patient_id, doctor_id, appt_datetime, day_start, day_end, max_per_day}) {
  const conn = await pooling.getConnection();
  try {
    await conn.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await conn.beginTransaction();

    //This will handle doctor's booking so that booking of the same doctor queue up
    const [doctors] = await conn.execute(
      'SELECT doctor_id, consultation_fee FROM doctors WHERE doctor_id = ? FOR UPDATE',
      [doctor_id]
    );

    if (doctors.length === 0) {
      await conn.rollback();
      return {outcome: 'DOCTOR_NOT_FOUND'};
    }

    // a patient must exist
    const [patients] = await conn.execute(
      'SELECT patient_id FROM patients WHERE patient_id = ?',
      [patient_id]
    );

    if (patients.length === 0) {
      await conn.rollback();
      return {outcome: 'PATIENT_NOT_FOUND'};
    }

    //This will check if the appointment is held
    const [taken] = await conn.execute(
      'SELECT appointment_id FROM appointments WHERE doctor_id = ? AND active_slot = ?',
      [doctor_id, appt_datetime]
    );

    if (taken.length > 0) {
      await conn.rollback();
      return {outcome: 'SLOT_TAKEN'};
    }

    const [counted] = await conn.execute(
      `SELECT COUNT(*) AS booked FROM appointments WHERE doctor_id = ? AND active_slot >= ? AND active_slot < ?`,
      [doctor_id, day_start, day_end]
    );

    const booked = Number(counted[0].booked);
    if (booked >= max_per_day){
      await conn.rollback();
      return {outcome: 'DAY_IS_FULL', booked};
    }

    //This will decide the refund amount by checking the amount paid, doctor's appointment fee and appointment's date
    const [inserted] = await conn.execute(
      `INSERT INTO appointments (appt_ref, patient_id, doctor_id, appt_datetime, amount_paid) VALUES (UUID(), ?, ?, ?, ?)`,
      [patient_id, doctor_id, appt_datetime, doctors[0].consultation_fee]
    );
    await conn.execute(
      `UPDATE appointments SET appt_ref = CONCAT('AP-', LPAD(appointment_id, 3, '0')) WHERE appointment_id = ?`,
      [inserted.insertId]
    );

    await conn.commit();
    return {
      outcome: 'BOOKED',
      appointment_id: inserted.insertId
    };
  } catch(err){
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {find_all, find_by_id, booking};
