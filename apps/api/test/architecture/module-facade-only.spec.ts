import { describe, expect, it } from 'vitest';
import { sources } from './source-rules.js';

/** D-5: un módulo solo se importa a través de su index.ts. */
describe('los módulos se usan solo por su fachada (D-5)', () => {
  it('nadie fuera de modules/accounting importa algo distinto de modules/accounting/index.js', () => {
    const bad = sources((r) => !r.startsWith('src/modules/accounting/')).flatMap((s) =>
      s.imports.filter((i) => /modules\/accounting\//.test(i) && !/modules\/accounting\/index\.js$/.test(i)).map((i) => `${s.rel} → ${i}`),
    );
    expect(bad).toEqual([]);
  });

  it('el index.ts del módulo exporta el módulo y los puertos públicos, y nada de infraestructura ni de dominio', () => {
    const idx = sources((r) => r === 'src/modules/accounting/index.ts')[0]!;
    expect(idx.text).toMatch(/AccountingModule/);
    expect(idx.text).toMatch(/POST_JOURNAL_ENTRY_PORT/);
    expect(idx.imports.filter((i) => /infrastructure|presentation|domain/.test(i))).toEqual([]);
  });
});
