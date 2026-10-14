import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../../src/platform/config/env.schema.js';
import { createRequestContextMiddleware, AlsRequestContext } from '../../../src/platform/http/request-context.js';

const SECRET = 'unit-test-secret-0123456789';
const key = new TextEncoder().encode(SECRET);
const baseEnv = { DATABASE_URL: 'postgresql://x', JWT_DEV_SECRET: SECRET };

describe('configuración', () => {
  it('falla al arrancar si falta algo o el secreto es corto', () => {
    expect(() => loadEnv({ ...baseEnv, DATABASE_URL: '' } as never)).toThrow(/Configuración inválida/);
    expect(() => loadEnv({ ...baseEnv, JWT_DEV_SECRET: 'corto' } as never)).toThrow(/Configuración inválida/);
    expect(loadEnv({ ...baseEnv, NODE_ENV: 'test' } as never).TX_TIMEOUT_MS).toBe(15_000);
  });

  it('el adaptador provisional de autenticación NO arranca en producción (falta la spec de IAM)', () => {
    expect(() => loadEnv({ ...baseEnv, NODE_ENV: 'production' } as never)).toThrow(/IAM|producción/);
  });
});

describe('autenticación provisional (JWT de desarrollo)', () => {
  const run = async (authorization?: string) => {
    let status = 0;
    let body: { code?: string } = {};
    let nextCalled = false;
    let seen: string | undefined;
    const res = { status(n: number) { status = n; return { type: () => ({ send: (b: unknown) => { body = b as never; } }) }; } };
    const mw = createRequestContextMiddleware(SECRET);
    await new Promise<void>((resolve) => {
      mw({ headers: authorization ? { authorization } : {} }, res as never, () => { nextCalled = true; seen = AlsRequestContext.current().tenantId; resolve(); });
      setTimeout(resolve, 300);
    });
    return { status, body, nextCalled, seen };
  };
  const token = (claims: Record<string, unknown>, exp: string | null = '1h', sub: string | null = 'user-1') => {
    let j = new SignJWT(claims).setProtectedHeader({ alg: 'HS256' });
    if (sub) j = j.setSubject(sub);
    if (exp) j = j.setExpirationTime(exp);
    return j.sign(key);
  };

  it('acepta un token válido y publica el contexto del tenant', async () => {
    const r = await run(`Bearer ${await token({ tid: 'tenant-1', perms: ['a'] })}`);
    expect(r.nextCalled).toBe(true);
    expect(r.seen).toBe('tenant-1');
  });

  it.each([
    ['sin encabezado', undefined],
    ['esquema distinto de Bearer', 'Basic abc'],
    ['token basura', 'Bearer abc.def.ghi'],
  ])('rechaza %s con 401 UNAUTHENTICATED', async (_n, h) => {
    const r = await run(h);
    expect([r.status, r.body.code, r.nextCalled]).toEqual([401, 'UNAUTHENTICATED', false]);
  });

  it('rechaza tokens vencidos, sin exp, sin sub, sin tid o firmados con otra clave', async () => {
    const other = await new SignJWT({ tid: 't', perms: [] }).setProtectedHeader({ alg: 'HS256' }).setSubject('u').setExpirationTime('1h').sign(new TextEncoder().encode('otra-clave-distinta-0123456789'));
    for (const t of [await token({ tid: 't', perms: [] }, '-1h'), await token({ tid: 't', perms: [] }, null), await token({ tid: 't', perms: [] }, '1h', null), await token({ perms: [] }), other]) {
      const r = await run(`Bearer ${t}`);
      expect([r.status, r.nextCalled]).toEqual([401, false]);
    }
  });

  it('rechaza el algoritmo «none»', async () => {
    const none = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from('{"tid":"t","sub":"u","perms":[],"exp":9999999999}').toString('base64url')}.`;
    expect((await run(`Bearer ${none}`)).status).toBe(401);
  });
});
