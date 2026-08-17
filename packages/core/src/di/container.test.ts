import { describe, it, expect } from 'vitest';
import { container, DIContainer } from './container.js';

describe('DIContainer', () => {
  it('should register and resolve a dependency', () => {
    const dep = { value: 42 };
    container.register('answer', dep);
    expect(container.resolve('answer')).toBe(dep);
  });

  it('should throw when resolving unregistered token', () => {
    const fresh = new DIContainer();
    expect(() => fresh.resolve('missing')).toThrow('No registration found for token: missing');
  });
});
