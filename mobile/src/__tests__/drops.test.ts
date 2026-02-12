jest.mock('../db', () => ({ db: null }));
jest.mock('../packs', () => ({ getLocalItems: jest.fn(() => []) }));
jest.mock('../attempts', () => ({ hasAttempt: jest.fn(() => false) }));

type DropsModule = typeof import('../drops');

let drops: DropsModule;

beforeEach(() => {
  jest.resetModules();
  drops = require('../drops');
});

describe('createDropGroups', () => {
  it('groups items into chunks of 3', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const groups = drops.createDropGroups(ids, 10);

    expect(groups).toHaveLength(3); // 7 items -> 3+3+1
    for (const g of groups) {
      expect(g.length).toBeGreaterThan(0);
      expect(g.length).toBeLessThanOrEqual(3);
    }
    expect(groups.flat().sort()).toEqual(ids.sort());
  });

  it('respects maxDrops limit', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const groups = drops.createDropGroups(ids, 1);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
  });

  it('returns empty array for no items', () => {
    expect(drops.createDropGroups([], 5)).toEqual([]);
  });
});

describe('saveDrop + getDropItems', () => {
  it('round-trips drop items in order', () => {
    drops.saveDrop('drop1', ['a', 'b', 'c'], 1000);
    expect(drops.getDropItems('drop1')).toEqual(['a', 'b', 'c']);
  });

  it('returns empty array for unknown dropId', () => {
    expect(drops.getDropItems('nonexistent')).toEqual([]);
  });
});

describe('getOrCreateNextDrop', () => {
  it('creates an ad-hoc drop from available items', () => {
    const { getLocalItems } = require('../packs');
    const now = Math.floor(Date.now() / 1000);

    getLocalItems.mockReturnValue([
      { id: 'i1', displayFrom: now - 3600, displayTo: now + 3600 },
      { id: 'i2', displayFrom: now - 3600, displayTo: now + 3600 },
      { id: 'i3', displayFrom: now - 3600, displayTo: now + 3600 },
    ]);

    const result = drops.getOrCreateNextDrop();
    expect(result).not.toBeNull();
    expect(result!.dropId).toMatch(/^drop_/);
    expect(result!.itemIds).toHaveLength(3);
  });

  it('returns null when no items are available', () => {
    expect(drops.getOrCreateNextDrop()).toBeNull();
  });
});
