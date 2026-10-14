# Feature Specification: Compras, retenciones practicadas y devolución a proveedor

**Feature Branch**: `005-compras-y-devolucion-proveedor`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "Registrar compras de mercancía y servicios con IVA descontable y retenciones practicadas, pagar a proveedores con comprobante de egreso y devolver mercancía a proveedores con salida de kardex al costo correspondiente y cruce con cuentas por pagar."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar una compra con impuestos y retenciones (Priority: P1)

El comprador registra la factura de un proveedor. El sistema ingresa la mercancía al kardex al costo correcto,
separa el IVA descontable, calcula las retenciones aplicables (solo cuando la base supera el mínimo) y deja la
cuenta por pagar neta de retenciones.

**Why this priority**: abastece el inventario y es el origen de las cuentas por pagar y de las retenciones.

**Independent Test**: con las compras de ejemplo se verifican costo, asiento y saldo por pagar.

**Acceptance Scenarios**:

1. **Dado** una compra de 2.000.000 más IVA con base sobre el mínimo, **Entonces** se retiene el 2,5 % y la cuenta por pagar es 2.330.000.
2. **Dado** una compra bajo la base mínima, **Entonces** no se retiene.

---

### User Story 2 - Pagar a proveedores con soporte (Priority: P2)

El tesorero paga una o más cuentas por pagar con un comprobante de egreso; no se salda una cuenta sin
documento de soporte.

**Why this priority**: cierra el ciclo de compras y controla la salida de dinero.

**Independent Test**: se registra un egreso y se verifican el asiento y el saldo.

**Acceptance Scenarios**:

1. **Dado** una cuenta por pagar, **Cuando** se paga, **Entonces** el saldo baja y el asiento cuadra.

---

### User Story 3 - Devolver mercancía a un proveedor (Priority: P1)

Se devuelve parte de lo comprado: la mercancía sale del kardex al costo de la compra original, se reduce la
cuenta por pagar (o queda saldo a favor si ya se pagó) y se reversan el IVA descontable y las retenciones en
proporción.

**Why this priority**: evita inventario y deuda inflados por mercancía devuelta.

**Independent Test**: se devuelven 100 de 200 unidades y se verifica el asiento y el kardex.

**Acceptance Scenarios**:

1. **Dado** una compra de 200 unidades a 10.000, **Cuando** se devuelven 100, **Entonces** salen del kardex a 10.000 y la cuenta por pagar baja 1.165.000.
2. **Dado** una devolución mayor a lo recibido, **Entonces** se rechaza.

---

### Edge Cases

- Compra con IVA no descontable (se suma al costo).
- Compra a un proveedor no obligado a facturar (documento soporte).
- Compra pagada antes de devolverla (saldo a favor).
- Ítem PEPS cuya capa de esa compra ya fue consumida parcialmente.
- Compra con varios conceptos de retención en el mismo documento.
- Proveedor no declarante de renta (tarifa distinta).
- Falla del sistema a mitad de una devolución.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST valorar la entrada de una compra como precio menos descuentos más costos de adquisición no recuperables más el IVA no descontable. *(R-INV-002)*
- **FR-002**: El sistema MUST calcular la retención en la fuente sobre la base antes de IVA solo cuando supera la base mínima del concepto, con la tarifa según el tipo de proveedor y la fecha del documento. *(R-IMP-011, R-IMP-012)*
- **FR-003**: El sistema MUST calcular ReteIVA y ReteICA cuando la empresa es agente y aplica la base mínima. *(R-IMP-020, R-IMP-021)*
- **FR-004**: El sistema MUST causar la compra con asiento que cuadra y referencia al documento. *(R-CAR-020, R-CON-001, R-CON-007)*
- **FR-005**: El pago a proveedores MUST hacerse con comprobante de egreso que referencia el documento causado. *(R-CAR-021, R-CAR-023)*
- **FR-006**: El sistema MUST emitir el documento soporte cuando se compra a un no obligado a facturar. *(R-FE-014)*
- **FR-007**: La devolución a proveedor MUST sacar del kardex al costo de la compra original (promedio) o de la capa de esa entrada (PEPS), sin exceder lo recibido ni la cantidad restante de la capa. *(R-INV-045, R-INV-016)*
- **FR-008**: La devolución MUST reducir la cuenta por pagar o generar saldo a favor, y reversar IVA descontable y retenciones en proporción. *(R-INV-045, R-CAR-023)*
- **FR-009**: Una compra y su devolución MUST ejecutarse en una sola transacción atómica e idempotente con su asiento. *(P-III)*
- **FR-010**: Los certificados de retención practicada MUST poder producirse por tercero y concepto. *(R-CAR-022)*

### Key Entities *(include if feature involves data)*

- **Compra / factura de proveedor**: documento con líneas, impuestos, retenciones y vencimiento.
- **Capa de costo**: entrada PEPS con su costo y cantidad restante.
- **Devolución a proveedor**: documento con líneas devueltas y referencia a la compra.
- **Comprobante de egreso**: pago aplicado a cuentas por pagar.
- **Documento soporte**: soporte de compras a no obligados a facturar.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Las retenciones de las compras de ejemplo coinciden al peso con las del catálogo de reglas (50.000; 0; 40.000, 28.500 y 9.660).
- **SC-002**: En 100 % de las devoluciones a proveedor, el valor que sale del kardex es el de la compra original.
- **SC-003**: Después de cada compra o devolución, cuentas por pagar, inventario y libro mayor concilian al peso.

## Assumptions

- Las tarifas y bases de retención vigentes están cargadas como datos con vigencia (spec 010).
- La tarifa de ReteICA de los ejemplos es ilustrativa y no corresponde a ningún municipio.
- El tratamiento de la diferencia entre costo original y promedio actual en devoluciones está pendiente de validación del contador (Q-14).

## Trazabilidad de reglas

Fuentes: [`04-inventarios`](../../02-normativa-y-reglas/04-inventarios-y-valoracion.md),
[`02-impuestos`](../../02-normativa-y-reglas/02-impuestos-y-retenciones.md),
[`05-cartera`](../../02-normativa-y-reglas/05-cartera-y-ventas-a-credito.md) §4,
[`01-contabilidad`](../../02-normativa-y-reglas/01-contabilidad-partida-doble-y-puc.md) (P-05 a P-08, P-12). La
relación regla → requisito → escenario se genera en [`../traceability-matrix.md`](../traceability-matrix.md).
Escenarios ejecutables: [`acceptance/compras.feature`](acceptance/compras.feature).

## Verificación de constitución

| Gate | Cumplimiento en esta spec |
|---|---|
| G-01, G-02 | Cálculo de costo y retenciones en dominio/servicios puros; repositorios detrás de puertos |
| G-04 | Compra y devolución: kardex + cuentas por pagar + impuestos + asiento en un solo `UnitOfWork` |
| G-06 | Solo inserciones; la devolución contrarresta, no edita |
| G-10 | Bases y tarifas de retención: ⚠️ hasta validación del contador; se cargan como datos con vigencia |
