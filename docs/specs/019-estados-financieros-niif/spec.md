# Feature Specification: Estados financieros NIIF para Pymes

**Feature Branch**: `019-estados-financieros-niif`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "SPEC-019 de la hoja de ruta (`docs/roadmap-specs.md` §2.3, Ola 2): estado de situación
financiera (corriente/no corriente) y estado de resultados (ingresos − devoluciones − costo de ventas − gastos) bajo NIIF
para Pymes, comparativos entre dos fechas o períodos, a partir del balance de prueba y de la clasificación del plan de
cuentas (spec 018); exportación a PDF y XLSX; huella reproducible. Fuera: flujo de efectivo, cambios en el patrimonio y
notas. Brecha de diseño G-04: no hay maqueta."

## Contexto

La spec 001 produce el balance de prueba cuadrado por cuenta y nivel. Lo que el contador entrega a la gerencia, a los
socios y a los bancos son los **estados financieros**: la situación financiera a una fecha y el resultado de un período,
presentados por partidas y comparados con un período anterior. Esta spec los produce **a partir de los saldos
contabilizados** y de la clasificación de cada cuenta (spec 018), sin digitar cifras y de forma reproducible: el mismo
rango siempre da el mismo informe.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Estado de situación financiera a una fecha (Priority: P1)

El contador genera el estado de situación financiera al 31/10/2026: activos, pasivos y patrimonio por partida,
separados en corrientes y no corrientes, con el resultado del ejercicio en curso dentro del patrimonio. El informe indica
si cuadra (activo = pasivo + patrimonio).

**Why this priority**: es el estado más pedido (bancos, socios, cámara de comercio) y valida la integridad de la
contabilidad.

**Independent Test**: con el libro de referencia (apertura + P-01 → P-03) generar el estado al 31/10/2026 y comparar
con las cifras esperadas.

**Acceptance Scenarios**:

1. **Dado** el libro de referencia, **Cuando** genera el estado al 31/10/2026, **Entonces** muestra Efectivo y
   equivalentes $ 952.000,00, Inventarios $ 520.000,00 y total activo corriente y total activo $ 1.472.000,00.
2. **Dado** lo mismo, **Entonces** muestra Impuestos por pagar $ 152.000,00 (total pasivo $ 152.000,00), Capital
   $ 1.000.000,00, Resultado del ejercicio $ 320.000,00, total patrimonio $ 1.320.000,00 y total pasivo más patrimonio
   $ 1.472.000,00 con el sello «Cuadrado».
3. **Dado** una cuenta con saldo y sin clasificación efectiva, **Cuando** genera el estado, **Entonces** no se emite y
   el mensaje lista las cuentas sin clasificar con enlace al plan de cuentas.

---

### User Story 2 - Estado de resultados de un período (Priority: P1)

El contador genera el estado de resultados de octubre de 2026: ingresos de actividades ordinarias, devoluciones,
ingresos netos, costo de ventas, utilidad bruta, gastos por función y resultado del período.

**Why this priority**: es la medida del desempeño; la gerencia lo pide cada mes.

**Independent Test**: con el libro de referencia generar el estado del 01/10/2026 al 31/10/2026.

**Acceptance Scenarios**:

1. **Dado** el libro de referencia, **Cuando** genera el estado de octubre de 2026, **Entonces** muestra ingresos
   $ 1.000.000,00, devoluciones ($ 200.000,00), ingresos netos $ 800.000,00, costo de ventas ($ 480.000,00), utilidad
   bruta $ 320.000,00, gastos $ 0,00 y resultado del período $ 320.000,00.
2. **Dado** el mismo período, **Entonces** el resultado del período coincide al centavo con el «Resultado del
   ejercicio» del estado de situación financiera al cierre de ese período (si el año no tiene otros meses con
   movimiento).
3. **Dado** un comprobante de cierre anual (origen `YEAR_CLOSING`), **Entonces** el estado de resultados del año lo
   excluye, de modo que el resultado no se anula a cero por el cierre.

---

### User Story 3 - Comparativo con otro período (Priority: P2)

El contador compara octubre de 2026 con septiembre de 2026 (o el 31/12/2026 con el 31/12/2025) en columnas, con la
variación absoluta y porcentual.

**Why this priority**: NIIF para Pymes exige información comparativa; la gerencia la usa para decidir.

**Independent Test**: generar el comparativo de dos períodos con datos conocidos.

**Acceptance Scenarios**:

1. **Dado** octubre con movimientos y septiembre sin ellos, **Cuando** genera el comparativo, **Entonces** la columna de
   septiembre muestra $ 0,00 y la variación porcentual se muestra como «—» cuando la base es cero.
2. **Dado** dos fechas de corte, **Cuando** genera el comparativo del estado de situación financiera, **Entonces** cada
   columna cuadra por sí sola.

---

### User Story 4 - Exportar y reproducir (Priority: P2)

El contador exporta los estados a PDF (con encabezado de la empresa, NIT, fecha de corte y firmas) y a XLSX; el informe
lleva una **huella** que permite comprobar después que corresponde exactamente a los mismos datos.

**Why this priority**: los estados se entregan a terceros; deben poder reproducirse y verificarse.

**Independent Test**: generar dos veces el mismo informe y comparar huellas; contabilizar algo y comparar de nuevo.

**Acceptance Scenarios**:

1. **Dado** el mismo rango y los mismos datos, **Cuando** genera el informe dos veces, **Entonces** la huella es
   idéntica.
2. **Dado** un comprobante nuevo dentro del rango, **Cuando** genera el informe otra vez, **Entonces** la huella cambia.
3. **Dado** la exportación a XLSX, **Entonces** las cifras son números con dos decimales (no texto) y los totales
   coinciden con el PDF.

---

### User Story 5 - Ir del estado al detalle (Priority: P3)

Desde una partida del estado, el contador abre las cuentas que la componen y, desde cada cuenta, su libro mayor del
período.

**Why this priority**: acelera la revisión; los datos ya existen (spec 001).

**Independent Test**: abrir «Inventarios» y llegar al mayor de `1435`.

**Acceptance Scenarios**:

1. **Dado** la partida «Inventarios» del estado al 31/10/2026, **Cuando** la abre, **Entonces** ve `1435` con
   $ 520.000,00 y un enlace a su libro mayor del período.

### Edge Cases

- **Saldo contrario a la naturaleza** de una cuenta (p. ej. bancos en sobregiro): se presenta con signo en su partida
  y una marca de alerta; no se reclasifica automáticamente.
- **Período sin movimientos**: el informe se genera con ceros, no como vacío ni error.
- **Fecha de corte en un período abierto**: se permite, con la leyenda «Período abierto: cifras sujetas a cambio».
- **Año con cierre anual reversado**: el resultado vuelve a calcularse desde las cuentas de resultado.
- **Cuentas de las clases 7, 8 y 9**: fuera de los estados del MVP; si tienen saldo se informa en una nota de
  advertencia.
- **Resultado negativo**: se presenta como «Pérdida del período» con el valor entre paréntesis.
- **Partida sin cuentas con saldo**: se oculta salvo que el usuario pida «mostrar partidas en cero».

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST generar el estado de situación financiera a una fecha de corte, agrupando el saldo de cada cuenta de las clases 1, 2 y 3 en su partida de estado financiero y en bloques corriente / no corriente según la clasificación efectiva de la spec 018 *(R-CON-013, R-CON-010)*.
- **FR-002**: El patrimonio MUST incluir una línea «Resultado del ejercicio» igual al saldo neto de las clases 4, 5 y 6 desde el inicio del año fiscal hasta la fecha de corte, mientras el año no tenga un cierre anual vigente *(R-CON-012)*.
- **FR-003**: El estado de situación financiera MUST mostrar los totales de activo, pasivo y patrimonio y el sello «Cuadrado» cuando activo = pasivo + patrimonio; si no cuadra, MUST mostrar la diferencia en rojo y no permitir exportarlo *(R-CON-001)*.
- **FR-004**: El sistema MUST generar el estado de resultados de un rango de fechas con la estructura: ingresos de actividades ordinarias, devoluciones y descuentos, ingresos netos, costo de ventas, utilidad bruta, gastos de administración, gastos de ventas, otros ingresos y gastos, y resultado del período *(R-CON-013)*.
- **FR-005**: El estado de resultados MUST excluir los comprobantes de cierre anual (origen `YEAR_CLOSING`) del rango *(R-CON-012)*.
- **FR-006**: Los importes MUST calcularse sobre los saldos contabilizados con aritmética decimal exacta y presentarse en COP con dos decimales; las deducciones se presentan entre paréntesis *(R-CON-009, P-VI)*.
- **FR-007**: Un saldo contrario a la naturaleza de su cuenta MUST presentarse con su signo y una marca de alerta, sin ocultarse ni reclasificarse *(R-CON-013)*.
- **FR-008**: Si alguna cuenta de las clases 1 a 6 con saldo no tiene clasificación efectiva, el informe MUST NOT emitirse y responder `VALIDATION_FAILED` con la lista de cuentas *(R-CON-013)*.
- **FR-009**: Ambos estados MUST poder compararse con una segunda fecha o rango, mostrando para cada partida los dos valores, la variación absoluta y la porcentual («—» si la base es cero) *(R-CON-010)*.
- **FR-010**: El mismo rango y los mismos datos MUST producir siempre el mismo informe y la misma huella; la huella MUST cambiar si cambia cualquier saldo del rango *(R-CON-010)*.
- **FR-011**: Los estados MUST exportarse a PDF (encabezado con razón social, NIT, título, fecha o rango, leyenda de período abierto si aplica, espacios de firma de representante legal y contador) y a XLSX con cifras numéricas *(ADR-0008, R-CON-010)*.
- **FR-012**: Desde cada partida MUST poderse ver las cuentas que la componen y, desde cada cuenta, abrir su libro mayor del período *(R-CON-010)*.
- **FR-013**: La consulta MUST exigir `accounting.report.read`, estar aislada por empresa y no modificar datos *(P-IV, ADR-0002)*.
- **FR-014**: Si la fecha de corte o el rango toca un período abierto, el informe MUST llevar la leyenda «Período abierto: cifras sujetas a cambio» *(R-CON-011)*.

### Key Entities *(include if feature involves data)*

- **Estado financiero** (informe, no se almacena): tipo, fecha de corte o rango, comparativo opcional, partidas con
  valores, totales, sello de cuadre, huella, leyendas.
- **Partida de estado financiero** (de la spec 018): estado, código, nombre, orden, bloque (corriente/no corriente),
  signo de presentación.
- **Línea de detalle**: cuenta, saldo, clasificación efectiva.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con el libro de referencia, el 100 % de las cifras de los dos estados coincide al centavo con las de los
  escenarios.
- **SC-002**: El estado de situación financiera de una empresa con 1.000.000 de líneas contables en el año se genera
  en menos de 5 segundos.
- **SC-003**: El 100 % de las regeneraciones con los mismos datos produce la misma huella.
- **SC-004**: El contador obtiene los dos estados del mes, comparativos y exportados, en menos de 2 minutos.

## Assumptions

- **Marco:** NIIF para Pymes (Grupo 2, S-03). Las plantillas del Grupo 3 (microempresas) dependen de la pregunta
  abierta Q-05 y quedan fuera de esta spec.
- **Estructura de partidas:** la propone esta spec a partir del PUC base (spec 018) y la valida el contador antes de
  producción (G-10); la presentación por función de los gastos es la del MVP.
- **Fuera de alcance:** estado de flujos de efectivo, estado de cambios en el patrimonio, notas, consolidación y
  estados en otra moneda.
- **Diseño:** no hay maqueta (brecha G-04 de la auditoría); la pantalla sigue el patrón del balance de prueba (`3g`)
  con selector de estado, fecha o rango, comparativo y exportar. Se pide en la Tanda 8 de diseño.
- **Libro de referencia:** apertura `1435`/`3115` de $ 1.000.000 más P-01, P-02 y P-03
  ([`02-…/01-…` §5](../../02-normativa-y-reglas/01-contabilidad-partida-doble-y-puc.md)), con la clasificación del PUC
  base: `1110` efectivo, `1435` inventarios, `2408` impuestos por pagar, `3115` capital, `4135` ingresos, `4175`
  devoluciones, `6135` costo de ventas.

## Trazabilidad de reglas

Esta especificación implementa R-CON-001 (cuadre), R-CON-009 (decimales), R-CON-010 (libros reproducibles), R-CON-011
(períodos), R-CON-012 (resultado y cierre anual) y R-CON-013 (naturaleza y presentación), y se rige por los principios
IV y VI de la [constitución](../../constitution.md) y los ADR-0002 y ADR-0008. La relación se genera en
[`../traceability-matrix.md`](../traceability-matrix.md). Escenarios ejecutables:
[`acceptance/estados-financieros.feature`](acceptance/estados-financieros.feature). Alcance por fases:
[`02-…/01-…` §6](../../02-normativa-y-reglas/01-contabilidad-partida-doble-y-puc.md). Depende de la spec 018.

## Verificación de constitución

| Gate | Cumplimiento en esta spec |
|---|---|
| G-01 a G-03 | El armado de los estados es un servicio de dominio puro sobre saldos y clasificaciones; la lectura de saldos es un puerto |
| G-06 | Solo lectura; no escribe en tablas contables |
| G-07 | La consulta corre con el `tenant_id` de la sesión bajo RLS; prueba con dos empresas |
| G-09 | Aritmética decimal exacta; ningún `number` en importes |
| G-10 | La estructura de partidas y las cuentas de cierre son 🔶 hasta la validación del contador |
| G-11 | Escenarios `[019-01]…[019-09]` etiquetados |
