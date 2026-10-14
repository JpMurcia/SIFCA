import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { API_ROOT } from './source-rules.js';

/** D-5 / diagnóstico 6: el grafo de componentes no tiene ciclos. */
describe('sin ciclos de dependencias', () => {
  it('dependency-cruiser no reporta la regla no-circular', () => {
    const r = spawnSync('npx', ['depcruise', 'src', '--config', '.dependency-cruiser.cjs', '--output-type', 'json'], { cwd: API_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const report = JSON.parse(r.stdout) as { summary: { violations: Array<{ rule: { name: string }; from: string; to: string }> } };
    const cycles = report.summary.violations.filter((v) => v.rule.name === 'no-circular').map((v) => `${v.from} → ${v.to}`);
    expect(cycles).toEqual([]);
  });
});
