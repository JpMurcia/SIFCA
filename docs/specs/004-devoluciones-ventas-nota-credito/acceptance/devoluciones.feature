# language: es
@P-I @P-III
Característica: Devoluciones en ventas con nota crédito y reingreso a kardex
  Para mantener inventario, cartera y contabilidad consistentes
  Una devolución reingresa la mercancía al costo original y ajusta impuestos y cartera en una sola operación

  Antecedentes:
    Dado el ítem "RAM-001" con costeo de promedio ponderado
    Y una factura aceptada "SETP1" de 10 unidades de "RAM-001" a 100000 más IVA del 19 % por un total de 1190000
    Y que la salida de esas unidades tuvo un costo de 60000 por unidad
    Y una bodega de avería configurada y la factura sin pagar a crédito de un cliente con cupo de 10000000

  @R-INV-040 @R-INV-041 @R-INV-042 @R-INV-043 @R-CAR-005
  Escenario: [004-01] Devolución parcial de unidades vendibles
    Cuando el operador emite una nota crédito por 2 unidades en condición "RESELLABLE"
    Entonces la nota crédito tiene subtotal 200000, IVA 38000 y total 238000
    Y el stock vendible de "RAM-001" sube 2 con un reingreso de costo 120000
    Y el saldo de la factura baja 238000 y el cupo del cliente se libera en 238000
    Y el comprobante de la nota cuadra con débitos de 358000 y créditos de 358000
    Y se publican los eventos "return.received" y "stock.changed"

  @R-INV-041 @R-INV-043
  Escenario: [004-02] Devolución mixta con baja inmediata de la unidad averiada
    Cuando el operador emite una nota crédito con baja inmediata por 1 unidad "RESELLABLE" y 1 unidad "DAMAGED"
    Entonces el stock vendible sube 1
    Y la unidad averiada reingresa a la bodega de avería y se da de baja a costo 60000
    Y el comprobante cuadra con débitos de 418000 y créditos de 418000
    Y el gasto por avería es 60000 y el costo de ventas baja 120000

  @R-INV-041 @R-INV-046
  Escenario: [004-03] Lo averiado no suma al disponible mientras no se decide su destino
    Cuando el operador emite una nota crédito por 1 unidad en condición "DAMAGED" sin baja inmediata
    Entonces el disponible de "RAM-001" no cambia
    Y la unidad queda en la bodega de avería a costo 60000 pendiente de merma o devolución al proveedor

  @R-INV-040
  Esquema del escenario: [004-04] No se puede devolver más de lo vendido
    Dado que ya se devolvieron <devueltas> unidades de la línea
    Cuando el operador intenta devolver <solicitadas> unidades más
    Entonces el resultado es "<resultado>"

    Ejemplos:
      | devueltas | solicitadas | resultado                    |
      | 0         | 10          | aceptado                     |
      | 8         | 2           | aceptado                     |
      | 8         | 3           | RETURN_EXCEEDS_SOLD          |
      | 10        | 1           | RETURN_EXCEEDS_SOLD          |

  @R-INV-043 @R-CAR-005
  Escenario: [004-05] Si la factura ya estaba pagada la nota genera saldo a favor
    Dado que la factura "SETP1" ya está pagada
    Cuando el operador emite una nota crédito por 2 unidades en condición "RESELLABLE"
    Entonces el cliente queda con un saldo a favor de 238000
    Y el comprobante incluye el crédito a anticipos de clientes por 238000

  @R-INV-040 @R-FE-010
  Escenario: [004-06] La devolución total anula la factura con una nota crédito
    Cuando el operador emite una nota crédito por las 10 unidades en condición "RESELLABLE"
    Entonces la nota usa el concepto de anulación y tiene total 1190000
    Y el saldo de la factura queda en 0
    Y el stock vendible de "RAM-001" sube 10 con un reingreso de costo 600000

  @R-INV-016 @R-INV-042
  Escenario: [004-07] En PEPS se restituyen las capas exactas consumidas
    Dado el ítem "PEP-001" con costeo PEPS y las capas de entrada 200 unidades a 10000 y 100 unidades a 11000
    Y una venta de 120 unidades que consumió 120 de la primera capa
    Cuando el operador devuelve 20 unidades en condición "RESELLABLE"
    Entonces la primera capa vuelve a tener 100 unidades restantes a 10000
    Y el valor del inventario sube 200000 y queda en 2100000 con 200 unidades

  @R-INV-042
  Escenario: [004-08] En promedio el reingreso entra al costo de salida original
    Dado el ítem "PRO-001" con costeo de promedio ponderado, 180 unidades y valor 1860000
    Y una venta anterior de 120 unidades con costo de salida 1240000
    Cuando el operador devuelve 20 unidades en condición "RESELLABLE"
    Entonces el reingreso vale 206666.67
    Y el inventario queda en 200 unidades con valor 2066666.67

  @P-III @R-INV-044
  Esquema del escenario: [004-09] Una falla en cualquier paso no deja la devolución a medias
    Dado un fallo inyectado en el paso "<paso>" de la devolución
    Cuando el operador emite una nota crédito por 2 unidades en condición "RESELLABLE"
    Entonces la operación falla
    Y no se consume el número de la nota crédito
    Y el stock, la cartera, el cupo y los comprobantes no cambian

    Ejemplos:
      | paso                    |
      | validar elegibilidad    |
      | asignar número          |
      | reingresar al kardex    |
      | ajustar cartera         |
      | contabilizar            |
      | registrar evento        |

  @R-INV-044
  Escenario: [004-10] Reintentar la misma devolución no duplica el reingreso
    Cuando el operador emite la misma nota crédito dos veces con la misma clave de idempotencia
    Entonces existe una sola nota crédito y un solo reingreso al kardex

  @R-INV-040
  Escenario: [004-11] Una devolución fuera de la ventana requiere permiso especial
    Dado que la ventana de devolución es de 30 días y la factura tiene 45 días
    Cuando un usuario sin el permiso "sales.return.override" intenta devolver 1 unidad
    Entonces se rechaza con el código "RETURN_WINDOW_EXPIRED"
    Cuando un usuario con ese permiso lo intenta
    Entonces la devolución se acepta

  @R-FE-010 @R-FE-008
  Escenario: [004-12] La nota crédito referencia la factura y se corrige sin cambiar su número
    Dado una nota crédito emitida localmente
    Cuando el worker la transmite y la DIAN la rechaza por un dato inválido
    Entonces la nota pasa a estado "REJECTED" con los motivos
    Cuando se corrige el dato y se retransmite
    Entonces conserva el mismo número y la nota referencia el CUFE de la factura "SETP1"

  @ADR-0005 @R-IMP-001
  Escenario: [004-13] La reversa usa las tarifas de la factura original
    Dado que la tarifa de IVA vigente hoy es distinta de la que se aplicó a la factura
    Cuando el operador devuelve 2 unidades
    Entonces el IVA revertido es 38000, calculado con el 19 % de la factura original

  @R-FE-009 @R-CON-005
  Escenario: [004-14] La factura original y su asiento no se modifican
    Cuando el operador emite una nota crédito por 2 unidades
    Entonces la factura "SETP1" conserva su estado, sus importes y su comprobante
    Y el efecto de la devolución está en documentos y comprobantes nuevos

  @R-INV-046 @R-INV-009
  Esquema del escenario: [004-15] Los ítems con lote reingresan a su lote original según su estado
    Dado el ítem "LAC-001" con lotes y vencimiento, vendido del lote "L-2026-09" que vence el <vence>
    Cuando el operador devuelve 1 unidad el 2026-10-13
    Entonces la unidad reingresa al lote "L-2026-09" en la bodega <bodega>

    Ejemplos:
      | vence      | bodega    |
      | 2026-12-31 | vendible  |
      | 2026-10-01 | de avería |
