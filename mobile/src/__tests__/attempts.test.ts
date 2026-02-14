jest.mock('../db', () => ({ db: null }));
jest.mock('../api', () => ({ getApiBase: () => 'http://localhost:8787' }));

type AttemptsModule = typeof import('../attempts');

let attempts: AttemptsModule;

beforeEach(() => {
  jest.resetModules();
  attempts = require('../attempts');
});

describe('saveAttempt + hasAttempt', () => {
  it('returns false before any attempt is saved', () => {
    expect(attempts.hasAttempt('item1')).toBe(false);
  });

  it('returns true after saving an attempt', () => {
    attempts.saveAttempt({
      itemId: 'item1',
      domain: 'medical',
      servedAt: 1000,
      answeredAt: 1005,
      rtMs: 5000,
      choice: 2,
      correct: true,
      scoreDelta: 100,
    });
    expect(attempts.hasAttempt('item1')).toBe(true);
  });

  it('does not detect attempts for other items', () => {
    attempts.saveAttempt({
      itemId: 'item1',
      domain: 'medical',
      servedAt: 1000,
      answeredAt: 1005,
      rtMs: 5000,
      choice: 2,
      correct: true,
      scoreDelta: 100,
    });
    expect(attempts.hasAttempt('item2')).toBe(false);
  });
});

describe('getLatestAttempt', () => {
  it('returns null when no attempts exist', () => {
    expect(attempts.getLatestAttempt('item1')).toBeNull();
  });

  it('returns the most recent attempt for an item', () => {
    attempts.saveAttempt({
      itemId: 'item1',
      domain: 'medical',
      servedAt: 1000,
      answeredAt: 1005,
      rtMs: 5000,
      choice: 1,
      correct: false,
      scoreDelta: -40,
    });
    attempts.saveAttempt({
      itemId: 'item1',
      domain: 'medical',
      servedAt: 2000,
      answeredAt: 2003,
      rtMs: 3000,
      choice: 2,
      correct: true,
      scoreDelta: 100,
    });

    const latest = attempts.getLatestAttempt('item1');
    expect(latest).not.toBeNull();
    expect(latest!.answeredAt).toBe(2003);
    expect(latest!.correct).toBe(1);
    expect(latest!.scoreDelta).toBe(100);
  });
});
