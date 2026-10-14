import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ports = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'modules', 'accounting', 'application', 'ports');

/** G-06: ningún puerto ofrece mutar un comprobante (JournalEntry / JournalLine). */
describe('puertos de registro inmutable (G-06)', () => {
  const files = readdirSync(ports).filter((f) => /journal-entry|journal-line|ledger/.test(f) && f.endsWith('.ts'));

  it('hay puertos de comprobante que revisar', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const f of files) {
    it(`${f} no expone update*, delete*, remove*, save* ni replace*`, () => {
      const src = readFileSync(join(ports, f), 'utf8');
      const methods = [...src.matchAll(/^\s+(?:readonly\s+)?(\w+)\s*(?:<[^>]*>)?\(/gm)].map((m) => m[1]!);
      const forbidden = methods.filter((m) => /^(update|delete|remove|save|replace|set|patch|truncate|clear)/i.test(m));
      expect(forbidden, `métodos mutadores en ${f}`).toEqual([]);
    });
  }
});
