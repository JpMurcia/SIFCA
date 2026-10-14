# language: es
@P-I @P-VI
Característica: Comprobantes contables inmutables de partida doble
  Para que la contabilidad sea evidencia confiable
  El contador registra comprobantes que cuadran, que nunca se editan ni se borran
  Además, se corrigen únicamente con reversiones

  Antecedentes:
    Dado una empresa con el plan de cuentas cargado y el período de octubre de 2026 abierto

  @R-CON-001 @R-CON-003
  Escenario: [001-01] Un comprobante cuadrado se contabiliza con su consecutivo
    Dado un comprobante de tipo "AJ" con las siguientes líneas:
      | cuenta | tercero | débito | crédito |
      | 1105   |         | 100000 | 0       |
      | 4135   |         | 0      | 100000  |
    Cuando el contador lo contabiliza
    Entonces el comprobante queda guardado con el número 1
    Y la suma de débitos es 100000 y la suma de créditos es 100000

  @R-CON-001
  Esquema del escenario: [001-02] Un comprobante descuadrado se rechaza sin consumir consecutivo
    Dado un comprobante de tipo "AJ" con un débito de <debito> y un crédito de <credito>
    Cuando el contador intenta contabilizarlo
    Entonces se rechaza con el código "ENTRY_NOT_BALANCED"
    Y el siguiente consecutivo del tipo "AJ" sigue siendo el mismo

    Ejemplos:
      | debito    | credito   |
      | 100000.00 | 99999.99  |
      | 100000.00 | 100000.01 |
      | 1190000   | 1000000   |

  @R-CON-002
  Esquema del escenario: [001-03] Una línea con ambos lados o con valores negativos se rechaza
    Dado un comprobante con una línea de débito <debito> y crédito <credito>
    Cuando el contador intenta contabilizarlo
    Entonces se rechaza con el código "VALIDATION_FAILED"

    Ejemplos:
      | debito | credito |
      | 100    | 100     |
      | -100   | 0       |
      | 0      | -100    |
      | 0      | 0       |

  @R-CON-003
  Escenario: [001-04] No se contabiliza en una cuenta acumuladora
    Dado un comprobante con una línea en la cuenta "13" de nivel grupo
    Cuando el contador intenta contabilizarlo
    Entonces se rechaza con el código "VALIDATION_FAILED"

  @R-CON-004
  Escenario: [001-05] No se contabiliza en un período cerrado
    Dado que el período de septiembre de 2026 está cerrado
    Y un comprobante cuadrado con fecha contable 2026-09-30
    Cuando el contador intenta contabilizarlo
    Entonces se rechaza con el código "PERIOD_CLOSED"

  @R-CON-005 @INV-05
  Escenario: [001-06] Un comprobante contabilizado no se edita ni se elimina
    Dado un comprobante contabilizado
    Cuando se intenta modificar o eliminar el comprobante por la API
    Entonces la operación se rechaza
    Cuando se intenta modificar o eliminar el comprobante con el usuario de base de datos de la aplicación
    Entonces la base de datos rechaza la operación por privilegios o por trigger

  @R-CON-005
  Escenario: [001-07] La reversión neutraliza al comprobante original
    Dado un comprobante contabilizado con un débito de 100000 en "1105" y un crédito de 100000 en "4135"
    Cuando el contador lo reversa
    Entonces existe un comprobante de reversión que referencia al original
    Y el efecto neto de ambos sobre cada cuenta es cero
    Y no es posible reversar dos veces el mismo comprobante

  @R-CON-006
  Escenario: [001-08] Una contabilización fallida no consume consecutivo
    Dado que el siguiente consecutivo del tipo "AJ" es 5
    Cuando falla la contabilización de un comprobante por un error inyectado en el último paso
    Entonces no queda ninguna línea ni ningún encabezado del comprobante
    Y el siguiente consecutivo del tipo "AJ" sigue siendo 5

  @R-CON-008
  Escenario: [001-09] Una cuenta que exige tercero rechaza líneas sin tercero
    Dado que la cuenta "130505" exige tercero
    Y un comprobante cuadrado con una línea en "130505" sin tercero
    Cuando el contador intenta contabilizarlo
    Entonces se rechaza con el código "VALIDATION_FAILED"

  @R-CON-009
  Escenario: [001-10] El total es la suma de líneas redondeadas por línea
    Dado una factura con 3 líneas de 333.33 y un IVA del 19 %
    Cuando se calculan los impuestos
    Entonces el IVA de cada línea es 63.33
    Y el IVA del documento es 189.99 y no 190.00

  @R-CON-001 @R-CON-013
  Escenario: [001-11] El balance de prueba de referencia cuadra
    Dado los comprobantes de referencia de venta, nota crédito y recibo del catálogo de reglas
    Cuando se consulta el balance de prueba a fin de octubre
    Entonces los saldos por cuenta son:
      | cuenta | débito  | crédito |
      | 1110   | 952000  | 0       |
      | 1435   | 520000  | 0       |
      | 2408   | 0       | 152000  |
      | 3115   | 0       | 1000000 |
      | 4135   | 0       | 1000000 |
      | 4175   | 200000  | 0       |
      | 6135   | 480000  | 0       |
    Y los totales son 2152000 en débito y 2152000 en crédito

  @R-CON-011
  Escenario: [001-12] El cierre mensual exige balance cuadrado y ausencia de borradores
    Dado un período con un comprobante en borrador
    Cuando el contador intenta cerrar el período
    Entonces se rechaza el cierre
    Cuando se elimina el borrador y el balance de prueba cuadra
    Entonces el cierre se realiza y queda en la bitácora

  @R-CON-014
  Escenario: [001-13] La fecha contable no depende de la zona horaria
    Dado un documento emitido a las 23:30 hora de Colombia del 31 de octubre de 2026
    Cuando se contabiliza
    Entonces la fecha contable es 2026-10-31 y pertenece al período de octubre

  @R-CON-004
  Escenario: [001-14] Reabrir un período exige permiso y motivo y queda en la bitácora
    Dado que el período de septiembre de 2026 está cerrado
    Cuando un usuario sin el permiso "accounting.period.reopen" intenta reabrir el período de septiembre de 2026
    Entonces se rechaza con el código "FORBIDDEN"
    Cuando el contador intenta reabrir el período de septiembre de 2026 sin indicar el motivo
    Entonces se rechaza con el código "VALIDATION_FAILED"
    Cuando el contador reabre el período de septiembre de 2026 con el motivo "Corrección de una factura omitida"
    Entonces el período de septiembre de 2026 queda abierto
    Y la bitácora registra la reapertura con el motivo y el usuario

  @R-CON-012
  Escenario: [001-15] El cierre anual cancela las cuentas de resultado con un comprobante reversible
    Dado los comprobantes de referencia de venta, nota crédito y recibo del catálogo de reglas
    Cuando el contador hace el cierre anual de 2026 trasladando el resultado a "3605" a través de "5905"
    Entonces las cuentas de resultado "4135", "4175" y "6135" quedan en cero
    Y la cuenta "3605" muestra un saldo crédito de 320000
    Cuando el contador reversa el comprobante de cierre
    Entonces las cuentas de resultado recuperan sus saldos de 1000000, 200000 y 480000

  @R-CON-010
  Escenario: [001-16] Los libros son reproducibles para un mismo rango
    Dado los comprobantes de referencia de venta, nota crédito y recibo del catálogo de reglas
    Cuando se consulta dos veces el balance de prueba y el libro diario de octubre de 2026
    Entonces ambas consultas del mismo informe devuelven exactamente el mismo resultado
