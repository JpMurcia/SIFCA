# language: es
@ADR-0001
Característica: Fundaciones del back-office web
  Para que todas las pantallas de SIFCA compartan navegación, formatos, errores y accesibilidad
  Como contador o auxiliar contable
  Quiero un cascarón común con estados globales y mensajes de error comprensibles

  Antecedentes:
    Dado la empresa "Comercializadora Andina S.A.S." con NIT "900.123.456-8"
    Y el período "2026-10" abierto

  @ADR-0001 @R-CON-011
  Esquema del escenario: [016-01] El cascarón se adapta al ancho de la ventana
    Dado un usuario con el permiso "accounting.report.read"
    Cuando abre el back-office en una ventana de <ancho> px
    Entonces el menú lateral se muestra "<menu>"
    Y la barra superior muestra "Comercializadora Andina S.A.S.", "NIT 900.123.456-8" y el chip "Oct 2026 · Abierto"

    Ejemplos:
      | ancho | menu      |
      | 1440  | expandido |
      | 1024  | en íconos |
      | 800   | en cajón  |

  @R-CON-004
  Escenario: [016-02] El chip del período avisa si el período de trabajo está cerrado
    Dado un usuario con el permiso "accounting.report.read"
    Y el período "2026-09" cerrado
    Cuando la fecha de trabajo es "2026-09-15"
    Entonces el chip dice "Sep 2026 · Cerrado" con estilo de advertencia
    Y al pulsarlo navega a "/contabilidad/periodos"

  @ADR-0001
  Escenario: [016-03] Tema y densidad se conservan entre sesiones
    Dado un usuario con el permiso "accounting.report.read"
    Cuando elige el tema "Slate" y la densidad "Compacta"
    Y recarga la aplicación
    Entonces la aplicación abre en tema "Slate"
    Y las filas de las tablas miden 28 px con texto de 13 px

  @P-V @ADR-0009
  Esquema del escenario: [016-04] Cada error tipificado se muestra con su texto y en su lugar
    Dado un usuario con todos los permisos de contabilidad
    Cuando la API responde con el código "<code>" y estado <http>
    Entonces se muestra "<texto>"
    Y el mensaje aparece en "<lugar>"

    Ejemplos:
      | code                 | http | texto                                                         | lugar                      |
      | ENTRY_NOT_BALANCED   | 422  | El comprobante no cuadra                                      | banner sobre la grilla     |
      | PERIOD_CLOSED        | 409  | El período 2026-09 está cerrado                               | campo Fecha contable       |
      | PERIOD_NOT_FOUND     | 422  | No existe un período contable para esa fecha                  | campo Fecha contable       |
      | ALREADY_REVERSED     | 409  | Este comprobante ya fue reversado                             | diálogo de reversión       |
      | FORBIDDEN            | 403  | No tienes permiso para esta acción                            | toast                      |
      | NOT_FOUND            | 404  | No encontramos ese registro                                   | página de error            |
      | CONFLICT             | 409  | cambió en otra sesión                                         | diálogo con Recargar       |
      | IDEMPOTENCY_CONFLICT | 422  | Este envío ya se había realizado con otros datos              | toast                      |
      | INTERNAL_ERROR       | 500  | Ocurrió un error inesperado                                   | página con código copiable |

  @P-V
  Escenario: [016-05] Los errores de validación marcan cada campo y llevan el foco al primero
    Dado un usuario con el permiso "accounting.entry.post"
    Cuando la API responde "VALIDATION_FAILED" con errores en "lines[2].accountCode" y "description"
    Entonces la celda de cuenta de la línea 3 y el campo Descripción muestran su mensaje
    Y arriba aparece un resumen con un enlace a cada campo
    Y el foco queda en el primer campo con error

  @P-V
  Escenario: [016-06] Un error desconocido no rompe la pantalla ni expone el cuerpo crudo
    Dado un usuario con el permiso "accounting.report.read"
    Cuando la API responde con estado 502 y un cuerpo HTML
    Entonces se muestra "Ocurrió un error inesperado" con la opción "Reintentar"
    Y no se muestra ningún fragmento del cuerpo recibido

  @P-IV
  Escenario: [016-07] Sin permiso no se ve la acción y el enlace directo muestra la página 403
    Dado un usuario con solo el permiso "accounting.report.read"
    Cuando abre la lista de comprobantes
    Entonces no ve "Nuevo comprobante" en el menú, en la lista ni en la paleta
    Cuando abre directamente "/contabilidad/comprobantes/nuevo"
    Entonces ve la página "No tienes permiso" con el permiso "accounting.entry.post"
    Y ve el botón "Solicitar permiso"

  @P-III @ADR-0006
  Escenario: [016-08] Un reintento tras perder la conexión no duplica el registro
    Dado un usuario con el permiso "accounting.entry.post"
    Y un comprobante válido listo para contabilizar
    Cuando envía el comprobante y la conexión se pierde antes de recibir la respuesta
    Y la conexión vuelve y la interfaz reintenta
    Entonces el reintento usa la misma clave de idempotencia
    Y existe un solo comprobante contabilizado

  @ADR-0001
  Escenario: [016-09] Carga con esqueleto y lista vacía con su explicación
    Dado un usuario con el permiso "accounting.entry.post"
    Cuando abre la lista de comprobantes y la respuesta tarda 2 segundos
    Entonces ve filas esqueleto con las columnas de la tabla
    Cuando la respuesta llega sin comprobantes para el rango filtrado
    Entonces ve "Aún no hay comprobantes en este rango"
    Y ve las acciones "Limpiar filtros" y "Nuevo comprobante"

  @R-CON-005 @P-I
  Escenario: [016-10] La lista de comprobantes nunca ofrece editar ni eliminar
    Dado un usuario con todos los permisos de contabilidad
    Y el comprobante "AJ-1" reversado por "AJ-2"
    Cuando abre la lista de comprobantes
    Entonces la fila de "AJ-1" muestra "Contabilizado" y "Reversado por AJ-2"
    Y la fila de "AJ-2" muestra "Reversión de AJ-1"
    Y ninguna fila ofrece "Editar" ni "Eliminar"

  @R-CON-009 @P-VI @ADR-0007
  Esquema del escenario: [016-11] Importes y fechas en formato colombiano sin errores de redondeo
    Dado un usuario con el permiso "accounting.report.read"
    Cuando la pantalla presenta el valor "<entrada>" de tipo "<tipo>"
    Entonces se lee "<salida>"

    Ejemplos:
      | tipo           | entrada                 | salida           |
      | importe        | 1190000.5               | $ 1.190.000,50   |
      | suma importes  | 0.10+0.20+0.30          | $ 0,60           |
      | fecha          | 2026-10-14              | 14/10/2026       |
      | instante       | 2026-02-01T04:30:00Z    | 31/01/2026 23:30 |

  @ADR-0001
  Escenario: [016-12] La paleta de comandos encuentra pantallas sin tildes y solo ofrece lo permitido
    Dado un usuario con solo el permiso "accounting.report.read"
    Cuando pulsa "Ctrl+K" y escribe "periodos"
    Entonces aparece "Períodos" y Enter navega a "/contabilidad/periodos"
    Cuando escribe "> nuevo"
    Entonces no aparece la acción "Nuevo comprobante"
