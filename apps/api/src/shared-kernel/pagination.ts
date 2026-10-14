export interface PageRequest {
  readonly limit: number;
  readonly cursor?: string | undefined;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

/** Cursor opaco en base64url de un JSON (los repositorios definen su contenido). */
export const encodeCursor = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64url');
export function decodeCursor<T>(cursor: string | undefined): T | undefined {
  if (!cursor) return undefined;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as T;
  } catch {
    throw new RangeError('Cursor inválido');
  }
}
