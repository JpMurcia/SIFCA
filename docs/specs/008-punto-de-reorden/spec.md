# Feature Specification: Punto de reorden y stock de seguridad

**Feature Branch**: `008-punto-de-reorden`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "Calcular y alertar automáticamente el punto de reorden ROP = (d × L) + SS, donde d es la demanda promedio diaria, L el tiempo de entrega del proveedor y SS el stock de seguridad que amortigua los picos de demanda (reposición justo a tiempo)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Saber cuándo reponer cada ítem (Priority: P1)

El comprador ve, para cada ítem, la demanda promedio, el tiempo de entrega, el stock de seguridad y el punto de
reorden calculados automáticamente, y recibe una alerta cuando la posición de inventario cruza el punto.

**Why this priority**: evita quiebres de stock sin inmovilizar capital en exceso.

**Independent Test**: con los datos de ejemplo se verifican SS = 27 y ROP = 167 y la alerta al cruzar.

**Acceptance Scenarios**:

1. **Dado** d = 20, L = 7 y σd = 6 al 95 %, **Entonces** el stock de seguridad es 27 y el ROP es 167.
2. **Dado** una posición de 150 sin órdenes en camino, **Entonces** se emite la alerta de reposición.

---

### User Story 2 - Variabilidad y nivel de servicio por clase (Priority: P1)

El stock de seguridad considera la variabilidad de la demanda y del tiempo de entrega, con un nivel de servicio
que depende de la clase ABC del ítem (A 98 %, B 95 %, C 90 %).

**Why this priority**: calibra el riesgo según la importancia del ítem.

**Independent Test**: se calcula el mismo ítem con y sin variabilidad del tiempo de entrega y en las tres clases.

**Acceptance Scenarios**:

1. **Dado** σL = 2 días, **Entonces** SS = 71 y ROP = 211.
2. **Dado** un ítem clase A al 98 %, **Entonces** SS = 33 y ROP = 173.

---

### User Story 3 - Datos fiables y sugerencia de pedido (Priority: P2)

El cálculo usa solo demanda real (netas de devoluciones, sin traslados ni ajustes), descarta días sin
disponibilidad, calcula el tiempo de entrega con las últimas recepciones y sugiere la cantidad a pedir.

**Why this priority**: sin datos limpios el cálculo engaña.

**Independent Test**: se verifican la demanda excluyendo días sin stock, el tiempo de entrega y la cantidad sugerida.

**Acceptance Scenarios**:

1. **Dado** 10 días sin disponibilidad en una ventana de 90, **Entonces** la demanda promedio usa solo los 80 días válidos.
2. **Dado** un ROP de 167, d = 20 y ciclo de 14 días con posición 150, **Entonces** la cantidad sugerida es 297.

---

### Edge Cases

- Menos de 30 días de historia (demanda manual con baja confianza).
- Ítem sin proveedor ni recepciones previas (tiempo de entrega pactado).
- Unidades fraccionarias (4 decimales en lugar de redondeo al entero).
- Órdenes de compra abiertas que cubren la posición.
- Devoluciones que reducen la demanda neta.
- Ítem con demanda cero (ROP = 0, sin alerta).
- Proveedor con tiempos de entrega muy variables.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST calcular la demanda promedio diaria y su desviación estándar sobre una ventana móvil (por defecto 90 días) con salidas por venta netas de devoluciones, excluyendo traslados, ajustes y días sin disponibilidad. *(R-INV-030)*
- **FR-002**: El sistema MUST usar la demanda manual con marca de baja confianza cuando haya menos de 30 días válidos. *(R-INV-030)*
- **FR-003**: El sistema MUST calcular el tiempo de entrega como promedio de las últimas recepciones (por defecto 5) con su desviación, o el pactado si no hay historial. *(R-INV-031)*
- **FR-004**: El sistema MUST calcular el stock de seguridad con SS = z · √(L·σd² + d²·σL²) según el nivel de servicio objetivo de la clase del ítem. *(R-INV-032)*
- **FR-005**: El sistema MUST calcular ROP = d × L + SS y redondear hacia arriba en unidades contables (4 decimales en fraccionarias). *(R-INV-032)*
- **FR-006**: El sistema MUST calcular la posición de inventario como disponible más cantidades en órdenes de compra abiertas y alertar cuando es menor o igual al ROP. *(R-INV-033)*
- **FR-007**: El sistema MUST publicar el evento de reposición requerida con ítem, posición, ROP y cantidad sugerida, y sugerir la cantidad como el máximo (ROP + d × ciclo) menos la posición. *(R-INV-034)*
- **FR-008**: El cálculo MUST refrescarse diariamente y al registrar una recepción, guardando los valores usados para auditar cada alerta. *(R-INV-034)*
- **FR-009**: El cálculo MUST ser un servicio de dominio puro y determinista. *(P-II)*

### Key Entities *(include if feature involves data)*

- **Métricas de reposición**: demanda, desviación, tiempo de entrega, nivel de servicio, z, stock de seguridad, ROP y confianza.
- **Posición de inventario**: disponible más pendiente en órdenes abiertas.
- **Proveedor del ítem**: tiempo de entrega pactado y cantidad mínima.
- **Alerta de reposición**: evento con los valores usados.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Los tres ejemplos del catálogo de reglas se reproducen exactamente (ROP 167, 211 y 173).
- **SC-002**: Ningún ítem cruza su ROP sin que se emita una alerta en el mismo ciclo de cálculo.
- **SC-003**: El recálculo diario de 50.000 ítems completa en menos de 5 minutos.

## Assumptions

- Los valores de z provienen de la distribución normal estándar (1,2816; 1,6449; 1,96; 2,0537; 2,3263).
- La estacionalidad y la demanda intermitente quedan fuera de esta primera versión.
- No se crean órdenes de compra automáticas salvo configuración.

## Trazabilidad de reglas

Fuente: [`04-inventarios-y-valoracion.md`](../../02-normativa-y-reglas/04-inventarios-y-valoracion.md) §6. La relación
regla → requisito → escenario se genera en [`../traceability-matrix.md`](../traceability-matrix.md). Escenarios
ejecutables: [`acceptance/punto-de-reorden.feature`](acceptance/punto-de-reorden.feature). Flujo:
[`03-procesos-y-flujos/04-…`](../../03-procesos-y-flujos/04-reposicion-abc-y-conteos.md).

## Verificación de constitución

| Gate | Cumplimiento en esta spec |
|---|---|
| G-01 | `ReorderPointCalculator` es un servicio de dominio puro; sin reloj ni base de datos |
| G-05 | Las alertas se publican por *outbox* y webhook estándar |
| G-09 | Cantidades con decimal exacto; sin `number` en el cálculo |
| G-10 | Fórmulas estándar ✅ (aritmética); parámetros de negocio configurables |
