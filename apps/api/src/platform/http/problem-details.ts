import { ZodError } from 'zod';
import { DomainError, Forbidden, type Violation } from '../../shared-kernel/index.js';

export interface ProblemBody {
  type: string;
  title: string;
  status: number;
  detail?: string;
  code: string;
  requestId?: string;
  errors?: Array<{ field: string; message: string; rule?: string }>;
}

const MAP: Record<string, { status: number; title: string }> = {
  ENTRY_NOT_BALANCED: { status: 422, title: 'El comprobante no cuadra' },
  VALIDATION_FAILED: { status: 422, title: 'La solicitud no es válida' },
  PERIOD_CLOSED: { status: 409, title: 'El período contable está cerrado' },
  PERIOD_NOT_FOUND: { status: 422, title: 'No existe un período para esa fecha' },
  ALREADY_REVERSED: { status: 409, title: 'El comprobante ya fue reversado' },
  ENTRY_IMMUTABLE: { status: 405, title: 'El comprobante es inmutable' },
  PERIOD_CLOSE_BLOCKED: { status: 409, title: 'El período no se puede cerrar' },
  FORBIDDEN: { status: 403, title: 'Operación no permitida' },
  UNAUTHENTICATED: { status: 401, title: 'No autenticado' },
  NOT_FOUND: { status: 404, title: 'No encontrado' },
  CONFLICT: { status: 409, title: 'Conflicto de estado' },
  IDEMPOTENCY_CONFLICT: { status: 422, title: 'La clave de idempotencia ya se usó con otro cuerpo' },
};

const slug = (code: string) => code.toLowerCase().replaceAll('_', '-');
const typeOf = (code: string) => `https://sifca.example/problems/${slug(code)}`;

/** Traduce cualquier error a un Problem (RFC 9457) sin filtrar trazas, SQL ni detalles internos. */
export function toProblem(error: unknown, requestId: string): ProblemBody {
  if (error instanceof ZodError) {
    const errors: Violation[] = error.issues.map((i) => ({ field: i.path.join('.') || '(body)', message: i.message }));
    return { type: typeOf('VALIDATION_FAILED'), title: MAP.VALIDATION_FAILED!.title, status: 422, code: 'VALIDATION_FAILED', requestId, errors };
  }
  if (error instanceof Forbidden) {
    return { type: typeOf('FORBIDDEN'), title: MAP.FORBIDDEN!.title, status: 403, code: 'FORBIDDEN', detail: error.message, requestId };
  }
  if (error instanceof DomainError) {
    const m = MAP[error.code];
    if (m) {
      const body: ProblemBody = { type: typeOf(error.code), title: m.title, status: m.status, code: error.code, detail: error.message, requestId };
      if (error.violations.length > 0) body.errors = error.violations.map((v) => ({ ...v }));
      return body;
    }
  }
  const status = (error as { status?: number } | null)?.status;
  if (status === 404) return { type: typeOf('NOT_FOUND'), title: MAP.NOT_FOUND!.title, status: 404, code: 'NOT_FOUND', requestId };
  if (status === 405) return { type: typeOf('ENTRY_IMMUTABLE'), title: 'Método no permitido', status: 405, code: 'ENTRY_IMMUTABLE', requestId };
  if (status === 401) return { type: typeOf('UNAUTHENTICATED'), title: MAP.UNAUTHENTICATED!.title, status: 401, code: 'UNAUTHENTICATED', requestId };
  return {
    type: 'about:blank',
    title: 'Error interno',
    status: 500,
    code: 'INTERNAL_ERROR',
    detail: 'Ocurrió un error inesperado.',
    requestId,
  };
}
