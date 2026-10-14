# Matriz de trazabilidad

> **Archivo generado** por `node scripts/docs.mjs matrix`. No se edita a mano: el CI (`check`) falla si está
> desactualizado. Une cada **regla normativa** con los requisitos (`FR`) de las especificaciones y los
> **escenarios ejecutables** (Gherkin) que la ejercen.

## Resumen

| Indicador | Valor |
|---|---:|
| Especificaciones | 11 |
| Requisitos funcionales (FR) | 133 |
| Escenarios ejecutables | 157 |
| Reglas definidas en el catálogo | 95 |
| Reglas con cobertura (FR o escenario) | 85 |
| Reglas **sin** cobertura todavía | 10 |

## 1. Reglas → requisitos → escenarios

| Regla | Título | Requisitos (spec/FR) | Escenarios |
|---|---|---|---|
| R-CON-001 | Todo comprobante cuadra | 001/FR-001, 002/FR-011, 005/FR-004 | 001-01, 001-02, 001-11, 005-01 |
| R-CON-002 | Cada línea tiene un solo lado, positivo | 001/FR-002 | 001-03 |
| R-CON-003 | Mínimo dos líneas y solo cuentas auxiliares activas | 001/FR-003 | 001-01, 001-04 |
| R-CON-004 | Solo en períodos abiertos | 001/FR-004, 002/FR-003 | 001-05, 001-14, 002-07 |
| R-CON-005 | Inmutabilidad y reversión | 001/FR-005, 004/FR-009 | 001-06, 001-07, 004-14 |
| R-CON-006 | Consecutivo propio por tipo de comprobante, sin saltos ni duplicados | 001/FR-006 | 001-08 |
| R-CON-007 | Trazabilidad al documento fuente | 001/FR-007, 002/FR-001, 002/FR-011, 005/FR-004 | 002-01 |
| R-CON-008 | Tercero y dimensión obligatorios según la cuenta | 001/FR-008, 010/FR-011 | 001-09, 010-14 |
| R-CON-009 | Aritmética decimal y redondeo | 001/FR-009, 002/FR-004, 010/FR-003 | 001-10 |
| R-CON-010 | Libros oficiales | 001/FR-010 | 001-16 |
| R-CON-011 | Cierre mensual | 001/FR-011, 007/FR-006 | 001-12, 007-08 |
| R-CON-012 | Cierre anual | 001/FR-012 | 001-15 |
| R-CON-013 | Naturaleza de las cuentas | 001/FR-010 | 001-11 |
| R-CON-014 | Fecha, hora y zona | 001/FR-013 | 001-13 |
| R-IMP-001 | Tarifas de IVA | 004/FR-006, 010/FR-001 | 004-13, 010-02 |
| R-IMP-002 | Base gravable | 010/FR-002 | — |
| R-IMP-003 | IVA por línea y redondeo | 002/FR-004, 010/FR-003 | 002-01, 010-01 |
| R-IMP-004 | IVA descontable | 010/FR-004 | — |
| R-IMP-010 | Quién retiene | 010/FR-005 | 010-06 |
| R-IMP-011 | Base y momento | 005/FR-002, 010/FR-006 | 005-01, 005-04 |
| R-IMP-012 | Concepto, cuantía mínima y tarifa | 005/FR-002, 010/FR-006 | 005-01, 005-02, 005-03, 005-04, 010-03, 010-04, 010-05, 010-09, 010-13 |
| R-IMP-013 | Certificados | 010/FR-011 | 010-14 |
| R-IMP-020 | ReteIVA | 005/FR-003, 010/FR-007 | 005-04, 010-07, 010-09 |
| R-IMP-021 | ReteICA | 005/FR-003, 010/FR-007 | 005-04, 010-08, 010-09 |
| R-FE-001 | Quién debe facturar electrónicamente | 009/FR-001 | — |
| R-FE-002 | Validación previa | 009/FR-002 | 009-01, 009-02 |
| R-FE-003 | Numeración autorizada | 002/FR-002, 009/FR-003 | 002-01, 002-08, 009-10 |
| R-FE-004 | Consecutivo sin saltos dentro del rango | 002/FR-002, 009/FR-003 | 002-01, 002-03, 002-05, 009-04 |
| R-FE-005 | CUFE y CUDE | 009/FR-004 | 009-01, 009-03 |
| R-FE-006 | Código QR | 009/FR-005 | — |
| R-FE-007 | Representación gráfica (PDF) | 009/FR-005 | 009-01, 009-13 |
| R-FE-008 | Estados DIAN | 004/FR-011, 009/FR-006, 009/FR-012 | 004-12, 009-01, 009-04, 009-05 |
| R-FE-009 | Un documento aceptado no se modifica | 004/FR-009, 009/FR-007 | 004-14, 009-07 |
| R-FE-010 | Notas crédito y débito | 004/FR-008, 004/FR-011 | 004-06, 004-12 |
| R-FE-011 | Contingencia | 009/FR-009 | 009-06 |
| R-FE-012 | Identificación del adquirente | 002/FR-009, 009/FR-008 | 002-09, 009-11, 009-12 |
| R-FE-013 | Conservación | 009/FR-010 | 009-01, 009-15 |
| R-FE-014 | Documento soporte | 005/FR-006 | 005-13 |
| R-INV-001 | Métodos de costeo permitidos y selección por ítem | 006/FR-001, 006/FR-002 | 006-01, 006-02 |
| R-INV-002 | Valor de una entrada | 005/FR-001, 006/FR-003 | 005-01, 005-05, 005-06, 006-03 |
| R-INV-003 | Costo de una salida — promedio ponderado | 002/FR-005, 006/FR-004 | 002-01, 006-03, 006-05, 006-06 |
| R-INV-016 | Costeo PEPS (FIFO) con capas | 002/FR-005, 004/FR-004, 005/FR-007, 006/FR-005 | 004-07, 005-06, 005-09, 006-04, 006-05 |
| R-INV-017 | Política de despacho físico y separación entre costo y flujo físico | 006/FR-007 | 006-07 |
| R-INV-018 | El método de costeo no cambia con movimientos existentes | 006/FR-008 | 006-08 |
| R-INV-004 | Movimientos inmutables | 006/FR-006 | 006-09 |
| R-INV-006 | Movimientos con fecha anterior (retroactivos) | 006/FR-009 | 006-10 |
| R-INV-007 | Stock negativo | 002/FR-005, 006/FR-010 | 002-02, 002-04, 006-11 |
| R-INV-008 | Traslados entre bodegas | 006/FR-011 | 006-12 |
| R-INV-009 | Lotes y vencimientos | 006/FR-012 | 004-15, 006-13 |
| R-INV-011 | Ajustes por toma física | 006/FR-013, 007/FR-007 | 006-14, 007-09 |
| R-INV-012 | Tipos de ítem | 006/FR-014 | 006-15 |
| R-INV-013 | Reservas y disponibilidad | 002/FR-006, 006/FR-014 | 002-13, 006-15 |
| R-INV-015 | Conciliación inventario–contabilidad | 006/FR-015 | 006-16 |
| R-INV-020 | Cálculo de la clasificación | 007/FR-001, 007/FR-002, 007/FR-003 | 007-01, 007-02, 007-03, 007-04, 007-05 |
| R-INV-021 | Frecuencia y estabilidad | 007/FR-004 | 007-06 |
| R-INV-022 | Políticas por clase | 007/FR-005, 007/FR-006 | 007-07, 007-08, 007-09 |
| R-INV-023 | Auditoría de ítems de clase A | 007/FR-008 | 007-10 |
| R-INV-030 | Demanda promedio diaria $d$ | 008/FR-001, 008/FR-002 | 008-07, 008-08, 008-09 |
| R-INV-031 | Lead time $L$ | 008/FR-003 | 008-10, 008-11 |
| R-INV-032 | Stock de seguridad $SS$ | 008/FR-004, 008/FR-005 | 008-01, 008-02, 008-03, 008-04, 008-12 |
| R-INV-033 | Posición de inventario y disparo | 008/FR-006 | 008-05 |
| R-INV-034 | Alertas y sugerencia de reposición | 008/FR-007, 008/FR-008 | 008-05, 008-06, 008-13 |
| R-INV-040 | Elegibilidad y límites de una devolución en venta | 004/FR-001, 004/FR-002 | 004-01, 004-04, 004-06, 004-11 |
| R-INV-041 | Reingreso físico según el estado del producto | 004/FR-003, 004/FR-005 | 004-01, 004-02, 004-03 |
| R-INV-042 | Costo del reingreso | 004/FR-004 | 004-01, 004-07, 004-08 |
| R-INV-043 | Efecto contable, fiscal y de cartera de la nota crédito | 004/FR-006, 004/FR-007, 004/FR-012 | 004-01, 004-02, 004-05 |
| R-INV-044 | Idempotencia y atomicidad | 004/FR-010 | 004-09, 004-10 |
| R-INV-045 | Devolución a proveedor | 005/FR-007, 005/FR-008 | 005-08, 005-09, 005-10, 005-11 |
| R-INV-046 | Bodega de avería y trazabilidad por lote | 004/FR-003 | 004-03, 004-15 |
| R-CAR-001 | La cartera se deriva del libro mayor, no de un saldo aparte | 003/FR-001 | 003-16 |
| R-CAR-002 | Plazos y vencimiento | 002/FR-007, 003/FR-002 | 002-01, 002-10 |
| R-CAR-003 | Aplicación de recibos y abonos | 003/FR-003 | 003-07, 003-08, 003-09, 003-17 |
| R-CAR-004 | Retenciones sufridas en el recibo | 003/FR-004 | 003-10 |
| R-CAR-005 | Notas crédito | 003/FR-005, 004/FR-007 | 004-01, 004-05 |
| R-CAR-006 | Edades de cartera | 003/FR-006 | 003-05 |
| R-CAR-007 | Mora: definición y alcance | 003/FR-007 | — |
| R-CAR-008 | Cupo de crédito y su consumo | 002/FR-007, 003/FR-008 | 002-01, 002-10, 003-01, 003-02, 003-07, 003-11, 003-12 |
| R-CAR-012 | Bloqueo de despacho por cupo excedido o por mora | 002/FR-008, 003/FR-009 | 002-11, 003-02, 003-03, 003-04, 003-06 |
| R-CAR-013 | Alertas de cartera y de crédito | 003/FR-010 | 003-13 |
| R-CAR-014 | Estado de crédito del cliente | 003/FR-011 | 003-06, 003-14 |
| R-CAR-015 | Cambios del cupo y del plazo | 003/FR-012 | 003-15 |
| R-CAR-020 | Registro y causación | 003/FR-015, 005/FR-004 | 005-01, 005-04 |
| R-CAR-021 | Pago a proveedores | 003/FR-015, 005/FR-005 | 005-07 |
| R-CAR-022 | Certificados de retención practicada | 005/FR-010 | — |
| R-CAR-023 | Las cuentas por pagar no se saldan sin soporte | 003/FR-015, 005/FR-005, 005/FR-008 | 005-07, 005-08 |

## 2. Cobertura por especificación

| Spec | Título | FR | Escenarios | Reglas cubiertas |
|---|---|---:|---:|---:|
| [001-contabilidad-comprobantes-inmutables](001-contabilidad-comprobantes-inmutables/spec.md) | Contabilidad con comprobantes inmutables | 14 | 16 | 14 |
| [002-emision-factura-venta](002-emision-factura-venta/spec.md) | Emisión de factura de venta (transacción atómica) | 13 | 13 | 15 |
| [003-ventas-credito-y-cartera](003-ventas-credito-y-cartera/spec.md) | Ventas a crédito y cartera | 15 | 17 | 15 |
| [004-devoluciones-ventas-nota-credito](004-devoluciones-ventas-nota-credito/spec.md) | Devoluciones en ventas con nota crédito y reingreso a kardex | 12 | 15 | 14 |
| [005-compras-y-devolucion-proveedor](005-compras-y-devolucion-proveedor/spec.md) | Compras, retenciones practicadas y devolución a proveedor | 10 | 13 | 14 |
| [006-inventario-kardex-costeo](006-inventario-kardex-costeo/spec.md) | Kardex y costeo de inventario (promedio ponderado, PEPS y despacho) | 15 | 16 | 15 |
| [007-clasificacion-abc-y-conteos](007-clasificacion-abc-y-conteos/spec.md) | Clasificación ABC y conteos cíclicos | 9 | 10 | 6 |
| [008-punto-de-reorden](008-punto-de-reorden/spec.md) | Punto de reorden y stock de seguridad | 9 | 13 | 5 |
| [009-facturacion-electronica-pta](009-facturacion-electronica-pta/spec.md) | Facturación electrónica mediante Proveedor Tecnológico Autorizado | 13 | 15 | 12 |
| [010-motor-impuestos-y-retenciones](010-motor-impuestos-y-retenciones/spec.md) | Motor de impuestos y retenciones con vigencias | 12 | 14 | 12 |
| [011-multitenancy-api-y-webhooks](011-multitenancy-api-y-webhooks/spec.md) | Aislamiento por tenant, API Keys, idempotencia y webhooks | 11 | 15 | 0 |

## 3. Principios de la constitución → escenarios

| Principio | Escenarios |
|---|---|
| P-I | 001-01, 001-02, 001-03, 001-04, 001-05, 001-06, 001-07, 001-08, 001-09, 001-10, 001-11, 001-12, 001-13, 001-14, 001-15, 001-16, 003-17, 004-01, 004-02, 004-03, 004-04, 004-05, 004-06, 004-07, 004-08, 004-09, 004-10, 004-11, 004-12, 004-13, 004-14, 004-15, 006-01, 006-02, 006-03, 006-04, 006-05, 006-06, 006-07, 006-08, 006-09, 006-10, 006-11, 006-12, 006-13, 006-14, 006-15, 006-16 |
| P-II | 007-01, 007-02, 007-03, 007-04, 007-05, 007-06, 007-07, 007-08, 007-09, 007-10, 008-01, 008-02, 008-03, 008-04, 008-05, 008-06, 008-07, 008-08, 008-09, 008-10, 008-11, 008-12, 008-13 |
| P-III | 002-01, 002-02, 002-03, 002-04, 002-05, 002-06, 002-07, 002-08, 002-09, 002-10, 002-11, 002-12, 002-13, 003-01, 003-02, 003-03, 003-04, 003-05, 003-06, 003-07, 003-08, 003-09, 003-10, 003-11, 003-12, 003-13, 003-14, 003-15, 003-16, 003-17, 004-01, 004-02, 004-03, 004-04, 004-05, 004-06, 004-07, 004-08, 004-09, 004-10, 004-11, 004-12, 004-13, 004-14, 004-15, 005-01, 005-02, 005-03, 005-04, 005-05, 005-06, 005-07, 005-08, 005-09, 005-10, 005-11, 005-12, 005-13, 009-13, 009-14, 011-08 |
| P-IV | 011-01, 011-02, 011-03, 011-04, 011-05, 011-06, 011-07, 011-08, 011-09, 011-10, 011-11, 011-12, 011-13, 011-14, 011-15 |
| P-V | 002-12, 009-08, 011-12, 011-13 |
| P-VI | 001-01, 001-02, 001-03, 001-04, 001-05, 001-06, 001-07, 001-08, 001-09, 001-10, 001-11, 001-12, 001-13, 001-14, 001-15, 001-16, 006-01, 006-02, 006-03, 006-04, 006-05, 006-06, 006-07, 006-08, 006-09, 006-10, 006-11, 006-12, 006-13, 006-14, 006-15, 006-16, 011-15 |
| P-VII | 010-01, 010-02, 010-03, 010-04, 010-05, 010-06, 010-07, 010-08, 010-09, 010-10, 010-11, 010-12, 010-13, 010-14 |
| P-VIII | — |
| P-IX | 009-01, 009-02, 009-03, 009-04, 009-05, 009-06, 009-07, 009-08, 009-09, 009-10, 009-11, 009-12, 009-13, 009-14, 009-15, 011-05, 011-06, 011-07, 011-09, 011-10, 011-11, 011-13, 011-14 |

## 4. Reglas sin cobertura (pendientes de especificar)

Reglas definidas en el catálogo que ninguna especificación o escenario cita todavía. No es un error: indica
trabajo futuro (por ejemplo, funcionalidad fuera del MVP).

- **CAR** (3): R-CAR-009, R-CAR-010, R-CAR-011
- **FE** (1): R-FE-015
- **IMP** (3): R-IMP-005, R-IMP-006, R-IMP-014
- **INV** (3): R-INV-005, R-INV-010, R-INV-014
