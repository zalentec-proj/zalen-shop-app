import { describe, expect, it } from 'vitest';
import { isValidCnpj, isValidCpf, isValidCpfOrCnpj, onlyDigits } from './br-document';

describe('Brazilian documents', () => {
  it('normalizes digits without accepting malformed input', () => {
    expect(onlyDigits('085.909.619-07')).toBe('08590961907');
    expect(onlyDigits(undefined)).toBe('');
  });

  it('validates CPF and rejects repeated or invalid values', () => {
    expect(isValidCpf('085.909.619-07')).toBe(true);
    expect(isValidCpf('123.456.789-09')).toBe(true);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('123.456.789-00')).toBe(false);
  });

  it('validates CNPJ and detects the document kind by length', () => {
    expect(isValidCnpj('62.193.839/0001-40')).toBe(true);
    expect(isValidCnpj('11.111.111/1111-11')).toBe(false);
    expect(isValidCpfOrCnpj('62.193.839/0001-40')).toBe(true);
    expect(isValidCpfOrCnpj('085.909.619-07')).toBe(true);
  });
});
