# SIFCA

**Sistema Integral Fiscal y Contable Ágil** — plataforma SaaS multiempresa (vitrina pública + back-office ERP
contable) para empresas colombianas, construida desde cero sobre normatividad pública colombiana, el Anexo
Técnico de la DIAN y buenas prácticas de usabilidad.

> **Estado: Fase 1 — Especificaciones.** Todavía no hay código de aplicación.

Empieza por [`docs/constitution.md`](docs/constitution.md) y [`docs/README.md`](docs/README.md).

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
