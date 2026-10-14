import { describe, expect, it } from 'vitest';
import { sources } from './source-rules.js';

/** G-03 / D-4: Prisma solo existe en infrastructure/persistence y platform/persistence. */
describe('Prisma confinado a persistencia (G-03)', () => {
  it('ningún otro archivo importa Prisma ni el cliente generado', () => {
    const allowed = (r: string) => /^src\/modules\/[^/]+\/infrastructure\/persistence\//.test(r) || r.startsWith('src/platform/persistence/');
    const bad = sources((r) => !allowed(r)).flatMap((s) => s.imports.filter((i) => /(^|\/)(@prisma|prisma)(\/|$)|generated\/prisma/.test(i)).map((i) => `${s.rel} → ${i}`));
    expect(bad).toEqual([]);
  });

  it('los tipos de Prisma no aparecen en las firmas de los puertos de aplicación ni del dominio', () => {
    const bad = sources((r) => /^src\/modules\/[^/]+\/(domain|application)\//.test(r)).filter((s) => /\bPrisma\b|\bPrismaClient\b/.test(s.text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''))).map((s) => s.rel);
    expect(bad).toEqual([]);
  });
});
