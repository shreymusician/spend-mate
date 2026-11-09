import { describe, expect, it } from 'vitest';
import { MoneyError, rupeesToPaise, splitEqual, splitExact, splitPercent } from './money.js';

const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

describe('splitEqual', () => {
  it('splits ₹900 among three evenly', () => {
    expect([...splitEqual(90000, ['a', 'b', 'c']).values()]).toEqual([30000, 30000, 30000]);
  });
  it('distributes remainder paise and always sums to total', () => {
    const m = splitEqual(1000, ['a', 'b', 'c']);
    expect([...m.values()]).toEqual([334, 333, 333]);
    expect(sum(m)).toBe(1000);
  });
  it('only charges selected participants', () => {
    const m = splitEqual(90000, ['a', 'b', 'c']);
    expect(m.has('d')).toBe(false);
  });
  it('handles 1 paisa among many', () => {
    const m = splitEqual(1, ['a', 'b', 'c']);
    expect([...m.values()]).toEqual([1, 0, 0]);
  });
  it('rejects empty, duplicate, fractional and negative', () => {
    expect(() => splitEqual(100, [])).toThrow(MoneyError);
    expect(() => splitEqual(100, ['a', 'a'])).toThrow(MoneyError);
    expect(() => splitEqual(10.5, ['a'])).toThrow(MoneyError);
    expect(() => splitEqual(-1, ['a'])).toThrow(MoneyError);
  });
});

describe('splitExact', () => {
  it('accepts shares that sum to total', () => {
    expect(sum(splitExact(1000, [{ userId: 'a', paise: 700 }, { userId: 'b', paise: 300 }]))).toBe(1000);
  });
  it('rejects mismatched totals', () => {
    expect(() => splitExact(1000, [{ userId: 'a', paise: 700 }, { userId: 'b', paise: 200 }])).toThrow(/expected 1000/);
  });
});

describe('splitPercent', () => {
  it('uses largest remainder so shares sum exactly', () => {
    const m = splitPercent(1000, [
      { userId: 'a', bps: 3333 }, { userId: 'b', bps: 3333 }, { userId: 'c', bps: 3334 },
    ]);
    expect(sum(m)).toBe(1000);
    expect(m.get('c')).toBe(334);
  });
  it('splits 50/50 of an odd amount without losing paise', () => {
    const m = splitPercent(101, [{ userId: 'a', bps: 5000 }, { userId: 'b', bps: 5000 }]);
    expect(sum(m)).toBe(101);
  });
  it('requires 100%', () => {
    expect(() => splitPercent(100, [{ userId: 'a', bps: 9000 }])).toThrow(/100%/);
  });
});

describe('rupeesToPaise', () => {
  it.each([['250', 25000], ['250.5', 25050], ['250.05', 25005], ['0.99', 99]])('%s → %i', (i, p) => {
    expect(rupeesToPaise(i)).toBe(p);
  });
  it('rejects junk', () => {
    expect(() => rupeesToPaise('1.234')).toThrow();
    expect(() => rupeesToPaise('-5')).toThrow();
    expect(() => rupeesToPaise('abc')).toThrow();
  });
});
