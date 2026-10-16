# Quickstart: validar las fundaciones del back-office web

Guía para comprobar de punta a punta que la spec 016 funciona. Contratos en [`contracts/`](contracts/), modelo en
[`data-model.md`](data-model.md).

## Requisitos

- El entorno de la API de la spec 001 funcionando (ver [`../001-…/quickstart.md`](../001-contabilidad-comprobantes-inmutables/quickstart.md)):
  PostgreSQL, migraciones y un *tenant* sembrado con `seed:test-chart`.
- Node 22.18+ y pnpm (`.nvmrc`). Chromium para Playwright (en la nube ya está en `/opt/pw-browsers`).

## 1. Levantar API y back-office

```bash
pnpm install && pnpm --filter @sifca/contracts build && pnpm --filter @sifca/design-tokens build

# API (terminal 1)
export JWT_DEV_SECRET=dev-secret-de-al-menos-16 SIFCA_TENANT_ID=<uuid-del-tenant>
export SIFCA_DEV_COMPANY_NAME="Comercializadora Andina S.A.S." SIFCA_DEV_COMPANY_NIT=900123456-8
pnpm --filter @sifca/api start:dev

# Back-office (terminal 2): el proxy de desarrollo inyecta el token; nunca va al navegador
export SIFCA_DEV_TOKEN=$(pnpm --silent --filter @sifca/api dev:token)
pnpm --filter @sifca/admin dev          # http://localhost:5173
```

Resultado esperado: cascarón con «Comercializadora Andina S.A.S. · NIT 900.123.456-8», chip «Oct 2026 · Abierto» y
la lista de comprobantes en `/contabilidad/comprobantes`.

## 2. Recorrido manual

| Paso | Acción | Esperado | Escenario |
|---|---|---|---|
| 1 | Redimensionar a 1440, 1024 y 800 px | Menú expandido, en íconos, en cajón | [016-01] |
| 2 | Menú de usuario → tema Slate y densidad Compacta; recargar | Se conserva; filas de 28 px | [016-03] |
| 3 | Lista de comprobantes con un rango sin datos | «Aún no hay comprobantes en este rango» + acciones | [016-09] |
| 4 | DevTools → *Network* → *Offline* | Banner «Sin conexión a internet» y botones de envío deshabilitados | US4 |
| 5 | `Ctrl+K`, escribir «periodos» y Enter | Navega a Períodos | [016-12] |
| 6 | `Ctrl+K`, escribir `#AJ-1` | Ofrece abrir AJ-1 si existe | US5 |
| 7 | Regenerar el token con solo `accounting.report.read` y recargar | Sin «Nuevo comprobante»; `/contabilidad/comprobantes/nuevo` muestra la página 403 | [016-07] |
| 8 | `Tab` por todo el cascarón | Foco visible de 2 px y orden lógico | US5 |

## 3. Pruebas automatizadas

```bash
pnpm --filter @sifca/admin test:unit        # formatos, money, catálogo de errores, registro, paleta
pnpm --filter @sifca/admin test:component   # cada code A.0 con MSW (SC-001), estados globales
pnpm --filter @sifca/admin test:arch        # reglas de dependencia del frontend y permisos declarados
pnpm --filter @sifca/admin test:e2e         # acceptance/fundaciones-frontend.feature con playwright-bdd + axe
pnpm --filter @sifca/admin storybook        # catálogo de componentes (FR-022)
pnpm --filter @sifca/api test:contract      # /me y el filtro number contra contracts/platform.v1.openapi.yaml
```

Criterios de salida: los 12 escenarios `[016-01]…[016-12]` en verde, axe sin violaciones AA en ambos temas y tres
densidades (SC-002), y `pnpm --filter @sifca/admin build` **falla** con `mode=production` mientras el modo de
autenticación sea `dev-proxy` (FR-021).

## 4. Rendimiento (SC-004)

```bash
pnpm --filter @sifca/admin build --mode e2e && pnpm --filter @sifca/admin preview
pnpm --filter @sifca/admin perf             # Lighthouse CI, red limitada a 10 Mbps: LCP < 2,5 s
```
