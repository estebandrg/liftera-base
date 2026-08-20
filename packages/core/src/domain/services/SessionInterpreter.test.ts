import { describe, it, expect } from 'vitest';
import { SessionInterpreter } from './SessionInterpreter.js';
import { Session } from '../exercise/Session.js';
import { LoggedSet } from '../exercise/LoggedSet.js';
import { Load } from '../value-objects/Load.js';
import { Reps } from '../value-objects/Reps.js';
import { RIR } from '../value-objects/RIR.js';

describe('SessionInterpreter', () => {
  const interpreter = new SessionInterpreter();

  const sessionOn = (day: number, sets: LoggedSet[]): Session =>
    new Session(sets, new Date(`2026-08-${day.toString().padStart(2, '0')}`));

  it('picks the heaviest set as the top set', () => {
    const session = sessionOn(1, [
      new LoggedSet(new Load(80, 'kg'), new Reps(10)),
      new LoggedSet(new Load(100, 'kg'), new Reps(8)),
      new LoggedSet(new Load(90, 'kg'), new Reps(9)),
    ]);

    const [performance] = interpreter.interpret([session]);

    expect(performance.topSet.load.value).toBe(100);
    expect(performance.topSet.reps.value).toBe(8);
  });

  it('computes session volume as the sum of load x reps', () => {
    const session = sessionOn(1, [
      new LoggedSet(new Load(100, 'kg'), new Reps(8)),
      new LoggedSet(new Load(100, 'kg'), new Reps(8)),
    ]);

    const [performance] = interpreter.interpret([session]);

    expect(performance.volume.value).toBe(1600);
  });

  it('uses the top-set RIR when the heaviest set carries one', () => {
    const session = sessionOn(1, [
      new LoggedSet(new Load(100, 'kg'), new Reps(8), new RIR(2)),
      new LoggedSet(new Load(80, 'kg'), new Reps(10), new RIR(5)),
    ]);

    const [performance] = interpreter.interpret([session]);

    expect(performance.effectiveRir).toBe(2);
  });

  it('falls back to the mean RIR of sets carrying one when the top set has none', () => {
    const session = sessionOn(1, [
      new LoggedSet(new Load(100, 'kg'), new Reps(8)),
      new LoggedSet(new Load(80, 'kg'), new Reps(10), new RIR(2)),
      new LoggedSet(new Load(80, 'kg'), new Reps(10), new RIR(4)),
    ]);

    const [performance] = interpreter.interpret([session]);

    expect(performance.effectiveRir).toBe(3);
  });

  it('keeps the fractional mean instead of rounding', () => {
    const session = sessionOn(1, [
      new LoggedSet(new Load(100, 'kg'), new Reps(8)),
      new LoggedSet(new Load(80, 'kg'), new Reps(10), new RIR(2)),
      new LoggedSet(new Load(80, 'kg'), new Reps(10), new RIR(3)),
    ]);

    const [performance] = interpreter.interpret([session]);

    expect(performance.effectiveRir).toBe(2.5);
  });

  it('returns unknown when no set in the session carries RIR', () => {
    const session = sessionOn(1, [
      new LoggedSet(new Load(100, 'kg'), new Reps(8)),
      new LoggedSet(new Load(80, 'kg'), new Reps(10)),
    ]);

    const [performance] = interpreter.interpret([session]);

    expect(performance.effectiveRir).toBe('unknown');
  });

  it('interprets every session in the window preserving order', () => {
    const sessions = [
      sessionOn(1, [new LoggedSet(new Load(100, 'kg'), new Reps(8), new RIR(3))]),
      sessionOn(2, [new LoggedSet(new Load(100, 'kg'), new Reps(9))]),
    ];

    const performances = interpreter.interpret(sessions);

    expect(performances).toHaveLength(2);
    expect(performances[0].effectiveRir).toBe(3);
    expect(performances[1].effectiveRir).toBe('unknown');
  });
});
