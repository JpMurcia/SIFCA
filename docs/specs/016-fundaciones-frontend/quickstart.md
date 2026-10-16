# Quickstart: validar las fundaciones del back-office web

Guía para comprobar de punta a punta que la spec 016 funciona. Contratos en [`contracts/`](contracts/), modelo en
[`data-model.md`](data-model.md).

## Requisitos

- El entorno de la API de la spec 001 funcionando (ver [`../001-…/quickstart.md`](../001-contabilidad-comprobantes-inmutables/quickstart.md)):
  PostgreSQL, migraciones y un *tenant* sembrado con `seed:test-chart`.
- Node 22.18+ (`.nvmrc`) y npm ≥ 11.20.0. Chromium para Playwright (en la nube ya está en `/opt/pw-browsers`).

## 1. Levantar API y back-office

```bash
npm install && npm run build -w @sifca/contracts && npm run build -w @sifca/design-tokens

# API (terminal 1)
export JWT_DEV_SECRET=dev-secret-de-al-menos-16 SIFCA_TENANT_ID=<uuid-del-tenant>
export SIFCA_DEV_COMPANY_NAME="Comercializadora Andina S.A.S." SIFCA_DEV_COMPANY_NIT=900123456-8
npm run start:dev -w @sifca/api

# Back-office (terminal 2): el proxy lee el token del archivo en cada petición; nunca va al navegador
npm run -s dev:token -w @sifca/api > apps/admin/.dev-token
npm run dev -w @sifca/admin          # http://localhost:5173
```

Para fijar la fecha de trabajo, arranca la API con `SIFCA_DEV_WORKING_DATE=2026-10-16`.

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
| 6 | `Ctrl+K`, escribir `#AJ-1` | Ofrece abrir la lista filtrada por AJ-1 si existe | US5 |
| 7 | Regenerar `apps/admin/.dev-token` con solo `accounting.report.read` (sin reiniciar) y recargar | Sin «Nuevo comprobante»; `/contabilidad/comprobantes/nuevo` muestra la página 403 | [016-07] |
| 8 | `Tab` por todo el cascarón | Foco visible de 2 px y orden lógico | US5 |
| 9 | Abrir `/__e2e/componentes` (solo en desarrollo) | Grilla, formulario y diálogos de demostración para ver cada error | [016-04], [016-05] |

## 3. Pruebas automatizadas

```bash
npm run test:unit -w @sifca/admin        # formatos, money, catálogo de errores, registro, paleta
npm run test:component -w @sifca/admin   # cada code A.0 con MSW (SC-001), estados globales
npm run test:arch -w @sifca/admin        # reglas de dependencia del frontend y permisos declarados
npm run test:e2e -w @sifca/admin         # acceptance/fundaciones-frontend.feature con playwright-bdd + axe
npm run storybook -w @sifca/admin        # catálogo de componentes (FR-022)
npm run test:contract -w @sifca/api      # /me y el filtro number contra contracts/platform.v1.openapi.yaml
```

Criterios de salida: los 12 escenarios `[016-01]…[016-12]` en verde, axe sin violaciones AA en ambos temas y tres
densidades (SC-002), y `npm run build -w @sifca/admin -- --mode production` **falla** mientras el modo de
autenticación sea `dev-proxy` (FR-021).

## 4. Rendimiento (SC-004)

```bash
npm run build -w @sifca/admin -- --mode e2e && npm run preview -w @sifca/admin
npm run perf -w @sifca/admin             # Lighthouse CI, red limitada a 10 Mbps: LCP < 2,5 s
```
