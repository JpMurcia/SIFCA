# language: es
@P-III
Característica: Compras, retenciones practicadas y devolución a proveedor
  Para tener inventario y deudas correctos
  Cada compra y cada devolución registran kardex, impuestos, cuentas por pagar y asiento a la vez

  Antecedentes:
    Dado el proveedor "Importadora Asia" declarante de renta con NIT válido
    Y la UVT de 2026 de 52374 y las bases de retención vigentes de 27 UVT para compras y 4 UVT para servicios
    Y una empresa agente de retención con el ítem "RAM-001" de costeo de promedio ponderado

  @R-INV-002 @R-IMP-011 @R-IMP-012 @R-CAR-020 @R-CON-001
  Escenario: [005-01] Compra de mercancía sobre la base mínima con retención en la fuente
    Cuando el comprador registra una compra de 200 unidades de "RAM-001" a 10000 con IVA del 19 %
    Entonces el IVA descontable es 380000
    Y la retención en la fuente al 2,5 % es 50000
    Y la cuenta por pagar al proveedor es 2330000
    Y el stock de "RAM-001" sube 200 con un valor de 2000000 y un costo promedio de 10000
    Y el comprobante cuadra con débitos de 2380000 y créditos de 2380000

  @R-IMP-012
  Escenario: [005-02] Una compra bajo la base mínima no retiene
    Cuando el comprador registra una compra de 100 unidades de "RAM-001" a 10000 con IVA del 19 %
    Entonces la base de 1000000 es menor que la base mínima de 1414098
    Y la retención en la fuente es 0
    Y la cuenta por pagar al proveedor es 1190000

  @R-IMP-012
  Esquema del escenario: [005-03] La tarifa depende de si el proveedor es declarante de renta
    Cuando el comprador registra una compra de bienes de 2000000 a un proveedor <tipo>
    Entonces la retención en la fuente es <retencion>

    Ejemplos:
      | tipo           | retencion |
      | declarante     | 50000     |
      | no declarante  | 70000     |

  @R-IMP-011 @R-IMP-012 @R-IMP-020 @R-IMP-021 @R-CAR-020
  Escenario: [005-04] Compra de servicios con ReteFuente, ReteIVA y ReteICA
    Cuando el comprador registra la factura de un servicio de 1000000 con IVA del 19 % y una tarifa de ReteICA de 9,66 por mil
    Entonces la ReteFuente de servicios al 4 % es 40000
    Y la ReteIVA al 15 % del IVA es 28500
    Y la ReteICA es 9660
    Y la cuenta por pagar neta es 1111840
    Y el comprobante cuadra con débitos de 1190000 y créditos de 1190000

  @R-INV-002
  Escenario: [005-05] El IVA no descontable se suma al costo de la entrada
    Cuando el comprador registra una compra de 100 unidades de "RAM-001" a 10000 con un IVA de 190000 no descontable
    Entonces el costo de la entrada es 1190000 y el costo unitario es 11900

  @R-INV-016 @R-INV-002
  Escenario: [005-06] Cada entrada de un ítem PEPS crea su propia capa de costo
    Dado el ítem "PEP-001" con costeo PEPS
    Cuando el comprador registra una compra de 200 unidades a 10000 y luego otra de 100 unidades a 11000
    Entonces existen dos capas de costo con 200 unidades a 10000 y 100 unidades a 11000

  @R-CAR-021 @R-CAR-023
  Escenario: [005-07] El pago a un proveedor se hace con comprobante de egreso y soporte
    Dado una cuenta por pagar de 2330000 de una compra registrada
    Cuando el tesorero registra un comprobante de egreso por 2330000 aplicado a esa compra
    Entonces el saldo por pagar es 0
    Y el comprobante debita proveedores y acredita bancos por 2330000
    Cuando intenta registrar un egreso sin documento de referencia
    Entonces se rechaza

  @R-INV-045 @R-CAR-023
  Escenario: [005-08] Devolución parcial a un proveedor con costeo de promedio
    Dado una compra registrada de 200 unidades de "RAM-001" a 10000 con IVA del 19 % y retención de 50000
    Cuando el comprador devuelve 100 unidades al proveedor
    Entonces salen del kardex 100 unidades al costo de 10000
    Y la cuenta por pagar baja 1165000
    Y se reversan el IVA descontable de 190000 y la retención de 25000
    Y el comprobante cuadra con débitos de 1190000 y créditos de 1190000

  @R-INV-045 @R-INV-016
  Escenario: [005-09] En PEPS la devolución sale de la capa de esa compra y no puede exceder su saldo
    Dado el ítem "PEP-001" con una capa de una compra con 60 unidades restantes a 11000
    Cuando el comprador intenta devolver 100 unidades de esa compra
    Entonces se rechaza porque la capa solo tiene 60 unidades restantes
    Cuando devuelve 60 unidades
    Entonces salen 60 unidades a 11000 de esa capa

  @R-INV-045
  Escenario: [005-10] Si la compra ya estaba pagada la devolución genera saldo a favor con el proveedor
    Dado una compra pagada por completo
    Cuando el comprador devuelve 100 de las 200 unidades
    Entonces la deuda con el proveedor no baja porque ya estaba en cero
    Y queda un saldo a favor con el proveedor de 1165000 en anticipos a proveedores

  @R-INV-045
  Escenario: [005-11] No se puede devolver más de lo recibido
    Dado una compra de 200 unidades de las cuales ya se devolvieron 150
    Cuando el comprador intenta devolver 60 unidades
    Entonces se rechaza con el código "RETURN_EXCEEDS_SOLD"

  @P-III
  Esquema del escenario: [005-12] Una falla no deja la devolución a proveedor a medias
    Dado un fallo inyectado en el paso "<paso>" de la devolución a proveedor
    Cuando el comprador devuelve 100 unidades
    Entonces la operación falla
    Y el stock, las cuentas por pagar y los comprobantes no cambian

    Ejemplos:
      | paso                  |
      | validar cantidades    |
      | salir del kardex      |
      | ajustar cuentas por pagar |
      | contabilizar          |

  @R-FE-014
  Escenario: [005-13] Comprar a un no obligado a facturar genera documento soporte sin IVA descontable
    Dado un proveedor persona natural no obligada a facturar
    Cuando el comprador registra la compra de un servicio de 500000
    Entonces se emite un documento soporte con su propia numeración
    Y la compra no genera IVA descontable
