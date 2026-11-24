const { read_booking_request } = require('../src/controllers/booking_rules');
const AppError = require('../src/controllers/app_errors');

//A far-future Monday so the "must be in the future" rule never interferes.
const at = (time) => ({ patient_id: 1, doctor_id: 2, appt_datetime: `2030-06-03 ${time}` });

describe('read_booking_request', () => {
  describe('working hours and slot alignment', () => {
    test.each([
      ['09:00', 'first slot of the day'],
      ['09:30', 'a :30 slot'],
      ['12:00', 'midday'],
      ['16:30', 'the last allowed start (ends at 17:00)'],
    ])('accepts %s (%s)', (time) => {
      expect(read_booking_request(at(time)).appt_datetime).toBe(`2030-06-03 ${time}:00`);
    });

    test.each([
      ['09:15', 'not on a 30-minute boundary'],
      ['10:45', 'not on a 30-minute boundary'],
      ['16:45', 'not on a 30-minute boundary'],
    ])('rejects %s (%s) with a 422', (time) => {
      expect(() => read_booking_request(at(time))).toThrow(AppError);
      expect(() => read_booking_request(at(time))).toThrow(/30-minute boundary/);
    });

    test.each([
      ['17:00', 'exactly closing time: too late to start'],
      ['18:00', 'after hours'],
      ['08:30', 'before opening'],
      ['00:00', 'midnight'],
    ])('rejects %s (%s) with a 422', (time) => {
      expect(() => read_booking_request(at(time))).toThrow(/between 09:00 and 16:30/);
    });

    test('rejects a start time that has seconds', () => {
      expect(() => read_booking_request(at('09:00:30'))).toThrow(/30-minute boundary/);
    });
  });

  describe('date rules', () => {
    test('rejects a date in the past', () => {
      const body = { patient_id: 1, doctor_id: 2, appt_datetime: '2020-01-06 09:00' };
      expect(() => read_booking_request(body)).toThrow(/in the future/);
    });

    test('rejects an impossible date before looking at the slot rules', () => {
      const body = { patient_id: 1, doctor_id: 2, appt_datetime: '2030-02-30 09:00' };
      expect(() => read_booking_request(body)).toThrow(/not a real date/);
    });

    test('rejects a malformed datetime', () => {
      const body = { patient_id: 1, doctor_id: 2, appt_datetime: 'nope' };
      expect(() => read_booking_request(body)).toThrow(/must look like/);
    });
  });

  describe('request body', () => {
    test.each([
      ['null', null],
      ['an array', []],
      ['a string', 'hello'],
      ['undefined', undefined],
    ])('rejects %s as the body', (_label, body) => {
      expect(() => read_booking_request(body)).toThrow(/must be a JSON object/);
    });

    test('rejects a non-numeric patient_id', () => {
      const body = { patient_id: 'abc', doctor_id: 2, appt_datetime: '2030-06-03 09:00' };
      expect(() => read_booking_request(body)).toThrow(AppError);
    });
  });

  describe('what it returns for the model', () => {
    test('returns ids, SQL datetime, the date and the day window', () => {
      expect(read_booking_request(at('09:30'))).toEqual({
        patient_id: 1,
        doctor_id: 2,
        appt_datetime: '2030-06-03 09:30:00',
        date: '2030-06-03',
        day_start: '2030-06-03 00:00:00',
        day_end: '2030-06-04 00:00:00',
      });
    });

    test('the day window rolls over a year end (31 December)', () => {
      const result = read_booking_request({ patient_id: 1, doctor_id: 2, appt_datetime: '2030-12-31 09:00' });
      expect(result.day_start).toBe('2030-12-31 00:00:00');
      expect(result.day_end).toBe('2031-01-01 00:00:00');
    });
  });
});
