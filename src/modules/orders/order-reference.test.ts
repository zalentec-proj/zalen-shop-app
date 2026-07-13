import { describe, expect, it } from 'vitest';
import { parseOrderReference } from './order-reference';

describe('parseOrderReference', () => {
  it('aceita UUID interno do pedido', () => {
    expect(
      parseOrderReference('F6E3B3B8-17D5-4D70-8FDF-B8ED14FCA04B')
    ).toEqual({
      kind: 'id',
      value: 'f6e3b3b8-17d5-4d70-8fdf-b8ed14fca04b',
    });
  });

  it('aceita e normaliza o número visível do pedido', () => {
    expect(parseOrderReference(' bd-167498 ')).toEqual({
      kind: 'number',
      value: 'BD-167498',
    });
  });

  it('rejeita referências vazias ou com caracteres inesperados', () => {
    expect(parseOrderReference('')).toBeNull();
    expect(parseOrderReference('BD-167498,other.eq.true')).toBeNull();
  });
});
