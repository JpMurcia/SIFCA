# language: es
@ADR-0005 @P-IV
Característica: Configuración por empresa
  Para que lo que cambia por empresa o por normativa sea un dato y no código
  Como administradora o contador de la empresa
  Quiero mantener los datos de la empresa, los parámetros con vigencia, la numeración y las plantillas

  Antecedentes:
    Dado la empresa "Comercializadora Andina S.A.S." sin documentos emitidos
    Y "admin@andina.com" con el rol "Administrador"

  @R-FE-012
  Esquema del escenario: [013-01] El NIT se valida con el dígito de verificación de la DIAN
    Cuando guarda el NIT "<numero>" con DV "<dv>"
    Entonces el resultado es "<resultado>"

    Ejemplos:
      | numero    | dv | resultado                                     |
      | 900123456 | 8  | guardado; la barra muestra NIT 900.123.456-8  |
      | 900123456 | 7  | El dígito de verificación debe ser 8          |
      | 800245117 | 7  | guardado; la barra muestra NIT 800.245.117-7  |

  @P-I @R-FE-012
  Escenario: [013-02] Los datos de la empresa conservan historial y no cambian lo ya emitido
    Dado un comprobante "AJ-1" emitido con la razón social "Comercializadora Andina S.A.S."
    Cuando cambia la razón social a "Andina Comercial S.A.S." con el motivo "Reforma estatutaria"
    Entonces el historial muestra el valor anterior, el nuevo, el autor, el motivo y el instante
    Y "AJ-1" conserva la razón social "Comercializadora Andina S.A.S."

  @ADR-0005 @R-CON-014
  Esquema del escenario: [013-03] El valor de un parámetro depende de la fecha de la operación
    Dado "credit.blockDaysOverdue" con valor 30 vigente desde "2026-01-01"
    Y el valor 45 programado desde "2026-11-01" con el motivo "Política comercial 2026-II"
    Cuando se consulta el valor vigente a la fecha "<fecha>"
    Entonces el valor es <valor>

    Ejemplos:
      | fecha      | valor |
      | 2026-10-31 | 30    |
      | 2026-11-01 | 45    |
      | 2027-03-15 | 45    |

  @ADR-0005
  Esquema del escenario: [013-04] Los parámetros validan tipo, rango y motivo
    Cuando programa "<clave>" con el valor "<valor>" y el motivo "<motivo>"
    Entonces la respuesta es 422 con el código "VALIDATION_FAILED"
    Y el mensaje dice "<mensaje>"

    Ejemplos:
      | clave                    | valor | motivo           | mensaje                                       |
      | credit.alertThresholdPct | 120   | Ajuste de umbral | El valor debe estar entre 1 y 100             |
      | credit.blockDaysOverdue  | -5    | Ajuste           | El valor debe estar entre 0 y 365             |
      | credit.blockDaysOverdue  | 45    |                  | El motivo es obligatorio (5 a 500 caracteres) |
      | credit.noExiste          | 1     | Prueba de clave  | Parámetro desconocido                         |

  @P-I @ADR-0005
  Escenario: [013-05] Un valor que ya rige no se modifica ni se programa en el pasado
    Dado "credit.blockDaysOverdue" con valor 30 vigente desde "2026-01-01"
    Cuando intenta cambiar el valor 30 por 35 sin programar uno nuevo
    Entonces la respuesta es 409 con el código "CONFLICT"
    Cuando programa el valor 35 desde "2026-01-15" estando a "2026-10-17"
    Entonces la respuesta es 422 con el mensaje "La vigencia no puede empezar en el pasado"

  @R-CON-006
  Escenario: [013-06] La numeración se configura antes del primer uso
    Dado el tipo de documento "AJ" sin números asignados
    Cuando fija el prefijo "AJ", el número inicial 1 y la política "anual"
    Entonces el siguiente número orientativo es "AJ-1"

  @R-CON-006 @INV-06 @P-III
  Escenario: [013-07] Consecutivos sin huecos ni duplicados bajo concurrencia
    Dado el tipo de documento "AJ" con política "anual" en 2026
    Cuando se piden 50 números de "AJ" a la vez
    Entonces se asignan los números del 1 al 50 sin huecos ni repetidos
    Y una transacción que falla después de pedir número no consume ese número

  @R-CON-006
  Escenario: [013-08] Un tipo con números asignados no cambia su prefijo ni su inicio
    Dado el tipo de documento "AJ" con el número 12 ya asignado
    Cuando intenta cambiar el prefijo a "AJU"
    Entonces la respuesta es 409 con el mensaje "Este tipo ya tiene documentos numerados; crea un tipo nuevo"

  @ADR-0008
  Esquema del escenario: [013-09] Las plantillas validan contraste y logo
    Cuando en la plantilla "Comprobante contable" <acción>
    Entonces el resultado es "<resultado>"

    Ejemplos:
      | acción                                      | resultado                                              |
      | elige el color de acento "#0B5CAD"          | guardado; la vista previa muestra «Sumas iguales»      |
      | elige el color de acento "#FFD966"          | El color debe tener contraste de al menos 4,5:1        |
      | sube un logo PNG de 2 MB                    | El logo debe pesar como máximo 1 MB                    |
      | sube un logo SVG con un script incrustado   | guardado sin el script                                 |

  @P-IV @ADR-0002 @INV-11
  Escenario: [013-10] La configuración está aislada por empresa y protegida por permisos
    Dado "aux@andina.com" sin el permiso "config.parameter.manage"
    Cuando programa un valor de "credit.blockDaysOverdue"
    Entonces la respuesta es 403 con el código "FORBIDDEN"
    Y los parámetros de "Empresa B" no son visibles para "admin@andina.com"
