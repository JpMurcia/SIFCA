# Feature Specification: Emisión de factura de venta (transacción atómica)

**Feature Branch**: `002-emision-factura-venta`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "Al emitir una factura de venta, el sistema debe asignar el consecutivo, calcular impuestos, descontar inventario al costo correcto, registrar la cartera y el asiento contable en una sola operación que se completa por entero o no se completa."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Emitir una factura de venta a crédito (Priority: P1)

El operador emite la factura de un pedido. El sistema asigna el número del rango autorizado, calcula IVA y
retenciones, descuenta las unidades al costo que corresponde al método del ítem, registra la cuenta por cobrar
dentro del cupo del cliente, contabiliza y deja la factura lista para transmitirse a la DIAN.

**Why this priority**: es el evento comercial central del producto; todo lo demás depende de que sea correcto.

**Independent Test**: se emite una factura de ejemplo y se verifican, en conjunto, número, impuestos, stock,
cartera, asiento y estado.

**Acceptance Scenarios**:

1. **Dado** un pedido confirmado dentro del cupo, **Cuando** se emite la factura, **Entonces** queda con el siguiente número del rango y los importes esperados.
2. **Dado** la misma emisión, **Entonces** el stock baja, la cartera sube, el asiento cuadra y se encola la transmisión.

---

### User Story 2 - Integridad bajo fallos y concurrencia (Priority: P1)

Ninguna falla (de stock, de contabilidad, de red del cliente) puede dejar la operación a medias, y dos
operadores emitiendo al mismo tiempo no pueden producir números repetidos ni stock negativo.

**Why this priority**: es el principio de transaccionalidad ACID (constitución III).

**Independent Test**: se inyecta un fallo en cada paso y se lanzan emisiones concurrentes; después se audita el
estado.

**Acceptance Scenarios**:

1. **Dado** un fallo en cualquier paso de la emisión, **Cuando** ocurre, **Entonces** no queda número consumido, movimiento de stock, asiento ni cambio en cartera.
2. **Dado** stock 10 y dos facturas de 8 unidades simultáneas, **Entonces** exactamente una se emite.
3. **Dado** el mismo `Idempotency-Key` enviado dos veces, **Entonces** hay una sola factura y respuestas idénticas.

---

### User Story 3 - Pedido web con reserva de stock (Priority: P2)

El cliente de la vitrina crea un pedido; el sistema fija los precios con los del servidor, reserva stock por un
tiempo limitado y, si el pedido no se confirma, libera la reserva.

**Why this priority**: conecta la vitrina con la emisión sin sobreventa.

**Independent Test**: se crea un pedido web con precios manipulados y se deja vencer otro.

**Acceptance Scenarios**:

1. **Dado** un pedido web con un precio distinto al vigente, **Cuando** se crea, **Entonces** el servidor usa el precio vigente.
2. **Dado** un pedido sin confirmar, **Cuando** vence la reserva, **Entonces** el pedido pasa a `EXPIRED` y el stock queda disponible.

---

### Edge Cases

- Rango de numeración agotado o vencido durante la emisión.
- Período contable cerrado en la fecha del documento.
- Cliente sin identificación válida (NIT con dígito de verificación incorrecto).
- Impuesto ambiguo (dos tarifas aplicables) o ítem sin impuesto asignado.
- Stock que alcanza solo para parte de las líneas.
- Venta de contado (no consume cupo) frente a venta a crédito.
- Doble envío del mismo `POST` por reintento del cliente.
- Costo de salida en una bodega con stock negativo permitido.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST ejecutar consecutivo, impuestos, inventario, cartera, cupo, asiento, estado y registro de eventos externos en una única transacción atómica. *(R-CON-007, P-III, ADR-0006)*
- **FR-002**: El sistema MUST asignar el consecutivo desde un rango de numeración autorizado y vigente, sin saltos ni duplicados, dentro de la misma transacción. *(R-FE-003, R-FE-004)*
- **FR-003**: El sistema MUST rechazar la emisión en un período cerrado. *(R-CON-004)*
- **FR-004**: El sistema MUST calcular el IVA por línea con redondeo mitad hacia arriba y sumar las líneas para el total del documento. *(R-IMP-003, R-CON-009)*
- **FR-005**: El sistema MUST descontar el inventario al costo según el método del ítem y rechazar la emisión si el stock no alcanza. *(R-INV-003, R-INV-007, R-INV-016)*
- **FR-006**: El sistema MUST consumir y liberar la reserva de stock de los pedidos web. *(R-INV-013)*
- **FR-007**: El sistema MUST registrar la cartera y consumir el cupo solo en ventas a crédito; una venta de contado no consume cupo. *(R-CAR-002, R-CAR-008)*
- **FR-008**: El sistema MUST retener la emisión de una venta a crédito que exceda el cupo o cuyo cliente esté en mora sobre el umbral. *(R-CAR-012)*
- **FR-009**: El sistema MUST exigir la identificación del adquirente con su dígito de verificación válido. *(R-FE-012)*
- **FR-010**: Toda emisión MUST aceptar una clave de idempotencia y devolver la misma respuesta ante un reintento con el mismo cuerpo. *(P-III)*
- **FR-011**: El sistema MUST contabilizar la venta y el costo con comprobantes que cuadran y referencian al documento fuente. *(R-CON-001, R-CON-007)*
- **FR-012**: El sistema MUST ignorar los precios enviados por el cliente web y usar los vigentes del servidor. *(P-V)*
- **FR-013**: Una emisión que falla en cualquier paso MUST dejar el estado exactamente como estaba antes. *(P-III)*

### Key Entities *(include if feature involves data)*

- **Documento de venta**: pedido o factura con estado, número, cliente, líneas, impuestos y totales.
- **Rango de numeración**: autorización de la DIAN con prefijo, desde, hasta, vigencia y siguiente número.
- **Movimiento de inventario**: salida del ítem con cantidad, costo y documento origen.
- **Reserva de stock**: cantidad apartada por un pedido con vencimiento.
- **Cuenta por cobrar / cupo**: saldo del cliente y su exposición frente al cupo.
- **Evento de salida (outbox)**: registro transaccional de efectos externos pendientes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con 2 hilos × 1.000 emisiones sobre un mismo rango, los números asignados son contiguos y únicos (0 duplicados, 0 huecos).
- **SC-002**: En 1.000 repeticiones de dos emisiones concurrentes que exceden el stock, el stock final nunca es negativo.
- **SC-003**: En 100 % de las fallas inyectadas, el estado posterior es idéntico al anterior a la emisión.
- **SC-004**: La emisión de una factura de hasta 50 líneas completa su transacción en menos de 800 ms en condiciones normales.

## Assumptions

- Existe un rango de numeración vigente y el proveedor de transmisión está configurado (la transmisión se especifica en la spec 009).
- Los precios, impuestos y métodos de costeo del ítem están configurados.
- Los pedidos web de clientes sin crédito son siempre de contado.

## Trazabilidad de reglas

Fuentes: [`01-contabilidad`](../../02-normativa-y-reglas/01-contabilidad-partida-doble-y-puc.md),
[`02-impuestos`](../../02-normativa-y-reglas/02-impuestos-y-retenciones.md),
[`03-facturacion`](../../02-normativa-y-reglas/03-facturacion-electronica-dian.md),
[`04-inventarios`](../../02-normativa-y-reglas/04-inventarios-y-valoracion.md),
[`05-cartera`](../../02-normativa-y-reglas/05-cartera-y-ventas-a-credito.md). La relación regla → requisito →
escenario se genera en [`../traceability-matrix.md`](../traceability-matrix.md). Escenarios ejecutables:
[`acceptance/emision.feature`](acceptance/emision.feature). Flujo: [`03-procesos-y-flujos/01-…`](../../03-procesos-y-flujos/01-flujo-venta-catalogo-a-factura.md).

## Verificación de constitución

| Gate | Cumplimiento en esta spec |
|---|---|
| G-01, G-02 | `IssueInvoice` es un caso de uso; numeración, impuestos, costeo y contabilización son servicios de dominio y puertos |
| G-03 | Prisma solo en los repositorios de infraestructura |
| G-04 | Consecutivo + impuestos + inventario + cartera + cupo + asiento + estado en un solo `UnitOfWork` |
| G-05 | La transmisión, el PDF y los webhooks se registran en el *outbox* y ocurren después del `COMMIT` |
| G-06 | Movimientos y asientos solo se insertan |
| G-07 | Todas las tablas involucradas llevan `tenant_id` y RLS |
| G-08 | La entrada de `IssueInvoice` se valida con su esquema de `packages/contracts` |
| G-09 | Importes y costos con decimal exacto |
| G-10 | R-IMP-003, R-FE-003/004 y R-CAR-012: 🔶/⚠️ hasta validación del contador |
