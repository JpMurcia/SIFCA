# SIFCA

**Sistema Integral Fiscal y Contable Ágil** — plataforma SaaS multiempresa (vitrina pública + back-office ERP
contable) para empresas colombianas, construida desde cero sobre normatividad pública colombiana, el Anexo
Técnico de la DIAN y buenas prácticas de usabilidad.

> **Estado (14-oct-2026):** especificaciones completas (Fase 1) y **backend de contabilidad implementado y probado**
> (spec 001: 93 de 94 tareas; la restante espera la validación del contador). Las specs 002–011 siguen sin
> implementar y **no hay interfaz de usuario todavía**: se entrega su especificación para maquetar.
> Resumen completo: [`docs/informe-del-proyecto.md`](docs/informe-del-proyecto.md).

Empieza por el [informe del proyecto](docs/informe-del-proyecto.md), la [constitución](docs/constitution.md) y [`docs/README.md`](docs/README.md).

| | |
|---|---|
| Backend | NestJS en capas Domain → Application → Infrastructure → Presentation (Clean Architecture) |
| Base de datos | PostgreSQL, multiempresa por `tenant_id` con RLS |
| ORM | Prisma (solo en infraestructura) |
| Contratos | Zod como única fuente de verdad; OpenAPI derivado + webhooks firmados |
| Frontend | React (back-office con Vite; vitrina con Next.js) |
| Móvil | React Native / Expo |
| Facturación electrónica | Proveedor Tecnológico Autorizado detrás del puerto `EInvoiceProvider` |
| Metodología | Spec Kit: constitución → especificaciones con escenarios Gherkin → plan → tareas |

## Verificar la documentación

```bash
node scripts/docs.mjs check --strict
```

## Qué hay en el repositorio

| Ruta | Contenido | Estado |
|---|---|---|
| [`docs/`](docs/README.md) | Constitución, 11 especificaciones con escenarios Gherkin, 95 reglas normativas, arquitectura, ADR, flujos, **diseño de interfaz** | ✅ |
| [`docs/04-diseno-ux/`](docs/04-diseno-ux/README.md) | Brief para **Claude Design**, navegación, catálogo de pantallas, sistema de diseño, benchmark, **integraciones y migración de datos** | ✅ propuesta |
| `apps/api/` | API NestJS (Clean Architecture): módulo `accounting` completo, migraciones SQL con inmutabilidad y RLS | ✅ spec 001 |
| `packages/contracts/` | Esquemas Zod: única fuente de verdad de los contratos | ✅ |
| `apps/admin`, `apps/storefront`, `apps/mobile` | Back-office (Vite), vitrina (Next.js), móvil (Expo) | ⏳ sin crear |
| `scripts/` | `docs.mjs` (gobernanza documental) y `check-rules-verified.mjs` (puerta de producción) | ✅ |
| `infra/` | PostgreSQL de desarrollo (Docker o sin Docker) y roles | ✅ |

## Probar el backend de contabilidad

```bash
pnpm install && pnpm --filter @sifca/contracts build && pnpm --filter @sifca/api prisma:generate
infra/postgres/local-cluster.sh start                      # PostgreSQL sin Docker (o: docker compose -f infra/docker-compose.dev.yml up -d)
export SIFCA_TEST_PG_ADMIN_URL=postgresql://postgres@127.0.0.1:54329/postgres
pnpm --filter @sifca/api test:unit && pnpm --filter @sifca/api test:integration && pnpm --filter @sifca/api test:acceptance
```

Recorrido manual de la API: [`quickstart.md`](docs/specs/001-contabilidad-comprobantes-inmutables/quickstart.md).

> **No se despliega a producción** mientras un contador no valide las reglas contables (constitución VII):
> `node scripts/check-rules-verified.mjs docs/specs/001-contabilidad-comprobantes-inmutables` falla hasta entonces.
