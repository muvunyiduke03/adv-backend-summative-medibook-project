const patientModel = require('../models/patientModel');
const AppError = require('./app_errors');
const {parseId, validateFields} = require('./validators');
const {catchAsync} = require('./errorControllers');
const patient_schema = {
  patient_name: {
    type: 'string',
    max: 50
  },
  patient_email: {
    type: 'email',
    max: 50
  },
  patient_phone: {
    type: 'phone',
    max: 20
  },
};

// This will handle loading a patient
async function loadPatient(rawId) {
  const id = parseId(rawId, 'patient id');
  const patient = await patientModel.find_by_id(id);
  if (!patient) {
    throw new AppError(404, `Patient with id ${id} was not found`);
  }
  return patient;
}

const listPatients = catchAsync(async (req, res) => {
  res.json(await patientModel.find_all());
});

const getPatient = catchAsync(async(req, res) => {
  res.json(await loadPatient(req.params.id));
});

const createPatient = catchAsync(async (req, res) => {
  const data = validateFields(req.body, patient_schema);
  const id = await patientModel.create(data);
  const patient = await patientModel.find_by_id(id);
  res.status(201).location(`/api/patients/${id}`).json(patient);
});

const updatePatient = catchAsync(async (req, res) => {
  const existing = await loadPatient(req.params.id);
  const data = validateFields(req.body, patient_schema);
  await patientModel.update(existing.patient_id, data);
  res.json(await patientModel.find_by_id(existing.patient_id));
});

const deletePatient = catchAsync(async(req, res) => {
  const existing = await loadPatient(req.params.id);
  await patientModel.remove(existing.patient_id);
  res.status(204).end();
});

module.exports = {listPatients, getPatient, createPatient, updatePatient, deletePatient}