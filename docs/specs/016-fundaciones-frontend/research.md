# Research: Fundaciones del back-office web

Fase 0 de [`plan.md`](plan.md). Cada decisión con su motivo y las alternativas evaluadas. Versiones consultadas en el
registro de npm el 16-oct-2026; se fijan **exactas** (sin `^`) como en el resto del monorepo y, al instalar, se toma
la última versión publicada hace **al menos 14 días** de cada línea indicada (higiene de cadena de suministro).

## 1. Biblioteca de componentes del back-office

**Decision:** primitivas accesibles sin estilos (**Radix UI**, paquete unificado `radix-ui` 1.8.x) + estilos propios
con **Tailwind CSS 4.3** sobre **variables CSS** que son exactamente los tokens de las maquetas `1a/1b`, siguiendo el
patrón de *shadcn/ui* (el código de cada componente vive en el repositorio). Tablas con **TanStack Table 9** +
**TanStack Virtual 3**. Formularios con **React Hook Form 7.90** + `@hookform/resolvers` 5.9 (`zodResolver`).

**Rationale:**
- Las maquetas fijan valores exactos (colores Claro y Slate, filas de 28/36/44 px, radio 6/10 px, Inter y JetBrains
  Mono). Con variables CSS y Tailwind se reproducen 1:1 y el cambio de tema/densidad es cambiar un atributo en
  `<html>` sin re-render (FR-004, FR-005).
- Radix resuelve foco atrapado, roles ARIA, `Esc`, navegación por teclado de menús y diálogos: cubre gran parte de
  FR-018 (WCAG 2.1 AA) sin trabajo propio.
- Un solo sistema de diseño para todo el back-office (la alternativa de `03-evaluacion-de-librerias.md` §3.4 la
  señalaba si la edición tipo hoja era central, y lo es: comprobantes, facturas, kardex).
- Peso: sin CSS-in-JS en tiempo de ejecución; ayuda a SC-004 (< 2,5 s).

**Alternatives considered:**
- *Ant Design 6* (la recomendación provisional era AntD 5): gran productividad, pero ajustar sus tokens a Slate y a
  tres densidades exactas, más su CSS-in-JS, cuesta más que construir ~25 componentes sobre Radix; además no resuelve
  la grilla editable (U-2) y obligaría a mezclar dos sistemas.
- *MUI + DataGrid*: funciones de grilla clave en niveles de pago.
- *AG Grid Community* como base general: es solo grilla. **Se mantiene como plan B exclusivamente para la grilla
  editable** si el spike S-UI (§9) muestra que TanStack no alcanza.

## 2. Enrutamiento y guardas por permiso

**Decision:** **TanStack Router 1.170** con rutas definidas en código y parámetros de búsqueda tipados y validados con
Zod (filtros de listas en la URL). La guarda por permiso va en `beforeLoad`: si falta el permiso, la ruta **renderiza**
la página 403 en la misma URL (no redirige), como pide FR-010.

**Rationale:** búsqueda tipada (filtros `from`, `to`, `voucherType`… reproducibles por URL), `useBlocker` para
«cambios sin guardar», precarga de datos por ruta y buen soporte de división de código.

**Alternatives considered:** *React Router 7* (modo datos): válido, pero sin validación tipada de parámetros de
búsqueda de serie. *Next.js* para el back-office: innecesario (no hay SEO ni SSR); queda para la vitrina (024).

## 3. Datos remotos, reintentos e idempotencia

**Decision:** **TanStack Query 5.104** para lecturas y mutaciones, detrás de un cliente HTTP propio (`fetch`) que:
1. valida cada respuesta exitosa con el esquema Zod de `@sifca/contracts`;
2. convierte toda respuesta de error en un `ApiProblem` tipificado (§4);
3. añade `X-Request-Id` (UUID) y, en mutaciones de creación, `Idempotency-Key`.

La clave de idempotencia se crea **una vez por intención del usuario** (al pulsar «Contabilizar») y viaja en las
variables de la mutación; cualquier reintento (red caída, sesión renovada) reutiliza esa misma clave (FR-012, SC-005).
Las mutaciones se **pausan** sin conexión (`onlineManager`) y se reanudan al reconectar.

**Rationale:** el servidor ya implementa idempotencia (spec 001: misma clave y mismo cuerpo → `200` con el mismo
recurso). Generar la clave por intención y no por petición es lo que evita duplicados.

**Alternatives considered:** *SWR* (sin mutaciones pausables ni persistencia de variables); *RTK Query* (añade Redux
sin necesidad).

## 4. Errores tipificados y catálogo A.0

**Decision:** un **catálogo único** `code → { severidad, ubicación, texto }` en `apps/admin/src/platform/errors/`
con las ubicaciones del catálogo A.0: `field`, `banner`, `dialog`, `toast`, `page`. El parseo del cuerpo de error en
el cliente es **tolerante**: `code` se lee como cadena y, si no está en el catálogo o el cuerpo no es
`application/problem+json` (p. ej. HTML de un proxy 502), se degrada a `INTERNAL_ERROR` genérico conservando el
`requestId` si llegó en el cuerpo o en la cabecera, sin mostrar el cuerpo crudo (FR-008, [016-06]).

`@sifca/contracts` exporta además `KnownProblemCodes` y `ProblemEnvelopeSchema` (código abierto) para que el cliente
no se rompa cuando una spec futura agregue códigos (`CREDIT_LIMIT_EXCEEDED`, `INSUFFICIENT_STOCK`…).

Los errores de campo se resuelven por **ruta** (`lines[2].accountCode`): el formulario registra sus campos con la
misma ruta que usa el contrato, de modo que React Hook Form `setError(path)` marca la celda exacta (FR-007).

## 5. Sesión, permisos y contexto de trabajo antes de la spec 012

**Decision:**
- **Modo de autenticación `dev-proxy`:** el servidor de Vite (`server.proxy` **y** `preview.proxy`) actúa como
  *proxy* de `/api` hacia la API y **añade** `Authorization: Bearer <token>`. El token se lee **en cada petición** desde
  el archivo `SIFCA_DEV_TOKEN_FILE` (por defecto `apps/admin/.dev-token`, ignorado por git), de modo que regenerarlo
  con `npm run -s dev:token -w @sifca/api > apps/admin/.dev-token` surte efecto al recargar, sin reiniciar. Si el
  archivo no existe se usa la variable `SIFCA_DEV_TOKEN`. El token **nunca** entra en el *bundle*. `vite build` con
  `mode=production` falla si el modo de autenticación es `dev-proxy` (FR-021).
- **Pruebas E2E con permisos por escenario:** solo en `mode=e2e`, el *proxy* acepta la cabecera
  `x-sifca-e2e-token` (que Playwright fija por escenario con `extraHTTPHeaders`), la convierte en `Authorization` y la
  elimina antes de reenviar. En cualquier otro modo la cabecera se descarta. Así [016-07] y [016-12] usan un token con
  solo `accounting.report.read` y el resto un token completo, sin reiniciar el servidor.
- **Fecha de trabajo reproducible (FR-024):** la API calcula `workingDate` así: cabecera `X-Sifca-Working-Date` si
  `SIFCA_ALLOW_DEV_OVERRIDES=true`; si no, la variable `SIFCA_DEV_WORKING_DATE`; si no, hoy en `America/Bogota`. Ambas
  opciones solo existen fuera de producción (la API ya se niega a arrancar con `NODE_ENV=production`, y `loadEnv`
  rechaza `SIFCA_ALLOW_DEV_OVERRIDES` en producción). Las pruebas E2E fijan la fecha por escenario: [016-01] con
  `2026-10-16`, [016-02] con `2026-09-15`; así no fallan cuando cambie el mes real.
- **Endpoint nuevo `GET /api/v1/me`** en la plataforma de la API: devuelve usuario, empresa (id, nombre, NIT),
  permisos y fecha de trabajo (hoy en Colombia). Mientras no exista la spec 013, nombre y NIT salen de variables de
  entorno de desarrollo (`SIFCA_DEV_COMPANY_NAME`, `SIFCA_DEV_COMPANY_NIT`). Contrato en
  [`contracts/platform.v1.openapi.yaml`](contracts/platform.v1.openapi.yaml).
- `401 UNAUTHENTICATED` en cualquier llamada abre el diálogo «Tu sesión venció»; al continuar se reintenta **una sola
  vez** la operación pendiente con su misma clave de idempotencia. Con la spec 012 el diálogo pedirá la contraseña y
  usará el *refresh token*; la interfaz del componente no cambia.

**Rationale:** permite construir y probar todo el comportamiento de sesión y permisos sin adelantar IAM; leer los
permisos desde `/me` (y no decodificando el JWT en el navegador) es el mismo contrato que usará 012/017.

**Alternatives considered:** pegar el token en `localStorage` (riesgo de filtrarlo y de llevarlo a producción);
decodificar el JWT en el cliente (acopla la UI al formato del token).

## 6. Búsqueda por número de documento (`#AJ-1`)

**Decision:** añadir el filtro opcional `number` (entero ≥ 1, solo junto con `voucherType`) a
`GET /accounting/journal-entries`. La paleta interpreta `#AJ-1` como `voucherType=AJ&number=1` y ofrece abrir el
resultado. Cambio retrocompatible del contrato de la spec 001 (parámetro opcional).

**Alternatives considered:** un índice de búsqueda global (excesivo hoy); traer la primera página y filtrar en el
cliente (incorrecto con paginación).

## 7. Formatos `es-CO` y dinero exacto en el cliente

**Decision:** `Intl.NumberFormat('es-CO')` y `Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota' })` para
presentar; **decimal.js 10.6.0** (la misma versión que la API) detrás de un módulo `money` del cliente para sumar
y comparar. El formateo de importes parte de la **cadena** decimal (se separa entero y fracción sin convertir a
`number`) para no perder precisión en valores grandes. Entrada: analizador propio que acepta `1190000,5`,
`1.190.000,50` y pegado desde hoja de cálculo, y fechas `14102026`, `14/10/26`, `14/10/2026`.

**Rationale:** FR-015/016, R-CON-009, R-CON-014. `Intl` cubre el formato y es estándar; el cálculo nunca usa `number`.
Una regla de ESLint prohíbe `parseFloat`/`Number()` sobre campos `MoneyString`.

## 8. Tokens de diseño compartidos

**Decision:** paquete **`packages/design-tokens`**: una fuente JSON (colores Claro y Slate, tipografía, espaciado,
radios, densidades) que genera `tokens.css` (variables CSS consumidas por Tailwind) y un objeto TypeScript que
reutilizarán la vitrina (024) y la app móvil (025). Fuentes Inter y JetBrains Mono **autoalojadas** (paquetes
`@fontsource-variable/*`), sin llamadas a Google Fonts (privacidad y funcionamiento sin CDN). Íconos: el set SVG de
las maquetas (`sifca-icons.js`) convertido a componentes; `lucide-react` solo como respaldo.

**Nombre del tema oscuro:** «Slate» (tandas 2–7) reemplaza al «Oscuro suave» de la maqueta `1b`; en código y
documentación se usa `slate`.

**Contraste:** una prueba recorre los pares texto/fondo del JSON y exige ≥ 4,5:1 (texto) y ≥ 3:1 (bordes y foco) en
ambos temas (SC-002).

## 9. Spike S-UI acotado a esta spec

**Decision:** el spike S-UI (`03-evaluacion-de-librerias.md` §3.4) se ejecuta como **primera tarea** de esta spec,
limitado a 1 día: grilla de 300 líneas editables con TanStack Table + Virtual, navegación Tab/Enter/flechas, pegado
de 20 filas, totales con decimal.js y `Ctrl+K` con foco en una celda; medir render de 5.000 filas de solo lectura.
**Criterio de éxito:** desplazamiento sin cortes visibles y render inicial < 500 ms en 5.000 filas. Si falla, la
grilla editable de la spec 001 (UI) usará AG Grid Community; **el resto de esta spec no cambia**.

## 10. Paleta de comandos

**Decision:** **cmdk 1.1.1** como motor (accesible, *combobox*), con filtro propio que normaliza tildes
(`NFD` sin diacríticos) y prefijos `>`, `#`, `@`, `/`. Fuentes: el **registro de navegación** (pantallas y acciones
declaradas por cada módulo, ya filtradas por permiso) y *proveedores de búsqueda* asíncronos que cada módulo registra
(`#` → comprobantes en esta spec; `@` → terceros en la spec 020). Recientes en el almacenamiento local del equipo.

**Nota:** cmdk 1.1.1 es de mar-2025 (estable, sin publicaciones nuevas). Riesgo bajo; si se abandona, se reemplaza
por un *combobox* de Radix sin cambiar el registro.

## 11. Pruebas

| Nivel | Herramienta | Qué cubre |
|---|---|---|
| Unidad | Vitest 5.0 (la del monorepo) | Formatos, analizadores de entrada, `money`, catálogo de errores, filtro de la paleta, registro de navegación |
| Componentes | Vitest + Testing Library 16.3 + jsdom + **MSW 3.0** | Cada código A.0 con respuestas simuladas (SC-001), estados globales, guardas |
| Catálogo visual | **Storybook 10.6** con `@storybook/addon-a11y` | FR-022: cada componente en ambos temas y tres densidades |
| E2E y aceptación | **Playwright 1.64** + **playwright-bdd 9.2** | Ejecuta **el mismo** `acceptance/fundaciones-frontend.feature` contra la API real (PostgreSQL de pruebas); [016-04] y [016-06] con respuestas interceptadas |
| Accesibilidad | `@axe-core/playwright` 4.14 | Cero violaciones AA en cascarón, paleta, 403 y lista, en ambos temas y tres densidades (SC-002) |
| Rendimiento | Lighthouse CI sobre el *build* de *preview* | SC-004: LCP < 2,5 s con red limitada a 10 Mbps |

**Rationale:** `playwright-bdd` permite cumplir el principio VIII («los mismos `.feature` son la prueba») en el
frontend, como Cucumber lo hace en la API.

## 12. Estructura y reglas de dependencia del frontend

**Decision:** `apps/admin/src/` en cuatro zonas: `app/` (arranque, *providers*, enrutador), `platform/` (HTTP,
errores, sesión, permisos, idempotencia, conectividad, formatos, preferencias), `ui/` (sistema de diseño y estados
globales, sin dependencias de `platform/` ni de módulos), `shell/` (cascarón, menú, barra, paleta, ayuda de atajos) y
`modules/<modulo>/` (registro + pantallas). Reglas de `dependency-cruiser` en el frontend:
`ui` no importa nada de la app; `modules/x` no importa `modules/y`; nadie importa de `apps/api`; solo
`platform/http` llama a `fetch`.

## 13. Despliegue

**Decision:** el *build* es estático (`dist/`); en producción lo sirve el mismo dominio que la API detrás de un
proxy inverso (`/api/v1` → API), así no hace falta CORS. Este despliegue queda **bloqueado** hasta la spec 012
(FR-021); en esta spec solo hay `dev` y `preview` local.

## 14. Pantalla de demostración para pruebas (FR-023)

**Decision:** módulo `apps/admin/src/e2e-harness/` con rutas `/__e2e/componentes` (grilla de líneas de demostración,
formulario con «Fecha contable» y «Descripción», diálogo de reversión simulado, formulario con cambios sin guardar) y
`/__e2e/contabilizar` (envía un comprobante real a `POST /accounting/journal-entries` con `useIdempotentMutation`). Se
registra **solo** si `import.meta.env.MODE` es `development` o `e2e`; en `production` el import dinámico no existe y
el *bundler* lo elimina. Una prueba busca la cadena `__e2e` en `dist/` del *build* de producción y falla si aparece.

**Rationale:** los escenarios [016-04], [016-05] y [016-08] y el estado «cambios sin guardar» necesitan grilla, campos
y un envío real que pertenecen a la interfaz de la spec 001. Probar los componentes sobre una pantalla de demostración
evita adelantar esa interfaz y sigue usando la API real.

**Alternatives considered:** pasar esos escenarios a pruebas de componentes (pierde la verificación de punta a punta
de la idempotencia); construir ya el editor de comprobantes (es la UI de la spec 001 y duplicaría su alcance).
