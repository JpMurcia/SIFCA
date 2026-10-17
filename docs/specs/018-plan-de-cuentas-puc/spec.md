# Feature Specification: Plan de cuentas (PUC) gestionable

**Feature Branch**: `018-plan-de-cuentas-puc`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "SPEC-018 de la hoja de ruta (`docs/roadmap-specs.md` §2.3, Ola 2): gestión del plan de
cuentas por empresa (hoy solo lectura): crear auxiliares, desactivar, marcar «exige tercero» y «exige centro de costo»,
clasificación para estados financieros; niveles protegidos (clase, grupo, cuenta de 4 dígitos); las cuentas con
movimiento no cambian código ni naturaleza; mapeo concepto → cuenta (cuentas por defecto); PUC base colombiano
sembrado al crear la empresa; centros de costo. Maqueta: plan de cuentas 5c/5d."

## Contexto

La spec 001 contabiliza contra un plan de cuentas que hoy siembra un *script* de pruebas y que la interfaz solo puede
leer. Las plantillas de contabilización automática (ventas, compras, inventario, cierre anual) no usan códigos fijos sino
**conceptos** (`REVENUE`, `VAT_OUTPUT`, `COGS`…) que cada empresa asigna a sus cuentas
([`02-…/01-…` §3.2](../../02-normativa-y-reglas/01-contabilidad-partida-doble-y-puc.md)). Esta spec entrega el plan
editable con sus reglas, el **PUC base** para empresas nuevas, los centros de costo, el mapeo de conceptos y la
clasificación que necesitan los estados financieros (spec 019).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear y mantener cuentas auxiliares (Priority: P1)

El contador agrega la auxiliar `11100501 Bancolombia cuenta corriente` bajo `111005 Bancos nacionales`, marca que exige
centro de costo si aplica y la usa de inmediato en un comprobante.

**Why this priority**: cada empresa necesita sus propias auxiliares (bancos, clientes especiales, gastos) para
contabilizar.

**Independent Test**: crear una auxiliar, contabilizar en ella y verificar que la cuenta padre ya no admite movimiento.

**Acceptance Scenarios**:

1. **Dado** `111005` sin movimientos, **Cuando** el contador crea `11100501`, **Entonces** hereda la naturaleza débito,
   queda activa y admite movimiento, y `111005` pasa a ser acumuladora.
2. **Dado** un código que no empieza por el de su padre o con longitud de nivel inválida (p. ej. `1110051` bajo
   `111005`), **Cuando** se guarda, **Entonces** se rechaza con la regla de estructura.
3. **Dado** `130505` con movimientos, **Cuando** se intenta crearle una auxiliar, **Entonces** se rechaza: una cuenta
   con movimientos no puede volverse acumuladora.

---

### User Story 2 - Proteger la estructura y la historia contable (Priority: P1)

Nadie puede alterar lo que da sentido a los saldos ya registrados: los niveles clase, grupo y cuenta de 4 dígitos son
protegidos, y una cuenta con movimientos no cambia de código ni de naturaleza. Desactivar exige saldo cero.

**Why this priority**: un cambio así falsearía libros y balances ya emitidos (constitución I).

**Independent Test**: intentar cada cambio prohibido sobre cuentas con y sin movimientos.

**Acceptance Scenarios**:

1. **Dado** `1435` (nivel protegido), **Cuando** se intenta renombrar, desactivar o eliminar, **Entonces** se
   rechaza; solo se permiten cambios de clasificación.
2. **Dado** una auxiliar con movimientos, **Cuando** se intenta cambiar su código o su naturaleza, **Entonces** se
   rechaza con `CONFLICT`; su nombre sí puede cambiar con historial.
3. **Dado** una auxiliar con saldo distinto de cero a hoy, **Cuando** se intenta desactivar, **Entonces** se rechaza
   indicando el saldo; con saldo cero se desactiva y deja de aparecer al contabilizar.
4. **Dado** una auxiliar sin movimientos ni hijos, **Cuando** se elimina, **Entonces** desaparece; con movimientos
   nunca se puede eliminar.

---

### User Story 3 - Cuentas por defecto: mapeo de conceptos (Priority: P1)

El contador decide qué cuenta usa cada evento automático: ventas, IVA generado, costo de ventas, inventario, caja,
bancos, retenciones, ganancias y pérdidas, utilidad del ejercicio. Los cambios tienen fecha de vigencia y no alteran lo
ya contabilizado.

**Why this priority**: las specs 002 a 006 contabilizan por concepto; sin mapeo no hay contabilización automática.

**Independent Test**: mapear `REVENUE` a `413595`, cambiarlo con vigencia futura y consultar el mapeo a dos fechas.

**Acceptance Scenarios**:

1. **Dado** una empresa nueva, **Entonces** todos los conceptos obligatorios están mapeados a cuentas del PUC base.
2. **Dado** `REVENUE → 413595`, **Cuando** el contador programa `REVENUE → 41359501` desde 01/11/2026 con motivo,
   **Entonces** el mapeo a 31/10/2026 devuelve `413595` y a 01/11/2026 devuelve `41359501`.
3. **Dado** una cuenta acumuladora o inactiva, **Cuando** se intenta mapear a un concepto, **Entonces** se rechaza: un
   concepto solo apunta a una cuenta de movimiento activa.
4. **Dado** una cuenta mapeada a un concepto vigente, **Cuando** se intenta desactivar, **Entonces** se rechaza
   nombrando el concepto.

---

### User Story 4 - Exigencias por cuenta: tercero y centro de costo (Priority: P2)

El contador marca qué cuentas exigen tercero y cuáles exigen centro de costo; desde ese momento los comprobantes nuevos
que usen esas cuentas lo piden. También administra el catálogo de centros de costo.

**Why this priority**: cartera, proveedores e impuestos necesitan el tercero en la línea (R-CON-008).

**Independent Test**: marcar «exige centro de costo» en una cuenta de gasto y contabilizar con y sin centro.

**Acceptance Scenarios**:

1. **Dado** `519530` marcada «exige centro de costo», **Cuando** se contabiliza una línea sin centro, **Entonces** se
   rechaza en esa línea con la regla R-CON-008.
2. **Dado** comprobantes anteriores al cambio sin centro, **Entonces** siguen válidos; la exigencia solo aplica a
   comprobantes nuevos.
3. **Dado** el centro de costo «ADM Administración», **Cuando** se desactiva, **Entonces** deja de ofrecerse en
   comprobantes nuevos y sigue visible en los anteriores.

---

### User Story 5 - Clasificación para estados financieros (Priority: P2)

Cada cuenta de 4 dígitos tiene una partida de estado financiero (p. ej. «Efectivo y equivalentes», «Inventarios»,
«Ingresos de actividades ordinarias») y, si es de balance, si es corriente o no corriente. Las subcuentas y auxiliares la
heredan salvo que se cambie.

**Why this priority**: es el insumo de la spec 019; sin clasificación no hay estados financieros.

**Independent Test**: consultar la clasificación efectiva de una auxiliar heredada y de una con clasificación propia.

**Acceptance Scenarios**:

1. **Dado** el PUC base, **Entonces** toda cuenta de las clases 1 a 6 tiene clasificación efectiva (propia o
   heredada).
2. **Dado** `11100501` sin clasificación propia, **Entonces** su clasificación efectiva es la de `1110` («Efectivo y
   equivalentes de efectivo», corriente).
3. **Dado** una cuenta de las clases 1 a 3 marcada «no corriente», **Entonces** el estado de situación financiera de la
   spec 019 la presenta en el bloque no corriente.

---

### User Story 6 - Ver y exportar el plan (Priority: P3)

Cualquier usuario con acceso de lectura navega el árbol por niveles, busca por código o nombre, filtra «solo de
movimiento» y exporta el plan a CSV.

**Why this priority**: consulta diaria; la lectura ya existe parcialmente en la spec 001.

**Independent Test**: buscar «bancos» y exportar.

**Acceptance Scenarios**:

1. **Dado** el árbol, **Cuando** busca «bancos», **Entonces** ve `1110` y sus descendientes resaltados con la ruta
   completa.
2. **Dado** el plan, **Cuando** exporta, **Entonces** obtiene un CSV con código, nombre, nivel, naturaleza, admite
   movimiento, exigencias, clasificación y estado.

### Edge Cases

- **Cuenta auxiliar con 10 o 12 dígitos**: válida si empieza por el código del padre y respeta el máximo de 12.
- **Nombre duplicado** entre cuentas: permitido (el código es el identificador), con advertencia.
- **Reactivar una cuenta**: permitido con motivo; vuelve a ofrecerse al contabilizar.
- **Clase 7, 8 y 9**: existen en el PUC base pero sin clasificación de estados financieros en el MVP (fuera de
  alcance: producción y cuentas de orden en notas).
- **Concepto sin mapeo vigente** en una fecha: la contabilización automática que lo necesite falla con un error que
  nombra el concepto (lo verifican las specs que contabilizan).
- **Cambio de «exige tercero»** en una cuenta con movimientos: permitido; no revalida comprobantes anteriores.
- **Dos usuarios editan la misma cuenta**: control de versión; el segundo recibe `CONFLICT` y recarga.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El plan de cuentas MUST ser por empresa, jerárquico por prefijo de código: clase (1 dígito), grupo (2), cuenta (4), subcuenta (6) y auxiliar (8 a 12 dígitos); el código de una cuenta MUST empezar por el de su padre y tener la longitud del nivel siguiente *(R-CON-003)*.
- **FR-002**: Una cuenta nueva MUST heredar la naturaleza de su padre; la naturaleza de cada clase sigue la tabla de R-CON-013 *(R-CON-013)*.
- **FR-003**: Solo las cuentas sin hijos, activas y marcadas como de movimiento MUST admitir líneas de comprobante; crear un hijo bajo una cuenta MUST convertirla en acumuladora y MUST rechazarse si esa cuenta ya tiene movimientos *(R-CON-003, INV-03)*.
- **FR-004**: Los niveles clase, grupo y cuenta de 4 dígitos del PUC base MUST ser protegidos: no se renombran, no se desactivan ni se eliminan; solo se cambia su clasificación *(R-CON-013, P-I)*.
- **FR-005**: Una cuenta con movimientos MUST conservar su código y su naturaleza; su nombre puede cambiar con historial *(R-CON-013, P-I)*.
- **FR-006**: Desactivar una cuenta MUST exigir saldo cero a la fecha, que no tenga hijos activos y que no esté mapeada a un concepto vigente; eliminarla solo MUST permitirse si nunca tuvo movimientos ni hijos *(R-CON-003, P-I)*.
- **FR-007**: Cada cuenta MUST poder marcar «exige tercero» y «exige centro de costo»; la exigencia aplica a los comprobantes contabilizados después del cambio *(R-CON-008)*.
- **FR-008**: El sistema MUST administrar centros de costo por empresa (código único, nombre, activo); uno inactivo no se ofrece en comprobantes nuevos *(R-CON-008)*.
- **FR-009**: El sistema MUST mantener el mapeo **concepto → cuenta** con vigencia desde y motivo, para todos los conceptos de `02-…/01-…` §3.3 más `PROFIT_AND_LOSS` (grupo 59) y `RETAINED_RESULT` (grupo 36) del cierre anual; un concepto solo MUST apuntar a una cuenta de movimiento activa *(R-CON-012, ADR-0005)*.
- **FR-010**: El mapeo aplicable a un evento MUST ser el vigente en su fecha contable, de forma determinista; cambiarlo MUST NOT alterar comprobantes ya contabilizados *(ADR-0005, P-I)*.
- **FR-011**: Cada cuenta de las clases 1 a 6 MUST tener clasificación efectiva de estado financiero (partida y, en balance, corriente/no corriente), propia o heredada del ancestro más cercano *(R-CON-013)*.
- **FR-012**: Al crear una empresa MUST sembrarse el **PUC base**: clases 1 a 9, grupos y cuentas de 4 dígitos usuales del comercio, las subcuentas de movimiento que usan las plantillas, su clasificación y el mapeo de todos los conceptos *(R-CON-012, P-VII)*.
- **FR-013**: Todo cambio al plan, a centros de costo, a exigencias, a clasificaciones y a mapeos MUST quedar en historial con autor, valor anterior, nuevo, motivo (obligatorio en desactivar, reactivar y mapear) e instante *(P-I)*.
- **FR-014**: El plan MUST consultarse como árbol con búsqueda por código o nombre sin tildes, filtro «solo de movimiento» y exportación CSV *(R-CON-010)*.
- **FR-015**: Las operaciones MUST exigir `accounting.chart.manage` (escritura) o `accounting.report.read` (lectura) y estar aisladas por empresa *(P-IV, ADR-0002)*.
- **FR-016**: El control de versión de cada cuenta MUST impedir que una edición concurrente sobrescriba otra (`CONFLICT`) *(P-I)*.

### Key Entities *(include if feature involves data)*

- **Cuenta** (existente, se amplía): código, nombre, padre, nivel, naturaleza, admite movimiento, exige tercero, exige
  centro de costo, activa, protegida, clasificación propia, versión.
- **Centro de costo** (existente): código, nombre, activo.
- **Concepto contable**: identificador (`REVENUE`, `VAT_OUTPUT`…), descripción, naturaleza esperada, obligatorio.
- **Mapeo de concepto**: concepto, cuenta, vigente desde, estado, autor, motivo.
- **Partida de estado financiero**: estado (situación financiera o resultados), código, nombre, orden, signo.
- **Cambio del plan**: entidad, campo, anterior, nuevo, motivo, autor, instante.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una empresa nueva puede contabilizar las plantillas P-01 a P-03 sin crear ni mapear ninguna cuenta.
- **SC-002**: El 100 % de las cuentas de las clases 1 a 6 del PUC base tiene clasificación efectiva y el 100 % de los
  conceptos obligatorios tiene mapeo vigente.
- **SC-003**: Cero cambios de código o naturaleza en cuentas con movimientos (batería de pruebas de todos los caminos
  de edición).
- **SC-004**: El contador crea una auxiliar y la usa en un comprobante en menos de 1 minuto.
- **SC-005**: La búsqueda en un plan de 5.000 cuentas responde en menos de 1 segundo.

## Assumptions

- **El PUC base** sigue la estructura clásica del Decreto 2650 de 1993 alineada a NIIF para Pymes; su contenido exacto
  lo valida el contador antes de producción (estado 🔶, G-10), igual que R-CON-012 (cuentas de cierre).
- **Subcuentas de 6 dígitos como cuentas de movimiento:** esta spec permite movimiento en cualquier cuenta **sin
  hijos** marcada como de movimiento (nivel 6 u 8+), como dice la tabla §3.1 del catálogo («depende de la política de
  la empresa») y como usa el libro de referencia (`130505`). El texto de R-CON-003 dice que la subcuenta es siempre
  acumuladora: **contradicción a resolver con el contador** antes de producción (preguntas 7 y 10 de
  [`validacion-contador.md`](../001-contabilidad-comprobantes-inmutables/validacion-contador.md)). Si el contador exige solo auxiliares de 8+ dígitos, basta con desmarcar «admite movimiento» en los niveles
  6 del PUC base y crear sus auxiliares.
- **Importar el plan** desde Alegra u hojas de cálculo es de la migración (spec 015).
- **Varios planes por empresa** o planes por sucursal: fuera de alcance.
- **Presupuestos** por cuenta o centro de costo: fuera de alcance.
- **Clasificaciones de las clases 7, 8 y 9**: fuera del MVP (producción y cuentas de orden).
- **Las cuentas existentes de las empresas de prueba** (sembradas por `seed:test-chart`) se migran al nuevo modelo con
  la clasificación y el mapeo del PUC base.

## Trazabilidad de reglas

Esta especificación implementa R-CON-003 (cuentas de movimiento activas), R-CON-008 (tercero y centro de costo),
R-CON-010 (libros), R-CON-012 (cuentas del cierre anual) y R-CON-013 (naturaleza), y se rige por los principios I, IV y
VII de la [constitución](../../constitution.md) y los ADR-0002 y ADR-0005, más el invariante INV-03 del
[modelo de datos](../../01-arquitectura/02-modelo-de-datos-preliminar.md). La relación se genera en
[`../traceability-matrix.md`](../traceability-matrix.md). Escenarios ejecutables:
[`acceptance/plan-de-cuentas.feature`](acceptance/plan-de-cuentas.feature). Maqueta `5c/5d`. Depende de las specs 001 y
013.

## Verificación de constitución

| Gate | Cumplimiento en esta spec |
|---|---|
| G-01 a G-03 | Reglas de estructura, herencia y protección en el dominio del módulo `accounting` |
| G-06 | Ninguna operación cambia código o naturaleza de cuentas con movimientos; historial de solo inserción |
| G-07 | Cuentas, centros, mapeos y clasificaciones con `tenant_id`, RLS y prueba de aislamiento |
| G-08 | Entradas validadas con esquemas de `packages/contracts` |
| G-10 | PUC base y cuentas de cierre 🔶 hasta la validación del contador |
| G-11 | Escenarios `[018-01]…[018-11]` etiquetados |
