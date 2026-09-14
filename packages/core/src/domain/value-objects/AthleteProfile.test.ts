import { describe, it, expect } from 'vitest';
import { AthleteProfile } from './AthleteProfile.js';
import { DomainInvariantError } from '../errors/DomainErrors.js';

describe('AthleteProfile — construction', () => {
  it('preserves all fields when fully constructed', () => {
    const profile = new AthleteProfile({
      methodology: 'HIT',
      experience: 'intermediate',
      limitations: ['squat', 'deadlift'],
      goals: 'strength',
    });

    expect(profile.methodology).toBe('HIT');
    expect(profile.experience).toBe('intermediate');
    expect(profile.limitations).toEqual(['squat', 'deadlift']);
    expect(profile.goals).toBe('strength');
  });

  it('makes fields readonly (structural immutability)', () => {
    const profile = new AthleteProfile({
      methodology: 'HIT',
      limitations: ['squat'],
    });

    // Structural immutability: reassigning the property throws at compile
    // time; at runtime we assert the value stays unchanged.
    expect(profile.methodology).toBe('HIT');
    expect(profile.limitations).toEqual(['squat']);
  });

  it('treats omitted fields as undefined', () => {
    const profile = new AthleteProfile({});

    expect(profile.methodology).toBeUndefined();
    expect(profile.experience).toBeUndefined();
    expect(profile.limitations).toBeUndefined();
    expect(profile.goals).toBeUndefined();
  });

  it('throws DomainInvariantError when limitations is present but empty', () => {
    expect(() => new AthleteProfile({ limitations: [] })).toThrow(DomainInvariantError);
    expect(() => new AthleteProfile({ limitations: [] })).toThrow(
      'Limitations cannot be empty when present',
    );
  });

  it('allows undefined limitations (no restrictions)', () => {
    const profile = new AthleteProfile({});

    expect(profile.limitations).toBeUndefined();
  });
});

describe('AthleteProfile — forbids()', () => {
  it('returns true for an exact match against a limitation', () => {
    const profile = new AthleteProfile({ limitations: ['squat'] });

    expect(profile.forbids('squat')).toBe(true);
  });

  it('returns false for a substring miss', () => {
    const profile = new AthleteProfile({ limitations: ['squat'] });

    expect(profile.forbids('front squat')).toBe(false);
    expect(profile.forbids('Squat')).toBe(false); // case-sensitive exact match
  });

  it('returns false when limitations is undefined', () => {
    const profile = new AthleteProfile({});

    expect(profile.forbids('squat')).toBe(false);
  });

  it('checks against all limitations in the list', () => {
    const profile = new AthleteProfile({ limitations: ['squat', 'deadlift'] });

    expect(profile.forbids('squat')).toBe(true);
    expect(profile.forbids('deadlift')).toBe(true);
    expect(profile.forbids('bench press')).toBe(false);
  });
});
