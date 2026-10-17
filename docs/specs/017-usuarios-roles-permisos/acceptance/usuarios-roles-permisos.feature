# language: es
@P-IV @ADR-0002
Característica: Usuarios, roles y permisos
  Para que cada persona haga solo lo que le corresponde
  Como administradora de la empresa
  Quiero invitar usuarios, asignarles roles con permisos granulares y auditar los cambios

  Antecedentes:
    Dado la empresa "Comercializadora Andina S.A.S." con los roles base
    Y "admin@andina.com" como única administradora activa

  @P-IV
  Escenario: [017-01] Invitar a un usuario nuevo con un rol
    Cuando "admin@andina.com" invita a "aux@andina.com" con el rol "Auxiliar contable"
    Entonces "aux@andina.com" aparece como "Invitado"
    Y se envía un enlace de invitación válido por 72 horas
    Cuando "aux@andina.com" define su contraseña desde el enlace
    Entonces su membresía queda "Activa" con los permisos "accounting.entry.post" y "accounting.report.read"

  @P-IV @ADR-0002
  Escenario: [017-02] Invitar a quien ya tiene cuenta en otra empresa solo agrega la membresía
    Dado "contador@externo.com" con cuenta activa en "Empresa B"
    Cuando "admin@andina.com" lo invita con el rol "Contador"
    Entonces "contador@externo.com" tiene membresías en "Empresa B" y "Comercializadora Andina S.A.S."
    Y su contraseña no cambia

  @P-IV @P-I
  Escenario: [017-03] Desactivar un usuario cierra sus sesiones en esa empresa
    Dado "aux@andina.com" activo con una sesión abierta
    Cuando "admin@andina.com" lo desactiva con el motivo "Retiro de la empresa"
    Entonces la siguiente petición de "aux@andina.com" responde 401
    Y la bitácora registra la desactivación con autor, motivo e instante

  @P-IV
  Escenario: [017-04] Quitar un permiso a un rol surte efecto en la siguiente renovación
    Dado "contador@andina.com" con el rol "Contador"
    Cuando "admin@andina.com" quita "accounting.period.close" al rol "Contador"
    Y "contador@andina.com" renueva su sesión
    Entonces cerrar el período "2026-10" responde 403 con el código "FORBIDDEN"
    Y el detalle nombra el permiso "accounting.period.close"

  @P-IV
  Esquema del escenario: [017-05] La empresa siempre conserva un administrador activo
    Cuando "admin@andina.com" intenta "<operación>"
    Entonces la respuesta es 409 con el código "CONFLICT"
    Y el mensaje dice "La empresa debe tener al menos un administrador activo"

    Ejemplos:
      | operación                            |
      | quitarse el rol Administrador        |
      | desactivarse                         |
      | eliminar el rol Administrador        |

  @P-IV @R-CON-005
  Esquema del escenario: [017-06] Toda operación protegida exige su permiso y no escribe sin él
    Dado "lector@andina.com" con solo el permiso "accounting.report.read"
    Cuando intenta "<operación>"
    Entonces la respuesta es 403 con el código "FORBIDDEN" y el permiso "<permiso>" en el detalle
    Y no se escribe ningún registro

    Ejemplos:
      | operación                      | permiso                   |
      | contabilizar un comprobante    | accounting.entry.post     |
      | reversar un comprobante        | accounting.entry.reverse  |
      | cerrar el período 2026-10      | accounting.period.close   |
      | reabrir el período 2026-09     | accounting.period.reopen  |
      | ejecutar el cierre anual 2026  | accounting.year.close     |

  @P-IV @P-VIII
  Escenario: [017-07] Una operación sin permiso declarado no pasa el CI
    Dado una operación nueva de la API sin permiso ni declaración pública
    Cuando corre la verificación de permisos del CI
    Entonces la verificación falla nombrando la operación

  @P-IV
  Escenario: [017-08] Saber quién puede y solicitar el permiso
    Dado "aux@andina.com" sin el permiso "accounting.period.reopen"
    Cuando consulta quién puede "accounting.period.reopen"
    Entonces ve "Juliana Murcia (Administrador)" sin correos ni otros datos personales
    Cuando solicita el permiso "accounting.period.reopen" dos veces
    Entonces existe una sola solicitud pendiente
    Y "admin@andina.com" la ve en sus alertas

  @P-IV @P-I
  Escenario: [017-09] Rechazar una solicitud de permiso con motivo
    Dado una solicitud pendiente de "aux@andina.com" por "accounting.period.reopen"
    Cuando "admin@andina.com" la rechaza con el motivo "Solo el contador reabre períodos"
    Entonces "aux@andina.com" recibe la respuesta con el motivo
    Y la bitácora registra la decisión

  @P-IV
  Escenario: [017-10] Segundo factor activado con códigos de respaldo
    Cuando "admin@andina.com" activa el segundo factor confirmando un código válido
    Entonces recibe 10 códigos de respaldo que no se vuelven a mostrar
    Cuando inicia sesión con la contraseña correcta y un código errado
    Entonces no entra
    Y el intento cuenta para el bloqueo por intentos fallidos

  @P-IV @ADR-0002 @INV-11
  Escenario: [017-11] Un administrador no ve ni modifica usuarios de otra empresa
    Dado "Empresa B" con el usuario "ventas@empresab.com"
    Cuando "admin@andina.com" lista los usuarios
    Entonces no aparece "ventas@empresab.com"
    Y intentar desactivarlo responde 404 con el código "NOT_FOUND"
