import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('Arquitectura (G-01, G-02, G-03; reglas D-1…D-7 y ausencia de ciclos)', () => {
  it('dependency-cruiser no encuentra violaciones', () => {
    const r = spawnSync('npx', ['depcruise', 'src', '--config', '.dependency-cruiser.cjs', '--output-type', 'err'], { cwd: root, encoding: 'utf8' });
    expect(r.stdout + r.stderr, 'salida de dependency-cruiser').not.toMatch(/error/i);
    expect(r.status).toBe(0);
  });
});
