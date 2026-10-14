# Feature Specification: Kardex y costeo de inventario (promedio ponderado, PEPS y despacho)

**Feature Branch**: `006-inventario-kardex-costeo`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "Gestión de inventario multibodega con kardex inmutable y valuación por promedio ponderado (por defecto) o PEPS (obligatorio en perecederos); UEPS solo como política de despacho físico, dejando explícito que el costeo financiero oficial es PEPS o promedio ponderado."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Kardex con promedio ponderado (Priority: P1)

El encargado de bodega registra compras y ventas de un ítem de mercancía general y el sistema mantiene el
kardex con cantidad, valor y costo promedio, de modo que la última salida deje el inventario exactamente en
cero.

**Why this priority**: es el método por defecto y el que más ítems usarán.

**Independent Test**: con el kardex de referencia se verifican costos y saldos movimiento a movimiento.

**Acceptance Scenarios**:

1. **Dado** las compras de 200 × 10.000 y 100 × 11.000, **Entonces** el valor es 3.100.000 y el promedio 10.333,333333.
2. **Dado** ventas de 120, 70 y 110 unidades, **Entonces** los costos son 1.240.000; 723.333,33 y 1.136.666,67 y el saldo final es 0.

---

### User Story 2 - Costeo PEPS con capas y perecederos (Priority: P1)

Para ítems perecederos (con vencimiento) el costeo es PEPS obligatorio: las salidas consumen las capas más
antiguas y cada consumo queda registrado. El despacho físico se propone por vencimiento (FEFO).

**Why this priority**: es requisito para perecederos y para el cumplimiento contable.

**Independent Test**: con las mismas compras se verifican costos de 1.200.000, 700.000 y 1.200.000 y se
confirma que un perecedero no admite promedio.

**Acceptance Scenarios**:

1. **Dado** un ítem PEPS, **Entonces** las ventas de 120, 70 y 110 cuestan 1.200.000; 700.000 y 1.200.000.
2. **Dado** un ítem con vencimiento, **Cuando** se le asigna costeo promedio, **Entonces** se rechaza.

---

### User Story 3 - Política de despacho física separada del costeo (Priority: P2)

El responsable de bodega elige cómo se saca físicamente el producto (FEFO, FIFO, UEPS o manual). Elegir UEPS
afecta solo qué unidad se despacha y muestra la advertencia de que el costo financiero se registra en PEPS o
promedio.

**Why this priority**: respeta la realidad física sin contaminar la contabilidad.

**Independent Test**: configurar UEPS y verificar que el costo sigue el método del ítem y que aparece la advertencia.

**Acceptance Scenarios**:

1. **Dado** la política UEPS, **Cuando** se despacha, **Entonces** el costo registrado sigue siendo el de PEPS o promedio.
2. **Dado** el valor UEPS como método de costeo, **Entonces** se rechaza.

---

### Edge Cases

- Salida que vacía el saldo (valor remanente exacto).
- Stock negativo en bodegas que lo permiten (nunca en perecederos).
- Movimientos con fecha anterior al último (revaluación) y en período cerrado.
- Cambio de método de costeo con movimientos existentes.
- Traslado entre bodegas (el costo viaja con la mercancía).
- Salida mayor al saldo en PEPS.
- Lote vencido que no debe venderse.
- Falla a mitad de un movimiento de varias capas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Cada ítem con inventario MUST tener un método de costeo PEPS o promedio ponderado (por defecto promedio); `LIFO` MUST NOT ser un valor válido. *(R-INV-001)*
- **FR-002**: Los ítems con vencimiento MUST usar PEPS y el sistema MUST rechazar el promedio para ellos. *(R-INV-001)*
- **FR-003**: El sistema MUST valorar las entradas y mantener el valor total del ítem, derivando el promedio. *(R-INV-002)*
- **FR-004**: En promedio, el costo de una salida MUST calcularse sobre el valor total con redondeo a 2 decimales y la última salida MUST tomar el valor remanente. *(R-INV-003)*
- **FR-005**: En PEPS, las salidas MUST consumir las capas en orden de entrada y registrar cada consumo. *(R-INV-016)*
- **FR-006**: Los movimientos y consumos de capas MUST ser de solo inserción; la corrección es un movimiento inverso. *(R-INV-004, P-I)*
- **FR-007**: El sistema MUST permitir elegir la política de despacho físico (FEFO, FIFO, UEPS, manual) sin que afecte el costeo, mostrando la advertencia al elegir UEPS. *(R-INV-017)*
- **FR-008**: El método de costeo MUST ser inmutable cuando el ítem tiene movimientos. *(R-INV-018)*
- **FR-009**: Los movimientos retroactivos MUST prohibirse en períodos cerrados y, en abiertos, requerir permiso y disparar una revaluación con comprobante de ajuste. *(R-INV-006)*
- **FR-010**: El sistema MUST rechazar ventas que dejen stock negativo salvo bodegas que lo permitan, y nunca en perecederos. *(R-INV-007)*
- **FR-011**: Los traslados MUST mover el costo sin afectar resultados. *(R-INV-008)*
- **FR-012**: Los ítems con lotes MUST exigir lote en entradas y salidas, despachar FEFO por defecto y no vender lotes vencidos. *(R-INV-009)*
- **FR-013**: Los ajustes por toma física MUST registrarse al costo del ítem con motivo y permiso. *(R-INV-011)*
- **FR-014**: Los kits MUST descontar el stock de sus componentes y las reservas MUST restar del disponible. *(R-INV-012, R-INV-013)*
- **FR-015**: Para cada cuenta de inventario, la suma de valores del kardex MUST conciliar con el saldo contable. *(R-INV-015)*

### Key Entities *(include if feature involves data)*

- **Ítem con inventario**: con método de costeo y política de despacho.
- **Movimiento de kardex**: entrada o salida con cantidad, costo y saldo acumulado.
- **Capa de costo**: entrada PEPS con costo y cantidad restante.
- **Consumo de capa**: registro de la porción de una capa que consumió una salida.
- **Lote**: grupo con código y vencimiento.
- **Bodega**: con tipo (principal, avería, cuarentena, tránsito).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El kardex de referencia en promedio reproduce al centavo los costos y saldos del catálogo de reglas.
- **SC-002**: El kardex de referencia en PEPS reproduce 1.200.000; 700.000 y 1.200.000 y el total vendido iguala al total comprado.
- **SC-003**: En 100 % de las pruebas de conciliación, la suma de valores del kardex coincide con la cuenta de inventario del libro mayor.
- **SC-004**: Ningún ítem perecedero tiene un método de costeo distinto de PEPS.

## Assumptions

- La clasificación fiscal del método sigue la técnica contable (ET art. 65 ⚠️).
- El cambio de método con movimientos existentes está fuera del MVP.
- Las unidades de medida alternativas se convierten a la unidad base en el registro del movimiento.

## Trazabilidad de reglas

Fuente: [`04-inventarios-y-valoracion.md`](../../02-normativa-y-reglas/04-inventarios-y-valoracion.md) §3 y §4. La
relación regla → requisito → escenario se genera en [`../traceability-matrix.md`](../traceability-matrix.md).
Escenarios ejecutables: [`acceptance/kardex-y-costeo.feature`](acceptance/kardex-y-costeo.feature).

## Verificación de constitución

| Gate | Cumplimiento en esta spec |
|---|---|
| G-01 | `WeightedAverageCosting` y `FifoCosting` son servicios de dominio puros tras `CostingStrategy` |
| G-03 | Las capas y el kardex se persisten solo mediante repositorios de infraestructura |
| G-06 | `stock_movement` y `cost_layer_consumption` solo reciben inserciones |
| G-09 | Costos con decimal exacto y escala de 6 decimales para costo unitario |
| G-10 | R-INV-001: ⚠️ (fórmulas admitidas); perecederos = política de producto |
