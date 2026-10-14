# Feature Specification: Motor de impuestos y retenciones con vigencias

**Feature Branch**: `010-motor-impuestos-y-retenciones`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "Calcular IVA, retención en la fuente, ReteIVA y ReteICA en ventas y compras con tarifas, bases y UVT almacenados como datos con vigencia, de modo que un cambio normativo sea una carga de datos y no un cambio de código."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Calcular IVA por línea con redondeo exacto (Priority: P1)

Cada línea de venta o compra calcula su IVA con la tarifa del ítem, redondeado a 2 decimales; el IVA del
documento es la suma de las líneas.

**Why this priority**: los totales deben coincidir al centavo con lo que valida la DIAN.

**Independent Test**: con el ejemplo de tres líneas de 333,33 el IVA es 189,99 y no 190,00.

**Acceptance Scenarios**:

1. **Dado** tres líneas de 333,33 con IVA del 19 %, **Entonces** el IVA es 189,99.

---

### User Story 2 - Retenciones con bases mínimas y vigencias (Priority: P1)

El motor decide, por concepto y por fecha del documento, si procede retención (base mínima en UVT), con qué
tarifa (declarante o no) y cuánto; aplica ReteIVA y ReteICA cuando corresponde.

**Why this priority**: es el cálculo más cambiante y más sensible a errores.

**Independent Test**: se recorre la tabla de ejemplos de retención con la UVT de 2026.

**Acceptance Scenarios**:

1. **Dado** una compra de bienes de 2.000.000 a un declarante, **Entonces** la retención es 50.000.
2. **Dado** una compra de 1.000.000, **Entonces** no hay retención por estar bajo la base mínima.

---

### User Story 3 - Cambios normativos como datos (Priority: P2)

Cuando una norma cambia o es suspendida, el contador carga una nueva ventana de vigencia; los documentos
emitidos conservan lo aplicado y los nuevos usan la tabla vigente en su fecha.

**Why this priority**: caso real (Decreto 572 de 2025 suspendido en 2026) que el diseño debe absorber.

**Independent Test**: documentos con fechas en distintas ventanas usan tablas distintas.

**Acceptance Scenarios**:

1. **Dado** dos ventanas de vigencia, **Entonces** cada documento usa la de su fecha.
2. **Dado** un cambio posterior, **Entonces** los documentos ya emitidos no cambian.

---

### Edge Cases

- Documento con varios conceptos de retención (la base se evalúa por concepto).
- Dos tarifas aplicables con igual especificidad (el cálculo falla, no se adivina).
- Empresa o tercero que no es agente de retención.
- Proveedor no declarante de renta.
- Base exactamente igual a la base mínima.
- Fecha de documento en el límite entre dos vigencias.
- Tarifa de ReteICA que depende del municipio y de la actividad.
- Ítem sin impuesto asignado.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST aplicar la tarifa de IVA (general, reducida, exento, excluido o no gravado) asignada al ítem y registrar el tipo además del porcentaje. *(R-IMP-001)*
- **FR-002**: La base gravable de una línea MUST ser cantidad por precio menos los descuentos no condicionados. *(R-IMP-002)*
- **FR-003**: El IVA MUST calcularse por línea con redondeo mitad hacia arriba y sumarse para el documento. *(R-IMP-003, R-CON-009)*
- **FR-004**: El IVA descontable MUST limitarse a compras con documento válido y destino gravado o exento. *(R-IMP-004)*
- **FR-005**: El sistema MUST practicar retención solo cuando la empresa es agente y el tercero lo admite. *(R-IMP-010)*
- **FR-006**: La retención MUST calcularse sobre la base antes de IVA, por concepto, cuando la base supera el mínimo en UVT del año del documento, con la tarifa de declarante o no declarante. *(R-IMP-011, R-IMP-012)*
- **FR-007**: El sistema MUST calcular ReteIVA como el 15 % del IVA cuando aplique y ReteICA por mil según municipio y actividad. *(R-IMP-020, R-IMP-021)*
- **FR-008**: Las tarifas, bases y UVT MUST almacenarse con ventana de vigencia y fuente, y el motor MUST seleccionar por la fecha del documento. *(ADR-0005)*
- **FR-009**: Cada documento MUST guardar el snapshot de lo aplicado (tarifa, base, monto) y no cambiar si las tablas cambian después. *(ADR-0005)*
- **FR-010**: Si más de una tarifa coincide con igual especificidad, el cálculo MUST fallar y registrar el caso para el contador. *(ADR-0005)*
- **FR-011**: El sistema MUST conservar tercero y concepto por línea contable para poder generar certificados de retención. *(R-IMP-013, R-CON-008)*
- **FR-012**: El motor MUST ser puro y determinista: misma entrada y mismas tablas, misma salida; sin acceso a red ni a la fecha actual. *(P-II)*

### Key Entities *(include if feature involves data)*

- **Impuesto**: IVA, INC, ReteFuente, ReteIVA, ReteICA, con su código DIAN.
- **Tarifa con vigencia**: porcentaje, base mínima, condiciones, ventana, fuente y estado de verificación.
- **Valor de la UVT**: por año con su resolución.
- **Concepto de retención**: compras, servicios, honorarios, arrendamientos, etc.
- **Snapshot de impuestos del documento**: tarifa, base y monto aplicados.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Todos los casos de la tabla de ejemplos del catálogo de reglas se reproducen exactamente.
- **SC-002**: Un cambio de tarifa o de base se aplica solo con cargar datos con vigencia, sin cambiar código.
- **SC-003**: Los documentos emitidos antes de un cambio normativo no cambian después de él.

## Assumptions

- UVT 2026 = 52.374 (Resolución DIAN 000238 de 2025 ✅); la UVT de 2025 es 49.799 (🔶 sin contrastar).
- Las fechas de las ventanas del Decreto 572 de 2025 y su suspensión están por confirmar (⚠️); los ejemplos de vigencias son ilustrativos.
- La tarifa de ReteICA de los ejemplos (9,66 por mil) es ilustrativa y no corresponde a ningún municipio.
- Régimen Simple de Tributación, autorretención especial e impuestos especiales están fuera de alcance.

## Trazabilidad de reglas

Fuente: [`02-impuestos-y-retenciones.md`](../../02-normativa-y-reglas/02-impuestos-y-retenciones.md). La relación regla
→ requisito → escenario se genera en [`../traceability-matrix.md`](../traceability-matrix.md). Escenarios
ejecutables: [`acceptance/impuestos.feature`](acceptance/impuestos.feature).

## Verificación de constitución

| Gate | Cumplimiento en esta spec |
|---|---|
| G-01 | `TaxEngine` es un servicio de dominio puro; la fecha y las tablas entran como parámetros |
| G-09 | Importes y bases con decimal exacto |
| G-10 | R-IMP-012 y vigencias: ⚠️/🔶; no pasan a producción sin validación del contador (Principio VII) |
