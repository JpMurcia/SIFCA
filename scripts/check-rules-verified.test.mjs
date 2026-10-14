import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { check, expandRanges } from './check-rules-verified.mjs';

const mk = () => {
  const root = mkdtempSync(join(tmpdir(), 'rules-'));
  const catalog = join(root, 'catalog');
  const spec = join(root, 'spec');
  mkdirSync(catalog);
  mkdirSync(join(spec, 'acceptance'), { recursive: true });
  writeFileSync(join(catalog, '01.md'), `# Reglas\n\n### R-CON-001 · Cuadre\nTexto.\n**Validación del contador:** ✅ 2026-11-02 · Ana Pérez (T.P. 1234)\n\n### R-CON-002 · Un lado\nTexto.\n\n## Otra sección\n`);
  writeFileSync(join(spec, 'spec.md'), 'FR-001 (R-CON-001), FR-002 (R-CON-002), FR-003 (R-CON-099)');
  writeFileSync(join(spec, 'acceptance', 'a.feature'), '@R-CON-001');
  return { catalog, spec };
};

test('expande rangos «R-CON-001…003»', () => {
  assert.deepEqual([...expandRanges('R-CON-001…003')].sort(), ['R-CON-001', 'R-CON-002', 'R-CON-003']);
});

test('una regla está validada solo con la línea «Validación del contador: ✅ fecha · nombre»', () => {
  const { catalog, spec } = mk();
  const rows = Object.fromEntries(check(spec, catalog).map((r) => [r.id, r]));
  assert.equal(rows['R-CON-001'].validated?.who, 'Ana Pérez (T.P. 1234)');
  assert.equal(rows['R-CON-002'].validated, null);
  assert.equal(rows['R-CON-099'].exists, false);
});

test('el script sale con código 1 si hay reglas sin validar y 0 con --allow-provisional', () => {
  const { spec } = mk();
  const run = (...a) => spawnSync('node', ['scripts/check-rules-verified.mjs', spec, ...a], { encoding: 'utf8' });
  // el script lee el catálogo real del repositorio: las reglas R-CON-099 de la prueba no existen allí
  assert.equal(run().status, 1);
  assert.equal(run('--allow-provisional').status, 0);
});
