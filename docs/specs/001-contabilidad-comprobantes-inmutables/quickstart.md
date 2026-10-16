# Quickstart — Contabilidad con comprobantes inmutables

**Spec**: [`spec.md`](spec.md) · **Plan**: [`plan.md`](plan.md)

Guía para levantar el entorno y comprobar el feature de principio a fin una vez implementado. No contiene código
de la implementación; usa solo comandos y llamadas HTTP.

> **Estado:** verificado de punta a punta el 2026-10-14 contra PostgreSQL 16 (ver T094 en `tasks.md`).

## 1. Requisitos

| Herramienta | Versión |
|---|---|
| Node.js | ≥ 22.18 (`.nvmrc`) |
| npm | ≥ 11.20.0 (`npm install -g npm@11.20.0`; npm 10 falla al resolver el árbol de dependencias) |
| PostgreSQL 16 | con Docker (`infra/docker-compose.dev.yml`) o sin Docker (`infra/postgres/local-cluster.sh start`, puerto 54329) |

> npm 11 bloquea los *scripts* de instalación salvo los aprobados en `allowScripts` del `package.json` raíz
> (`@prisma/engines`, `prisma`, `esbuild`). `.npmrc` activa `engine-strict` para exigir las versiones de Node y npm.

## 2. Levantar el entorno

```bash
npm install
npm run build -w @sifca/contracts                         # esquemas Zod compilados (los consume la API)
npm run prisma:generate -w @sifca/api                     # cliente de Prisma (src/generated/, no se versiona)

# Base de datos (los roles sifca_owner / sifca_app / sifca_readonly los crea infra/postgres/init/00-roles.sql)
docker compose -f infra/docker-compose.dev.yml up -d         # o: infra/postgres/local-cluster.sh start
psql "$ADMIN_URL/postgres" -f infra/postgres/init/00-roles.sql   # solo si no usas el compose (ADMIN_URL = superusuario)
psql "$ADMIN_URL/postgres" -c "CREATE DATABASE sifca OWNER sifca_owner"
psql "$ADMIN_URL/sifca" -c "CREATE EXTENSION IF NOT EXISTS btree_gist"

export DATABASE_MIGRATION_URL=postgresql://sifca_owner:sifca_owner_dev@127.0.0.1:5432/sifca   # rol propietario
export DATABASE_URL=postgresql://sifca_app:sifca_app_dev@127.0.0.1:5432/sifca                 # rol de la aplicación
export JWT_DEV_SECRET=quickstart-secret-0123456789                                            # solo desarrollo
export SIFCA_TENANT_ID=0195f3a0-0000-7000-8000-00000000d00d

npm run prisma:migrate -w @sifca/api                      # migraciones (RLS, REVOKE, triggers) como sifca_owner
npm run prisma:drift -w @sifca/api                        # «No difference detected»: schema.prisma = base migrada
npm run seed:test-chart -w @sifca/api                     # plan de cuentas de PRUEBA, tipos de comprobante y año 2026 (no es el PUC real)
npm run start:dev -w @sifca/api                           # API en http://localhost:3000/api/v1 (Swagger UI en /api/docs)
```

La aplicación se conecta con `sifca_app` (sin `UPDATE`/`DELETE` sobre los comprobantes); las migraciones y la siembra
usan `sifca_owner`. Con `NODE_ENV=production` la API **se niega a arrancar** mientras exista el adaptador provisional
de autenticación (falta la spec de IAM).

## 3. Recorrido manual (las tres historias)

```bash
export TOKEN=$(npm run -s dev:token -w @sifca/api)        # JWT de desarrollo con los permisos de contracts/ports.md §5
api() { curl -sS -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "$@"; }

# US1 — Contabilizar un comprobante que cuadra  → 201, number = 1
api -X POST localhost:3000/api/v1/accounting/journal-entries -H 'Idempotency-Key: demo-0001' -d '{
  "voucherType":"AJ","accountingDate":"2026-10-14","description":"Venta de contado",
  "lines":[{"accountCode":"1105","debit":"100000.00"},{"accountCode":"4135","credit":"100000.00"}]}'

# US1 — Descuadrado → 422 ENTRY_NOT_BALANCED y NO consume consecutivo
api -X POST localhost:3000/api/v1/accounting/journal-entries -d '{
  "voucherType":"AJ","accountingDate":"2026-10-14","description":"Descuadrado",
  "lines":[{"accountCode":"1105","debit":"100000.00"},{"accountCode":"4135","credit":"99999.99"}]}'

ENTRY_ID=$(api "localhost:3000/api/v1/accounting/journal-entries?limit=1" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")

# US2 — Editar o borrar → 405 ENTRY_IMMUTABLE
api -X DELETE localhost:3000/api/v1/accounting/journal-entries/$ENTRY_ID

# US2 — Reversar → 201 (efecto neto 0); reversar de nuevo → 409 ALREADY_REVERSED
api -X POST localhost:3000/api/v1/accounting/journal-entries/$ENTRY_ID/reversal -d '{"reason":"Error de digitación"}'

# US3 — Balance de prueba a fin de octubre
api "localhost:3000/api/v1/accounting/reports/trial-balance?from=2026-10-01&to=2026-10-31"

# US3 — Cerrar el período (falla con 409 PERIOD_CLOSE_BLOCKED si hay borradores)
PERIOD_ID=$(api "localhost:3000/api/v1/accounting/periods?year=2026" | python3 -c "import sys,json; print([p for p in json.load(sys.stdin)['data'] if p['month']==10][0]['id'])")
api -X POST localhost:3000/api/v1/accounting/periods/$PERIOD_ID/close
```

> La fecha de hoy se toma en hora de Colombia (R-CON-014): una reversión sin `accountingDate` a las 23:00 del 13 de
> octubre en Bogotá (04:00 UTC del 14) queda fechada el 13.

## 4. Comprobar la inmutabilidad directamente en la base

Con el rol de la aplicación, cualquier mutación debe fallar:

```bash
PGPASSWORD=sifca_app_dev psql -h 127.0.0.1 -U sifca_app sifca -c "UPDATE acc.journal_entry SET description='x'"
# ERROR:  permission denied for table journal_entry

PGPASSWORD=sifca_owner_dev psql -h 127.0.0.1 -U sifca_owner sifca -c "BEGIN" -c "SELECT set_config('app.tenant_id','$SIFCA_TENANT_ID',true)" -c "DELETE FROM acc.journal_line"
# ERROR:  IMMUTABLE_RECORD: DELETE on acc.journal_line is not allowed   (trigger; protege incluso al propietario)
```

## 5. Ejecutar las pruebas

```bash
export SIFCA_TEST_PG_ADMIN_URL=postgresql://postgres@127.0.0.1:54329/postgres   # sin esto se usa Testcontainers (requiere Docker)
npm run test:unit -w @sifca/api          # dominio y casos de uso (sin base de datos)
npm run test:integration -w @sifca/api   # Testcontainers: triggers, privilegios, RLS, concurrencia, atomicidad
npm run test:acceptance -w @sifca/api    # Cucumber ejecuta docs/specs/001-…/acceptance/comprobantes.feature
npm run test:contract -w @sifca/api      # respuestas ⊂ contracts/accounting.v1.openapi.yaml
npm run test:arch -w @sifca/api          # reglas D-1…D-7, ciclos, sin number monetario
npm run test:perf -w @sifca/api          # 1.000 contabilizaciones simultáneas y balance de 1.000.000 de líneas
node scripts/docs.mjs check --strict # documentación y trazabilidad
```

## 6. Criterios de «listo» del feature

| Criterio | Cómo se comprueba |
|---|---|
| Los 13 escenarios `[001-01]…[001-13]` pasan | `test:acceptance` (ningún escenario `undefined` o `pending`) |
| SC-001 — 100 % de los guardados cuadra | propiedad con `fast-check` + *constraint trigger* |
| SC-002 — ninguna vía permite mutar | pruebas de API (405), de rol `sifca_app` y de propietario |
| SC-003 — 1.000 contabilizaciones simultáneas sin saltos ni duplicados | `test:perf` verifica números contiguos 1…1000 |
| SC-004 — balance de referencia 2.152.000 / 2.152.000 | escenario [001-11] |
| Reglas R-CON-001…009 y 013 con ✅ del contador | `scripts/check-rules-verified.mjs` (bloquea el *release* de producción, no el desarrollo) |
