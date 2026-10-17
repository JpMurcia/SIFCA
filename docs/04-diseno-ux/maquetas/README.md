# Maquetas de interfaz (Claude Design)

Las siete tandas de maquetas del brief [`01-brief-claude-design.md`](../01-brief-claude-design.md), versionadas para que
las specs puedan citar sus identificadores (`1a`, `3c`, `7u`…). La auditoría de cobertura y el inventario completo de
las 141 vistas están en [`../../roadmap-specs.md`](../../roadmap-specs.md) §1.

| Archivo | Contenido |
|---|---|
| `tanda-1.dc.html` | Tokens y componentes (`1a/1b`), cascarón web 1440/1024 (`1c–1f`), POS móvil (`1g/1h`) |
| `tanda-2.dc.html` | Login, editor de factura, inventario, integraciones y migración (`2a–2j`); móvil y vitrina (`2k–2r`) |
| `tanda-3.dc.html` | Contabilidad, cartera, impuestos, DIAN, auditoría, multiempresa (`3a–3r`); cobro exprés móvil (`3s–3x`) |
| `tanda-4.dc.html` | Tablero, factura de proveedor, egreso, terceros, notas crédito/débito (`4a–4o`) |
| `tanda-5.dc.html` | Lista de comprobantes, plan de cuentas, cierre anual, IN.7–IN.10, configuración, estados globales (`5a–5r`) |
| `tanda-6.dc.html` | Vitrina pública, publicación, pedidos web y app móvil (`6a–6v`) |
| `tanda-7.dc.html` | Pendientes de la auditoría, densidades, 1024 px y estados 403/esqueleto/vacío (`7a–7aj`) |
| `sifca-icons.js` | Set de íconos SVG de SIFCA (fuente de `apps/admin/src/ui/icons/`, spec 016) |
| `assets/` | Logos SIFCA claro y oscuro (marca y *lockup*) |
| `insumos/` | Archivos de la carpeta `uploads/` del ZIP: el brief tal como se entregó a Claude Design y los conceptos de logo (ver abajo) |
| `original/SIFCA_Mockups_UIUX.zip` | El ZIP exportado de Claude Design, sin cambios (SHA-256 `ff3da739ae4d75b64ad4e26261769fab898bacad223e130d07b994a1ab60223f`) |

**Cómo verlas:** abrir el `.html` en un navegador con Internet. `support.js` (el *runtime* de Claude Design) descarga
React 18 desde unpkg; las fuentes salen de Google Fonts. Son **referencia de diseño**, no código de producción: la
aplicación implementa los tokens en `packages/design-tokens` y los componentes en `apps/admin`.

**Prototipo navegable:** las mismas vistas enlazadas entre sí, con flujos guiados, en [`../prototipo/`](../prototipo/README.md).

## Correspondencia con el ZIP original

Esta carpeta reproduce completo el contenido de `original/SIFCA_Mockups_UIUX.zip` (exportado el 16-oct-2026). Las tandas
son idénticas byte a byte; solo cambian los nombres para que no tengan espacios:

| En el ZIP | En el repositorio |
|---|---|
| `SIFCA Tanda N.dc.html` (N = 1…7) | `tanda-N.dc.html` |
| `support.js`, `sifca-icons.js`, `assets/*.png` | Mismo nombre |
| `uploads/SIFCA - Brief de diseño de interfaz (Claude Design).md` | `insumos/brief-entregado-a-claude-design.md` (versión entregada; la vigente es [`../01-brief-claude-design.md`](../01-brief-claude-design.md)) |
| `uploads/Diseño sin título CLARO.png` / `OSCURO.png` | `insumos/logo-concepto-claro.png` / `logo-concepto-oscuro.png` |
| `uploads/Gemini_Generated_Image_7gxfsl7gxfsl7gxf (1).svg` | `insumos/logo-gemini.svg` |
| `uploads/export-2026-10-14 161628.svg` | `insumos/logo-export-2026-10-14.svg` |
| `.thumbnail` | `insumos/miniatura-claude-design.webp` |
