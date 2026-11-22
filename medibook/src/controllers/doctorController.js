const doctorModel = require('../models/doctorModel');
const appointmentModel = require('../models/appointmentModel');
const {max_per_day} = require('./business_rules');
const AppError = require('./app_errors');
const {parseId, validateFields, to_sql_date_time} = require('./validators');
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

const get_doctor_stats = catchAsync(async (req, res) => {
  const doctor = await load_doctor(req.params.id);
  const now = new Date();
  const last_day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6);
  const stats = await appointmentModel.doctor_stats({
    doctor_id: doctor.doctor_id,
    now: to_sql_date_time(now),
    from_day: to_sql_date_time(now).slice(0, 10),
    to_day: to_sql_date_time(last_day).slice(0, 10),
    daily_max: max_per_day,
  });

  const first = stats.days[0];
  res.json({
    doctor,
    revenue: {
      gross_collected: stats.money.gross_collected,
      total_refund: stats.money.total_refunded,
      net_collected: stats.money.net_collected,
    },
    upcoming_appointments: stats.money.upcoming,
    next_7_days: {
      from: first.date,
      to: stats.days[stats.days.length - 1].date,
      daily_capacity: max_per_day,
      appointments: Number(first.window_appointments),
      utilization_percent: first.window_utilization_percent,
      days: stats.days.map((d) => ({
        date: d.date,
        appointments: d.appointments,
        utilization_percent: d.utilization_percent,
      })),
    },
  });
});

module.exports = {list_doctors, get_doctor, create_doctor, update_doctor, delete_doctor, get_doctor_stats};
