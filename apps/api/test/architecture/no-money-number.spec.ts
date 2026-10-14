import { describe, expect, it } from 'vitest';
import { sources, stripComments } from './source-rules.js';

/** G-09 / principio VI: ningún `number` en cálculos ni campos monetarios del dominio y la aplicación. */
describe('dinero exacto: sin number monetario (G-09)', () => {
  const files = sources((r) => /^src\/modules\/[^/]+\/(domain|application)\//.test(r));
  const MONEY_WORD = '(amount|debit|credit|total|balance|saldo|importe|price|precio|cost|costo|tax|iva)';

  it('hay archivos que revisar', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('ningún campo, parámetro o variable monetaria se tipa como number', () => {
    const re = new RegExp(`\\b\\w*${MONEY_WORD}\\w*\\s*\\??\\s*:\\s*number\\b`, 'i');
    const bad = files.flatMap((s) => stripComments(s.text).split('\n').filter((l) => re.test(l)).map((l) => `${s.rel}: ${l.trim()}`));
    expect(bad).toEqual([]);
  });

  it('no convierte importes con Number(), parseFloat() ni .toNumber()', () => {
    const bad = files.flatMap((s) => {
      const code = stripComments(s.text);
      return [new RegExp(`Number\\([^)]*${MONEY_WORD}`, 'i'), /parseFloat\s*\(/, /\.toNumber\s*\(/, /unary\+/].filter((re) => re.test(code)).map((re) => `${s.rel}: ${re}`);
    });
    expect(bad).toEqual([]);
  });
});
