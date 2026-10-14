import { describe, expect, it } from 'vitest';
import { sources, stripComments } from './source-rules.js';

/** G-01: el dominio (y el núcleo compartido) no importa frameworks ni usa el reloj/azar del sistema. */
describe('dominio sin frameworks ni reloj del sistema (G-01)', () => {
  const pure = sources((r) => /^src\/modules\/[^/]+\/domain\//.test(r) || r.startsWith('src/shared-kernel/'));

  it('hay archivos de dominio que revisar', () => {
    expect(pure.length).toBeGreaterThan(15);
  });

  it('no importa NestJS, Prisma, Zod, pg, rxjs ni módulos de E/S de Node', () => {
    const bad = pure.flatMap((s) => s.imports.filter((i) => /^(@nestjs|@prisma|prisma|zod|pg|rxjs|node:fs|node:http|node:https|node:net|node:child_process|fs|http|https)(\/|$)/.test(i)).map((i) => `${s.rel} → ${i}`));
    expect(bad).toEqual([]);
  });

  it('no usa Date.now(), new Date() sin argumentos, Math.random ni crypto', () => {
    const bad = pure.flatMap((s) => {
      const code = stripComments(s.text);
      return [/Date\.now\s*\(/, /new Date\(\s*\)/, /Math\.random\s*\(/, /\brandomUUID\b/, /performance\.now/].filter((re) => re.test(code)).map((re) => `${s.rel}: ${re}`);
    });
    expect(bad).toEqual([]);
  });

  it('la capa de aplicación tampoco usa el reloj: el tiempo entra por el puerto Clock', () => {
    const app = sources((r) => /^src\/modules\/[^/]+\/application\//.test(r));
    const bad = app.filter((s) => /Date\.now\s*\(|new Date\(\s*\)/.test(stripComments(s.text))).map((s) => s.rel);
    expect(bad).toEqual([]);
  });
});
