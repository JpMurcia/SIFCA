# Especificaciones (Spec Kit)

Cada **caso de uso** de SIFCA tiene su especificación en `docs/specs/NNN-nombre/`, con criterios de aceptación
**ejecutables** (Gherkin) y trazabilidad a las reglas normativas. Gobernanza:
[`../constitution.md`](../constitution.md) (principio VIII). Matriz generada:
[`traceability-matrix.md`](traceability-matrix.md).

## Índice de especificaciones

| # | Caso de uso | Reglas principales | Fase |
|---|---|---|---|
| [001](001-contabilidad-comprobantes-inmutables/spec.md) | Contabilidad: comprobantes inmutables, reversiones, períodos y balance de prueba | R-CON | F2 |
| [002](002-emision-factura-venta/spec.md) | Emisión de factura de venta (transacción ACID: consecutivo, impuestos, inventario, cartera, asiento) | R-CON, R-FE, R-INV, R-IMP | F3 |
| [003](003-ventas-credito-y-cartera/spec.md) | Ventas a crédito y cartera: cupo, plazos, edades, recibos, mora y bloqueo de despacho | R-CAR | F4 |
| [004](004-devoluciones-ventas-nota-credito/spec.md) | Devoluciones en ventas con nota crédito y reingreso a kardex (RMA) | R-INV-040…046, R-FE-009/010 | F4 |
| [005](005-compras-y-devolucion-proveedor/spec.md) | Compras, retenciones practicadas y devolución a proveedor | R-INV-002/045, R-CAR-020…023 | F4 |
| [006](006-inventario-kardex-costeo/spec.md) | Kardex y costeo: promedio ponderado, PEPS y política de despacho | R-INV-001…018 | F3 |
| [007](007-clasificacion-abc-y-conteos/spec.md) | Clasificación ABC y conteos cíclicos | R-INV-020…023 | F5 |
| [008](008-punto-de-reorden/spec.md) | Punto de reorden y stock de seguridad | R-INV-030…034 | F5 |
| [009](009-facturacion-electronica-pta/spec.md) | Facturación electrónica mediante PTA (puerto `EInvoiceProvider`) | R-FE | F3 |
| [010](010-motor-impuestos-y-retenciones/spec.md) | Motor de impuestos y retenciones con vigencias | R-IMP | F3 |
| [011](011-multitenancy-api-y-webhooks/spec.md) | Aislamiento por tenant, API Keys, idempotencia y webhooks | Constitución IV, IX | F2 |

## Estructura de una especificación

```text
docs/specs/NNN-nombre/
├── spec.md                  # QUÉ y POR QUÉ (formato de la plantilla de Spec Kit + secciones de SIFCA)
├── acceptance/
│   └── *.feature            # Criterios de aceptación ejecutables (Gherkin en español)
├── plan.md                  # (lo genera /speckit-plan) CÓMO, con la verificación de constitución
├── tasks.md                 # (lo genera /speckit-tasks)
└── checklists/              # (lo generan /speckit-specify y /speckit-checklist)
```

`spec.md` sigue la plantilla de Spec Kit (`User Scenarios & Testing`, `Requirements`, `Success Criteria`,
`Assumptions`) y añade dos secciones obligatorias: **Trazabilidad de reglas** y **Verificación de
constitución**. Cada requisito funcional cita entre paréntesis y en cursiva las reglas que implementa:
`- **FR-001**: … *(R-CON-001, R-CON-002)*`.

## Criterios de aceptación ejecutables (Gherkin)

- Archivos `acceptance/*.feature` en **español** (`# language: es`): `Característica`, `Antecedentes`,
  `Escenario`, `Esquema del escenario`, `Ejemplos`, `Dado`, `Cuando`, `Entonces`, `Y`, `Pero`.
- **Id de escenario obligatorio:** el nombre empieza con `[NNN-NN]` (el número de la spec y un consecutivo), p. ej.
  `Escenario: [002-03] La emisión es idempotente`.
- **Etiquetas de trazabilidad obligatorias:** cada escenario lleva al menos una etiqueta de regla (`@R-CON-001`),
  de principio de la constitución (`@P-III`), de ADR (`@ADR-0006`) o de invariante del modelo (`@INV-05`).
- Los números de los ejemplos salen de los catálogos de reglas (`docs/02-normativa-y-reglas/`) y están
  verificados por cálculo exacto.
- **Ejecución:** se implementan con un ejecutor Cucumber sobre una base PostgreSQL real
  (`@cucumber/cucumber`, Testcontainers). Las definiciones de pasos se escriben durante `/speckit-implement`
  de cada spec; hasta entonces el CI valida que los `.feature` estén bien formados y trazados.

## Verificación automática (`scripts/docs.mjs`)

```bash
node scripts/docs.mjs check            # enlaces, reglas definidas, Gherkin, specs, espejo y matriz
node scripts/docs.mjs check --strict   # además valida los .feature con el parser oficial de Gherkin (npx)
node scripts/docs.mjs matrix           # regenera traceability-matrix.md
node scripts/docs.mjs sync             # copia docs/constitution.md a .specify/memory/constitution.md
```

`check` falla si: una regla citada no existe; un escenario carece de id, etiquetas o pasos Dado/Cuando/Entonces;
un esquema usa una columna que no está en `Ejemplos`; hay un enlace roto; el espejo de la constitución difiere;
una spec carece de secciones obligatorias; o la matriz está desactualizada.

## Uso con las skills de Spec Kit

Las skills `speckit-*` (instaladas desde `dceoy/speckit-agent-skills`) y `clean-architecture` (de
`wondelai/skills`) están en `.claude/skills/`; el andamiaje de Spec Kit (`.specify/`: plantillas y scripts)
lo generó el CLI oficial (`specify init --here --integration claude --script sh`).

| Paso | Comando | Notas para este repositorio |
|---|---|---|
| 1 | `/speckit-constitution` | La constitución canónica es `docs/constitution.md`. **No** edite `.specify/memory/constitution.md` a mano: es un espejo (`sync`) |
| 2 | `/speckit-specify` | Por defecto Spec Kit crea `specs/NNN-…`. Para usar `docs/specs/`, defina `SPECIFY_FEATURE_DIRECTORY=docs/specs/NNN-nombre` (Spec Kit lo admite) o escriba `{"feature_directory": "docs/specs/NNN-nombre"}` en `.specify/feature.json` |
| 3 | `/speckit-clarify` | Resuelva los `[NEEDS CLARIFICATION]` (las specs vigentes no deben tener ninguno) |
| 4 | `/speckit-plan` | El plan debe responder los **gates G-01…G-12** de la constitución («Constitution Check») |
| 5 | `/speckit-tasks` | Tareas por historia de usuario; incluya las definiciones de pasos de los `.feature` |
| 6 | `/speckit-implement` | Pruebas primero: haga pasar los escenarios de `acceptance/` |
| 7 | `/speckit-analyze`, `/speckit-checklist` | Control cruzado de consistencia y calidad |

La skill `clean-architecture` se usa al planificar e implementar: orienta dónde va cada pieza de código
(entidades, casos de uso, adaptadores, *composition root*) y aporta un diagnóstico de la regla de dependencia
que complementa los gates G-01…G-03.

> **Nota sobre `plan.md`:** la plantilla de Spec Kit propone una estructura de código genérica; para SIFCA el
> plan DEBE usar la estructura de capas de `docs/01-arquitectura/01-vision-general-y-modulos.md` §4 y §5.
