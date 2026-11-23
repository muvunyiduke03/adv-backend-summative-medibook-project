const pooling = require('../config/mysql_db');

//here we will handle all doctors including those with no appointment too...
async function doctors_summary(){
  const [rows] = await pooling.execute(
    `SELECT d.doctor_id,
            d.doctor_name,
            d.speciality,
            COUNT(a.appointment_id)                                AS total_appointments,
            COUNT(CASE WHEN a.status = 'BOOKED'    THEN 1 END)     AS booked,
            COUNT(CASE WHEN a.status = 'COMPLETED' THEN 1 END)     AS completed,
            COUNT(CASE WHEN a.status = 'CANCELLED' THEN 1 END)     AS cancelled,
            COALESCE(SUM(a.amount_paid - a.refund_amount), 0)      AS revenue_collected
       FROM doctors d
       LEFT JOIN appointments a ON a.doctor_id = d.doctor_id
      GROUP BY d.doctor_id, d.doctor_name, d.speciality
      ORDER BY revenue_collected DESC, d.doctor_name`
  );
  return rows;
}

//Every (doctor, date) where MORE than threshold_percent of the daily cap is booked.
async function busy_days({ daily_cap, threshold_percent }) {
  const [rows] = await pooling.execute(
    `SELECT d.doctor_id,
            d.doctor_name,
            d.speciality,
            DATE(a.active_slot)                                        AS date,
            COUNT(*)                                                   AS appointments,
            CAST(? AS UNSIGNED)                                        AS daily_capacity,
            ROUND(100 * COUNT(*) / CAST(? AS DECIMAL(5,2)), 1)         AS utilization_percent
       FROM appointments a
       JOIN doctors d ON d.doctor_id = a.doctor_id
      WHERE a.active_slot IS NOT NULL
      GROUP BY d.doctor_id, d.doctor_name, d.speciality, DATE(a.active_slot)
     HAVING COUNT(*) * 100 / CAST(? AS DECIMAL(5,2)) > CAST(? AS DECIMAL(5,2))
      ORDER BY date, utilization_percent DESC, d.doctor_name`,
    [daily_cap, daily_cap, daily_cap, threshold_percent]
  );
  return rows;
}

module.exports = { doctors_summary, busy_days };