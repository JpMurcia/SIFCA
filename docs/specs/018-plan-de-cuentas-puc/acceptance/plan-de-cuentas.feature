# language: es
@R-CON-003 @R-CON-013
Característica: Plan de cuentas (PUC) gestionable
  Para contabilizar con las cuentas propias de la empresa sin alterar la historia contable
  Como contador
  Quiero mantener auxiliares, exigencias, clasificaciones y cuentas por defecto con reglas protegidas

  Antecedentes:
    Dado la empresa "Comercializadora Andina S.A.S." con el PUC base sembrado
    Y "contador@andina.com" con el permiso "accounting.chart.manage"

  @R-CON-003 @R-CON-013 @INV-03
  Escenario: [018-01] Crear una auxiliar hereda la naturaleza y vuelve acumuladora a su padre
    Dado la subcuenta "111005 Bancos nacionales" sin movimientos
    Cuando crea la auxiliar "11100501 Bancolombia cuenta corriente" bajo "111005"
    Entonces "11100501" queda activa, de movimiento y de naturaleza "Débito"
    Y "111005" deja de admitir movimiento

  @R-CON-003
  Esquema del escenario: [018-02] El código debe respetar la estructura del padre
    Cuando crea la cuenta "<codigo>" bajo "<padre>"
    Entonces la respuesta es 422 con el código "VALIDATION_FAILED"
    Y el mensaje dice "<mensaje>"

    Ejemplos:
      | codigo        | padre  | mensaje                                                  |
      | 1110051       | 111005 | El código debe tener 8 a 12 dígitos en el nivel auxiliar |
      | 11200501      | 111005 | El código debe empezar por el de la cuenta padre 111005   |
      | 1110050100001 | 111005 | El código no puede tener más de 12 dígitos                |

  @R-CON-003 @P-I
  Escenario: [018-03] Una cuenta con movimientos no puede volverse acumuladora
    Dado la subcuenta "130505 Clientes nacionales" con movimientos
    Cuando crea una auxiliar bajo "130505"
    Entonces la respuesta es 409 con el código "CONFLICT"
    Y el mensaje dice "La cuenta 130505 tiene movimientos y no puede tener cuentas hijas"

  @R-CON-013 @P-I
  Esquema del escenario: [018-04] Los niveles protegidos y la historia contable no se alteran
    Cuando intenta "<acción>" la cuenta "<cuenta>"
    Entonces la respuesta es 409 con el código "CONFLICT"

    Ejemplos:
      | acción                       | cuenta   |
      | renombrar                    | 1435     |
      | desactivar                   | 1105     |
      | eliminar                     | 4135     |
      | cambiar el código            | 130505   |
      | cambiar la naturaleza        | 130505   |

  @R-CON-003 @P-I
  Escenario: [018-05] Desactivar exige saldo cero y eliminar exige que nunca haya tenido movimientos
    Dado la auxiliar "11100501" con saldo de $ 952.000,00
    Cuando intenta desactivarla con el motivo "Cuenta cerrada"
    Entonces la respuesta es 409 con el mensaje "La cuenta tiene saldo de $ 952.000,00"
    Dado la auxiliar "11100599" sin movimientos ni hijos
    Cuando la elimina
    Entonces ya no existe en el plan

  @R-CON-012
  Escenario: [018-06] Una empresa nueva tiene todos los conceptos mapeados
    Cuando se consulta el mapeo de conceptos vigente a la fecha "2026-10-17"
    Entonces los conceptos "REVENUE", "VAT_OUTPUT", "RECEIVABLE", "COGS", "INVENTORY_GOODS", "BANK", "CASH", "PROFIT_AND_LOSS" y "RETAINED_RESULT" tienen una cuenta de movimiento activa vigente
    Y las plantillas P-01, P-02 y P-03 se contabilizan sin crear ni mapear cuentas

  @R-CON-012 @P-I
  Esquema del escenario: [018-07] El mapeo de un concepto depende de la fecha contable
    Dado "REVENUE" mapeado a "413595" desde "2026-01-01"
    Y "REVENUE" mapeado a "41359501" desde "2026-11-01" con el motivo "Separar ventas en línea"
    Cuando se consulta el mapeo de "REVENUE" a la fecha "<fecha>"
    Entonces la cuenta es "<cuenta>"

    Ejemplos:
      | fecha      | cuenta   |
      | 2026-10-31 | 413595   |
      | 2026-11-01 | 41359501 |

  @R-CON-003
  Escenario: [018-08] Un concepto solo apunta a una cuenta de movimiento activa
    Cuando mapea "VAT_OUTPUT" a la cuenta acumuladora "2408"
    Entonces la respuesta es 422 con el mensaje "Un concepto solo puede apuntar a una cuenta de movimiento activa"
    Dado "VAT_OUTPUT" mapeado vigente a "240801"
    Cuando intenta desactivar "240801"
    Entonces la respuesta es 409 con el mensaje "La cuenta está asignada al concepto VAT_OUTPUT"

  @R-CON-008
  Escenario: [018-09] Exigir centro de costo aplica solo a comprobantes nuevos
    Dado un comprobante "AJ-1" contabilizado en "519530" sin centro de costo
    Cuando marca "519530" como "exige centro de costo"
    Entonces "AJ-1" sigue siendo válido
    Y contabilizar una línea nueva en "519530" sin centro de costo responde 422 con la regla "R-CON-008"

  @R-CON-013
  Escenario: [018-10] La clasificación para estados financieros se hereda
    Dado "1110" clasificada como "Efectivo y equivalentes de efectivo" corriente
    Y la auxiliar "11100501" sin clasificación propia
    Cuando se consulta la clasificación efectiva de "11100501"
    Entonces es "Efectivo y equivalentes de efectivo" corriente
    Y toda cuenta de las clases 1 a 6 del PUC base tiene clasificación efectiva

  @P-IV @ADR-0002 @INV-11
  Escenario: [018-11] El plan está aislado por empresa y protegido por permisos
    Dado "aux@andina.com" con solo el permiso "accounting.report.read"
    Cuando intenta crear una auxiliar
    Entonces la respuesta es 403 con el código "FORBIDDEN"
    Y las cuentas creadas por "Empresa B" no aparecen en el plan de "Comercializadora Andina S.A.S."
