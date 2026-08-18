import { describe, it, expect } from 'vitest';
import { Load } from './Load.js';
import { DomainInvariantError } from '../errors/DomainErrors.js';

describe('Load', () => {
  it('creates a valid load in kg', () => {
    const load = new Load(100, 'kg');
    expect(load.value).toBe(100);
    expect(load.unit).toBe('kg');
  });

  it('creates a valid load in lb', () => {
    const load = new Load(225, 'lb');
    expect(load.value).toBe(225);
    expect(load.unit).toBe('lb');
  });

  it('rejects zero load', () => {
    expect(() => new Load(0, 'kg')).toThrow(DomainInvariantError);
    expect(() => new Load(0, 'kg')).toThrow('Load must be positive');
  });

  it('rejects negative load', () => {
    expect(() => new Load(-5, 'kg')).toThrow(DomainInvariantError);
    expect(() => new Load(-5, 'kg')).toThrow('Load must be positive');
  });

  it('rejects invalid unit', () => {
    expect(() => new Load(100, 'oz' as 'kg')).toThrow(DomainInvariantError);
    expect(() => new Load(100, 'oz' as 'kg')).toThrow("Load unit must be 'kg' or 'lb'");
  });

  it('equals by value and unit', () => {
    const a = new Load(100, 'kg');
    const b = new Load(100, 'kg');
    const c = new Load(100, 'lb');
    const d = new Load(90, 'kg');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
    expect(a.equals(d)).toBe(false);
  });
});
