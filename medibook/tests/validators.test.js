const { parse_date_time } = require('../src/controllers/validators');
const AppError = require('../src/controllers/app_errors');

describe('parse_date_time', () => {
  describe('valid input', () => {
    test('parses "YYYY-MM-DD HH:MM" into its parts', () => {
      const r = parse_date_time('2026-12-14 09:30');
      expect(r).toMatchObject({ year: 2026, month: 12, day: 14, hour: 9, minute: 30, second: 0 });
    });

    test('accepts the T separator and optional seconds', () => {
      const r = parse_date_time('2026-12-14T16:30:15');
      expect(r).toMatchObject({ hour: 16, minute: 30, second: 15 });
    });

    test('trims surrounding whitespace', () => {
      expect(parse_date_time('  2026-12-14 09:00  ').day).toBe(14);
    });

    test('accepts 29 February in a leap year', () => {
      expect(parse_date_time('2028-02-29 09:00')).toMatchObject({ month: 2, day: 29 });
    });

    test('does not enforce 30-minute alignment: 09:15 parses (booking rules check that)', () => {
      expect(parse_date_time('2026-12-14 09:15').minute).toBe(15);
    });
  });

  describe('malformed input is rejected with an AppError', () => {
    test.each([
      ['wrong separators', '2026/12/14 09:00'],
      ['day first', '14-12-2026 09:00'],
      ['missing time', '2026-12-14'],
      ['empty string', ''],
      ['plain text', 'nope'],
    ])('%s', (_label, value) => {
      expect(() => parse_date_time(value)).toThrow(AppError);
      expect(() => parse_date_time(value)).toThrow(/must look like/);
    });

    test.each([
      ['a number', 12345],
      ['null', null],
      ['undefined', undefined],
    ])('non-string input (%s)', (_label, value) => {
      expect(() => parse_date_time(value)).toThrow(AppError);
    });
  });

  describe('well-formed but impossible dates are rejected', () => {
    test.each([
      ['30 February', '2026-02-30 09:00'],
      ['29 February in a non-leap year', '2027-02-29 09:00'],
      ['month 13', '2026-13-01 09:00'],
      ['hour 24', '2026-12-14 24:00'],
      ['minute 60', '2026-12-14 09:60'],
    ])('%s', (_label, value) => {
      expect(() => parse_date_time(value)).toThrow(/not a real date/);
    });
  });

  test('uses the label in the error message', () => {
    expect(() => parse_date_time('bad', 'appt_datetime')).toThrow(/appt_datetime/);
  });
});