# language: es
@P-IV @ADR-0002
Característica: Aislamiento por tenant, API Keys, idempotencia y webhooks
  Para operar como SaaS multiempresa sin fugas de datos
  Además, integra sistemas externos solo por contratos y eventos estándar

  Antecedentes:
    Dado dos empresas "Empresa A" y "Empresa B" con datos propios en la misma base de datos

  @INV-11
  Esquema del escenario: [011-01] La empresa A no ve datos de la empresa B en ninguna tabla de negocio
    Dado registros de la empresa B en la tabla "<tabla>"
    Cuando una consulta se ejecuta con el tenant de "Empresa A"
    Entonces la consulta devuelve 0 filas de la empresa B
    Y un intento de modificar o insertar filas de la empresa B falla

    Ejemplos:
      | tabla                  |
      | parties.party          |
      | catalog.item           |
      | acc.journal_entry      |
      | inventory.stock_movement |
      | sales.document         |
      | arap.receipt           |

  @P-IV
  Escenario: [011-02] Sin tenant fijado en la transacción no se ve ningún dato
    Cuando se ejecuta una consulta sin fijar el tenant de la transacción
    Entonces no devuelve filas ni permite escrituras

  @P-IV @INV-11
  Escenario: [011-03] El rol de la aplicación no puede saltarse las políticas de aislamiento
    Cuando se inspeccionan los privilegios del rol de base de datos de la aplicación
    Entonces no es propietario de las tablas de negocio ni tiene el atributo BYPASSRLS

  @P-IV
  Escenario: [011-04] El CI rechaza una tabla de negocio sin tenant ni aislamiento
    Dado una migración que crea una tabla de negocio sin la columna "tenant_id" o sin RLS habilitada
    Cuando se ejecuta la verificación del esquema en el CI
    Entonces la verificación falla indicando la tabla

  @P-IX
  Escenario: [011-05] Una API Key solo puede hacer lo que sus alcances permiten
    Dado una API Key de "Empresa A" con el único alcance "catalog:read"
    Cuando intenta emitir una factura
    Entonces se rechaza con el estado 403
    Y puede listar los ítems del catálogo

  @P-IV @P-IX
  Escenario: [011-06] Una API Key no accede a recursos de otra empresa ni revela su existencia
    Dado una API Key de "Empresa A" y una factura de "Empresa B"
    Cuando consulta esa factura por su identificador
    Entonces recibe el estado 404

  @P-IX
  Escenario: [011-07] El secreto de la API Key se muestra una vez y se guarda como hash
    Cuando el administrador crea una API Key
    Entonces el secreto completo se muestra solo en esa respuesta
    Y en la base de datos solo existe su hash y su prefijo
    Cuando rota la llave
    Entonces ambas llaves son válidas durante el periodo de solapamiento configurado
    Y se registra el último uso de cada una

  @P-III
  Escenario: [011-08] Reutilizar una clave de idempotencia con otro cuerpo se rechaza
    Dado una operación creada con la clave "abc-12345678" y un cuerpo determinado
    Cuando se envía la misma clave con un cuerpo distinto
    Entonces se rechaza con el código "IDEMPOTENCY_KEY_REUSED"
    Y con el mismo cuerpo se devuelve la respuesta original

  @P-IX
  Escenario: [011-09] Los webhooks se entregan firmados y el receptor puede verificarlos
    Dado una suscripción al evento "invoice.accepted" con su secreto
    Cuando ocurre el evento
    Entonces se entrega con el encabezado de firma que incluye la marca de tiempo y el HMAC del cuerpo
    Y un receptor que valide la firma y la marca de tiempo dentro de 5 minutos acepta el evento
    Y un evento con marca de tiempo vencida se rechaza

  @P-IX
  Escenario: [011-10] La entrega es al menos una vez con reintentos exponenciales y registro
    Dado un destino de webhook que responde con error
    Cuando ocurre el evento
    Entonces se reintenta con retroceso exponencial hasta el límite configurado
    Y cada intento queda registrado con su respuesta
    Y el evento puede reenviarse manualmente
    Y todos los intentos llevan el mismo identificador de evento para deduplicar

  @P-IX
  Esquema del escenario: [011-11] No se crean webhooks hacia destinos privados
    Cuando el administrador crea una suscripción con la dirección "<destino>"
    Entonces se rechaza

    Ejemplos:
      | destino                    |
      | http://localhost:8080/hook |
      | https://127.0.0.1/hook     |
      | https://10.0.0.5/hook      |
      | https://192.168.1.20/hook  |
      | http://ejemplo.com/hook    |

  @P-V
  Esquema del escenario: [011-12] Los esquemas estrictos rechazan datos inválidos en el borde
    Cuando se envía un cuerpo con <problema>
    Entonces se rechaza con el código "VALIDATION_FAILED" indicando el campo

    Ejemplos:
      | problema                          |
      | un campo desconocido              |
      | un importe negativo               |
      | un importe con 3 decimales        |
      | una cantidad igual a cero         |
      | un identificador malformado       |

  @P-V @P-IX
  Escenario: [011-13] El OpenAPI se deriva de los esquemas y el CI detecta cambios incompatibles
    Dado el OpenAPI derivado de los esquemas de contratos
    Cuando se elimina un campo obligatorio de una respuesta existente
    Entonces la comparación de contratos del CI falla indicando el cambio incompatible

  @P-IX @ADR-0008
  Escenario: [011-14] El núcleo funciona aunque un motor externo esté caído
    Dado un motor externo suscrito a los webhooks que no responde
    Cuando se emiten facturas y se registran movimientos
    Entonces las operaciones se completan con su desempeño normal
    Y los eventos pendientes se reintentan sin bloquear la operación

  @P-VI
  Escenario: [011-15] Los importes de la API viajan como cadenas decimales
    Cuando se consulta una factura por la API
    Entonces los importes y cantidades son cadenas como "1190000.00"
    Y ninguno es un número de punto flotante
