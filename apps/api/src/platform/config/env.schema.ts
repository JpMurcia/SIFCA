import { z } from 'zod';

/** Configuración validada al arrancar: si falta algo, el proceso falla (research §9). */
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  /** Conexión de la aplicación: rol `sifca_app` (sin UPDATE/DELETE sobre comprobantes). */
  DATABASE_URL: z.string().min(1),
  /** Conexión de migraciones: rol `sifca_owner`. */
  DATABASE_MIGRATION_URL: z.string().min(1).optional(),
  TX_MAX_WAIT_MS: z.coerce.number().int().positive().default(5_000),
  TX_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  /** Secreto del adaptador PROVISIONAL de autenticación (pendiente de la spec de IAM). */
  JWT_DEV_SECRET: z.string().min(16),
});
export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Configuración inválida: ${detail}`);
  }
  if (parsed.data.NODE_ENV === 'production') {
    throw new Error(
      'El adaptador provisional de autenticación no puede usarse en producción: falta la spec de IAM (spec 012).',
    );
  }
  return parsed.data;
}
