# Data Model: Fundaciones del back-office web

Esta spec **no crea tablas**. Las entidades son modelos del cliente (en memoria o en el almacenamiento local del
equipo) y un recurso de lectura nuevo en la API (`/me`). Contratos: [`contracts/`](contracts/).

## 1. SessionContext — respuesta de `GET /api/v1/me`

| Campo | Tipo | Regla |
|---|---|---|
| `user.id` | UUID | Del token (`sub`) |
| `user.displayName` | texto ≤ 120 | En desarrollo: `SIFCA_DEV_USER_NAME` o «Usuario de desarrollo» |
| `tenant.id` | UUID | Del token (`tid`) |
| `tenant.name` | texto 1–200 | En desarrollo: `SIFCA_DEV_COMPANY_NAME` (spec 013 lo reemplaza) |
| `tenant.nit` | `{ number: "900123456", dv: "8" }` | `SIFCA_DEV_COMPANY_NIT`, por defecto `900123456-8`; DV validado con el algoritmo de la DIAN (R-FE-012) al arrancar la API |
| `permissions` | lista de `modulo.recurso.accion` | Del token (`perms`); orden estable |
| `workingDate` | fecha `YYYY-MM-DD` | Cabecera `X-Sifca-Working-Date` (solo con `SIFCA_ALLOW_DEV_OVERRIDES=true`) › `SIFCA_DEV_WORKING_DATE` › hoy en `America/Bogota` (R-CON-014, FR-024); nunca en producción |
| `authMode` | `dev` | Con la spec 012 se agrega `password` |

Se consulta al arrancar y tras renovar la sesión; si cambian los permisos, menú, paleta y acciones se recalculan.

## 2. PeriodStatus (derivado, para el chip)

Se obtiene de `GET /accounting/periods?year={año de workingDate}` y se elige el período que contiene `workingDate`.

| Estado | Texto del chip | Estilo | Destino al pulsar |
|---|---|---|---|
| `OPEN` | «Oct 2026 · Abierto» | éxito | `/contabilidad/periodos` |
| `CLOSED` | «Sep 2026 · Cerrado» | advertencia | `/contabilidad/periodos` |
| sin período | «Sin período» | neutro | `/contabilidad/periodos` |
| sin permiso `accounting.report.read` | (chip oculto) | — | — |

## 3. ApiProblem (error tipificado del cliente)

| Campo | Tipo | Origen |
|---|---|---|
| `code` | cadena | `problem.code`; desconocido o cuerpo no válido → `INTERNAL_ERROR` |
| `status` | entero | estado HTTP |
| `title`, `detail` | texto | `problem+json` |
| `fieldErrors` | lista `{ path, message, rule? }` | `problem.errors[]`; `path` conserva la forma `lines[2].amount` |
| `requestId` | texto | cuerpo o cabecera `X-Request-Id` |
| `presentation` | `field` · `banner` · `dialog` · `toast` · `page` | del catálogo ([`contracts/ui-error-catalog.md`](contracts/ui-error-catalog.md)) |
| `isKnown` | booleano | `code` presente en el catálogo |

## 4. Registro de navegación

**ScreenRegistration**

| Campo | Regla |
|---|---|
| `id` | único, `modulo.pantalla` (`accounting.journalEntries`) |
| `path` | ruta del mapa del sitio (`/contabilidad/comprobantes`) |
| `title` | texto del menú y de la paleta |
| `module` | uno de los módulos del menú (orden fijo del mapa del sitio) |
| `icon` | ícono del set SIFCA |
| `permission` | permiso requerido (obligatorio; prueba de arquitectura) |
| `keywords` | sinónimos para la paleta (sin tildes) |
| `shortcut` | opcional (`G C`) |
| `showInMenu` | por defecto sí |

**ActionRegistration**: `id`, `title`, `permission`, `shortcut?`, `scope` (`global` o id de pantalla, para acciones
contextuales), `run(context)`.

**SearchProvider**: `prefix` (`#`, `@`), `permission`, `search(texto) → resultados { title, subtitle, path }`.

Regla: un elemento sin permiso del usuario **no existe** para el menú, la paleta ni los atajos (FR-010).

## 5. UiPreferences (almacenamiento local del equipo)

| Campo | Valores | Por defecto |
|---|---|---|
| `theme` | `light` · `slate` · `system` | `system` (cae a `light`) |
| `density` | `compact` · `normal` · `comfortable` | `normal`; **`compact` en las pantallas de Contabilidad** salvo que el usuario elija otra |
| `sidebarCollapsed` | booleano | según ancho |
| `recentCommands` | hasta 8 ids | vacío |

Clave por usuario y empresa (`sifca.ui.{tenantId}.{userId}`). Un valor ilegible se descarta y se usan los valores por
defecto.

## 6. PendingMutation (idempotencia)

| Campo | Regla |
|---|---|
| `idempotencyKey` | UUID v7 creado **una vez** al iniciar la intención del usuario |
| `request` | cuerpo validado con su esquema de `@sifca/contracts` |
| `attempts` | se reintenta automáticamente solo por red caída o `401` renovado; nunca por `4xx` de negocio |
| `state` | `pending` → `paused` (sin conexión) → `pending` → `succeeded` / `failed` |

Una respuesta `200` a una creación repetida se trata como éxito (mismo recurso). `IDEMPOTENCY_CONFLICT` se muestra
como toast y no se reintenta.

## 7. ConnectivityState y SessionState

- `ConnectivityState`: `online` · `offline` (evento del navegador **o** fallo de red de una petición) · `recovering`.
  En `offline` se muestra el banner y se deshabilitan las acciones que envían datos.
- `SessionState`: `active` · `expired` (llegó `401`) · `renewing`. En `expired` se abre el diálogo; las peticiones
  nuevas esperan hasta `active`.
