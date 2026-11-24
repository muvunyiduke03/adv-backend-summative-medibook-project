const { refund_percentage_for } = require('../src/controllers/business_rules');

describe('refund_percentage_for', () => {
  describe('tier 1: more than 48 hours notice -> 100%', () => {
    test.each([
      [72],
      [100],
      [48.01],
    ])('%s hours gives a full refund', (hours) => {
      expect(refund_percentage_for(hours)).toBe(100);
    });
  });

  describe('tier 2: 24 up to and including 48 hours -> 50%', () => {
    test.each([
      [36],
      [47.99],
      [24.01],
    ])('%s hours gives a half refund', (hours) => {
      expect(refund_percentage_for(hours)).toBe(50);
    });
  });

  describe('tier 3: under 24 hours -> 0%', () => {
    test.each([
      [12],
      [1],
      [23.99],
      [0],
    ])('%s hours gives no refund', (hours) => {
      expect(refund_percentage_for(hours)).toBe(0);
    });
  });

  describe('boundaries (documented policy)', () => {
    test('exactly 48 hours is NOT a full refund: it falls in the 50% tier', () => {
      expect(refund_percentage_for(48)).toBe(50);
    });

    test('exactly 24 hours is still in the 50% tier', () => {
      expect(refund_percentage_for(24)).toBe(50);
    });

    test('a hair over 48 hours flips to 100% and a hair under 24 flips to 0%', () => {
      expect(refund_percentage_for(48.0001)).toBe(100);
      expect(refund_percentage_for(23.9999)).toBe(0);
    });
  });

  test('an appointment already in the past (negative notice) gets no refund', () => {
    expect(refund_percentage_for(-5)).toBe(0);
  });
});