# Feature Specification: Ventas a crédito y cartera

**Feature Branch**: `003-ventas-credito-y-cartera`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "SIFCA no presta dinero; gestiona ventas a crédito y cartera: límite de crédito por cliente, plazos de pago, edades de cartera (corriente, 30, 60, 90+), recibos de caja y abonos, y control de mora o bloqueo de despacho por cupo excedido."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Vender a crédito dentro del cupo y retener lo que lo excede (Priority: P1)

El vendedor confirma pedidos y emite facturas a crédito. El sistema calcula la exposición del cliente (cartera
más pedidos confirmados menos saldos a favor), la compara con su cupo y, si se excede o el cliente está en
mora, retiene el documento hasta que alguien con permiso lo libere dejando un motivo.

**Why this priority**: protege la caja del negocio y es la razón de ser del módulo.

**Independent Test**: con un cliente de cupo conocido se confirman pedidos hasta exceder el cupo y se verifica
la retención y la liberación.

**Acceptance Scenarios**:

1. **Dado** un cliente con cupo disponible de 2.000.000, **Cuando** confirma un pedido a crédito de 2.500.000, **Entonces** queda retenido por un excedente de 500.000.
2. **Dado** un documento retenido, **Cuando** un responsable con permiso lo libera con motivo, **Entonces** continúa y queda en bitácora.
3. **Dado** un cliente en mora sobre el umbral, **Cuando** compra de contado, **Entonces** la venta procede.

---

### User Story 2 - Cobrar: recibos, abonos y edades de cartera (Priority: P1)

El cajero registra recibos que se aplican a las facturas más antiguas vencidas primero (o a las que elija),
con soporte de abonos parciales y de retenciones sufridas. Cada recibo libera cupo en el acto. El responsable
de cartera consulta las edades: corriente, 30, 60, 90 y más de 90 días.

**Why this priority**: sin cobros y edades no hay control de cartera.

**Independent Test**: con las facturas de ejemplo se verifican los rangos y los totales; se registra un abono y
se verifica el cupo.

**Acceptance Scenarios**:

1. **Dado** las cinco facturas de ejemplo, **Cuando** se consulta la cartera al 2026-10-13, **Entonces** los totales por rango suman 7.500.000.
2. **Dado** un abono parcial, **Cuando** se aplica, **Entonces** la factura queda parcial y el cupo aumenta en el valor aplicado.
3. **Dado** un recibo con retenciones sufridas, **Entonces** el valor neto recibido es el esperado y el saldo de la factura queda en cero.

---

### User Story 3 - Estados de crédito y alertas (Priority: P2)

El responsable de cartera ve en cada cliente un estado derivado (al día, alerta, bloqueado por cupo, bloqueado
por mora o suspendido) y recibe alertas al acercarse al cupo, al entrar en mora y al retener un documento.

**Why this priority**: permite actuar antes de que el problema se agrave.

**Independent Test**: se recorren combinaciones de mora, exposición y suspensión y se comparan los estados.

**Acceptance Scenarios**:

1. **Dado** una exposición del 80 % del cupo, **Entonces** se emite una alerta de cupo.
2. **Dado** distintas combinaciones, **Entonces** el estado respeta el orden de prevalencia.

---

### Edge Cases

- Cliente con cupo en cero (solo contado).
- Reducir el cupo por debajo de la exposición actual.
- Dos pedidos simultáneos que juntos exceden el cupo.
- Nota crédito sobre una factura a crédito (libera cupo).
- Recibo mayor que la suma de las facturas a aplicar (queda anticipo).
- Factura con fecha de vencimiento igual al día de corte (corriente).
- Corrección de un recibo (se reversa, no se edita).
- Mora por debajo del umbral de bloqueo (solo alerta).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El saldo de un cliente MUST derivarse del libro mayor y los reportes de cartera MUST cuadrar con él. *(R-CAR-001)*
- **FR-002**: Una factura a crédito MUST vencer a la fecha de emisión más el plazo del cliente; la venta de contado no genera cartera. *(R-CAR-002)*
- **FR-003**: Los recibos MUST aplicarse a las facturas más antiguas vencidas primero salvo elección del usuario, admitir abonos parciales y dejar anticipos cuando sobra valor. *(R-CAR-003)*
- **FR-004**: Los recibos MUST registrar las retenciones sufridas y reducir el saldo de la factura; el neto en banco es el valor aplicado menos las retenciones. *(R-CAR-004)*
- **FR-005**: Una nota crédito MUST aplicarse a su factura y liberar cupo. *(R-CAR-005)*
- **FR-006**: El sistema MUST clasificar la cartera por edades (corriente, 1–30, 31–60, 61–90 y más de 90 días) medidas desde el vencimiento a una fecha de corte. *(R-CAR-006)*
- **FR-007**: El sistema MUST definir la mora como factura con saldo vencido y NO MUST calcular intereses de mora automáticamente. *(R-CAR-007)*
- **FR-008**: El sistema MUST calcular la exposición y el cupo disponible de cada cliente y rechazar ventas a crédito de clientes sin cupo. *(R-CAR-008)*
- **FR-009**: El sistema MUST retener los documentos a crédito que excedan el cupo, de clientes en mora sobre el umbral o suspendidos, y permitir su liberación solo con permiso y motivo obligatorio, dejando bitácora. *(R-CAR-012)*
- **FR-010**: El sistema MUST emitir alertas al alcanzar el 80 % y el 100 % del cupo, al entrar en mora y al liberar un documento retenido. *(R-CAR-013)*
- **FR-011**: El sistema MUST derivar el estado de crédito con el orden de prevalencia suspendido, bloqueado por mora, bloqueado por cupo, alerta, al día. *(R-CAR-014)*
- **FR-012**: Cambiar el cupo o el plazo MUST exigir permiso, dejar el valor anterior y el nuevo en bitácora y no afectar documentos ya emitidos. *(R-CAR-015)*
- **FR-013**: Los recibos MUST ser de solo inserción: se corrigen con un recibo de reversa. *(P-I)*
- **FR-014**: El control de cupo MUST ocurrir dentro de la transacción comercial para que pedidos concurrentes no superen el cupo. *(P-III)*
- **FR-015**: Las cuentas por pagar MUST causarse con retenciones y pagarse con comprobante de egreso con soporte. *(R-CAR-020, R-CAR-021, R-CAR-023)*

### Key Entities *(include if feature involves data)*

- **Cliente con crédito**: tercero con cupo, plazo y estado de crédito.
- **Exposición**: cartera pendiente más pedidos a crédito confirmados menos saldos a favor.
- **Factura a crédito**: documento con saldo y vencimiento.
- **Recibo de caja**: pago con aplicaciones a facturas y retenciones sufridas.
- **Retención de crédito (hold)**: marca de un documento retenido con causa, excedente, liberación y motivo.
- **Gestión de cobranza**: acción, resultado y compromiso de pago.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Ninguna venta a crédito se emite con exposición mayor al cupo sin una liberación auditada.
- **SC-002**: El reporte de cartera por cliente coincide al peso con el saldo de las cuentas de clientes del libro mayor.
- **SC-003**: Con 100 pares de pedidos simultáneos que juntos exceden el cupo, en el 100 % exactamente uno se confirma.
- **SC-004**: El cupo disponible se actualiza en el mismo instante de registrar un abono, nota crédito o cancelación.

## Assumptions

- Los plazos de pago se miden en días calendario.
- Los umbrales de alerta (80 %), de bloqueo por mora (30 días) y los rangos de edades son configurables por empresa.
- La gestión de cobranza usa solo canales con autorización del titular.
- Los intereses de mora, el deterioro y el castigo de cartera están fuera de alcance.

## Trazabilidad de reglas

Fuente: [`05-cartera-y-ventas-a-credito.md`](../../02-normativa-y-reglas/05-cartera-y-ventas-a-credito.md); asientos
en [`01-contabilidad`](../../02-normativa-y-reglas/01-contabilidad-partida-doble-y-puc.md) (P-03, P-04, P-09). La
relación regla → requisito → escenario se genera en [`../traceability-matrix.md`](../traceability-matrix.md).
Escenarios ejecutables: [`acceptance/credito-y-cartera.feature`](acceptance/credito-y-cartera.feature). Flujo:
[`03-procesos-y-flujos/03-…`](../../03-procesos-y-flujos/03-venta-a-credito-y-control-de-cupo.md).

## Verificación de constitución

| Gate | Cumplimiento en esta spec |
|---|---|
| G-01, G-02 | El cálculo de exposición, edades y estado es de dominio puro; `CreditPolicyPort` lo define `sales` y lo implementa este módulo |
| G-04 | Registrar la cartera y consumir el cupo ocurren dentro de la transacción de la factura |
| G-06 | Recibos e historial de aplicaciones solo se insertan |
| G-07 | Tablas de crédito con `tenant_id` y RLS |
| G-08 | Entradas de recibos, condiciones de crédito y liberaciones con esquemas de `packages/contracts` |
| G-12 | Las alertas se publican como webhooks estándar; ningún motor externo es requisito |
