import type { TenantId, UserId } from '../ids.js';

export interface RequestContext {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly permissions: ReadonlySet<string>;
  readonly requestId: string;
}

/** Entrega el contexto de la solicitud en curso (tenant, usuario, permisos). */
export interface RequestContextPort {
  current(): RequestContext;
}

export const REQUEST_CONTEXT = Symbol('RequestContext');
