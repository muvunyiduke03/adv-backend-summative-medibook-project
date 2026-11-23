const reportModel = require('../models/reportModel');
const {catchAsync} = require('./errorControllers');
const {max_per_day, percent_of_busy_day} = require('./business_rules');

const doctors_report = catchAsync(async (req, res) => {
  res.json(await reportModel.doctors_summary());
});

const busy_days_report = catchAsync(async (req, res) => {
  res.json(await reportModel.busy_days({
    daily_cap: max_per_day,
    threshold_percent: percent_of_busy_day,
  }));
});

module.exports = {doctors_report, busy_days_report};