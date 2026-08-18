import { describe, it, expect } from 'vitest';
import { RIR } from './RIR.js';
import { DomainInvariantError } from '../errors/DomainErrors.js';

describe('RIR', () => {
  it('creates valid RIR at bounds', () => {
    const zero = new RIR(0);
    expect(zero.value).toBe(0);
    const ten = new RIR(10);
    expect(ten.value).toBe(10);
  });

  it('rejects negative RIR', () => {
    expect(() => new RIR(-1)).toThrow(DomainInvariantError);
    expect(() => new RIR(-1)).toThrow('RIR must be between 0 and 10');
  });

  it('rejects RIR above 10', () => {
    expect(() => new RIR(11)).toThrow(DomainInvariantError);
    expect(() => new RIR(11)).toThrow('RIR must be between 0 and 10');
  });

  it('rejects fractional RIR', () => {
    expect(() => new RIR(2.5)).toThrow(DomainInvariantError);
    expect(() => new RIR(2.5)).toThrow('RIR must be between 0 and 10');
  });

  it('equals by value', () => {
    const a = new RIR(3);
    const b = new RIR(3);
    const c = new RIR(4);
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
