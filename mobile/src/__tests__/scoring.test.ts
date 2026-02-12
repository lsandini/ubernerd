import { scoreBase, speedMultiplier } from '../scoring';

describe('scoreBase', () => {
  it('returns 100 for type A', () => {
    expect(scoreBase('A')).toBe(100);
  });

  it('returns 100 for type B', () => {
    expect(scoreBase('B')).toBe(100);
  });

  it('returns 150 for type AB', () => {
    expect(scoreBase('AB')).toBe(150);
  });

  it('returns 250 for type K', () => {
    expect(scoreBase('K')).toBe(250);
  });
});

describe('speedMultiplier', () => {
  it('returns 1.0 when no time remaining', () => {
    expect(speedMultiplier(0, 10)).toBe(1.0);
  });

  it('returns 1.5 when full time remaining', () => {
    expect(speedMultiplier(10, 10)).toBe(1.5);
  });

  it('returns 1.25 at half time remaining', () => {
    expect(speedMultiplier(5, 10)).toBe(1.25);
  });

  it('clamps negative remaining to 1.0', () => {
    expect(speedMultiplier(-5, 10)).toBe(1.0);
  });

  it('clamps remaining exceeding total to 1.5', () => {
    expect(speedMultiplier(15, 10)).toBe(1.5);
  });
});
