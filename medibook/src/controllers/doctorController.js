const doctorModel = require('../models/doctorModel');
const AppError = require('./app_errors');
const {parseId, validateFields} = require('./validators');
const {catchAsync} = require('./errorControllers');
const doctor_schema = {
  doctor_name: {
    type: 'string',
    max: 100
  },

  speciality: {
    type: 'string',
    max: 50
  },

  consultation_fee: {
    type: 'money'
  },

  room: {
    type: 'string',
    max: 50
  },
};

// This will handle loading a doctor
async function load_doctor(rawId) {
  const id = parseId(rawId, 'doctor_id');
  const doctor = await doctorModel.find_by_id(id);
  if (!doctor) {
    throw new AppError(404, `Doctor with id ${id} was not found`);
  }
  return doctor;
}

const list_doctors = catchAsync(async (req, res) => {
  res.json(await doctorModel.find_all());
});

const get_doctor = catchAsync(async (req, res) => {
  res.json(await load_doctor(req.params.id));
});

const create_doctor = catchAsync(async (req, res) => {
  const data = validateFields(req.body, doctor_schema);
  const id = await doctorModel.create(data);
  const doctor = await doctorModel.find_by_id(id);
  res.status(201).location(`/api/doctors/${id}`).json(doctor);
});

const update_doctor = catchAsync(async (req, res) => {
  const existing = await load_doctor(req.params.id);
  const data = validateFields(req.body, doctor_schema);
  await doctorModel.update(existing.doctor_id, data);
  res.json(await doctorModel.find_by_id(existing.doctor_id));
});

const delete_doctor = catchAsync(async (req, res) => {
  const existing = await load_doctor(req.params.id);
  await doctorModel.remove(existing.doctor_id);
  res.status(204).end();
});

module.exports = {list_doctors, get_doctor, create_doctor, update_doctor, delete_doctor};
