//here we have the booking business rules and reports that are shared.
const full_refund_hours = 48;
const half_refund_hours = 24;

//more than 48 hours' notice: 100%. From 24 up to and including 48 hours: 50%. Under 24 hours: 0%.
function refund_percentage_for(notice_hours) {
  if (notice_hours > full_refund_hours) {
    return 100;
  }

  if (notice_hours >= half_refund_hours) {
    return 50;
  }

  return 0;
}

module.exports = {
  max_per_day: 12,
  percent_of_busy_day: 80,
  full_refund_hours,
  half_refund_hours,
  refund_percentage_for,
};