---

description: "Task list for Fundaciones del back-office web"
---

# Tasks: Fundaciones del back-office web

**Input**: Design documents from `docs/specs/016-fundaciones-frontend/`

**Prerequisites**: [`plan.md`](plan.md), [`spec.md`](spec.md), [`research.md`](research.md), [`data-model.md`](data-model.md), [`contracts/`](contracts/), [`quickstart.md`](quickstart.md)

**Tests**: **Incluidas y obligatorias.** La constitución (principio VIII) exige pruebas primero: en cada historia las
pruebas se escriben antes, **deben fallar** y solo entonces se implementa. El archivo
[`acceptance/fundaciones-frontend.feature`](acceptance/fundaciones-frontend.feature) se ejecuta tal cual con
`playwright-bdd` (no se copia).

**Organization**: Tareas agrupadas por historia de usuario. US1–US3 son P1; US4–US6 son P2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias entre sí)
- **[Story]**: historia a la que pertenece (US1…US6); Setup, Foundational y Polish no llevan etiqueta
- Cada tarea incluye la ruta exacta del archivo

## Path Conventions

Monorepo de `plan.md` → *Project Structure*: back-office en `apps/admin/` (código en `apps/admin/src/`, pruebas en
`apps/admin/test/`), tokens en `packages/design-tokens/`, contratos en `packages/contracts/src/`, API en `apps/api/`.

> **Convenciones:** versiones **exactas** (sin `^`), tomando de cada línea indicada en `plan.md` la última publicada hace
> ≥ 14 días. Los textos de interfaz salen **literalmente** de [`contracts/ui-error-catalog.md`](contracts/ui-error-catalog.md)
> y del `.feature`; no se parafrasean. Ningún importe pasa por `number` (G-09).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: crear `apps/admin` y `packages/design-tokens` dentro del monorepo y dejar listas las herramientas.

- [ ] T001 Crear `apps/admin/package.json` (`name: @sifca/admin`, `type: module`, `private`) con dependencias exactas de `plan.md` → *Primary Dependencies* (React 19.3, Vite 8.3, `@vitejs/plugin-react` 6.1, TanStack Router 1.170 / Query 5.104 / Table 9.3 / Virtual 3.14, `radix-ui` 1.8, Tailwind 4.3 + `@tailwindcss/vite`, React Hook Form 7.90, `@hookform/resolvers` 5.9, cmdk 1.1.1, decimal.js 10.6.0, `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`, `@sifca/contracts` y `@sifca/design-tokens` como `workspace:*`) y *scripts* `dev`, `build`, `preview`, `typecheck`, `lint`, `test:unit`, `test:component`, `test:arch`, `test:e2e`, `storybook`, `perf`; ejecutar `npm install` (npm ≥ 11.20.0) y versionar `package-lock.json`
- [ ] T002 [P] Crear `apps/admin/tsconfig.json` que extiende `packages/config/tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) con `jsx: react-jsx`, `lib: [DOM, ES2023]` y alias `@/*` → `src/*`
- [ ] T003 [P] Crear `apps/admin/index.html` (`<html lang="es-CO">`, `<meta name="viewport">`, raíz `#root`) y `apps/admin/src/app/main.tsx` que monta `<App/>` vacío
- [ ] T004 Crear `apps/admin/vite.config.ts` con React, Tailwind, alias `@`, y *proxy* de `/api` hacia `SIFCA_API_URL` (por defecto `http://localhost:3000`) configurado **igual en `server.proxy` y `preview.proxy`**, que **añade** `Authorization: Bearer <token>` leyendo el token **en cada petición** desde `SIFCA_DEV_TOKEN_FILE` (por defecto `apps/admin/.dev-token`; si no existe, la variable `SIFCA_DEV_TOKEN`) y que, **solo en `mode === 'e2e'`**, convierte la cabecera `x-sifca-e2e-token` en `Authorization` y la elimina antes de reenviar (en otros modos la descarta) (research §5); y un *plugin* que **aborta** `vite build` cuando `mode === 'production'` y `SIFCA_AUTH_MODE` es `dev-proxy` o está vacío, con el mensaje «El back-office no puede compilarse para producción sin la spec 012 (autenticación)» (FR-021)
- [ ] T005 [P] Crear `apps/admin/vitest.config.ts` con proyectos `unit` (`test/unit/**/*.spec.ts`, entorno `node`) y `component` (`test/component/**/*.spec.tsx`, entorno `jsdom`, `setupFiles: test/component/setup.ts`)
- [ ] T006 [P] Crear `apps/admin/playwright.config.ts` con `playwright-bdd` (`defineBddConfig({ features: '../../docs/specs/016-fundaciones-frontend/acceptance/*.feature', steps: 'test/e2e/steps/**/*.ts' })`), proyecto Chromium (`executablePath` desde `PLAYWRIGHT_CHROMIUM_PATH` si existe) y `webServer` que ejecuta `npm run build -- --mode e2e && npm run preview -- --mode e2e`
- [ ] T007 [P] Crear `apps/admin/eslint.config.mjs` (TypeScript, `react-hooks`, `jsx-a11y`) con reglas propias: prohibir `fetch` fuera de `src/platform/http/**`, prohibir literales de color (`#hex`, `rgb(`) fuera de `packages/design-tokens`, y prohibir `Number(`/`parseFloat(`/`parseInt(` en archivos que importen `MoneyString`
- [ ] T008 [P] Crear `apps/admin/.dependency-cruiser.cjs` con las reglas de research §12: `src/ui` no importa `src/platform`, `src/shell`, `src/modules` ni `src/app`; `src/modules/x` no importa `src/modules/y`; nada importa `apps/api`; `no-circular`; *script* `test:arch`
- [ ] T009 [P] Crear `packages/design-tokens/package.json` (`@sifca/design-tokens`, `type: module`, `exports` de `dist/index.js` y `dist/tokens.css`), `tsconfig.json` y el *script* `build` (`node scripts/build.mjs`)
- [ ] T010 [P] Crear `apps/admin/.storybook/main.ts` y `preview.tsx` (Storybook 10.6 con `@storybook/react-vite` y `@storybook/addon-a11y`) con *toolbar* para tema (Claro/Slate) y densidad (Compacta/Normal/Cómoda)
- [ ] T011 Añadir a `turbo.json` las tareas `test:component`, `test:e2e` y `storybook` (sin caché) y al `package.json` raíz los *scripts* `test:component` y `test:e2e`; añadir al `.gitignore` `apps/admin/.features-gen`, `apps/admin/.dev-token`, `playwright-report` y `storybook-static`
- [ ] T012 Añadir el *job* `admin` a `.github/workflows/ci.yml` con npm (como el *job* `api`: `npm install -g npm@11.20.0`, `npm ci`, comandos `npm run <script> -w <paquete>`): instala, compila `@sifca/contracts` y `@sifca/design-tokens`, ejecuta `lint`, `typecheck`, `test:unit`, `test:component`, `test:arch` y `test:e2e` (con el servicio PostgreSQL, migraciones, `seed:test-chart` y la API en segundo plano arrancada con `SIFCA_ALLOW_DEV_OVERRIDES=true`), y publica el reporte de Playwright como artefacto

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: tokens, contratos, cliente HTTP, sesión, registro, enrutador y arnés de pruebas. **Ninguna historia puede
empezar hasta terminar esta fase.**

### Spike S-UI (research §9) — primero

- [ ] T013 **Spike S-UI** (máx. 1 día) en `apps/admin/spikes/s-ui/`: grilla de 300 líneas editables con TanStack Table + Virtual, navegación Tab/Enter/flechas, pegado de 20 filas desde el portapapeles, totales con decimal.js y `Ctrl+K` con foco en una celda; medir render de 5.000 filas de solo lectura. **Éxito:** render inicial < 500 ms y desplazamiento sin cortes visibles. Registrar el resultado (y, si falla, la adopción de AG Grid Community **solo para la grilla editable**) en `docs/specs/016-fundaciones-frontend/research.md` §9 y en `docs/01-arquitectura/03-evaluacion-de-librerias.md` §3.4; borrar `apps/admin/spikes/` al terminar

### Tokens de diseño

- [ ] T014 [P] Crear `packages/design-tokens/src/tokens.json` con los valores de `docs/04-diseno-ux/04-sistema-de-diseno.md` §2–§5 y de las maquetas `1a/1b`: temas `light` y `slate` (`bg`, `surface`, `text`, `text-muted`, `border`, `border-strong`, `primary`, `success-bg/fg`, `warning-bg/fg`, `danger-bg/fg`, `info-bg/fg`, `focus`), tipografía (Inter; JetBrains Mono para cifras y códigos), espaciado base 4 px (4 · 8 · 12 · 16 · 24 · 32), radios 6 px (controles) y 10 px (tarjetas y diálogos), y densidades **Compacta 28 px / 13 px, Normal 36 px / 14 px, Cómoda 44 px / 16 px**
- [ ] T015 Crear `packages/design-tokens/scripts/build.mjs` que genera `dist/tokens.css` (variables CSS bajo `:root[data-theme="light"]`, `:root[data-theme="slate"]` y `:root[data-density="compact|normal|comfortable"]`) y `dist/index.js` + `dist/index.d.ts` con el mismo objeto tipado
- [ ] T016 [P] Prueba `packages/design-tokens/test/contrast.test.ts`: para cada tema, todo par texto/fondo declarado cumple **≥ 4,5:1** y `border-strong` y `focus` contra `bg` **≥ 3:1** (WCAG 2.1, SC-002); debe fallar si se altera un color a uno sin contraste

### Contratos y API

- [ ] T017 [P] En `packages/contracts/src/common/problem.ts` añadir `KnownProblemCodes` (los 13 códigos actuales) y `ProblemEnvelopeSchema` (igual a `ProblemSchema` pero con `code: z.string()` y `errors[].field` cadena), exportados desde `packages/contracts/src/index.ts` sin romper `ProblemSchema`
- [ ] T018 [P] Crear `packages/contracts/src/platform/me.ts` con `SessionContextSchema` según `data-model.md` §1 y `contracts/platform.v1.openapi.yaml`: `user.displayName` texto **1–120**, `tenant.name` texto **1–200**, `tenant.nit.number` `^[0-9]{5,15}$`, `tenant.nit.dv` `^[0-9]$`, `permissions` lista única de `^[a-z]+(\.[a-zA-Z]+)+$`, `workingDate` fecha ISO, `authMode` `enum(['dev'])`; exportar desde `packages/contracts/src/index.ts`
- [ ] T019 [P] En `packages/contracts/src/accounting/journal-entry.ts` añadir a `ListJournalEntriesQuerySchema` el campo opcional `number: z.coerce.number().int().min(1)` con refinamiento «`number` exige `voucherType`» (error en `field = number`)
- [ ] T020 [P] Prueba de contrato `apps/api/test/contract/platform/me.contract.spec.ts`: `GET /api/v1/me` responde 200 conforme a `SessionContext` de `contracts/platform.v1.openapi.yaml`; sin token → `401` `problem+json` con `code = UNAUTHENTICATED`; dos tokens de empresas distintas devuelven cada uno su `tenant.id` (G-07); con `SIFCA_ALLOW_DEV_OVERRIDES=true` la cabecera `X-Sifca-Working-Date: 2026-09-15` produce `workingDate = 2026-09-15` y sin esa variable la cabecera se ignora (FR-024)
- [ ] T021 [P] Prueba de integración `apps/api/test/integration/accounting/list-by-number.spec.ts`: con AJ-1 y AJ-2 contabilizados, `voucherType=AJ&number=1` devuelve solo AJ-1; `number=1` sin `voucherType` → `422 VALIDATION_FAILED` con `field = number`; con otro *tenant* devuelve 0 filas
- [ ] T022 En `apps/api/src/platform/config/env.schema.ts` añadir `SIFCA_DEV_COMPANY_NAME` (texto 1–200, por defecto «Empresa de desarrollo»), `SIFCA_DEV_WORKING_DATE` (opcional, `YYYY-MM-DD`), `SIFCA_ALLOW_DEV_OVERRIDES` (booleano, por defecto `false`; `loadEnv` lo **rechaza** con `NODE_ENV=production`) y `SIFCA_DEV_COMPANY_NIT` (por defecto `900123456-8`; formato `NNNNNNNNN-D`, **DV validado con el algoritmo de la DIAN**, pesos 3,7,13,17,19,23,29,37,41,43,47,53,59,67,71 desde la derecha; residuo 0 o 1 → DV = residuo, si no 11 − residuo; R-FE-012) y `SIFCA_DEV_USER_NAME` (1–120, por defecto «Usuario de desarrollo»); prueba unitaria en `apps/api/test/unit/platform/env-nit.spec.ts` con `900123456-8` válido y `900123456-7` rechazado
- [ ] T023 Crear `apps/api/src/platform/http/me.controller.ts` (`GET /me`, sin permiso específico, toma usuario, empresa y permisos de `RequestContext` y `workingDate` resuelto así: cabecera `X-Sifca-Working-Date` si `SIFCA_ALLOW_DEV_OVERRIDES=true`, si no `SIFCA_DEV_WORKING_DATE`, si no hoy en `America/Bogota` desde el puerto `Clock` (FR-024); responde validando con `SessionContextSchema`) y registrarlo en `apps/api/src/platform/platform.module.ts`; hace pasar T020
- [ ] T024 Implementar el filtro `number` en `apps/api/src/modules/accounting/application/ports/journal-entry-repository.ts` (`JournalEntryFilter.number?`), `application/use-cases/list-journal-entries.ts` e `infrastructure/persistence/prisma-journal-entry.repository.ts` (orden: más recientes primero); hace pasar T021
- [ ] T025 Actualizar `docs/specs/001-contabilidad-comprobantes-inmutables/contracts/accounting.v1.openapi.yaml` con el parámetro `number` y ejecutar `npm run test:contract -w @sifca/api` en verde

### Plataforma del cliente

- [ ] T026 [P] Prueba `apps/admin/test/unit/platform/problem.spec.ts`: `toApiProblem` convierte (a) un `problem+json` conocido, (b) un `code` desconocido → `INTERNAL_ERROR` con `isKnown=false`, (c) un 502 con cuerpo HTML → `INTERNAL_ERROR` **sin** el cuerpo, (d) conserva `requestId` del cuerpo o de la cabecera `X-Request-Id`, (e) conserva rutas de campo como `lines[2].accountCode` (data-model §3)
- [ ] T027 Crear `apps/admin/src/platform/errors/api-problem.ts` (`ApiProblem` de data-model §3 y `toApiProblem`) y `apps/admin/src/platform/errors/catalog.ts` con **todas** las filas de `contracts/ui-error-catalog.md` (código, ubicación `field|banner|dialog|toast|page`, texto literal con marcadores `{…}`, acción); hace pasar T026
- [ ] T028 [P] Prueba `apps/admin/test/unit/platform/http-client.spec.ts` (con MSW en Node): añade `X-Request-Id`; valida la respuesta 200 con el esquema recibido y lanza `ApiProblem` si no cumple; en un `POST` de creación envía `Idempotency-Key` recibido por parámetro; nunca envía `Authorization` (lo pone el *proxy*)
- [ ] T029 Crear `apps/admin/src/platform/http/client.ts` (único uso de `fetch`: base `/api/v1`, `get(path, query, schema)`, `post(path, body, schema, { idempotencyKey })`, conversión de errores con `toApiProblem`) y `apps/admin/src/platform/http/ids.ts` (UUID v4 para `X-Request-Id`, UUID v7 para idempotencia); hace pasar T028
- [ ] T030 [P] Crear `apps/admin/src/platform/format/money.ts` (formatea una `MoneyString` a `$ 1.190.000,50` **partiendo la cadena**, sin `number`; `sum(MoneyString[])` con decimal.js) y `apps/admin/src/platform/format/date.ts` (`dd/mm/aaaa`; instantes en `America/Bogota` con `Intl.DateTimeFormat('es-CO')`); prueba mínima en `apps/admin/test/unit/platform/format-basic.spec.ts` (`"1190000.5"` → `$ 1.190.000,50`; `2026-10-14` → `14/10/2026`)
- [ ] T031 [P] Crear `apps/admin/src/platform/preferences/preferences.ts`: `UiPreferences` de data-model §5 (`theme: light|slate|system`, por defecto `system` → `light`; `density: compact|normal|comfortable`, por defecto `normal` y `compact` en Contabilidad; `sidebarCollapsed`; `recentCommands` **hasta 8 ids**), clave `sifca.ui.{tenantId}.{userId}`, lectura tolerante (valor ilegible → valores por defecto) y aplicación a `<html data-theme data-density>`
- [ ] T032 Crear `apps/admin/src/platform/session/session.tsx`: `SessionProvider` que consulta `GET /me` con `SessionContextSchema`, expone `useSession()` (usuario, empresa, permisos, `workingDate`) y estado `SessionState` `active|expired|renewing` (data-model §7)
- [ ] T033 Crear `apps/admin/src/platform/permissions/permissions.ts` (`can(permission)`, componente `<Can permission>` y `requirePermission(permission)` para `beforeLoad`, que **no redirige**: marca la ruta para renderizar la página 403)
- [ ] T034 Crear `apps/admin/src/shell/registry/types.ts` y `apps/admin/src/shell/registry/registry.ts` según `contracts/ui-registry.md` y data-model §4 (`ModuleManifest`, `ScreenRegistration` con `permission` **obligatorio**, `ActionRegistration`, `SearchProvider`), con selectores filtrados por permiso; y `apps/admin/src/app/modules.ts` (lista de manifiestos, vacía por ahora)
- [ ] T035 [P] Prueba de arquitectura `apps/admin/test/arch/registry.spec.ts`: falla si algún `screen`, `action` o `searchProvider` de los manifiestos de `src/app/modules.ts` no declara `permission` o repite `id` o `path`
- [ ] T036 Crear `apps/admin/src/app/router.tsx` (TanStack Router: ruta raíz con el cascarón, rutas generadas desde el registro con carga diferida, `notFoundComponent`) y `apps/admin/src/app/providers.tsx` (`QueryClientProvider`, `SessionProvider`, preferencias); actualizar `apps/admin/src/app/main.tsx`
- [ ] T037 [P] Importar `@sifca/design-tokens/tokens.css`, las fuentes autoalojadas y Tailwind en `apps/admin/src/ui/styles.css`, mapeando los tokens a la configuración de Tailwind 4 (`@theme` con `var(--…)`)
- [ ] T038 [P] Crear las primitivas base sobre Radix en `apps/admin/src/ui/primitives/` (`Button`, `IconButton`, `Input`, `Select`, `Dialog`, `Tooltip`, `DropdownMenu`, `Badge`, `Chip`) con foco visible de 2 px (`--focus`), tamaños según densidad y **sin animaciones con `prefers-reduced-motion`** (diálogos, menús, *tooltips*); una historia de Storybook por primitiva en `apps/admin/src/ui/primitives/*.stories.tsx`
- [ ] T039 [P] Convertir el set de íconos `docs/04-diseno-ux/maquetas/sifca-icons.js` (objeto `I` de trazados SVG) en componentes SVG en `apps/admin/src/ui/icons/` con `aria-hidden` por defecto y `title` opcional, y copiar los logos `docs/04-diseno-ux/maquetas/assets/sifca-{claro,oscuro}-{mark,lockup}.png` a `apps/admin/src/ui/brand/`
- [ ] T040 Crear el arnés de pruebas de componentes: `apps/admin/test/component/setup.ts` (Testing Library, `jest-dom`, MSW `setupServer`), `apps/admin/test/component/handlers/problems.ts` (un *handler* por cada `code` de `contracts/ui-error-catalog.md` con el cuerpo `problem+json` correspondiente) y `apps/admin/test/component/render.tsx` (renderiza con *providers*, sesión simulada y permisos configurables)
- [ ] T041 Crear el arnés E2E: `apps/admin/test/e2e/support/fixtures.ts` (crea *tenant* con `seed:test-chart`, genera tokens con permisos configurables vía `dev:token` y los envía por escenario en la cabecera `x-sifca-e2e-token` con `extraHTTPHeaders`; fija la fecha de trabajo por escenario con la cabecera `X-Sifca-Working-Date` —[016-01] `2026-10-16`, [016-02] `2026-09-15`—; usa la API arrancada con `SIFCA_ALLOW_DEV_OVERRIDES=true`) y `apps/admin/test/e2e/steps/common.steps.ts` con los pasos de `Antecedentes` («la empresa … con NIT …», «el período … abierto/cerrado») y «un usuario con el permiso …»

- [ ] T093 Crear la pantalla de demostración de pruebas (FR-023, research §14) en `apps/admin/src/e2e-harness/`: `routes.tsx` registra `/__e2e/componentes` (grilla de líneas de demostración con columnas «Cuenta», «Débito», «Crédito»; formulario con «Fecha contable» y «Descripción»; diálogo de reversión simulado; formulario con cambios sin guardar) y `/__e2e/contabilizar` (envía a `POST /accounting/journal-entries` un comprobante de 2 líneas que cuadra); se registran en `apps/admin/src/app/router.tsx` **solo** si `import.meta.env.MODE` es `development` o `e2e` mediante `import()` dinámico; los componentes que usa se conectan en cada historia (US2, US4)

**Checkpoint**: `npm run dev -w @sifca/admin` muestra una página en blanco con estilos y la sesión cargada; `/me`
y el filtro `number` en verde; arneses listos.

---

## Phase 3: User Story 1 - Moverse por el back-office con un cascarón coherente (Priority: P1) 🎯 MVP

**Goal**: cascarón común (menú, barra superior, chip de período, tema y densidad) a 1440, 1024 y < 1024 px.

**Independent Test**: con la API de la spec 001, abrir la app a 1440, 1024 y 800 px, recorrer el menú, cambiar tema
y densidad y recargar.

### Tests for User Story 1 ⚠️

- [ ] T042 [P] [US1] Pasos E2E de [016-01], [016-02] y [016-03] en `apps/admin/test/e2e/steps/shell.steps.ts` (anchos 1440/1024/800 → menú «expandido» / «en íconos» / «en cajón»; chip «Oct 2026 · Abierto» y «Sep 2026 · Cerrado» con navegación a `/contabilidad/periodos`; tema Slate + Compacta persisten y filas miden **28 px** con texto **13 px**)
- [ ] T043 [P] [US1] Prueba de componentes `apps/admin/test/component/shell/period-chip.spec.tsx` con los cuatro casos de data-model §2 (`OPEN`, `CLOSED`, sin período → «Sin período», sin `accounting.report.read` → oculto)
- [ ] T044 [P] [US1] Prueba unitaria `apps/admin/test/unit/platform/nit.spec.ts`: `{ number: "900123456", dv: "8" }` → `900.123.456-8`

### Implementation for User Story 1

- [ ] T045 [P] [US1] Crear `apps/admin/src/platform/format/nit.ts` (formato `900.123.456-8`); hace pasar T044
- [ ] T046 [P] [US1] Crear `apps/admin/src/shell/Sidebar.tsx`: módulos en el orden del mapa del sitio (`02-navegacion-…` §3), entradas desde el registro filtradas por permiso, entradas de specs aún no implementadas **deshabilitadas con «Próximamente»**; sin animación de apertura/cierre con `prefers-reduced-motion`; expandido ≥ 1280 px (240 px), íconos 1024–1279 px con nombre accesible y *tooltip*, cajón < 1024 px (FR-002)
- [ ] T047 [P] [US1] Crear `apps/admin/src/shell/PeriodChip.tsx` según data-model §2, consultando `GET /accounting/periods?year=` con `FiscalPeriodSchema`; hace pasar T043 (FR-003)
- [ ] T048 [P] [US1] Crear `apps/admin/src/shell/UserMenu.tsx` (nombre del usuario, tema Claro/Slate/Sistema, densidad Compacta/Normal/Cómoda, ayuda de atajos) que persiste con `preferences.ts` (FR-004)
- [ ] T049 [US1] Crear `apps/admin/src/shell/Topbar.tsx` (logo SIFCA claro/oscuro según tema, nombre de la empresa y `NIT 900.123.456-8`, botón «Buscar o ejecutar… Ctrl K» que por ahora solo enfoca, `PeriodChip`, campana de alertas con contador 0, `UserMenu`) y `apps/admin/src/shell/AppShell.tsx` que compone barra, menú y `<Outlet/>` (FR-001)
- [ ] T050 [US1] Crear `apps/admin/src/shell/HomePage.tsx` (ruta `/`, tablero `4a` vacío con mensaje de bienvenida) y conectar `AppShell` como ruta raíz en `apps/admin/src/app/router.tsx`
- [ ] T051 [US1] Crear `apps/admin/src/modules/accounting/manifest.ts` con la pantalla `accounting.journalEntries` (`/contabilidad/comprobantes`, permiso `accounting.report.read`, palabras clave «comprobantes asientos») y `accounting.periods` (`/contabilidad/periodos`, página «Próximamente» hasta la UI de la spec 001); registrarlo en `apps/admin/src/app/modules.ts`
- [ ] T052 [US1] Historias de Storybook del cascarón en `apps/admin/src/shell/AppShell.stories.tsx` (1440/1024/800 px × Claro/Slate × tres densidades) y ejecutar T042 en verde

**Checkpoint**: US1 funcional y demostrable sola (MVP visual).

---

## Phase 4: User Story 2 - Entender cualquier error sin ayuda técnica (Priority: P1)

**Goal**: cada `code` se muestra con su texto y en su lugar; errores de campo con foco; desconocidos sin romper.

**Independent Test**: respuestas simuladas por cada código A.0; con la API real, `PERIOD_NOT_FOUND` y `FORBIDDEN`.

### Tests for User Story 2 ⚠️

- [ ] T053 [P] [US2] Prueba de componentes `apps/admin/test/component/errors/catalog.spec.tsx`: **una prueba por fila** de `contracts/ui-error-catalog.md` que verifica texto y ubicación (SC-001); `ENTRY_IMMUTABLE` no tiene presentación
- [ ] T054 [P] [US2] Prueba de componentes `apps/admin/test/component/errors/field-errors.spec.tsx`: `VALIDATION_FAILED` con `lines[2].accountCode` y `description` marca la celda de la línea 3 y el campo, muestra el resumen con enlaces y deja el foco en el primero (FR-007)
- [ ] T055 [P] [US2] Pasos E2E de [016-04], [016-05] y [016-06] en `apps/admin/test/e2e/steps/errors.steps.ts` (sobre `/__e2e/componentes` de T093, con respuestas interceptadas con `page.route` para cada `code` y contexto del esquema y para el 502 HTML)

### Implementation for User Story 2

- [ ] T056 [P] [US2] Crear `apps/admin/src/ui/feedback/Toast.tsx` (región `aria-live="polite"`, cierre con `Esc`) y `apps/admin/src/ui/feedback/ErrorBanner.tsx` (texto, «Copiar código», «Reintentar»)
- [ ] T057 [P] [US2] Crear `apps/admin/src/ui/feedback/ErrorPage.tsx` (página de error con código copiable) y `apps/admin/src/ui/feedback/ConflictDialog.tsx` («Este registro cambió en otra sesión», «Recargar», conserva los cambios locales como copia)
- [ ] T058 [US2] Crear `apps/admin/src/ui/form/Form.tsx` (React Hook Form + `zodResolver`, registro de campos por **ruta del contrato**, `applyServerErrors(ApiProblem)` con `setError(path)`, resumen con enlaces y foco en el primero); hace pasar T054
- [ ] T059 [US2] Crear `apps/admin/src/platform/errors/present.tsx` (`usePresentProblem()`: según `presentation` del catálogo despacha a campo, banner, diálogo, toast o página, rellenando los marcadores `{…}` con `detail`, `errors[]` y `requestId`); hace pasar T053
- [ ] T060 [US2] Conectar el manejador global de errores de TanStack Query en `apps/admin/src/app/providers.tsx` (consultas → `ErrorBanner`/`ErrorPage`; mutaciones → `usePresentProblem`) y ejecutar T055 en verde

**Checkpoint**: US1 y US2 funcionan juntas e independientes.

---

## Phase 5: User Story 3 - Ver solo lo que se puede hacer (Priority: P1)

**Goal**: sin permiso no se ve; por enlace directo, página 403 con «Solicitar permiso»; 403 de la API como toast.

**Independent Test**: token con solo `accounting.report.read`: sin «Nuevo comprobante»; `/contabilidad/comprobantes/nuevo` → 403.

### Tests for User Story 3 ⚠️

- [ ] T061 [P] [US3] Pasos E2E de [016-07] en `apps/admin/test/e2e/steps/permissions.steps.ts`
- [ ] T062 [P] [US3] Prueba de componentes `apps/admin/test/component/permissions/forbidden.spec.tsx`: la acción que recibe `FORBIDDEN` muestra el toast «No tienes permiso para esta acción (accounting.entry.post).» y queda deshabilitada con esa razón en su *tooltip* (FR-011); cambiar permisos en la sesión recalcula menú y acciones sin recargar

### Implementation for User Story 3

- [ ] T063 [P] [US3] Crear `apps/admin/src/ui/feedback/ForbiddenPage.tsx` («No tienes permiso», permiso faltante, «Solicitar permiso» que registra la intención y confirma «Solicitud enviada» — el envío real llega con la spec 017) y `apps/admin/src/ui/feedback/NotFoundPage.tsx` («No encontramos esa página.», «Ir al inicio»)
- [ ] T064 [US3] Aplicar `requirePermission` a cada ruta generada en `apps/admin/src/app/router.tsx` (renderiza `ForbiddenPage` en la misma URL) y registrar en `apps/admin/src/modules/accounting/manifest.ts` la acción `accounting.entry.new` (permiso `accounting.entry.post`, atajo `N`, ámbito de la lista) y la ruta `/contabilidad/comprobantes/nuevo` (página «Próximamente» hasta la UI de la spec 001)
- [ ] T065 [US3] Crear `apps/admin/src/platform/permissions/useGuardedAction.ts` (oculta sin permiso; ante `FORBIDDEN` deshabilita con la explicación del catálogo); hace pasar T062 y T061

**Checkpoint**: las tres historias P1 completas → **MVP de la spec**.

---

## Phase 6: User Story 4 - Estados de carga, vacío, sin conexión y sesión vencida (Priority: P2)

**Goal**: esqueleto, vacío, sin conexión, sesión vencida y cambios sin guardar; lista de comprobantes de referencia (FR-020); idempotencia (FR-012).

**Independent Test**: lista de comprobantes con latencia, sin datos, sin red y con token vencido.

### Tests for User Story 4 ⚠️

- [ ] T066 [P] [US4] Pasos E2E de [016-08], [016-09] y [016-10] en `apps/admin/test/e2e/steps/states.steps.ts` ([016-08] se ejecuta en `/__e2e/contabilizar` de T093: corta la red con `context.setOffline(true)` tras enviar y verifica **un solo** comprobante y la misma `Idempotency-Key` en ambos intentos; además, en `/__e2e/componentes`, navegar con el formulario modificado muestra «¿Salir sin guardar?»)
- [ ] T067 [P] [US4] Prueba de componentes `apps/admin/test/component/states/session-expired.spec.tsx`: un `401` abre «Tu sesión venció»; «Continuar» reintenta **una sola vez** la operación pendiente con la misma clave; dos pestañas (simuladas) no muestran error genérico
- [ ] T068 [P] [US4] Prueba unitaria `apps/admin/test/unit/platform/idempotent-mutation.spec.ts` según data-model §6: la clave se crea una vez por intención; se reintenta solo por red caída o `401` renovado, nunca por `4xx` de negocio; `200` repetido = éxito; `IDEMPOTENCY_CONFLICT` no se reintenta

### Implementation for User Story 4

- [ ] T069 [P] [US4] Crear `apps/admin/src/ui/states/Skeleton.tsx` (filas con la forma de las columnas, sin bloquear la página, sin animación con `prefers-reduced-motion`) y `apps/admin/src/ui/states/EmptyState.tsx` (motivo + acción principal)
- [ ] T070 [P] [US4] Crear `apps/admin/src/platform/connectivity/connectivity.ts` (`ConnectivityState` `online|offline|recovering` desde el navegador y desde fallos de red; integra `onlineManager` de TanStack Query) y `apps/admin/src/ui/states/OfflineBanner.tsx` («Sin conexión a internet. Puedes seguir digitando; enviaremos al reconectar.» + «Reintentar ahora»)
- [ ] T071 [US4] Crear `apps/admin/src/platform/http/useIdempotentMutation.ts` (data-model §6: estados `pending → paused → pending → succeeded/failed`, clave UUID v7 por intención); hace pasar T068 (FR-012)
- [ ] T072 [US4] Crear `apps/admin/src/platform/session/SessionExpiredDialog.tsx` y la cola de reintento en `session.tsx` (las peticiones nuevas esperan a `active`; en modo `dev` «Continuar» vuelve a consultar `/me`); hace pasar T067
- [ ] T073 [P] [US4] Crear `apps/admin/src/ui/states/UnsavedChangesGuard.tsx` (`useBlocker` + `beforeunload`; «¿Salir sin guardar?», «Seguir editando», «Descartar») y `apps/admin/src/ui/states/ReadOnlyNotice.tsx` («Para corregir, usa Reversar», FR-013)
- [ ] T074 [US4] Crear `apps/admin/src/ui/data/DataTable.tsx` (TanStack Table + Virtual: columnas tipadas, importes a la derecha con cifras tabulares, esqueleto, vacío, error con reintento, paginación por cursor «Cargar más», densidad desde tokens, `<th scope>`)
- [ ] T075 [US4] Crear `apps/admin/src/modules/accounting/journal-entries/JournalEntriesListPage.tsx` (FR-020): filtros en la URL validados con `ListJournalEntriesQuerySchema` (fechas, tipo, cuenta, origen), columnas Fecha contable · Tipo-Número · Descripción · Origen · Débito total · Crédito total · Estado/etiquetas · Registrado por/cuándo; etiquetas «Contabilizado», «Reversado por AJ-2», «Reversión de AJ-1», «Cierre anual»; **sin** «Editar» ni «Eliminar»; vacío «Aún no hay comprobantes en este rango» con «Limpiar filtros» y, con permiso, «Nuevo comprobante»; ejecutar T066 en verde

**Checkpoint**: US1–US4 funcionan; la lista real ejercita todos los estados.

---

## Phase 7: User Story 5 - Paleta de comandos y teclado (Priority: P2)

**Goal**: `Ctrl/Cmd + K` con pantallas, acciones y `#documento`, sin tildes y solo lo permitido; cascarón operable con teclado.

**Independent Test**: «balance» / «periodos», «#AJ-1» y navegación solo con teclado.

### Tests for User Story 5 ⚠️

- [ ] T076 [P] [US5] Prueba unitaria `apps/admin/test/unit/shell/palette-filter.spec.ts`: «periodos» encuentra «Períodos»; prefijos `>`, `#`, `@`, `/` enrutan a su fuente; sin permiso no hay resultado; recientes **hasta 8**
- [ ] T077 [P] [US5] Pasos E2E de [016-12] en `apps/admin/test/e2e/steps/palette.steps.ts` y prueba de teclado en `apps/admin/test/e2e/keyboard.spec.ts` (SC-003: desde `Ctrl+K`, tras escribir «periodos», la navegación ocurre con ≤ 3 pulsaciones y en < 5 s; Tab recorre el cascarón con foco visible, sin trampas; `?` abre la ayuda; `G` + `C` va a Contabilidad)

### Implementation for User Story 5

- [ ] T078 [P] [US5] Crear `apps/admin/src/shell/palette/filter.ts` (normalización NFD sin diacríticos, prefijos, puntuación por coincidencia) y `apps/admin/src/shell/palette/recent.ts`; hace pasar T076
- [ ] T079 [US5] Crear `apps/admin/src/shell/palette/CommandPalette.tsx` (cmdk como `combobox`, grupos por tipo con ícono, atajo a la derecha, «Recientes», acciones contextuales de la pantalla actual) y conectar el botón de la barra y `Ctrl/Cmd + K` en `apps/admin/src/shell/AppShell.tsx` (FR-017)
- [ ] T080 [US5] Registrar en `apps/admin/src/modules/accounting/manifest.ts` el proveedor `#` que interpreta `#AJ-1` como `voucherType=AJ&number=1`, consulta `GET /accounting/journal-entries` y, al elegir el resultado, navega a la **lista filtrada** `/contabilidad/comprobantes?voucherType=AJ&number=1` (el detalle llega con la UI de la spec 001)
- [ ] T081 [US5] Crear `apps/admin/src/shell/shortcuts/shortcuts.ts` y `apps/admin/src/shell/shortcuts/ShortcutsHelp.tsx` (`Ctrl/Cmd + K`, `G` + letra de módulo, `N` en listas, `/` filtro, `?` ayuda, `Esc`; FR-019); ejecutar T077 en verde

---

## Phase 8: User Story 6 - Cifras y fechas en formato colombiano sin errores de redondeo (Priority: P2)

**Goal**: presentación y entrada `es-CO` completas; sumas exactas.

**Independent Test**: batería de entradas y salidas de importes, fechas e instantes.

### Tests for User Story 6 ⚠️

- [ ] T082 [P] [US6] Prueba unitaria `apps/admin/test/unit/platform/format.spec.ts`: `"1190000.5"` → `$ 1.190.000,50`; `0.10+0.20+0.30` → `$ 0,60`; `"999999999999999.99"` sin pérdida; `2026-02-01T04:30:00Z` → `31/01/2026 23:30`; entrada de importes `1190000,5`, `1.190.000,50`, pegado con tabulaciones; fechas `14102026`, `14/10/26`, `14/10/2026` → `2026-10-14`; entradas inválidas rechazadas
- [ ] T083 [P] [US6] Pasos E2E de [016-11] en `apps/admin/test/e2e/steps/format.steps.ts`

### Implementation for User Story 6

- [ ] T084 [US6] Ampliar `apps/admin/src/platform/format/money.ts` y `date.ts` con los analizadores de entrada (`parseMoneyInput`, `parseDateInput`) y hacer pasar T082 (FR-015, FR-016)
- [ ] T085 [P] [US6] Crear `apps/admin/src/ui/data/MoneyText.tsx` (cifras tabulares, alineado a la derecha, negativo con signo y texto, no solo color), `apps/admin/src/ui/data/DateText.tsx` y `apps/admin/src/ui/form/MoneyInput.tsx` / `DateInput.tsx`; usar `MoneyText` y `DateText` en `JournalEntriesListPage.tsx`; ejecutar T083 en verde

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T086 [P] Prueba de accesibilidad `apps/admin/test/e2e/a11y.spec.ts` con `@axe-core/playwright`: cascarón, paleta abierta, página 403 y lista de comprobantes, en tema Claro y Slate y en las tres densidades → **cero violaciones AA** (SC-002); texto al 200 % y ancho 768 px sin desborde horizontal de la página
- [ ] T087 [P] Configurar Lighthouse CI en `apps/admin/lighthouserc.json` (*preview* con red limitada a 10 Mbps): LCP < 2,5 s; *bundle* inicial ≤ **250 KB gzip** (SC-004); *script* `perf`
- [ ] T088 [P] Completar Storybook (FR-022): una historia por componente de `src/ui/` y `src/shell/` en ambos temas y tres densidades, con `addon-a11y` sin violaciones; `npm run build-storybook -w @sifca/admin` en CI
- [ ] T089 [P] Prueba de SC-006 en `apps/admin/test/arch/registry-extension.spec.ts`: un manifiesto de prueba con una pantalla nueva aparece en menú, paleta y guardas sin tocar `src/shell/`
- [ ] T090 Verificar FR-021: `SIFCA_AUTH_MODE=dev-proxy npm run build -w @sifca/admin -- --mode production` **falla** con el mensaje de T004 (prueba en `apps/admin/test/unit/build-guard.spec.ts`) y el *bundle* de `--mode e2e` no contiene `SIFCA_DEV_TOKEN` ni ningún JWT (búsqueda en `dist/`); además, un *build* con `SIFCA_AUTH_MODE=none --mode production` (solo para esta prueba) no contiene la cadena `__e2e` ni `x-sifca-e2e-token` (FR-023)
- [ ] T091 [P] Actualizar documentación: `README.md` (cómo levantar el back-office y estado de la spec 016), `docs/roadmap-specs.md` (estado de SPEC-016) y `docs/04-diseno-ux/04-sistema-de-diseno.md` (enlace a Storybook y a `packages/design-tokens`)
- [ ] T092 Ejecutar el recorrido de [`quickstart.md`](quickstart.md) completo, `node scripts/docs.mjs check --strict` y todos los *jobs* de CI en verde; marcar las tareas como completadas

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sin dependencias.
- **Foundational (Fase 2)**: depende de Setup; **bloquea todas las historias**. T013 (spike) va primero.
- **US1–US3 (Fases 3–5, P1)**: dependen de Foundational. Pueden ir en paralelo; el MVP es US1 + US2 + US3.
- **US4–US6 (Fases 6–8, P2)**: dependen de Foundational; US4 usa las páginas de error de US2 para el banner de error
  de la lista (si se hace antes, usa el `ErrorBanner` básico de T056).
- **Polish (Fase 9)**: depende de todas las historias.

### User Story Dependencies

| Historia | Depende de | Notas |
|---|---|---|
| US1 | Foundational | Independiente |
| US2 | Foundational | Independiente; sus componentes los usa el resto |
| US3 | Foundational | Independiente; usa el toast de US2 si existe (si no, `Toast` básico) |
| US4 | Foundational (+ T056 de US2) | La lista de comprobantes vive aquí |
| US5 | Foundational | El proveedor `#` necesita T024 (filtro `number`) |
| US6 | Foundational (T030) | Completa formatos y entradas |

### Within Each User Story

Pruebas primero (deben fallar) → modelos/plataforma → componentes de UI → integración en el cascarón → pasos E2E en
verde.

### Parallel Opportunities

- Setup: T002, T003, T005–T010 en paralelo tras T001.
- Foundational: T093 después de T036 y T038; T014, T016–T021 en paralelo; T026/T028/T030/T031 en paralelo; T035, T037–T039 en paralelo.
- Con varios desarrolladores, tras Foundational: US1, US2 y US3 a la vez; luego US4, US5 y US6 a la vez.

## Parallel Example: User Story 1

```bash
# Pruebas de US1 juntas:
Task: "T042 Pasos E2E de [016-01..03] en apps/admin/test/e2e/steps/shell.steps.ts"
Task: "T043 Prueba de PeriodChip en apps/admin/test/component/shell/period-chip.spec.tsx"
Task: "T044 Prueba de formato NIT en apps/admin/test/unit/platform/nit.spec.ts"

# Componentes de US1 juntos:
Task: "T046 Sidebar en apps/admin/src/shell/Sidebar.tsx"
Task: "T047 PeriodChip en apps/admin/src/shell/PeriodChip.tsx"
Task: "T048 UserMenu en apps/admin/src/shell/UserMenu.tsx"
```

## Parallel Example: User Story 4

```bash
Task: "T066 Pasos E2E de [016-08..10] en apps/admin/test/e2e/steps/states.steps.ts"
Task: "T067 Sesión vencida en apps/admin/test/component/states/session-expired.spec.tsx"
Task: "T068 Idempotencia en apps/admin/test/unit/platform/idempotent-mutation.spec.ts"
Task: "T069 Skeleton y EmptyState en apps/admin/src/ui/states/"
Task: "T070 Conectividad en apps/admin/src/platform/connectivity/connectivity.ts"
```

## Implementation Strategy

### MVP First (US1 + US2 + US3)

1. Fase 1 Setup → Fase 2 Foundational (spike S-UI primero).
2. US1: cascarón visible con datos reales de `/me` y del período.
3. US2: errores tipificados del catálogo.
4. US3: permisos y página 403.
5. **Parar y validar**: [016-01]…[016-07] en verde y recorrido manual del `quickstart.md` pasos 1, 2, 7 y 8.

### Incremental Delivery

US4 (estados + lista real) → US5 (paleta y teclado) → US6 (formatos completos) → Polish (accesibilidad, rendimiento,
Storybook). Cada incremento deja todos los escenarios anteriores en verde.

## Notes

- 93 tareas; un *commit* por fase como en la spec 001. T093 se añadió tras `/speckit-analyze` (hallazgos U1/U2); su número no sigue el orden de ejecución: va al final de la fase Foundational.
- Si el spike S-UI (T013) cambia la grilla a AG Grid, solo afecta a la UI de la spec 001; esta lista no cambia.
- Ninguna tarea toca tablas ni migraciones: G-06 y G-07 se cumplen por construcción.
