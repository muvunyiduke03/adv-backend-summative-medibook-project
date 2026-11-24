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

//The following code will handle cancellation of appointment and refunds
async function cancellation({appointment_id, cancelled_at, refund_percentage}) {
  const connection = await pooling.getConnection();
  try {
    await connection.beginTransaction();

    //Appointment cancellation of the same appointment will run after each other.
    const [rows] = await connection.execute(
      'SELECT status FROM appointments WHERE appointment_id = ? FOR UPDATE',
      [appointment_id]
    );

    if (rows.length === 0){
      await connection.rollback();
      return {outcome: 'NOT_FOUND'};
    }

    if (rows[0].status !== 'BOOKED'){
      await connection.rollback();
      return {
        outcome: 'NOT_CANCELLEABLE',
        status: rows[0].status
      };
    }

    await connection.execute(
      `UPDATE appointments SET status = 'CANCELLED', cancelled_at = ?, refund_amount = ROUND(amount_paid * CAST(? AS DECIMAL(5, 2)) / 100, 2) WHERE appointment_id = ?`,
      [cancelled_at, refund_percentage, appointment_id]
    );

    await connection.commit();
    return {outcome: 'CANCELLED'};
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

//in this part we will have the advanced SQL that handles the doctor's reports and busy day reports and JS will be used to pass in dates and reading rows.
async function doctor_stats({doctor_id, now, from_day, to_day, daily_max}){
  const [money] = await pooling.execute(
    `SELECT COALESCE(SUM(amount_paid), 0)                       AS gross_collected,
            COALESCE(SUM(refund_amount), 0)                     AS total_refunded,
            COALESCE(SUM(amount_paid - refund_amount), 0)       AS net_collected,
            COUNT(CASE WHEN status = 'BOOKED' AND appt_datetime > ? THEN 1 END) AS upcoming
      FROM appointments
      WHERE doctor_id = ?`,
      [now, doctor_id]
  );

  const [days] = await pooling.execute(
    `WITH RECURSIVE days (day) AS (
        SELECT CAST(? AS DATE)
        UNION ALL
        SELECT day + INTERVAL 1 DAY FROM days WHERE day < CAST(? AS DATE)
    )
    SELECT d.day                                                              AS date,
            COUNT(a.appointment_id)                                           AS appointments,
            ROUND(100 * COUNT(a.appointment_id) / CAST(? AS DECIMAL(5,2)), 1) AS utilization_percent,
            ROUND(100 * SUM(COUNT(a.appointment_id)) OVER ()
                  / (COUNT(*) OVER () * CAST(? AS DECIMAL(5,2))), 1)          AS window_utilization_percent,
            SUM(COUNT(a.appointment_id)) OVER ()                              AS window_appointments
      FROM days d
      LEFT JOIN appointments a
            ON  a.doctor_id = ?
            AND a.active_slot >= d.day
            AND a.active_slot < d.day + INTERVAL 1 DAY
      GROUP BY d.day
      ORDER BY d.day`,
      [from_day, to_day, daily_max, daily_max, doctor_id]
  );

  return {money: money[0], days}
}

async function availability({ doctor_id, patient_id, appt_datetime, day_start, day_end }) {
  const [rows] = await pooling.execute(
    `SELECT (SELECT COUNT(*) FROM doctors  WHERE doctor_id  = ?) AS doctor_exists,
            (SELECT COUNT(*) FROM patients WHERE patient_id = ?) AS patient_exists,
            (SELECT patient_id FROM appointments WHERE doctor_id = ? AND active_slot = ?) AS slot_holder,
            (SELECT COUNT(*) FROM appointments
              WHERE doctor_id = ? AND active_slot >= ? AND active_slot < ?) AS booked`,
    [doctor_id, patient_id, doctor_id, appt_datetime, doctor_id, day_start, day_end]
  );
  const row = rows[0];
  return {
    doctor_exists: Number(row.doctor_exists) > 0,
    patient_exists: Number(row.patient_exists) > 0,
    slot_holder: row.slot_holder,
    booked: Number(row.booked),
  };
}

module.exports = {find_all, find_by_id, booking, cancellation, doctor_stats, availability};
