# language: es
@P-IV @ADR-0002
Característica: Autenticación y sesiones
  Para trabajar en SIFCA con mi identidad real y de forma segura
  Como usuario del back-office
  Quiero iniciar sesión, mantener mi sesión protegida y elegir la empresa con la que trabajo

  Antecedentes:
    Dado la empresa "Comercializadora Andina S.A.S." con NIT "900.123.456-8"
    Y el usuario "admin@andina.com" activo con membresía en esa empresa y contraseña "Cuenta-Segura-2026"

  @P-IV
  Escenario: [012-01] Inicio de sesión correcto con una sola empresa
    Cuando inicia sesión con "admin@andina.com" y "Cuenta-Segura-2026"
    Entonces entra al back-office de "Comercializadora Andina S.A.S."
    Y la consulta de su contexto de sesión devuelve su usuario, la empresa y el modo de autenticación "password"

  @P-IV
  Esquema del escenario: [012-02] Las credenciales inválidas no revelan si el correo existe
    Cuando inicia sesión con "<correo>" y "<contraseña>"
    Entonces ve "Correo o contraseña incorrectos"
    Y no se crea ninguna sesión

    Ejemplos:
      | correo                 | contraseña         |
      | admin@andina.com       | clave-equivocada-1 |
      | noexiste@andina.com    | Cuenta-Segura-2026 |

  @P-IV
  Escenario: [012-03] La credencial de renovación es de un solo uso
    Dado una sesión iniciada con su credencial de renovación "R1"
    Cuando el back-office renueva la sesión con "R1"
    Entonces recibe una credencial de renovación nueva "R2"
    Y "R1" queda inválida

  @P-IV @P-I
  Escenario: [012-04] Reutilizar una credencial rotada revoca toda la sesión
    Dado una sesión cuya credencial "R1" ya fue rotada a "R2" hace más de 10 segundos
    Cuando alguien presenta "R1"
    Entonces la respuesta es 401 con el código "UNAUTHENTICATED"
    Y "R2" también queda inválida
    Y la bitácora de seguridad registra "reutilización de credencial de renovación"

  @P-IV
  Escenario: [012-05] La sesión vence por inactividad sin perder el trabajo
    Dado una sesión sin actividad durante 30 minutos
    Y un borrador local sin enviar
    Cuando el usuario intenta una acción
    Entonces ve "Tu sesión venció"
    Y tras escribir de nuevo su contraseña continúa con el borrador intacto

  @P-IV
  Escenario: [012-06] Cerrar una sesión desde otro dispositivo
    Dado dos sesiones abiertas de "admin@andina.com" en "Oficina" y "Portátil"
    Cuando desde "Oficina" cierra la sesión "Portátil" en "Mis sesiones"
    Entonces la siguiente petición desde "Portátil" responde 401
    Y la sesión "Oficina" sigue activa

  @P-IV @ADR-0002 @INV-11
  Escenario: [012-07] Elegir y cambiar de empresa sin ver datos ajenos
    Dado el usuario "contador@externo.com" con membresía en "Empresa A" y "Empresa B"
    Cuando inicia sesión
    Entonces ve la lista "Empresa A", "Empresa B" para elegir
    Cuando elige "Empresa A" y luego cambia a "Empresa B"
    Entonces sus consultas solo devuelven datos de "Empresa B"
    Y las credenciales emitidas para "Empresa A" no sirven para "Empresa B"

  @P-IV
  Escenario: [012-08] No se puede cambiar a una empresa sin membresía
    Dado el usuario "contador@externo.com" con membresía solo en "Empresa A"
    Cuando pide cambiar a "Empresa C"
    Entonces la respuesta es 403 con el código "FORBIDDEN"
    Y la sesión sigue en "Empresa A"

  @P-IV @P-I
  Escenario: [012-09] Bloqueo temporal tras cinco intentos fallidos
    Dado cuatro intentos fallidos seguidos para "admin@andina.com"
    Cuando falla el quinto intento
    Entonces ve "Por seguridad bloqueamos el acceso durante 15 minutos. Puedes recuperar tu contraseña"
    Y un intento con la contraseña correcta antes de 15 minutos responde con el código "ACCOUNT_LOCKED"
    Y la bitácora de seguridad registra el bloqueo con correo, dirección de origen e instante

  @P-IV
  Esquema del escenario: [012-10] La recuperación de contraseña responde igual exista o no el correo
    Cuando pide recuperar la contraseña de "<correo>"
    Entonces ve "Si el correo está registrado, recibirás un enlace"
    Y se envían <enviados> correos de recuperación

    Ejemplos:
      | correo              | enviados |
      | admin@andina.com    | 1        |
      | noexiste@andina.com | 0        |

  @P-IV
  Escenario: [012-11] El enlace de recuperación sirve una sola vez y cierra todas las sesiones
    Dado un enlace de recuperación válido para "admin@andina.com"
    Y dos sesiones abiertas de "admin@andina.com"
    Cuando define la contraseña "Otra-Clave-Segura-2026" con ese enlace
    Entonces las dos sesiones quedan cerradas
    Cuando abre de nuevo el mismo enlace
    Entonces ve "Este enlace ya no es válido" y la opción de pedir otro

  @P-IV
  Esquema del escenario: [012-12] Las contraseñas débiles se rechazan con su causa
    Dado un enlace de recuperación válido para "admin@andina.com"
    Cuando define la contraseña "<contraseña>"
    Entonces la respuesta es 422 con el código "WEAK_PASSWORD"
    Y el mensaje dice "<causa>"

    Ejemplos:
      | contraseña         | causa                                   |
      | corta-11ch         | Debe tener al menos 12 caracteres       |
      | password1234       | Es una contraseña demasiado común       |
      | Cuenta-Segura-2026 | Debe ser distinta de la anterior        |
