# language: es
@R-CON-010 @R-CON-013
Característica: Estados financieros NIIF para Pymes
  Para informar la situación y el desempeño de la empresa sin digitar cifras
  Como contador
  Quiero generar el estado de situación financiera y el estado de resultados desde lo contabilizado

  Antecedentes:
    Dado la empresa "Comercializadora Andina S.A.S." con el PUC base clasificado
    Y el año fiscal 2026 con sus períodos abiertos
    Y el libro de referencia contabilizado: apertura de inventario por $ 1.000.000,00 y las plantillas P-01, P-02 y P-03 de octubre de 2026

  @R-CON-013 @R-CON-001
  Escenario: [019-01] Estado de situación financiera del libro de referencia
    Cuando genera el estado de situación financiera al "2026-10-31"
    Entonces las partidas muestran:
      | partida                              | bloque     | valor          |
      | Efectivo y equivalentes de efectivo  | corriente  | $ 952.000,00   |
      | Inventarios                          | corriente  | $ 520.000,00   |
      | Impuestos por pagar                  | corriente  | $ 152.000,00   |
      | Capital                              | patrimonio | $ 1.000.000,00 |
      | Resultado del ejercicio              | patrimonio | $ 320.000,00   |
    Y el total activo es $ 1.472.000,00
    Y el total pasivo más patrimonio es $ 1.472.000,00
    Y el informe muestra el sello "Cuadrado"

  @R-CON-013
  Escenario: [019-02] Estado de resultados del libro de referencia
    Cuando genera el estado de resultados del "2026-10-01" al "2026-10-31"
    Entonces las líneas muestran:
      | línea                                  | valor            |
      | Ingresos de actividades ordinarias     | $ 1.000.000,00   |
      | Devoluciones y descuentos              | ($ 200.000,00)   |
      | Ingresos netos                         | $ 800.000,00     |
      | Costo de ventas                        | ($ 480.000,00)   |
      | Utilidad bruta                         | $ 320.000,00     |
      | Gastos de administración               | $ 0,00           |
      | Resultado del período                  | $ 320.000,00     |

  @R-CON-012
  Escenario: [019-03] El resultado del período coincide con el resultado del ejercicio del balance
    Cuando genera el estado de resultados del "2026-01-01" al "2026-10-31"
    Y genera el estado de situación financiera al "2026-10-31"
    Entonces el "Resultado del período" es igual al "Resultado del ejercicio" al centavo

  @R-CON-012
  Escenario: [019-04] El cierre anual no anula el estado de resultados del año
    Dado el cierre anual 2026 contabilizado con las cuentas "5905" y "3605" al "2026-12-31"
    Cuando genera el estado de resultados del "2026-01-01" al "2026-12-31"
    Entonces el "Resultado del período" es $ 320.000,00
    Y el estado de situación financiera al "2026-12-31" presenta "Resultados del ejercicio" en $ 320.000,00 sin la línea calculada "Resultado del ejercicio"

  @R-CON-013
  Escenario: [019-05] Una cuenta con saldo y sin clasificar impide emitir el estado
    Dado la auxiliar "13809501 Préstamo a socio" con saldo de $ 50.000,00 y sin clasificación efectiva
    Cuando genera el estado de situación financiera al "2026-10-31"
    Entonces la respuesta es 422 con el código "VALIDATION_FAILED"
    Y el mensaje lista la cuenta "13809501" con un enlace al plan de cuentas

  @R-CON-010
  Escenario: [019-06] Comparativo con un período sin movimientos
    Cuando genera el estado de resultados de octubre de 2026 comparado con septiembre de 2026
    Entonces la columna de septiembre muestra "Ingresos de actividades ordinarias" en $ 0,00
    Y la variación absoluta es $ 1.000.000,00
    Y la variación porcentual se muestra como "—"

  @R-CON-010
  Escenario: [019-07] La huella es reproducible y cambia con los datos
    Cuando genera dos veces el estado de situación financiera al "2026-10-31"
    Entonces las dos huellas son idénticas
    Cuando se contabiliza un comprobante de $ 10.000,00 con fecha "2026-10-31"
    Y genera de nuevo el estado al "2026-10-31"
    Entonces la huella es distinta

  @R-CON-013
  Escenario: [019-08] Un saldo contrario a la naturaleza se muestra con signo y alerta
    Dado la auxiliar "11100501" de bancos con saldo crédito de $ 30.000,00 al "2026-10-31"
    Cuando genera el estado de situación financiera al "2026-10-31"
    Entonces "Efectivo y equivalentes de efectivo" incluye -$ 30.000,00 de esa cuenta
    Y la línea lleva la alerta "Saldo contrario a la naturaleza de la cuenta (R-CON-013)"

  @R-CON-011 @P-IV
  Escenario: [019-09] Período abierto, permisos y aislamiento
    Cuando genera el estado de situación financiera al "2026-10-31" con octubre abierto
    Entonces el informe lleva la leyenda "Período abierto: cifras sujetas a cambio"
    Dado un usuario sin el permiso "accounting.report.read"
    Cuando intenta generar el estado
    Entonces la respuesta es 403 con el código "FORBIDDEN"
