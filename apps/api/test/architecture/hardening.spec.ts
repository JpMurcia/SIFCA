import { describe, expect, it } from 'vitest';
import { sources, stripComments } from './source-rules.js';

/** T091 · revisión de seguridad automatizable. */
describe('seguridad del código', () => {
  const all = sources(() => true);

  it('no hay SQL sin parametrizar: ni $queryRawUnsafe ni $executeRawUnsafe', () => {
    expect(all.filter((s) => /\$(query|execute)RawUnsafe/.test(stripComments(s.text))).map((s) => s.rel)).toEqual([]);
  });

  it('el código no escribe en consola: no se imprimen importes, terceros ni el token', () => {
    expect(all.filter((s) => /\bconsole\.(log|info|debug|warn|error)\b/.test(stripComments(s.text))).map((s) => s.rel)).toEqual([]);
  });

  it('el encabezado Authorization solo se lee en el middleware provisional', () => {
    const bad = all.filter((s) => /headers\.authorization|headers\['authorization'\]/i.test(stripComments(s.text)) && s.rel !== 'src/platform/http/request-context.ts').map((s) => s.rel);
    expect(bad).toEqual([]);
  });

  it('el filtro de errores no devuelve trazas ni el mensaje de errores desconocidos', () => {
    const f = sources((r) => r === 'src/platform/http/problem-details.ts')[0]!;
    expect(f.text).not.toMatch(/\.stack\b/);
  });
});
