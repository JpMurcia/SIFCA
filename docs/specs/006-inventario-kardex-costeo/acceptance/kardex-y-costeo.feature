# language: es
@P-I @P-VI
Característica: Kardex y costeo de inventario
  Para valorar el inventario según la norma
  El costeo financiero es siempre promedio ponderado o PEPS, y el despacho físico es una política aparte

  @R-INV-001
  Escenario: [006-01] Un ítem perecedero no admite costeo de promedio ponderado
    Dado el ítem "LAC-001" con fecha de vencimiento
    Cuando el administrador intenta asignarle el método de costeo "WEIGHTED_AVERAGE"
    Entonces se rechaza con el código "COSTING_METHOD_NOT_ALLOWED"
    Y el ítem usa costeo "FIFO"

  @R-INV-001
  Escenario: [006-02] UEPS no es un método de costeo válido
    Dado el ítem "RAM-001"
    Cuando el administrador intenta asignarle el método de costeo "LIFO"
    Entonces se rechaza con el código "VALIDATION_FAILED"

  @R-INV-002 @R-INV-003
  Escenario: [006-03] Kardex de promedio ponderado de referencia
    Dado el ítem "PRO-001" con costeo de promedio ponderado y sin existencias
    Cuando se registran en orden estos movimientos:
      | tipo   | cantidad | costo_unitario |
      | compra | 200      | 10000          |
      | compra | 100      | 11000          |
      | venta  | 120      |                |
      | venta  | 70       |                |
      | venta  | 110      |                |
    Entonces los costos de las ventas son 1240000.00, 723333.33 y 1136666.67
    Y los saldos después de cada movimiento son:
      | cantidad | valor      |
      | 200      | 2000000.00 |
      | 300      | 3100000.00 |
      | 180      | 1860000.00 |
      | 110      | 1136666.67 |
      | 0        | 0.00       |

  @R-INV-016
  Escenario: [006-04] Kardex PEPS de referencia con consumo de capas
    Dado el ítem "PEP-001" con costeo PEPS y sin existencias
    Cuando se registran en orden estos movimientos:
      | tipo   | cantidad | costo_unitario |
      | compra | 200      | 10000          |
      | compra | 100      | 11000          |
      | venta  | 120      |                |
      | venta  | 70       |                |
      | venta  | 110      |                |
    Entonces los costos de las ventas son 1200000.00, 700000.00 y 1200000.00
    Y la última venta consume 10 unidades de la primera capa a 10000 y 100 unidades de la segunda a 11000
    Y el costo de ventas total es 3100000.00, igual al total comprado

  @R-INV-003 @R-INV-016
  Escenario: [006-05] Mismo inventario, distinta distribución del costo según el método
    Dado dos ítems idénticos, uno con promedio ponderado y otro con PEPS, con las mismas compras y ventas
    Cuando se comparan los costos de venta
    Entonces los totales son iguales en 3100000.00 pero cada venta tiene un costo distinto

  @R-INV-003
  Escenario: [006-06] La última salida deja el valor exactamente en cero sin deriva por redondeo
    Dado el ítem "PRO-001" con 110 unidades y valor 1136666.67
    Cuando se vende la última cantidad de 110 unidades
    Entonces el costo de la salida es el valor remanente 1136666.67
    Y el valor del inventario es exactamente 0.00

  @R-INV-017
  Esquema del escenario: [006-07] La política de despacho no cambia el costeo
    Dado el ítem "PEP-001" con costeo PEPS y la política de despacho "<politica>"
    Cuando se despacha una venta
    Entonces el costo registrado se calcula con PEPS
    Y <advertencia> la advertencia de que UEPS es solo una política de despacho físico

    Ejemplos:
      | politica | advertencia |
      | FEFO     | no se muestra |
      | FIFO     | no se muestra |
      | LIFO     | se muestra    |

  @R-INV-018
  Escenario: [006-08] No se cambia el método de costeo de un ítem con movimientos
    Dado el ítem "PRO-001" con movimientos registrados
    Cuando el administrador intenta cambiar su método de costeo a "FIFO"
    Entonces se rechaza con el código "COSTING_METHOD_LOCKED"

  @R-INV-004 @P-I @INV-07
  Escenario: [006-09] Un movimiento de kardex no se edita ni se borra
    Dado un movimiento de kardex registrado
    Cuando se intenta modificar o eliminar el movimiento con el usuario de base de datos de la aplicación
    Entonces la base de datos rechaza la operación
    Y la corrección se hace con un movimiento inverso que referencia al original

  @R-INV-006
  Esquema del escenario: [006-10] Los movimientos con fecha anterior respetan el estado del período
    Dado un movimiento con fecha en un período <periodo>
    Cuando un usuario <permiso> el permiso "inventory.backdate" lo registra
    Entonces el resultado es "<resultado>"

    Ejemplos:
      | periodo | permiso | resultado |
      | cerrado | con     | PERIOD_CLOSED |
      | abierto | sin     | rechazado |
      | abierto | con     | aceptado con revaluación y comprobante de ajuste |

  @R-INV-007
  Esquema del escenario: [006-11] El stock negativo solo se admite donde la bodega lo permite
    Dado una bodega que <permite> stock negativo y un ítem <tipo> con 5 unidades
    Cuando se intenta vender 8 unidades
    Entonces el resultado es "<resultado>"

    Ejemplos:
      | permite | tipo       | resultado           |
      | no      | normal     | INSUFFICIENT_STOCK  |
      | sí      | normal     | aceptado            |
      | sí      | perecedero | INSUFFICIENT_STOCK  |

  @R-INV-008
  Escenario: [006-12] Un traslado mueve el costo sin afectar resultados
    Dado el ítem "PRO-001" con 100 unidades de valor 1000000 en la bodega "Principal"
    Cuando se trasladan 40 unidades a la bodega "Sucursal"
    Entonces el kardex registra una salida y una entrada de 400000 cada una
    Y el costo de ventas y el valor total del ítem no cambian

  @R-INV-009
  Escenario: [006-13] Un lote vencido no se vende y el despacho propone el que vence primero
    Dado el ítem "LAC-001" con los lotes "L-A" que vence el 2026-11-30 y "L-B" que vence el 2026-10-20
    Y el lote "L-C" vencido el 2026-10-01
    Cuando se prepara el despacho de 5 unidades el 2026-10-13
    Entonces el sistema propone el lote "L-B"
    Y rechaza vender el lote "L-C"

  @R-INV-011
  Escenario: [006-14] Un ajuste por toma física exige motivo y permiso y usa el costo del ítem
    Dado el ítem "PRO-001" con costo promedio de 10000 y 100 unidades en el sistema
    Cuando un usuario con el permiso "inventory.adjust" registra un conteo de 97 unidades con el motivo "Faltante en bodega"
    Entonces se genera una salida de ajuste de 3 unidades a costo 10000 y su comprobante cuadrado

  @R-INV-012 @R-INV-013
  Escenario: [006-15] Un kit descuenta sus componentes y las reservas restan del disponible
    Dado el kit "COMBO-01" compuesto por 2 unidades de "RAM-001" y 1 de "SNK-001"
    Y 20 unidades disponibles de "RAM-001" y 20 de "SNK-001" con 4 unidades de "RAM-001" reservadas
    Cuando se vende 1 kit
    Entonces el stock de "RAM-001" baja 2 y el de "SNK-001" baja 1
    Y el disponible de "RAM-001" es 14

  @R-INV-015
  Escenario: [006-16] El kardex concilia con la cuenta contable de inventario
    Dado movimientos de varios ítems con métodos de costeo distintos
    Cuando se ejecuta la conciliación de inventario contra contabilidad
    Entonces la suma del valor del inventario es igual al saldo de la cuenta de inventario del libro mayor
