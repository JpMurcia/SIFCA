/**
 * `npm run dev:token -w @sifca/api` — imprime un JWT de DESARROLLO (HS256) con todos los permisos de contabilidad.
 * Variables: JWT_DEV_SECRET (obligatoria), SIFCA_TENANT_ID (obligatoria), SIFCA_USER_ID (opcional).
 * Es el adaptador provisional hasta que exista la spec de IAM (no sirve en producción).
 */
import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';

const secret = process.env.JWT_DEV_SECRET;
const tenant = process.env.SIFCA_TENANT_ID;
if (!secret || !tenant) {
  console.error('Falta JWT_DEV_SECRET o SIFCA_TENANT_ID');
  process.exit(1);
}
const perms = ['accounting.entry.post', 'accounting.entry.reverse', 'accounting.report.read', 'accounting.period.manage', 'accounting.period.close', 'accounting.period.reopen', 'accounting.year.close'];
const token = await new SignJWT({ tid: tenant, perms })
  .setProtectedHeader({ alg: 'HS256' })
  .setSubject(process.env.SIFCA_USER_ID ?? randomUUID())
  .setIssuedAt()
  .setExpirationTime('8h')
  .sign(new TextEncoder().encode(secret));
console.log(token);
