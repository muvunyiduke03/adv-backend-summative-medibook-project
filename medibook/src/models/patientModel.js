const pooling = require('../config/mysql_db');
const Columns = 'patient_id, patient_name, patient_email, patient_phone, created_at';

async function find_all() {
  const [rows] = await pooling.execute(
    `SELECT ${Columns} FROM patients ORDER BY patient_id`
  );
  return rows;
}

async function find_by_id(id){
  const [rows] = await pooling.execute(
    `SELECT ${Columns} FROM patients WHERE patient_id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function create({patient_name, patient_email, patient_phone}) {
  const [result] = await pooling.execute(
    'INSERT INTO patients (patient_name, patient_email, patient_phone) VALUES ( ?, ?, ?)',
    [patient_name, patient_email, patient_phone]
  );
  return result.insertId;
}

async function update(id, {patient_name, patient_email, patient_phone}) {
  const [result] = await pooling.execute(
    `UPDATE patients SET patient_name = ?, patient_email = ?, patient_phone = ? WHERE patient_id = ?`,
    [patient_name, patient_email, patient_phone, id]
  );
  return result.affectedRows;
}

async function remove(id) {
  const [result] = await pooling.execute(
    'DELETE FROM patients WHERE patient_id = ?',
    [id]
  );
  return result.affectedRows;
}

module.exports = {find_all, find_by_id, create, update, remove};
