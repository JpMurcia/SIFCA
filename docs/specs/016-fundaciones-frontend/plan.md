# Implementation Plan: Fundaciones del back-office web

**Branch**: `016-fundaciones-frontend` | **Date**: 2026-10-16 | **Spec**: [`spec.md`](spec.md)

**Input**: Feature specification from `docs/specs/016-fundaciones-frontend/spec.md`

**Note**: Este plan lo genera `/speckit-plan`. Decisiones y alternativas en [`research.md`](research.md); modelo en
[`data-model.md`](data-model.md); contratos en [`contracts/`](contracts/) (API: `platform.v1.openapi.yaml`;
interfaz: `ui-error-catalog.md` y `ui-registry.md`); validación en [`quickstart.md`](quickstart.md).

## Summary

Crear `apps/admin`, la aplicación web del back-office, con el **marco común** que heredarán todas las pantallas:
cascarón 1440/1024 con menú, barra superior, chip de período y paleta `Ctrl+K`; temas Claro y Slate y tres
densidades con los tokens de las maquetas; componentes de estado global; traducción de cada `code` de
`problem+json` al texto y lugar del catálogo A.0; guardas por permiso; idempotencia en reintentos; formatos `es-CO`
con decimal exacto. Se demuestra con la **lista de comprobantes** sobre la API real de la spec 001 (spec 016: US1–US3
en P1, US4–US6 en P2; FR-001…FR-022).

Enfoque técnico, por zona:

- **`packages/design-tokens`** (nuevo): JSON fuente → `tokens.css` + objeto TS; prueba de contraste AA.
- **`apps/admin/src/ui`**: sistema de diseño sobre Radix UI + Tailwind 4 con variables CSS; estados globales;
  `DataTable` (TanStack Table + Virtual); `Form` (React Hook Form + `zodResolver`); `MoneyText`/`DateText`.
- **`apps/admin/src/platform`**: cliente HTTP único (`fetch`) con validación Zod, `ApiProblem` tolerante, `X-Request-Id`,
  `Idempotency-Key` por intención, sesión (`/me`), permisos, conectividad, preferencias y formatos.
- **`apps/admin/src/shell`**: cascarón, registro de módulos, paleta (cmdk), atajos y páginas 403/404.
- **`apps/admin/src/modules/accounting`**: manifiesto + lista de comprobantes de referencia.
- **API (cambios pequeños)**: `GET /api/v1/me` en la plataforma y filtro opcional `number` en la lista de
  comprobantes; esquemas en `packages/contracts` (`platform/me.ts`, `ProblemEnvelopeSchema` abierto).
- **Pruebas**: Vitest + Testing Library + MSW; Playwright + `playwright-bdd` ejecutando el mismo `.feature`; axe;
  Storybook como catálogo; Lighthouse CI.

## Technical Context

**Language/Version**: TypeScript 5.9.3 (estricto, como `packages/config/tsconfig.base.json`), React 19.3, Node.js ≥ 22.18 para herramientas

**Primary Dependencies**: Vite 8.3 + `@vitejs/plugin-react` 6.1; TanStack Router 1.170, Query 5.104, Table 9.3, Virtual 3.14; `radix-ui` 1.8; Tailwind CSS 4.3 (`@tailwindcss/vite`); React Hook Form 7.90 + `@hookform/resolvers` 5.9; cmdk 1.1.1; decimal.js 10.6.0 (misma que la API); Zod 4.6.7 vía `@sifca/contracts`; fuentes `@fontsource-variable/inter` y `jetbrains-mono`. Versiones exactas; al instalar, la última publicada hace ≥ 14 días de cada línea (ver la introducción de research.md)

**Storage**: Sin base de datos nueva. Almacenamiento local del navegador solo para preferencias y recientes (data-model §5)

**Testing**: Vitest 5.0 (unidad y componentes, jsdom), Testing Library 16.3, MSW 3.0, Playwright 1.64 + playwright-bdd 9.2 (aceptación con el `.feature`), `@axe-core/playwright` 4.14, Storybook 10.6 + addon-a11y, Lighthouse CI, `dependency-cruiser` 18.6 (la del monorepo); en la API, Vitest + supertest para `/me` y el filtro `number`

**Target Platform**: Navegadores de escritorio: dos últimas versiones de Chrome, Edge, Firefox y Safari; anchos 768–1920 px

**Project Type**: Aplicación web (SPA) dentro del monorepo, consumidora de la API existente

**Performance Goals**: SC-004 — primera pantalla usable (LCP) < 2,5 s con 10 Mbps; navegación entre pantallas cargadas < 300 ms; *bundle* inicial ≤ 250 KB gzip (sin pantallas de módulo, que se cargan bajo demanda); lista de 5.000 filas virtualizadas sin cortes (spike S-UI)

**Constraints**: ningún `number` en importes (G-09); el token de desarrollo nunca en el *bundle*; *build* de producción bloqueado sin la spec 012 (FR-021); WCAG 2.1 AA (FR-018); sin CDN externos (fuentes e íconos locales); solo `platform/http` llama a `fetch`

**Scale/Scope**: 6 historias, 22 FR, 12 escenarios; ~25 componentes de UI, 1 pantalla de módulo de referencia, 2 cambios de API; base para ~45 pantallas de las specs siguientes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Fuente: [`docs/constitution.md`](../../constitution.md) (gates G-01…G-12).

| Gate | Pregunta | Antes de la investigación | Después del diseño (Fase 1) |
|---|---|---|---|
| G-01 | ¿Dominio con imports de framework o `Date.now()`? | ✅ No se toca `domain/` de la API | ✅ `/me` vive en `platform/http` (presentación) y usa el puerto `Clock` para `workingDate` |
| G-02 | ¿Puertos en domain/application e implementaciones en infrastructure? | ✅ | ✅ El filtro `number` se agrega al puerto `JournalEntryRepository` (application) y a su implementación Prisma (infrastructure) |
| G-03 | ¿Tipos de Prisma fuera de `infrastructure/`? | ✅ | ✅ El frontend solo ve tipos de `@sifca/contracts`; regla de `dependency-cruiser` impide importar `apps/api` |
| G-04 | ¿Evento comercial en una transacción? | ✅ N/A: no hay eventos comerciales nuevos | ✅ N/A |
| G-05 | ¿Efectos externos dentro de la transacción? | ✅ Ninguno | ✅ Ninguno |
| G-06 | ¿`UPDATE`/`DELETE` sobre tablas inmutables? | ✅ Ninguno | ✅ La UI no ofrece editar ni eliminar documentos inmutables (FR-013, [016-10]) |
| G-07 | ¿Tablas nuevas con `tenant_id`, RLS y prueba? | ✅ Sin tablas nuevas | ✅ `/me` toma la empresa del contexto de la solicitud; prueba de que dos tokens de empresas distintas ven su propia empresa |
| G-08 | ¿Entradas validadas con Zod de `packages/contracts`? | ✅ | ✅ El filtro `number` amplía `ListJournalEntriesQuerySchema`; el cliente valida respuestas con los mismos esquemas (FR-014) |
| G-09 | ¿`number` en cálculos monetarios? | ✅ | ✅ Importes como cadena + decimal.js en el cliente; regla de lint que prohíbe `Number()`/`parseFloat` sobre `MoneyString`; [016-11] |
| G-10 | ¿Reglas ✅ o provisionales? | ⚠️ Cita R-CON-004/005/009/010/011/014, aún 🔶 | ⚠️ **Provisional declarado**, igual que la spec 001: la UI muestra lo que la API ya aplica; la puerta de liberación (`check-rules-verified.mjs`) también cubre esta spec. Además el *build* de producción está bloqueado por FR-021 |
| G-11 | ¿Escenarios etiquetados y matriz al día? | ✅ `[016-01]…[016-12]` | ✅ Ejecutados por `playwright-bdd`; `docs.mjs check --strict` en CI |
| G-12 | ¿Acoplamiento con un sistema externo? | ✅ Ninguno | ✅ Fuentes e íconos autoalojados; sin CDN |

**Resultado**: sin violaciones. Abiertos y rastreados (no son violaciones): G-10 (validación del contador) y la
dependencia de la spec 012 para producción. Ver *Complexity Tracking*.

## Project Structure

### Documentation (this feature)

```text
docs/specs/016-fundaciones-frontend/
├── spec.md
├── plan.md                          # este archivo
├── research.md                      # Fase 0
├── data-model.md                    # Fase 1
├── quickstart.md                    # Fase 1
├── contracts/
│   ├── platform.v1.openapi.yaml     # GET /me + filtro number
│   ├── ui-error-catalog.md          # code → ubicación y texto (A.0)
│   └── ui-registry.md               # cómo un módulo registra pantallas, acciones y búsquedas
├── acceptance/
│   └── fundaciones-frontend.feature
├── checklists/requirements.md
└── tasks.md                         # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
packages/
├── contracts/src/
│   ├── common/problem.ts            # + ProblemEnvelopeSchema (code abierto) y KnownProblemCodes
│   ├── platform/me.ts               # NUEVO: SessionContextSchema
│   └── accounting/journal-entry.ts  # + number en ListJournalEntriesQuerySchema
└── design-tokens/                   # NUEVO
    ├── src/tokens.json              # Claro, Slate, tipografía, espaciado, radios, densidades
    ├── scripts/build.mjs            # → dist/tokens.css + dist/index.js (+ .d.ts)
    └── test/contrast.test.ts        # AA en ambos temas

apps/api/src/
├── platform/http/me.controller.ts   # NUEVO: GET /me (usa RequestContext y Clock)
├── platform/config/env.schema.ts    # + SIFCA_DEV_COMPANY_NAME, SIFCA_DEV_COMPANY_NIT (DV validado), SIFCA_DEV_USER_NAME
└── modules/accounting/…             # filtro number: schema → caso de uso → puerto → repositorio Prisma

apps/admin/                          # NUEVO
├── index.html  vite.config.ts  playwright.config.ts  .storybook/
├── src/
│   ├── app/          # main.tsx, providers (Query, Router, Preferences, Session), router.tsx, modules.ts
│   ├── platform/
│   │   ├── http/         # client.ts (único fetch), request-id, idempotency
│   │   ├── errors/       # ApiProblem, catalog.ts (ui-error-catalog.md), toFieldErrors
│   │   ├── session/      # useSession (/me), SessionExpiredDialog orchestration
│   │   ├── permissions/  # can(), <Can>, guard para beforeLoad
│   │   ├── connectivity/ # onlineManager + banner state
│   │   ├── format/       # money (decimal.js), date, nit; parsers de entrada
│   │   └── preferences/  # tema, densidad, recientes
│   ├── ui/           # tokens import, Button, Input, Select, Dialog, Toast, Tooltip, Badge, Chip, DataTable,
│   │                 # Form, MoneyText, DateText, Skeleton, EmptyState, ErrorBanner, OfflineBanner,
│   │                 # UnsavedChangesGuard, ReadOnlyNotice, ForbiddenPage, NotFoundPage, icons/
│   ├── shell/        # AppShell, Sidebar, Topbar, PeriodChip, UserMenu, CommandPalette, ShortcutsHelp, registry/
│   └── modules/accounting/   # manifest.ts, journal-entries/JournalEntriesListPage.tsx
├── test/
│   ├── unit/  component/ (MSW handlers por code)  arch/ (.dependency-cruiser.cjs)
│   └── e2e/   # steps de playwright-bdd para acceptance/fundaciones-frontend.feature
└── package.json  # dev, build, preview, test:unit, test:component, test:arch, test:e2e, storybook, perf
```

**Structure Decision**: aplicación separada `apps/admin` en el monorepo existente (npm workspaces + Turborepo) (ya previsto en el
README y en ADR-0001). Los tokens van en un paquete propio porque los reutilizarán `apps/storefront` (024) y
`apps/mobile` (025). Dentro de `apps/admin`, la regla de dependencias es `app → shell → modules → platform/ui`, con
`ui` sin dependencias internas y módulos aislados entre sí (research §12). CI agrega un *job* `admin` (unidad,
componentes, arquitectura, E2E con la API y PostgreSQL de pruebas, axe).

## Complexity Tracking

| Punto abierto | Por qué se acepta | Alternativa más simple descartada |
|---|---|---|
| Autenticación provisional (`dev-proxy`) y *build* de producción bloqueado | La spec 012 va justo después; permite construir y probar sesión, 401 y permisos sin adelantar IAM | Construir login ahora: duplicaría la spec 012 y su modelo de sesiones |
| Cambio pequeño en la API de la spec 001 (`number`) | Necesario para `#AJ-1` en la paleta (US5); parámetro opcional y retrocompatible, con prueba de contrato | Filtrar en el cliente: incorrecto con paginación por cursor |
| Biblioteca de UI elegida antes de cerrar el spike S-UI | El spike se acota a la grilla editable (research §9); el resto de componentes no depende de su resultado | Esperar el spike completo: bloquearía toda la Ola 0 por una pieza que solo usa la UI de la spec 001 |
| G-10 provisional | Mismo tratamiento que la spec 001; la puerta de liberación lo controla | — |
