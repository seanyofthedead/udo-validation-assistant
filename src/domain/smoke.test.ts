import { describe, it, expect } from 'vitest';
import * as domain from './index';

describe('scaffold smoke test', () => {
  it('arithmetic works (suite is wired up)', () => {
    expect(1 + 1).toBe(2);
  });

  it('domain barrel exposes the engine entry points', () => {
    expect(typeof domain.runValidation).toBe('function');
    expect(typeof domain.validateStatus).toBe('function');
    expect(typeof domain.flagDeobligation).toBe('function');
  });
});
