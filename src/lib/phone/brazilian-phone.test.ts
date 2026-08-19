import { describe, expect, it } from 'vitest';
import { formatBrazilianPhone } from './brazilian-phone';

describe('formatBrazilianPhone', () => {
  it('formats a Brazilian mobile number typed as digits', () => {
    expect(formatBrazilianPhone('45984155354')).toBe('(45) 98415-5354');
  });

  it('accepts a pasted E.164 number without changing a DDD 55 number', () => {
    expect(formatBrazilianPhone('+5545984155354')).toBe('(45) 98415-5354');
    expect(formatBrazilianPhone('55984155354')).toBe('(55) 98415-5354');
  });
});
