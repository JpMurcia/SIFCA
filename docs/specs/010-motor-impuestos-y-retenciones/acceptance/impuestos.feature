# language: es
@ADR-0005 @P-VII
Característica: Motor de impuestos y retenciones con vigencias
  Para que un cambio normativo sea una carga de datos y no un cambio de código
  El motor calcula con las tarifas y bases vigentes en la fecha del documento

  Antecedentes:
    Dado la UVT de 2026 de 52374
    Y una empresa agente de retención

  @R-IMP-003
  Escenario: [010-01] El IVA se calcula por línea y se suma
    Dado una factura con 3 líneas de 333.33 con IVA del 19 %
    Cuando se calculan los impuestos
    Entonces el IVA por línea es 63.33
    Y el IVA del documento es 189.99

  @R-IMP-001
  Esquema del escenario: [010-02] Cada tipo de ítem aplica su tarifa de IVA
    Dado un ítem de tipo <tipo> con precio de 100000
    Cuando se calcula el IVA de una unidad
    Entonces el IVA es <iva>

    Ejemplos:
      | tipo           | iva   |
      | gravado general al 19 % | 19000 |
      | gravado reducido al 5 % | 5000  |
      | exento         | 0     |
      | excluido       | 0     |

  @R-IMP-012
  Esquema del escenario: [010-03] La retención en la fuente depende del concepto, la base mínima y el tipo de tercero
    Dado una compra de <concepto> de <base> a un tercero <tipo>
    Cuando se calcula la retención en la fuente
    Entonces la retención es <retencion>

    Ejemplos:
      | concepto  | base    | tipo           | retencion |
      | bienes    | 1000000 | declarante     | 0         |
      | bienes    | 2000000 | declarante     | 50000     |
      | bienes    | 2000000 | no declarante  | 70000     |
      | servicios | 200000  | declarante     | 0         |
      | servicios | 1000000 | declarante     | 40000     |
      | servicios | 1000000 | no declarante  | 60000     |

  @R-IMP-012
  Escenario: [010-04] Las bases mínimas se expresan en UVT del año del documento
    Cuando se consultan las bases mínimas de 2026
    Entonces la base de compras de 27 UVT es 1414098
    Y la base de servicios de 4 UVT es 209496

  @R-IMP-012
  Escenario: [010-05] Los honorarios de una persona jurídica retienen sin base mínima
    Dado una compra de honorarios de 3000000 a una persona jurídica
    Cuando se calcula la retención en la fuente
    Entonces la retención al 11 % es 330000

  @R-IMP-010
  Escenario: [010-06] Una empresa que no es agente no practica retenciones
    Dado una empresa que no es agente de retención
    Cuando registra una compra de bienes de 2000000
    Entonces la retención es 0

  @R-IMP-020
  Esquema del escenario: [010-07] La ReteIVA es el 15 % del IVA
    Dado una operación con IVA de <iva> y una empresa agente de retención de IVA
    Cuando se calcula la ReteIVA
    Entonces la ReteIVA es <reteiva>

    Ejemplos:
      | iva    | reteiva |
      | 380000 | 57000   |
      | 190000 | 28500   |

  @R-IMP-021
  Esquema del escenario: [010-08] La ReteICA se calcula por mil sobre la base sin IVA
    Dado una base de <base> y una tarifa de ReteICA de 9,66 por mil
    Cuando se calcula la ReteICA
    Entonces la ReteICA es <reteica>

    Ejemplos:
      | base    | reteica |
      | 2000000 | 19320   |
      | 1000000 | 9660    |

  @R-IMP-012 @R-IMP-020 @R-IMP-021
  Escenario: [010-09] Una venta pequeña a un agente de retención solo sufre ReteICA
    Dado una venta de 1000000 más IVA de 190000 a un cliente agente de retención
    Cuando se calculan las retenciones sufridas
    Entonces la retención en la fuente es 0 y la ReteIVA es 0 por estar bajo la base mínima
    Y la ReteICA es 9660
    Y el valor neto a recibir es 1180340

  @ADR-0005
  Escenario: [010-10] Cada documento usa la tabla vigente en su fecha (vigencias de ejemplo)
    Dado una tabla de bases anterior con compras en 27 UVT hasta 2025-06-30
    Y una tabla posterior con compras en 10 UVT desde 2025-07-01 hasta 2026-05-07
    Y de nuevo la tabla de 27 UVT desde 2026-05-08
    Y una compra de bienes de 600000 a un declarante
    Cuando se calcula la retención para documentos con fechas 2025-03-01, 2025-09-01 y 2026-06-01
    Entonces la retención es 0 para el primero, 15000 para el segundo y 0 para el tercero

  @ADR-0005
  Escenario: [010-11] Los documentos emitidos conservan lo aplicado cuando cambian las tablas
    Dado una factura emitida con una retención calculada con una tarifa vigente
    Cuando se carga una nueva tarifa distinta para fechas posteriores
    Entonces la factura emitida conserva su tarifa, su base y su monto originales

  @ADR-0005
  Escenario: [010-12] Dos tarifas con igual especificidad hacen fallar el cálculo
    Dado dos tarifas que coinciden con el mismo concepto, vigencia y condiciones
    Cuando se calcula la retención
    Entonces el cálculo falla con el código "VALIDATION_FAILED"
    Y el caso queda registrado para revisión del contador

  @R-IMP-012
  Escenario: [010-13] En un documento con varios conceptos la base se evalúa por concepto
    Dado una compra con bienes por 1000000 y servicios por 1000000 al mismo declarante
    Cuando se calculan las retenciones
    Entonces los bienes no retienen por estar bajo 1414098
    Y los servicios retienen 40000

  @R-IMP-013 @R-CON-008
  Escenario: [010-14] Cada retención conserva tercero y concepto para el certificado
    Dado retenciones practicadas durante el año a un proveedor
    Cuando se genera su certificado de retención
    Entonces el certificado agrupa las retenciones por concepto con su base y tarifa
