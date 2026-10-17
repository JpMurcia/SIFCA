# SIFCA

**Sistema Integral Fiscal y Contable Ágil** — plataforma SaaS multiempresa (vitrina pública + back-office ERP
contable) para empresas colombianas, construida desde cero sobre normatividad pública colombiana, el Anexo
Técnico de la DIAN y buenas prácticas de usabilidad.

> **Estado (16-oct-2026):** especificaciones completas (Fase 1), **backend de contabilidad implementado y probado**
> (spec 001: 93 de 94 tareas; la restante espera la validación del contador) y **mockups auditados** (7 tandas,
> 141 vistas). La construcción sigue la [hoja de ruta de 25 specs](docs/roadmap-specs.md); todavía **no hay
> interfaz de usuario**. Resumen completo: [`docs/informe-del-proyecto.md`](docs/informe-del-proyecto.md).

Empieza por el [informe del proyecto](docs/informe-del-proyecto.md), la [constitución](docs/constitution.md), la [hoja de ruta por specs](docs/roadmap-specs.md) y [`docs/README.md`](docs/README.md).

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

## Avance de specs

Orden de construcción y dependencias completas: [`docs/roadmap-specs.md`](docs/roadmap-specs.md) §2.
Estado: ✅ entregada · 🟡 spec escrita, sin implementar · 🆕 por especificar. Actualiza esta tabla al cerrar cada spec.

| Sec. | Spec | Ola | Estado | Depende de |
|---:|---|:-:|:-:|---|
| 1 | 000 Fundaciones backend (monorepo, RLS, `problem+json`, OpenAPI) | 0 | ✅ | — |
| 2 | [016](docs/specs/016-fundaciones-frontend/spec.md) Fundaciones frontend (`apps/admin`, tokens, estados globales) | 0 | 🟡 | 000 |
| 3 | [012](docs/specs/012-autenticacion-y-sesiones/spec.md) Autenticación y sesiones | 1 | 🟡 | 000, 016 |
| 4 | [017](docs/specs/017-usuarios-roles-permisos/spec.md) Usuarios, roles y permisos | 1 | 🟡 | 012 |
| 5 | [013](docs/specs/013-configuracion-empresa/spec.md) Configuración por empresa | 1 | 🟡 | 017 |
| 6 | [001](docs/specs/001-contabilidad-comprobantes-inmutables/spec.md) Motor contable inmutable, períodos y libros | 2 | ✅ 93/94 | 000 |
| 7 | [018](docs/specs/018-plan-de-cuentas-puc/spec.md) Plan de cuentas (PUC) | 2 | 🟡 | 001, 013 |
| 8 | [019](docs/specs/019-estados-financieros-niif/spec.md) Estados financieros NIIF Pymes | 2 | 🟡 | 018 |
| 9 | 020 Terceros | 3 | 🆕 | 013 |
| 10 | 021 Ítems y bodegas | 3 | 🆕 | 013 |
| 11 | [006](docs/specs/006-inventario-kardex-costeo/spec.md) Kardex y costeo | 3 | 🟡 | 018, 021 |
| 12 | [007](docs/specs/007-clasificacion-abc-y-conteos/spec.md) ABC, conteos y ajustes | 3 | 🟡 | 006 |
| 13 | [008](docs/specs/008-punto-de-reorden/spec.md) Punto de reorden | 3 | 🟡 | 007 |
| 14 | [010](docs/specs/010-motor-impuestos-y-retenciones/spec.md) Impuestos y retenciones | 4 | 🟡 | 018, 020, 021 |
| 15 | 022 Cotizaciones, pedidos y crédito | 4 | 🆕 | 006, 010 |
| 16 | [002](docs/specs/002-emision-factura-venta/spec.md) Factura de venta | 4 | 🟡 | 022 |
| 17 | [009](docs/specs/009-facturacion-electronica-pta/spec.md) Factura electrónica (PTA) | 4 | 🟡 | 002 |
| 18 | [003](docs/specs/003-ventas-credito-y-cartera/spec.md) Cartera y recibos | 4 | 🟡 | 002 |
| 19 | [004](docs/specs/004-devoluciones-ventas-nota-credito/spec.md) Notas crédito/débito | 4 | 🟡 | 003, 009 |
| 20 | [005](docs/specs/005-compras-y-devolucion-proveedor/spec.md) Compras y devolución a proveedor | 5 | 🟡 | 008, 010 |
| 21 | [011](docs/specs/011-multitenancy-api-y-webhooks/spec.md) API Keys, *outbox* y webhooks | 6 | 🟡 | 017, 002 |
| 22 | 014 Conectores (Alegra, CSV/XLSX) | 6 | 🆕 | 013 |
| 23 | 015 Migración de datos | 6 | 🆕 | 014, 003, 005 |
| 24 | 024 Vitrina pública `/:slug/tienda` | 6 | 🆕 | 022, 011 |
| 25 | 025 App móvil: POS y cobranza | 6 | 🆕 | 003, 012 |

> **Antes de la UI de la Ola 4** hace falta una tanda de diseño con las brechas G-01…G-05 (retenciones de crédito,
> detalle de factura, recibo de caja web, estados financieros y reposición por ROP) y corregir los NIT de las
> maquetas, cuyo dígito de verificación es inválido (G-06). Ver [`docs/roadmap-specs.md`](docs/roadmap-specs.md) §1.3.

## Verificar la documentación

```bash
node scripts/docs.mjs check --strict
```

## Qué hay en el repositorio

| Ruta | Contenido | Estado |
|---|---|---|
| [`docs/`](docs/README.md) | Constitución, 11 especificaciones con escenarios Gherkin, 95 reglas normativas, arquitectura, ADR, flujos, **diseño de interfaz** | ✅ |
| [`docs/roadmap-specs.md`](docs/roadmap-specs.md) | Auditoría de mockups, hoja de ruta de 25 specs con dependencias y plan de datos semilla | ✅ |
| [`docs/04-diseno-ux/`](docs/04-diseno-ux/README.md) | Brief para **Claude Design**, navegación, catálogo de pantallas, sistema de diseño, benchmark, **integraciones y migración de datos** | ✅ propuesta |
| `apps/api/` | API NestJS (Clean Architecture): módulo `accounting` completo, migraciones SQL con inmutabilidad y RLS | ✅ spec 001 |
| `packages/contracts/` | Esquemas Zod: única fuente de verdad de los contratos | ✅ |
| `apps/admin`, `apps/storefront`, `apps/mobile` | Back-office (Vite), vitrina (Next.js), móvil (Expo) | ⏳ sin crear |
| `scripts/` | `docs.mjs` (gobernanza documental) y `check-rules-verified.mjs` (puerta de producción) | ✅ |
| `infra/` | PostgreSQL de desarrollo (Docker o sin Docker) y roles | ✅ |

## Inicializar el entorno local

Requisitos: Node 22.18+ (`.nvmrc`), **npm ≥ 11.20.0** (`npm install -g npm@11.20.0`) y PostgreSQL 16+ (Docker o el clúster local sin Docker).

```bash
# 1. Dependencias y código generado
npm install
npm run build -w @sifca/contracts
npm run prisma:generate -w @sifca/api

# 2. Base de datos (elige una)
infra/postgres/local-cluster.sh start                    # sin Docker, puerto 54329
docker compose -f infra/docker-compose.dev.yml up -d     # con Docker, puerto 5432

# 3. Migraciones (inmutabilidad, RLS y roles) con el rol propietario; ajusta host, puerto y base a tu opción
export DATABASE_MIGRATION_URL=postgresql://sifca_owner:sifca_owner_dev@127.0.0.1:5432/sifca
export DATABASE_URL=postgresql://sifca_app:sifca_app_dev@127.0.0.1:5432/sifca
npm run prisma:migrate -w @sifca/api
```

Paso a paso (creación de la base y roles, arranque de la API): [`quickstart.md`](docs/specs/001-contabilidad-comprobantes-inmutables/quickstart.md).

### Datos semilla

| Comando | Qué siembra | Disponible |
|---|---|---|
| `SIFCA_TENANT_ID=<uuid> npm run seed:test-chart -w @sifca/api` | Plan de cuentas de prueba, tipos de comprobante y año fiscal 2026 para un tenant | ✅ hoy |
| `JWT_DEV_SECRET=… SIFCA_TENANT_ID=<uuid> npm run dev:token -w @sifca/api` | JWT de desarrollo con todos los permisos de contabilidad (adaptador provisional) | ✅ hoy |
| `npm run db:seed -w @sifca/api` (perfil `base`) | Comercializadora Andina S.A.S. (NIT 900.123.456-8), usuarios `admin@`, `aux@` y `ventas@andina.com`, PUC base, impuestos y UVT 2026, 5 ítems con kardex, 3 clientes, apertura de $ 1.000.000 | ⏳ con las specs 013, 018, 020 y 021 |
| `SEED_PROFILE=demo npm run db:seed -w @sifca/api` | Facturas, nota crédito y recibo por casos de uso: cartera al día, en alerta y en mora | ⏳ con las specs 002, 003, 004 y 009 |
| `npm run db:seed:verify -w @sifca/api` | Comprueba balance cuadrado, kardex = 1435, cartera = 1305 y estados de crédito | ⏳ con el perfil `base` |

Las semillas se niegan a correr con `NODE_ENV=production`; las contraseñas salen de `SIFCA_SEED_PASSWORD` y se
convierten a argon2id al sembrar (no se versionan hashes). Plan completo y cifras esperadas:
[`docs/roadmap-specs.md`](docs/roadmap-specs.md) §3.

### Probar el backend de contabilidad

```bash
export SIFCA_TEST_PG_ADMIN_URL=postgresql://postgres@127.0.0.1:54329/postgres
npm run test:unit -w @sifca/api && npm run test:integration -w @sifca/api && npm run test:acceptance -w @sifca/api
```

Recorrido manual de la API: [`quickstart.md`](docs/specs/001-contabilidad-comprobantes-inmutables/quickstart.md).

> **No se despliega a producción** mientras un contador no valide las reglas contables (constitución VII):
> `node scripts/check-rules-verified.mjs docs/specs/001-contabilidad-comprobantes-inmutables` falla hasta entonces.
