import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const API_ROOT = join(here, '..', '..', '..');
const MIGRATIONS_DIR = join(API_ROOT, 'prisma', 'migrations');
const ROLES_SQL = join(API_ROOT, '..', '..', 'infra', 'postgres', 'init', '00-roles.sql');

export const TEMPLATE_DB = 'sifca_tpl';
export const PASSWORDS = { sifca_owner: 'sifca_owner_dev', sifca_app: 'sifca_app_dev', sifca_readonly: 'sifca_readonly_dev' } as const;

export function adminUrlFromEnv(): string {
  const url = process.env.SIFCA_TEST_PG_ADMIN_URL;
  if (!url) throw new Error('Falta SIFCA_TEST_PG_ADMIN_URL (lo fija global-setup).');
  return url;
}

function withDb(url: string, db: string): string {
  const u = new URL(url);
  u.pathname = `/${db}`;
  return u.toString();
}

function withUser(url: string, user: keyof typeof PASSWORDS, db: string): string {
  const u = new URL(url);
  u.username = user;
  u.password = PASSWORDS[user];
  u.pathname = `/${db}`;
  return u.toString();
}

async function adminQuery(adminUrl: string, sql: string, db = 'postgres'): Promise<void> {
  const c = new pg.Client({ connectionString: withDb(adminUrl, db) });
  await c.connect();
  try {
    await c.query(sql);
  } finally {
    await c.end();
  }
}

export async function ensureRoles(adminUrl: string): Promise<void> {
  await adminQuery(adminUrl, readFileSync(ROLES_SQL, 'utf8'));
}

export async function recreateTemplate(adminUrl: string): Promise<void> {
  await adminQuery(adminUrl, `DROP DATABASE IF EXISTS ${TEMPLATE_DB} WITH (FORCE)`);
  await adminQuery(adminUrl, `CREATE DATABASE ${TEMPLATE_DB} OWNER sifca_owner`);
}

/** Aplica, como `sifca_owner`, todas las migraciones SQL en orden lexicográfico a la base plantilla. */
export async function applyMigrations(adminUrl: string): Promise<void> {
  // btree_gist es de confianza (PG13+) pero lo crea el superusuario para no depender de privilegios del propietario.
  await adminQuery(adminUrl, 'CREATE EXTENSION IF NOT EXISTS btree_gist', TEMPLATE_DB);
  let dirs: string[] = [];
  try {
    dirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
  } catch {
    dirs = [];
  }
  const owner = new pg.Client({ connectionString: withUser(adminUrl, 'sifca_owner', TEMPLATE_DB) });
  await owner.connect();
  try {
    for (const d of dirs) {
      const sql = readFileSync(join(MIGRATIONS_DIR, d, 'migration.sql'), 'utf8');
      try {
        await owner.query(sql);
      } catch (e) {
        throw new Error(`Falló la migración ${d}: ${(e as Error).message}`);
      }
    }
  } finally {
    await owner.end();
  }
}

export interface TestDb {
  readonly name: string;
  readonly urls: { owner: string; app: string; readonly: string; admin: string };
  readonly owner: pg.Pool;
  readonly app: pg.Pool;
  readonly admin: pg.Pool;
  /** Ejecuta `fn` en una transacción con `app.tenant_id` fijado (como el UnitOfWork) usando el rol de la aplicación. */
  withTenant<T>(tenantId: string, fn: (c: pg.PoolClient) => Promise<T>, pool?: pg.Pool): Promise<T>;
  close(): Promise<void>;
}

/** Clona la plantilla en una base nueva y devuelve pools para cada rol. */
export async function createTestDatabase(): Promise<TestDb> {
  const adminUrl = adminUrlFromEnv();
  const name = `t_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
  await adminQuery(adminUrl, `CREATE DATABASE ${name} TEMPLATE ${TEMPLATE_DB} OWNER sifca_owner`);
  const urls = {
    admin: withDb(adminUrl, name),
    owner: withUser(adminUrl, 'sifca_owner', name),
    app: withUser(adminUrl, 'sifca_app', name),
    readonly: withUser(adminUrl, 'sifca_readonly', name),
  };
  const owner = new pg.Pool({ connectionString: urls.owner, max: 4 });
  const app = new pg.Pool({ connectionString: urls.app, max: 10 });
  const admin = new pg.Pool({ connectionString: urls.admin, max: 2 });
  return {
    name,
    urls,
    owner,
    app,
    admin,
    async withTenant(tenantId, fn, pool = app) {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        await c.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
        const r = await fn(c);
        await c.query('COMMIT');
        return r;
      } catch (e) {
        await c.query('ROLLBACK').catch(() => undefined);
        throw e;
      } finally {
        c.release();
      }
    },
    async close() {
      await Promise.allSettled([owner.end(), app.end(), admin.end()]);
      await adminQuery(adminUrl, `DROP DATABASE IF EXISTS ${name} WITH (FORCE)`).catch(() => undefined);
    },
  };
}

/**
 * Prepara PostgreSQL para una corrida de pruebas: usa `SIFCA_TEST_PG_ADMIN_URL` si existe (clúster local o servicio
 * de CI) o, si no, levanta un contenedor de Testcontainers. Crea la plantilla con roles y migraciones.
 * Devuelve la función que libera los recursos.
 */
export async function bootstrapPostgres(): Promise<() => Promise<void>> {
  let stop: (() => Promise<void>) | undefined;
  if (!process.env.SIFCA_TEST_PG_ADMIN_URL) {
    const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
    const container = await new PostgreSqlContainer('postgres:16').start();
    process.env.SIFCA_TEST_PG_ADMIN_URL = container.getConnectionUri();
    stop = async () => {
      await container.stop();
    };
  }
  const adminUrl = adminUrlFromEnv();
  await ensureRoles(adminUrl);
  await recreateTemplate(adminUrl);
  await applyMigrations(adminUrl);
  return async () => {
    if (stop) await stop();
  };
}
