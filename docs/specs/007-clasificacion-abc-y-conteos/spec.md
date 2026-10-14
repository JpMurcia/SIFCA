# Feature Specification: Clasificación ABC y conteos cíclicos

**Feature Branch**: `007-clasificacion-abc-y-conteos`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "Clasificar el inventario en A (alto valor y alta rotación: auditoría estricta, recuentos periódicos forzosos y alertas en tiempo real), B (moderados) y C (bajo valor y baja rotación: reposición simplificada)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clasificar el inventario por valor y rotación (Priority: P1)

El responsable de logística ve, cada mes, la clase A, B o C de cada ítem, calculada con el valor de consumo
anual (Pareto) y la rotación, para saber dónde concentrar la atención.

**Why this priority**: orienta todas las políticas posteriores (conteos, alertas, niveles de servicio).

**Independent Test**: con los diez ítems de ejemplo se obtienen las clases esperadas.

**Acceptance Scenarios**:

1. **Dado** los diez ítems de ejemplo, **Entonces** P01 y P02 son A; P03 a P07 son B; P08 a P10 son C.
2. **Dado** un ítem de alto valor pero baja rotación, **Entonces** es B y no A.

---

### User Story 2 - Conteos cíclicos forzosos según la clase (Priority: P1)

El sistema genera tareas de conteo con frecuencia según la clase (A mensual y forzoso, B trimestral, C
semestral) y los ajustes por diferencias siguen controles proporcionales a la clase.

**Why this priority**: la exactitud del inventario de mayor valor es crítica.

**Independent Test**: se generan las tareas del mes y se verifica el efecto de un conteo A vencido.

**Acceptance Scenarios**:

1. **Dado** ítems A, B y C, **Cuando** se planifican los conteos, **Entonces** A se cuenta mensualmente, B trimestralmente y C semestralmente.
2. **Dado** un conteo de clase A vencido, **Cuando** se cierra el período, **Entonces** se bloquea o se exige justificación según la configuración.

---

### User Story 3 - Estabilidad, historial y auditoría (Priority: P2)

La clase no «salta» por ruido: baja solo tras dos cálculos consecutivos, sube de inmediato, cada cambio queda en
el historial y se notifica; los movimientos manuales sobre ítems A quedan destacados.

**Why this priority**: evita ruido operativo y mejora la auditoría.

**Independent Test**: se recalculan clases en meses sucesivos y se revisa historial y eventos.

**Acceptance Scenarios**:

1. **Dado** un ítem A que calcula B por primera vez, **Entonces** sigue siendo A; tras un segundo cálculo B pasa a B.

---

### Edge Cases

- Ítems con menos de 90 días de historia.
- Ítems sin ventas en la ventana.
- Empates en el valor de consumo (desempate determinista por código).
- Ítems con devoluciones que reducen su consumo neto.
- Valor promedio del inventario igual a cero (rotación indefinida).
- Ítem que cruza el umbral del 80 % (queda en la clase donde empieza).
- Cambio de los umbrales de Pareto por el administrador.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST ordenar los ítems por valor de consumo anual (costo de ventas neto) y asignar la clase de Pareto con el acumulado previo (A hasta 80 %, B hasta 95 %, C el resto; umbrales configurables). *(R-INV-020)*
- **FR-002**: El sistema MUST calcular la rotación (vueltas por año) y combinarla con la clase de Pareto mediante la matriz de clase final. *(R-INV-020)*
- **FR-003**: Los ítems con menos de 90 días de historia MUST quedar como B provisional marcados «nuevo»; los de valor cero, como C marcados «sin rotación». *(R-INV-020)*
- **FR-004**: La clasificación MUST recalcularse mensualmente y bajo demanda; un ítem solo baja de clase tras dos cálculos consecutivos y sube de inmediato, con historial y evento. *(R-INV-021)*
- **FR-005**: El sistema MUST generar tareas de conteo cíclico según la clase y aplicar las políticas de alertas, nivel de servicio y aprobación de ajustes por clase. *(R-INV-022)*
- **FR-006**: Un conteo vencido de clase A MUST poder bloquear el cierre del período según configuración. *(R-INV-022, R-CON-011)*
- **FR-007**: Los ajustes derivados del conteo MUST registrarse al costo del ítem con comprobante, motivo y permiso. *(R-INV-011)*
- **FR-008**: Los movimientos manuales sobre ítems de clase A MUST quedar marcados en la bitácora y en un reporte de excepciones. *(R-INV-023)*
- **FR-009**: El cálculo MUST ser un servicio de dominio puro y determinista (mismos datos y misma fecha, mismo resultado). *(P-II)*

### Key Entities *(include if feature involves data)*

- **Clasificación ABC**: ítem, fecha de cálculo, valor de consumo, % acumulado previo, clase de Pareto, vueltas, rotación y clase final.
- **Tarea de conteo cíclico**: bodega, clase, fecha límite, estado y líneas con diferencias.
- **Política por clase**: frecuencia de conteo, alertas, nivel de servicio y control de ajustes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El cálculo de los diez ítems de ejemplo reproduce exactamente las clases finales del catálogo de reglas.
- **SC-002**: El mismo conjunto de datos y fecha producen siempre la misma clasificación.
- **SC-003**: Ningún ítem de clase A queda sin conteo en un mes sin una justificación registrada.
- **SC-004**: El recálculo mensual de 50.000 ítems completa en menos de 5 minutos.

## Assumptions

- La ventana por defecto es de 12 meses y los umbrales 80/95 % y de rotación 6,0/2,0 vueltas son parámetros de negocio.
- El valor promedio del inventario del ítem en la ventana está disponible desde el kardex.
- La clase ABC no es una regla normativa: es un criterio de gestión configurable.

## Trazabilidad de reglas

Fuente: [`04-inventarios-y-valoracion.md`](../../02-normativa-y-reglas/04-inventarios-y-valoracion.md) §5. La relación
regla → requisito → escenario se genera en [`../traceability-matrix.md`](../traceability-matrix.md). Escenarios
ejecutables: [`acceptance/abc-y-conteos.feature`](acceptance/abc-y-conteos.feature). Flujo:
[`03-procesos-y-flujos/04-…`](../../03-procesos-y-flujos/04-reposicion-abc-y-conteos.md).

## Verificación de constitución

| Gate | Cumplimiento en esta spec |
|---|---|
| G-01 | `AbcClassifier` es un servicio de dominio puro; la fecha entra por parámetro |
| G-02, G-03 | La lectura de ventas y valor de inventario usa puertos de lectura implementados en infraestructura |
| G-06 | El historial de clasificaciones y los ajustes solo se insertan |
| G-10 | Parámetros de negocio, no normativa: se documentan como configurables |
