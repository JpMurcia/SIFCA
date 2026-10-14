# Quickstart — Contabilidad con comprobantes inmutables

**Spec**: [`spec.md`](spec.md) · **Plan**: [`plan.md`](plan.md)

Guía para levantar el entorno y comprobar el feature de principio a fin una vez implementado. No contiene código
de la implementación; usa solo comandos y llamadas HTTP.

> **Estado:** este documento describe el comportamiento objetivo. Los comandos existirán cuando se completen las
> fases *Setup* y *Foundational* de `tasks.md`.

## 1. Requisitos

| Herramienta | Versión |
|---|---|
| Node.js | ≥ 22.18 (`.nvmrc`) |
| pnpm | 12.x |
| Docker | para PostgreSQL 16 y Testcontainers |

## 2. Levantar el entorno

```bash
pnpm install
docker compose -f infra/docker-compose.dev.yml up -d        # PostgreSQL con los roles sifca_owner / sifca_app / sifca_readonly
pnpm --filter api prisma migrate deploy                      # migraciones (incluye RLS, REVOKE y triggers)
pnpm --filter api run seed:test-chart                        # plan de cuentas de PRUEBA y tipos de comprobante (no es el PUC real)
pnpm --filter api run start:dev                              # API en http://localhost:3000/api/v1
```

La aplicación se conecta con `sifca_app` (sin `UPDATE`/`DELETE` sobre los comprobantes); las migraciones usan
`sifca_owner`.

## 3. Recorrido manual (las tres historias)

Se asume un token de desarrollo con los permisos de `contracts/ports.md` §5 en `$TOKEN`.

```bash
api() { curl -sS -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "$@"; }

# 0) Crear el año fiscal (12 períodos abiertos)
api -X POST localhost:3000/api/v1/accounting/fiscal-years -d '{"year":2026}'

# US1 — Contabilizar un comprobante que cuadra  → 201, number = 1
api -X POST localhost:3000/api/v1/accounting/journal-entries -H 'Idempotency-Key: demo-0001' -d '{
  "voucherType":"AJ","accountingDate":"2026-10-14","description":"Venta de contado",
  "lines":[{"accountCode":"1105","debit":"100000.00"},{"accountCode":"4135","credit":"100000.00"}]}'

# US1 — Descuadrado → 422 ENTRY_NOT_BALANCED y NO consume consecutivo
api -X POST localhost:3000/api/v1/accounting/journal-entries -d '{
  "voucherType":"AJ","accountingDate":"2026-10-14","description":"Descuadrado",
  "lines":[{"accountCode":"1105","debit":"100000.00"},{"accountCode":"4135","credit":"99999.99"}]}'

# US2 — Editar o borrar → 405 ENTRY_IMMUTABLE
api -X DELETE localhost:3000/api/v1/accounting/journal-entries/$ENTRY_ID

# US2 — Reversar → 201 (efecto neto 0); reversar de nuevo → 409 ALREADY_REVERSED
api -X POST localhost:3000/api/v1/accounting/journal-entries/$ENTRY_ID/reversal -d '{"reason":"Error de digitación"}'

# US3 — Balance de prueba a fin de octubre
api "localhost:3000/api/v1/accounting/reports/trial-balance?from=2026-10-01&to=2026-10-31"

# US3 — Cerrar el período (falla con 409 PERIOD_CLOSE_BLOCKED si hay borradores)
api -X POST localhost:3000/api/v1/accounting/periods/$PERIOD_ID/close
```

## 4. Comprobar la inmutabilidad directamente en la base

Con el rol de la aplicación, cualquier mutación debe fallar:

```bash
psql "postgresql://sifca_app:***@localhost:5432/sifca" -c "UPDATE acc.journal_entry SET description='x'"
# ERROR:  permission denied for table journal_entry

psql "postgresql://sifca_owner:***@localhost:5432/sifca" -c "DELETE FROM acc.journal_line"
# ERROR:  IMMUTABLE_RECORD: DELETE on acc.journal_line is not allowed   (trigger; protege incluso al propietario)
```

## 5. Ejecutar las pruebas

```bash
pnpm --filter api test:unit          # dominio y casos de uso (sin base de datos)
pnpm --filter api test:integration   # Testcontainers: triggers, privilegios, RLS, concurrencia, atomicidad
pnpm --filter api test:acceptance    # Cucumber ejecuta docs/specs/001-…/acceptance/comprobantes.feature
pnpm --filter api test:contract      # respuestas ⊂ contracts/accounting.v1.openapi.yaml
pnpm --filter api test:arch          # reglas D-1…D-7, ciclos, sin number monetario
pnpm --filter api test:perf          # 1.000 contabilizaciones simultáneas y balance de 1.000.000 de líneas
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
