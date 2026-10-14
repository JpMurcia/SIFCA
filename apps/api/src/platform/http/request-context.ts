import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { jwtVerify } from 'jose';
import {
  Forbidden,
  type PermissionChecker,
  type RequestContext,
  type RequestContextPort,
  type TenantId,
  type UserId,
} from '../../shared-kernel/index.js';

/**
 * ADAPTADOR PROVISIONAL de autenticación (research §11): lee un JWT HS256 de desarrollo/pruebas con los claims
 * `tid` (tenant), `sub` (usuario) y `perms` (permisos). NO es seguridad de producción: la spec de IAM (spec 012)
 * lo reemplaza. `loadEnv` impide arrancar con NODE_ENV=production mientras exista.
 */
const als = new AsyncLocalStorage<RequestContext>();

export const AlsRequestContext: RequestContextPort = {
  current(): RequestContext {
    const ctx = als.getStore();
    if (!ctx) throw new Error('No hay contexto de solicitud (tenant/usuario)');
    return ctx;
  },
};

export class RequestContextPermissionChecker implements PermissionChecker {
  constructor(private readonly ctx: RequestContextPort) {}
  assert(permission: string): void {
    if (!this.ctx.current().permissions.has(permission)) throw new Forbidden(permission);
  }
}

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return als.run(ctx, fn);
}

type Req = { headers: Record<string, string | string[] | undefined> };
type Res = { status(n: number): { type(t: string): { send(b: unknown): void } } };

export function createRequestContextMiddleware(secret: string) {
  const key = new TextEncoder().encode(secret);
  return (req: Req, res: Res, next: () => void): void => {
    const auth = req.headers.authorization;
    const header = req.headers['x-request-id'];
    const requestId = (Array.isArray(header) ? header[0] : header) ?? randomUUID();
    const token = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7) : undefined;
    const reject = (detail: string) =>
      res.status(401).type('application/problem+json').send({
        type: 'https://sifca.example/problems/unauthenticated',
        title: 'No autenticado',
        status: 401,
        code: 'UNAUTHENTICATED',
        detail,
        requestId,
      });
    if (!token) return reject('Falta el encabezado Authorization: Bearer');
    jwtVerify(token, key, { algorithms: ['HS256'] }).then(
      ({ payload }) => {
        const tid = payload.tid;
        const perms = payload.perms;
        if (typeof tid !== 'string' || typeof payload.sub !== 'string' || !Array.isArray(perms)) {
          return reject('Token sin tid, sub o perms');
        }
        runWithRequestContext(
          { tenantId: tid as TenantId, userId: payload.sub as UserId, permissions: new Set(perms.map(String)), requestId },
          next,
        );
      },
      () => reject('Token inválido o vencido'),
    );
  };
}
