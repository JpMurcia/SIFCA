export class Forbidden extends Error {
  readonly code = 'FORBIDDEN';
  constructor(readonly permission: string) {
    super(`Falta el permiso ${permission}`);
    this.name = 'Forbidden';
  }
}

export interface PermissionChecker {
  /** Lanza `Forbidden` si el usuario actual no tiene el permiso. */
  assert(permission: string): void;
}

export const PERMISSION_CHECKER = Symbol('PermissionChecker');
