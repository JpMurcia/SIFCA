# Contrato de interfaz: registro de módulos del back-office

Es la **única** forma en que una spec posterior agrega pantallas, acciones y búsquedas al back-office (SC-006). Vive en
`apps/admin/src/shell/registry/`. Modelo de datos: [`../data-model.md`](../data-model.md) §4.

## Forma

Cada módulo exporta un `ModuleManifest` desde `apps/admin/src/modules/<modulo>/manifest.ts`:

| Elemento | Contenido | Uso |
|---|---|---|
| `module` | id y orden del módulo en el menú (mapa del sitio) | Menú lateral |
| `screens[]` | `ScreenRegistration` (id, ruta, título, ícono, **permiso**, palabras clave, atajo) + la ruta del enrutador (componente cargado bajo demanda) | Menú, enrutador, guardas, paleta |
| `actions[]` | `ActionRegistration` (id, título, **permiso**, atajo, ámbito global o de pantalla) | Paleta (`>`), atajos, botones |
| `searchProviders[]` | `SearchProvider` (prefijo, **permiso**, función de búsqueda) | Paleta (`#`, `@`) |
| `homeCards[]` | (vacío en esta spec) tarjetas del tablero `4a` | Inicio |

`apps/admin/src/app/modules.ts` es la lista de manifiestos activos; agregar un módulo es una línea.

## Garantías que el cascarón ofrece a cada módulo

1. Una pantalla registrada aparece en el menú, la paleta y el enrutador **solo** si el usuario tiene su permiso; por
   enlace directo sin permiso se ve la página 403 (FR-010).
2. La pantalla se renderiza dentro del cascarón, con tema, densidad, formatos y manejo de errores ya resueltos.
3. Las mutaciones creadas con `useIdempotentMutation` reciben clave de idempotencia y reintentos seguros (FR-012).
4. Las listas que usan `<DataTable>` obtienen esqueleto, vacío, error con reintento y paginación por cursor.
5. Los formularios que usan `<Form schema={…}>` reciben los errores de campo del servidor en sus rutas (FR-007).

## Obligaciones del módulo (verificadas en CI)

- Todo `screen`, `action` y `searchProvider` declara `permission` (prueba de arquitectura: falla si falta).
- Ningún módulo importa otro módulo ni llama a `fetch` directamente (`dependency-cruiser`).
- Ningún módulo define colores o tamaños fuera de los tokens (regla de lint sobre valores literales de color).
- Los textos de botones usan verbos exactos del vocabulario (`04-sistema-de-diseno.md` §10).

## Manifiesto de esta spec

`modules/accounting/manifest.ts` registra, como pantalla de referencia, solo `accounting.journalEntries`
(`/contabilidad/comprobantes`, permiso `accounting.report.read`), la acción `accounting.entry.new` (permiso
`accounting.entry.post`, atajo `N`, ámbito de la lista; abre la página «Próximamente» hasta la UI de la
spec 001) y el proveedor `#` (comprobantes por tipo-número). El resto de entradas del menú aparece **deshabilitado
con la etiqueta «Próximamente»** hasta que su spec lo registre.
