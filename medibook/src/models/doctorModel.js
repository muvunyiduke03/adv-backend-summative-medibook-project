const pooling = require('../config/mysql_db');
const Columns = 'doctor_id, doctor_name, speciality, consultation_fee, room, created_at';

async function find_all() {
  const [rows] = await pooling.execute(
    `SELECT ${Columns} FROM doctors ORDER BY doctor_id`
  );
  return rows;
}

async function find_by_id(id) {
  const [rows] = await pooling.execute(
    `SELECT ${Columns} FROM doctors WHERE doctor_id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function create({doctor_name, speciality, consultation_fee, room}) {
  const [result] = await pooling.execute(
    'INSERT INTO doctors (doctor_name, speciality, consultation_fee, room) VALUES (?, ?, ?, ?)',
    [doctor_name, speciality, consultation_fee, room]
  );
  return result.insertId;
}

async function update(id, {doctor_name, speciality, consultation_fee, room}) {
  const [result] = await pooling.execute(
    `UPDATE doctors SET doctor_name = ?, speciality = ?, consultation_fee = ?, room = ? WHERE doctor_id = ?`,
    [doctor_name, speciality, consultation_fee, room, id]
  );
  return result.affectedRows;
}

async function remove(id){
  const [result] = await pooling.execute(
    'DELETE FROM doctors WHERE doctor_id = ?',
    [id]
  );
  return result.affectedRows;
}

module.exports = {find_all, find_by_id, create, update, remove};
