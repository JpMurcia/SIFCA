# Feature Specification: Devoluciones en ventas con nota crédito y reingreso a kardex

**Feature Branch**: `004-devoluciones-ventas-nota-credito`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "Devoluciones totales y parciales en ventas: emisión de nota crédito DIAN, restitución física de stock al kardex según el estado del producto (disponible o avería/merma), reversión del IVA y de las retenciones, y ajuste de cartera o saldo a favor del cliente."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Devolución parcial o total con nota crédito (Priority: P1)

Un cliente devuelve parte o todo lo que compró. El operador emite una nota crédito sobre la factura aceptada; el
sistema reingresa la mercancía al kardex al costo con que salió, revierte el IVA y el costo de ventas y ajusta
la cartera del cliente, todo en una sola operación.

**Why this priority**: sin devoluciones correctas, inventario, cartera y contabilidad se descuadran juntos.

**Independent Test**: se devuelven 2 de 10 unidades de una factura de ejemplo y se verifican la nota, el kardex,
el asiento y la cartera.

**Acceptance Scenarios**:

1. **Dado** una factura aceptada de 10 unidades, **Cuando** se devuelven 2 vendibles, **Entonces** la nota es de 238.000 y el stock sube 2 al costo original.
2. **Dado** una factura pagada, **Cuando** se emite la nota, **Entonces** el cliente queda con saldo a favor.
3. **Dado** la devolución de todas las unidades, **Entonces** la factura queda con saldo cero y la nota usa el concepto de anulación.

---

### User Story 2 - Estado del producto y costo del reingreso (Priority: P1)

El operador declara si cada unidad devuelta está disponible, averiada o vencida. Las disponibles vuelven al
stock vendible; las averiadas o vencidas van a una bodega de avería sin sumar al disponible, y pueden darse de
baja contra gasto en la misma operación. El costo del reingreso respeta el método del ítem: promedio al costo
de salida original, PEPS sobre las capas exactas consumidas.

**Why this priority**: evita vender producto en mal estado y mantiene el costo correcto.

**Independent Test**: devoluciones mixtas en ítems de promedio y de PEPS verificando bodega, disponible y valor.

**Acceptance Scenarios**:

1. **Dado** 1 unidad vendible y 1 averiada, **Entonces** el disponible sube 1 y se registra el gasto por avería de 60.000 si hay baja inmediata.
2. **Dado** un ítem PEPS, **Entonces** se restituye la capa de la que se consumió.

---

### User Story 3 - Control, fiscalidad y trazabilidad (Priority: P2)

El sistema impide devolver más de lo vendido o fuera de plazo, usa las tarifas de la factura original (no las
vigentes), no modifica la factura original ni sus asientos, y transmite la nota crédito referenciando el CUFE.

**Why this priority**: protege el cumplimiento fiscal y la auditoría.

**Independent Test**: se intentan devoluciones inválidas y se audita que los documentos originales no cambian.

**Acceptance Scenarios**:

1. **Dado** una línea con 10 vendidas y 8 ya devueltas, **Cuando** se piden 3 más, **Entonces** se rechaza.
2. **Dado** una nota emitida, **Entonces** la factura y su asiento permanecen intactos.

---

### Edge Cases

- Devolución de un ítem con lotes y vencimiento (reingresa al lote original o a avería si está vencido).
- Devoluciones parciales sucesivas de la misma línea.
- Ítem cuyo método de costeo es PEPS y cuyas capas ya se consumieron parcialmente.
- Cliente agente de retención con retenciones sufridas ya reconocidas.
- Factura con descuento por línea.
- Falla del sistema a mitad de la operación o reintento del mismo pedido de devolución.
- Rechazo de la DIAN a la nota crédito.
- Cambio de tarifas entre la fecha de la factura y la de la devolución.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Solo MUST permitirse devolver líneas de una factura aceptada; la cantidad acumulada devuelta de una línea MUST NOT exceder lo vendido. *(R-INV-040)*
- **FR-002**: El sistema MUST aceptar una ventana máxima de devolución configurable y permitir excepciones solo con permiso. *(R-INV-040)*
- **FR-003**: Cada línea devuelta MUST declarar su condición (disponible, averiada o vencida) y el sistema MUST reingresarla a la bodega que corresponda; solo las disponibles suman al stock vendible. *(R-INV-041, R-INV-046)*
- **FR-004**: El reingreso MUST hacerse al costo con que salió: promedio con el costo de salida original, PEPS sobre las capas exactas consumidas. *(R-INV-042, R-INV-016)*
- **FR-005**: El sistema MUST permitir dar de baja lo averiado o vencido en la misma operación contra la cuenta de gasto configurable. *(R-INV-041)*
- **FR-006**: El sistema MUST revertir en proporción el ingreso, el IVA generado y el costo de ventas, usando las tarifas de la factura original. *(R-INV-043, R-IMP-001)*
- **FR-007**: El sistema MUST reducir el saldo de la factura o generar saldo a favor si ya estaba pagada, y liberar cupo de crédito. *(R-INV-043, R-CAR-005)*
- **FR-008**: La nota crédito MUST referenciar el CUFE de la factura y un concepto de corrección, y MUST NOT exceder el valor de la factura. *(R-FE-010)*
- **FR-009**: La factura aceptada y sus asientos MUST NOT modificarse; el efecto se logra con documentos y comprobantes nuevos. *(R-FE-009, R-CON-005, P-I)*
- **FR-010**: Inventario, cartera, impuestos, consecutivo y asiento de la devolución MUST ejecutarse en una sola transacción atómica e idempotente. *(R-INV-044, P-III)*
- **FR-011**: La nota crédito MUST transmitirse a la DIAN por el mismo mecanismo que la factura; un rechazo se corrige conservando el número. *(R-FE-008, R-FE-010)*
- **FR-012**: El sistema MUST publicar los eventos de devolución recibida y de cambio de stock. *(R-INV-043)*

### Key Entities *(include if feature involves data)*

- **Nota crédito**: documento fiscal que referencia a la factura y su concepto de corrección.
- **Línea devuelta**: cantidad, condición y línea original referenciada.
- **Movimiento de reingreso**: entrada al kardex al costo original, a bodega vendible o de avería.
- **Consumo restituido de capa**: restitución de una capa PEPS exacta.
- **Saldo a favor**: anticipo del cliente originado por una nota sobre una factura pagada.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En 100 % de las devoluciones, el valor del reingreso al inventario es igual al costo de salida original de las unidades devueltas.
- **SC-002**: Ninguna devolución puede superar lo vendido por línea ni dejar el estado a medias ante una falla.
- **SC-003**: Después de cada devolución, cartera, inventario y libro mayor concilian al peso.
- **SC-004**: Una devolución típica (hasta 20 líneas) completa su registro local en menos de 800 ms.

## Assumptions

- La nota crédito parte de una factura ya aceptada por la DIAN.
- Existe una bodega de avería configurada por empresa.
- El tratamiento de las retenciones sufridas en devoluciones sigue pendiente de validación del contador (Q-14).

## Trazabilidad de reglas

Fuentes: [`04-inventarios`](../../02-normativa-y-reglas/04-inventarios-y-valoracion.md) §7,
[`03-facturacion`](../../02-normativa-y-reglas/03-facturacion-electronica-dian.md),
[`01-contabilidad`](../../02-normativa-y-reglas/01-contabilidad-partida-doble-y-puc.md) (P-02, P-09, P-11). La
relación regla → requisito → escenario se genera en [`../traceability-matrix.md`](../traceability-matrix.md).
Escenarios ejecutables: [`acceptance/devoluciones.feature`](acceptance/devoluciones.feature). Secuencia completa:
[`03-procesos-y-flujos/02-…`](../../03-procesos-y-flujos/02-devoluciones-nota-credito-y-reingreso.md).

## Verificación de constitución

| Gate | Cumplimiento en esta spec |
|---|---|
| G-01, G-02 | `RegisterSalesReturn` es un caso de uso; el costeo del reingreso es un servicio de dominio |
| G-04 | Elegibilidad, número, reingreso, cartera/cupo y asiento en un solo `UnitOfWork` |
| G-05 | La transmisión de la nota, el PDF y los webhooks usan *outbox* |
| G-06 | La devolución solo inserta movimientos, consumos de capa y comprobantes (contraasientos) |
| G-08 | La entrada (líneas, cantidades, condición) se valida con un esquema de `packages/contracts` |
| G-10 | R-INV-043 (retenciones) y R-INV-045: 🔶 hasta validación del contador |
