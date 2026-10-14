# language: es
@P-III
Característica: Ventas a crédito y cartera
  Para proteger la caja del negocio
  Cada cliente tiene un cupo y un plazo, y el sistema retiene lo que lo excede o lo que se vende a quien está en mora

  Antecedentes:
    Dado un tenant con la fecha de corte 2026-10-13
    Y el cliente "Comercial Norte" con cupo de crédito de 10000000 y plazo de pago de 30 días

  @R-CAR-008
  Escenario: [003-01] La exposición y el cupo disponible se calculan con cartera, pedidos y saldos a favor
    Dado facturas a crédito pendientes por 6500000
    Y pedidos a crédito confirmados sin facturar por 2000000
    Y un saldo a favor del cliente de 500000
    Cuando se consulta el crédito del cliente
    Entonces la exposición es 8000000
    Y el cupo disponible es 2000000

  @R-CAR-008 @R-CAR-012
  Escenario: [003-02] Un pedido a crédito que excede el cupo se retiene
    Dado que el cupo disponible del cliente es 2000000
    Cuando el vendedor confirma un pedido a crédito de 2500000
    Entonces se rechaza con el código "CREDIT_LIMIT_EXCEEDED" indicando un excedente de 500000
    Y el pedido queda en estado "CREDIT_HOLD"
    Y se publica el evento "credit.hold.created"

  @R-CAR-012
  Escenario: [003-03] Un responsable con permiso libera un documento retenido con motivo
    Dado un pedido en estado "CREDIT_HOLD"
    Cuando un usuario con el permiso "sales.credit.release" lo libera con el motivo "Aprobado por gerencia"
    Entonces el pedido continúa
    Y la bitácora registra al usuario, el motivo y la fecha
    Y se publica el evento "credit.hold.released"

  @R-CAR-012
  Esquema del escenario: [003-04] La liberación exige permiso y motivo
    Dado un pedido en estado "CREDIT_HOLD"
    Cuando un usuario <permiso> el permiso "sales.credit.release" intenta liberarlo con el motivo "<motivo>"
    Entonces se rechaza
    Y el pedido sigue en estado "CREDIT_HOLD"

    Ejemplos:
      | permiso | motivo |
      | sin     | Aprobado por gerencia |
      | con     |  |
      | con     | ok |

  @R-CAR-006
  Escenario: [003-05] Las edades de cartera clasifican por días de mora desde el vencimiento
    Dado las siguientes facturas pendientes del cliente:
      | factura | vencimiento | saldo   |
      | F-101   | 2026-10-30  | 1500000 |
      | F-087   | 2026-09-20  | 800000  |
      | F-070   | 2026-08-31  | 2000000 |
      | F-052   | 2026-07-15  | 2200000 |
      | F-031   | 2026-06-01  | 1000000 |
    Cuando se consulta la cartera al 2026-10-13
    Entonces los días de mora son 0, 23, 43, 90 y 134 respectivamente
    Y los totales por rango son:
      | rango     | total   |
      | Corriente | 1500000 |
      | 30        | 800000  |
      | 60        | 2000000 |
      | 90        | 2200000 |
      | 90+       | 1000000 |
    Y el total de la cartera es 7500000

  @R-CAR-012 @R-CAR-014
  Escenario: [003-06] Un cliente en mora sobre el umbral queda bloqueado pero puede comprar de contado
    Dado una factura del cliente vencida hace 31 días con saldo de 500000
    Cuando el vendedor intenta confirmar un pedido a crédito
    Entonces se rechaza con el código "CUSTOMER_BLOCKED_OVERDUE"
    Y el estado de crédito del cliente es "BLOQUEADO_MORA"
    Cuando el vendedor confirma un pedido de contado
    Entonces el pedido se confirma

  @R-CAR-003 @R-CAR-008
  Escenario: [003-07] Un abono libera cupo en el mismo instante
    Dado una factura pendiente de 1190000 y una exposición de 1190000
    Cuando el cajero registra un recibo de 1190000 aplicado a esa factura
    Entonces la factura queda pagada
    Y la exposición del cliente es 0
    Y el cupo disponible es 10000000

  @R-CAR-003
  Escenario: [003-08] Por defecto el recibo se aplica a la factura vencida más antigua
    Dado las facturas pendientes F-052 con saldo 2200000 vencida en 2026-07-15 y F-070 con saldo 2000000 vencida en 2026-08-31
    Cuando el cajero registra un recibo de 2500000 sin elegir facturas
    Entonces se aplican 2200000 a F-052 y 300000 a F-070
    Y F-052 queda pagada y F-070 queda parcial con saldo 1700000

  @R-CAR-003
  Esquema del escenario: [003-09] Un recibo no puede aplicar más que su valor ni más que el saldo
    Dado una factura con saldo 1000000
    Cuando el cajero registra un recibo de <recibo> y aplica <aplicado> a la factura
    Entonces el resultado es "<resultado>"

    Ejemplos:
      | recibo  | aplicado | resultado |
      | 1000000 | 1000000  | aceptado  |
      | 1000000 | 1200000  | rechazado |
      | 500000  | 600000   | rechazado |
      | 1500000 | 1000000  | aceptado con anticipo de 500000 |

  @R-CAR-004
  Escenario: [003-10] Un recibo con retenciones sufridas calcula el neto recibido
    Dado una factura de 2380000 con IVA incluido de un cliente agente de retención
    Cuando el cajero registra el recibo con retefuente de 50000, reteiva de 57000 y reteica de 19320
    Entonces el valor neto recibido en bancos es 2253680
    Y el saldo de la factura queda en 0
    Y el comprobante de recibo cuadra con totales de 2380000

  @R-CAR-008 @P-III
  Escenario: [003-11] Dos pedidos simultáneos que juntos exceden el cupo no se confirman ambos
    Dado que el cupo disponible del cliente es 2000000
    Cuando se confirman al mismo tiempo dos pedidos a crédito de 1500000 cada uno
    Entonces exactamente uno se confirma
    Y el otro queda en estado "CREDIT_HOLD"

  @R-CAR-008
  Escenario: [003-12] Un cliente sin cupo solo puede comprar de contado
    Dado que el cupo de crédito del cliente es 0
    Cuando el vendedor intenta confirmar un pedido a crédito
    Entonces se rechaza con el código "CREDIT_NOT_ALLOWED"

  @R-CAR-013
  Escenario: [003-13] Se alerta al alcanzar el 80 % del cupo
    Dado una exposición de 7900000
    Cuando se confirma un pedido a crédito de 100000
    Entonces la exposición es 8000000
    Y se publica el evento "credit.limit.warning"

  @R-CAR-014
  Esquema del escenario: [003-14] El estado de crédito respeta el orden de prevalencia
    Dado un cliente suspendido manualmente: <suspendido>, con <mora> días de mora y una exposición de <exposicion>
    Cuando se consulta su estado de crédito
    Entonces el estado es "<estado>"

    Ejemplos:
      | suspendido | mora | exposicion | estado          |
      | sí         | 40   | 10000000   | SUSPENDIDO      |
      | no         | 40   | 10000000   | BLOQUEADO_MORA  |
      | no         | 10   | 10000000   | BLOQUEADO_CUPO  |
      | no         | 10   | 8000000    | ALERTA          |
      | no         | 0    | 3000000    | AL_DIA          |

  @R-CAR-015
  Escenario: [003-15] Cambiar el cupo exige permiso y deja bitácora sin afectar documentos emitidos
    Dado una factura ya emitida al cliente
    Cuando un usuario con el permiso "parties.credit.manage" cambia el cupo de 10000000 a 5000000
    Entonces la bitácora registra el valor anterior y el nuevo
    Y la factura ya emitida no cambia
    Cuando un usuario sin ese permiso intenta cambiarlo
    Entonces se rechaza

  @R-CAR-001
  Escenario: [003-16] La cartera por cliente cuadra con el libro mayor
    Dado facturas, recibos y notas crédito de varios clientes
    Cuando se ejecuta la conciliación de cartera
    Entonces la suma de la cartera por cliente es igual al saldo de las cuentas de clientes del libro mayor

  @P-I @R-CAR-003
  Escenario: [003-17] Un recibo no se edita: se corrige con un recibo de reversa
    Dado un recibo registrado
    Cuando se intenta modificar o eliminar el recibo
    Entonces se rechaza
    Cuando se registra su reversa
    Entonces el saldo de las facturas afectadas vuelve a su valor anterior y el recibo original permanece visible
