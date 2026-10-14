# Feature Specification: Contabilidad con comprobantes inmutables

**Feature Branch**: `001-contabilidad-comprobantes-inmutables`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "El contador debe poder registrar comprobantes contables de partida doble que cuadran, nunca se editan ni se borran, se corrigen con reversiones, respetan períodos abiertos y producen el balance de prueba."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Contabilizar un comprobante que cuadra (Priority: P1)

El contador registra un comprobante manual con varias líneas, cada una con su cuenta, tercero cuando la cuenta
lo exige, y un solo lado (débito o crédito). El sistema solo acepta el comprobante si cuadra y le asigna su
consecutivo.

**Why this priority**: es la base de toda la contabilidad; sin comprobantes válidos no existe información
financiera confiable.

**Independent Test**: se prueba registrando comprobantes válidos e inválidos y verificando que solo los
válidos quedan guardados, con número consecutivo.

**Acceptance Scenarios**:

1. **Dado** un comprobante con débitos y créditos iguales, **Cuando** se contabiliza, **Entonces** queda guardado con su consecutivo.
2. **Dado** un comprobante descuadrado, **Cuando** se intenta contabilizar, **Entonces** se rechaza y no consume consecutivo.
3. **Dado** una línea sin tercero en una cuenta que lo exige, **Cuando** se contabiliza, **Entonces** se rechaza.

---

### User Story 2 - Corregir sin borrar (Priority: P1)

Cuando hay un error en un comprobante ya contabilizado, el contador lo **reversa**: el sistema crea un
contraasiento que neutraliza al original y deja ambos visibles. Nunca se edita ni se elimina un comprobante.

**Why this priority**: es el principio de inmutabilidad contable (constitución I); sin él no hay evidencia
auditable.

**Independent Test**: se intenta editar y borrar un comprobante (debe fallar) y se reversa (debe neutralizar el
saldo de cada cuenta).

**Acceptance Scenarios**:

1. **Dado** un comprobante contabilizado, **Cuando** alguien intenta modificarlo o eliminarlo, **Entonces** la operación se rechaza.
2. **Dado** un comprobante contabilizado, **Cuando** se reversa, **Entonces** el efecto neto del par sobre cada cuenta es cero.

---

### User Story 3 - Períodos y balance de prueba (Priority: P2)

El contador cierra el mes cuando el balance de prueba cuadra y no quedan borradores; después de cerrado, nadie
puede contabilizar en ese mes sin reabrirlo con permiso y bitácora. El sistema produce el balance de prueba
por cuenta.

**Why this priority**: da cierre y control periódico a la contabilidad.

**Independent Test**: con el conjunto de datos de referencia se obtiene el balance de prueba esperado y el
cierre de mes bloquea nuevas contabilizaciones.

**Acceptance Scenarios**:

1. **Dado** un período cerrado, **Cuando** se intenta contabilizar con fecha dentro de él, **Entonces** se rechaza.
2. **Dado** los comprobantes de referencia, **Cuando** se pide el balance de prueba, **Entonces** los totales de débito y crédito coinciden.

---

### Edge Cases

- Comprobante con una sola línea o con una línea de valor cero.
- Línea con débito y crédito simultáneos, o con valores negativos.
- Contabilizar en una cuenta acumuladora (clase, grupo, cuenta) o inactiva.
- Comprobante con fecha en un período futuro que aún no existe.
- Reversión de un comprobante ya reversado.
- Falla del sistema a mitad de la contabilización: no puede quedar un comprobante parcial ni un consecutivo consumido.
- Fecha de un documento emitido a las 23:30 del último día del mes (hora de Colombia).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST rechazar todo comprobante cuyos débitos y créditos no sean iguales, en pesos y con 2 decimales exactos. *(R-CON-001)*
- **FR-002**: Cada línea MUST tener un solo lado (débito o crédito) con valor positivo; no se admiten negativos ni ambos lados. *(R-CON-002)*
- **FR-003**: Un comprobante MUST tener al menos dos líneas y solo se mueve en cuentas auxiliares activas. *(R-CON-003)*
- **FR-004**: El sistema MUST contabilizar solo en períodos abiertos; reabrir un período exige permiso y queda en bitácora. *(R-CON-004)*
- **FR-005**: Un comprobante contabilizado MUST NOT editarse ni eliminarse; su corrección es un contraasiento que lo referencia. *(R-CON-005)*
- **FR-006**: Cada tipo de comprobante MUST tener consecutivo propio, sin saltos ni duplicados; un fallo no consume número. *(R-CON-006)*
- **FR-007**: Todo comprobante automático MUST guardar su documento fuente y los totales MUST coincidir con los del documento. *(R-CON-007)*
- **FR-008**: Las cuentas que exigen tercero o centro de costo MUST rechazar líneas sin ellos. *(R-CON-008)*
- **FR-009**: Todo importe MUST usar aritmética decimal exacta con redondeo mitad hacia arriba por línea; el total es la suma de líneas redondeadas. *(R-CON-009)*
- **FR-010**: El sistema MUST producir el diario, el mayor y el balance de prueba, de forma reproducible para un mismo rango. *(R-CON-010, R-CON-013)*
- **FR-011**: El cierre mensual MUST exigir balance cuadrado y ausencia de borradores. *(R-CON-011)*
- **FR-012**: El cierre anual MUST cancelar las cuentas de resultado contra ganancias y pérdidas con un comprobante reversible. *(R-CON-012)*
- **FR-013**: La fecha contable MUST ser una fecha sin zona horaria; los instantes se guardan en UTC y se presentan en hora de Colombia. *(R-CON-014)*
- **FR-014**: Las tablas de comprobantes MUST protegerse contra modificación a nivel de dominio, de privilegios de base de datos y de *triggers*. *(P-I)*

### Key Entities *(include if feature involves data)*

- **Comprobante**: asiento de partida doble con tipo, número, fecha contable, período y estado `POSTED`.
- **Línea de comprobante**: cuenta, tercero, centro de costo, débito o crédito, referencia al documento.
- **Cuenta**: elemento del plan de cuentas con naturaleza, nivel y si admite movimiento.
- **Período contable**: mes de una empresa, abierto o cerrado.
- **Reversión**: comprobante que neutraliza a otro y lo referencia.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de los comprobantes guardados cuadra; ningún intento de guardar un comprobante descuadrado tiene éxito.
- **SC-002**: Ningún comprobante contabilizado puede modificarse o eliminarse por ninguna vía (interfaz, API o acceso directo con el usuario de la aplicación).
- **SC-003**: Los consecutivos de cada tipo de comprobante son contiguos y únicos incluso con 1.000 contabilizaciones simultáneas.
- **SC-004**: El balance de prueba del conjunto de referencia coincide al peso con los totales esperados (2.152.000 en débito y en crédito).

## Assumptions

- La empresa ya tiene un plan de cuentas cargado y períodos creados.
- El marco contable por defecto es NIIF para las Pymes (Grupo 2); la plantilla de estados financieros no cambia las reglas del comprobante.
- La reapertura de períodos es excepcional y queda fuera del flujo normal.

## Trazabilidad de reglas

Fuente de reglas: [`02-normativa-y-reglas/01-contabilidad-partida-doble-y-puc.md`](../../02-normativa-y-reglas/01-contabilidad-partida-doble-y-puc.md).
La relación regla → requisito → escenario se genera en [`../traceability-matrix.md`](../traceability-matrix.md);
no se mantiene a mano. Escenarios ejecutables: [`acceptance/comprobantes.feature`](acceptance/comprobantes.feature).

## Verificación de constitución

| Gate | Cumplimiento en esta spec |
|---|---|
| G-01 | Las reglas de cuadre, signo y reversión se implementan como entidades y objetos de valor sin framework |
| G-06 | Ninguna operación hace `UPDATE`/`DELETE` sobre comprobantes: solo reversión |
| G-07 | Los comprobantes llevan `tenant_id` y RLS; hay prueba de aislamiento |
| G-08 | La entrada de contabilizar se valida con un esquema de `packages/contracts` |
| G-09 | Importes y balances usan decimal exacto; ningún `number` |
| G-10 | Reglas R-CON-001…009 y 013: 🔶 hasta validación del contador; la implementación se publica solo con ✅ |
