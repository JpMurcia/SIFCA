# language: es
@P-III @ADR-0006
Característica: Emisión de factura de venta como transacción atómica
  Para no dejar nunca una venta a medias
  El sistema asigna consecutivo, impuestos, inventario, cartera y asiento en una sola operación

  Antecedentes:
    Dado un tenant con un rango de numeración vigente con prefijo "SETP" cuyo siguiente número es 1
    Y el ítem "RAM-001" con IVA del 19 %, precio de 100000, costo promedio de 60000 y stock de 50 unidades
    Y el cliente "Distribuciones Sur" con NIT válido, plazo de 30 días y cupo de crédito de 10000000
    Y el período de octubre de 2026 abierto

  @R-FE-003 @R-FE-004 @R-IMP-003 @R-INV-003 @R-CON-007 @R-CAR-002 @R-CAR-008
  Escenario: [002-01] Se emite una factura a crédito con todos sus efectos
    Dado un pedido confirmado de 10 unidades de "RAM-001" a crédito
    Cuando el operador emite la factura
    Entonces la factura queda en estado "ISSUED" con el número "SETP1"
    Y el subtotal es 1000000, el IVA es 190000 y el total es 1190000
    Y el stock de "RAM-001" baja a 40 con un movimiento de salida de costo 600000
    Y la cartera del cliente sube 1190000 con vencimiento a 30 días
    Y la exposición de crédito del cliente es 1190000
    Y existen un comprobante de venta por 1190000 y un comprobante de costo por 600000, ambos cuadrados
    Y se registra un evento de salida "invoice.issued" para su transmisión

  @R-INV-007
  Escenario: [002-02] Con stock insuficiente la emisión se rechaza sin efectos
    Dado un pedido confirmado de 60 unidades de "RAM-001"
    Cuando el operador emite la factura
    Entonces se rechaza con el código "INSUFFICIENT_STOCK"
    Y el siguiente número del rango sigue siendo 1
    Y no existen movimientos de stock ni comprobantes nuevos
    Y la factura sigue en estado "DRAFT"

  @R-FE-004 @P-III
  Escenario: [002-03] La emisión es idempotente
    Dado un pedido confirmado de 10 unidades de "RAM-001" a crédito
    Cuando el operador emite la factura dos veces con la misma clave de idempotencia
    Entonces existe una sola factura con el número "SETP1"
    Y existe un solo movimiento de salida de stock y un solo comprobante de venta
    Y ambas respuestas son idénticas

  @R-INV-007 @P-III
  Escenario: [002-04] Dos emisiones simultáneas no pueden dejar el stock negativo
    Dado que el stock de "RAM-001" es 10
    Y dos pedidos confirmados de 8 unidades cada uno
    Cuando ambos se emiten al mismo tiempo
    Entonces exactamente una factura queda emitida
    Y la otra se rechaza con el código "INSUFFICIENT_STOCK"
    Y el stock final de "RAM-001" es 2

  @R-FE-004
  Escenario: [002-05] Las emisiones concurrentes producen números contiguos y únicos
    Dado 100 pedidos confirmados de 1 unidad de "RAM-001"
    Cuando se emiten desde 2 procesos en paralelo
    Entonces los números asignados son los consecutivos del 1 al 100 sin repeticiones ni huecos

  @P-III @INV-15
  Esquema del escenario: [002-06] Un fallo en cualquier paso deja el estado intacto
    Dado un pedido confirmado de 10 unidades de "RAM-001" a crédito
    Y un fallo inyectado en el paso "<paso>" de la emisión
    Cuando el operador emite la factura
    Entonces la emisión falla
    Y el siguiente número del rango sigue siendo 1
    Y el stock de "RAM-001" sigue siendo 50
    Y la cartera y el cupo del cliente no cambian
    Y no existen comprobantes nuevos ni eventos de salida
    Y la factura sigue en estado "DRAFT"

    Ejemplos:
      | paso                  |
      | asignar consecutivo   |
      | calcular impuestos    |
      | descontar inventario  |
      | registrar cartera     |
      | contabilizar          |
      | registrar evento      |

  @R-CON-004
  Escenario: [002-07] No se emite en un período cerrado
    Dado que el período de la fecha del documento está cerrado
    Y un pedido confirmado de 1 unidad de "RAM-001"
    Cuando el operador emite la factura
    Entonces se rechaza con el código "PERIOD_CLOSED"
    Y no se consume número ni stock

  @R-FE-003
  Esquema del escenario: [002-08] Un rango agotado o vencido bloquea la emisión
    Dado que el rango de numeración está <estado>
    Y un pedido confirmado de 1 unidad de "RAM-001"
    Cuando el operador emite la factura
    Entonces se rechaza con el código "<codigo>"

    Ejemplos:
      | estado   | codigo                   |
      | agotado  | NUMBERING_RANGE_EXHAUSTED |
      | vencido  | NUMBERING_RANGE_EXPIRED   |

  @R-FE-012
  Escenario: [002-09] El adquirente debe tener un NIT con dígito de verificación correcto
    Dado el cliente con NIT "800197268" y dígito de verificación "5"
    Y un pedido confirmado de 1 unidad de "RAM-001"
    Cuando el operador emite la factura
    Entonces se rechaza con el código "VALIDATION_FAILED" indicando el campo del dígito de verificación

  @R-CAR-002 @R-CAR-008
  Escenario: [002-10] Una venta de contado no consume cupo ni genera cartera
    Dado un pedido confirmado de 10 unidades de "RAM-001" de contado
    Cuando el operador emite la factura
    Entonces la factura queda en estado "ISSUED"
    Y la exposición de crédito del cliente sigue siendo 0
    Y el comprobante de venta debita caja o bancos y no clientes

  @R-CAR-012
  Escenario: [002-11] Una venta a crédito que excede el cupo se retiene
    Dado que la exposición de crédito del cliente es 9000000
    Y un pedido confirmado de 10 unidades de "RAM-001" a crédito
    Cuando el operador emite la factura
    Entonces se rechaza con el código "CREDIT_LIMIT_EXCEEDED"
    Y el documento queda en estado "CREDIT_HOLD"
    Y no se consume número, stock ni cupo

  @P-V
  Escenario: [002-12] El servidor ignora los precios enviados por el cliente web
    Dado que el precio vigente de "RAM-001" es 100000
    Cuando un visitante crea un pedido web de 2 unidades con un precio manipulado de 1
    Entonces el pedido se crea con precio unitario 100000 y subtotal 200000

  @R-INV-013
  Escenario: [002-13] Un pedido web sin confirmar libera su reserva al vencer
    Dado un pedido web de 5 unidades de "RAM-001" que reservó stock hasta las 10:00
    Cuando llegan las 10:01 sin que el pedido se confirme
    Entonces el pedido pasa a estado "EXPIRED"
    Y el stock disponible de "RAM-001" vuelve a 50
