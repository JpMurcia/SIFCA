import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { DomainError, Forbidden, type Violation } from '../../../src/shared-kernel/index.js';
import { toProblem } from '../../../src/platform/http/problem-details.js';

class Dummy extends DomainError {
  constructor(readonly code: string, violations: readonly Violation[] = []) {
    super(`dummy ${code}`, violations);
  }
}

const table: Array<[string, number]> = [
  ['ENTRY_NOT_BALANCED', 422],
  ['VALIDATION_FAILED', 422],
  ['PERIOD_CLOSED', 409],
  ['PERIOD_NOT_FOUND', 422],
  ['ALREADY_REVERSED', 409],
  ['ENTRY_IMMUTABLE', 405],
  ['PERIOD_CLOSE_BLOCKED', 409],
  ['NOT_FOUND', 404],
  ['CONFLICT', 409],
  ['IDEMPOTENCY_CONFLICT', 422],
];

describe('toProblem (research §14)', () => {
  for (const [code, status] of table) {
    it(`${code} → HTTP ${status}`, () => {
      const p = toProblem(new Dummy(code), 'req-1');
      expect(p.status).toBe(status);
      expect(p.code).toBe(code);
      expect(p.requestId).toBe('req-1');
      expect(p.type).toMatch(/^https:\/\/sifca\.example\/problems\//);
    });
  }

  it('propaga las violaciones con field, message y rule', () => {
    const p = toProblem(new Dummy('VALIDATION_FAILED', [{ field: 'lines[0]', message: 'Sin tercero', rule: 'R-CON-008' }]), 'r');
    expect(p.errors).toEqual([{ field: 'lines[0]', message: 'Sin tercero', rule: 'R-CON-008' }]);
  });

  it('Forbidden → 403 FORBIDDEN', () => {
    const p = toProblem(new Forbidden('accounting.entry.post'), 'r');
    expect([p.status, p.code]).toEqual([403, 'FORBIDDEN']);
  });

  it('ZodError → 422 VALIDATION_FAILED con errors[] por campo', () => {
    const r = z.object({ lines: z.array(z.string()).min(2) }).safeParse({ lines: ['a'] });
    expect(r.success).toBe(false);
    const p = toProblem((r as { error: Error }).error, 'r');
    expect([p.status, p.code]).toEqual([422, 'VALIDATION_FAILED']);
    expect(p.errors?.[0]?.field).toBe('lines');
  });

  it('un error desconocido → 500 sin filtrar mensaje, traza ni SQL', () => {
    const p = toProblem(new Error('SELECT * FROM acc.journal_entry -- secreto'), 'r');
    expect(p.status).toBe(500);
    expect(JSON.stringify(p)).not.toMatch(/SELECT|secreto|at /);
  });
});
