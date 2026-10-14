# language: es
@ADR-0003 @P-IX
Característica: Facturación electrónica mediante un Proveedor Tecnológico Autorizado
  Para cumplir la validación previa de la DIAN sin acoplar el dominio a un proveedor
  La transmisión se hace por un puerto con adaptadores intercambiables

  Antecedentes:
    Dado una factura "SETP1" emitida localmente en estado "ISSUED"
    Y un proveedor tecnológico simulado conectado al puerto de facturación electrónica

  @R-FE-002 @R-FE-008 @R-FE-005 @R-FE-007 @R-FE-013
  Escenario: [009-01] Una factura aceptada se guarda y se entrega al cliente
    Cuando el worker transmite la factura y el proveedor responde "ACCEPTED" con el XML firmado y el CUFE
    Entonces el estado de la factura es "ACCEPTED"
    Y el CUFE calculado por el sistema coincide con el del proveedor
    Y se genera el PDF con el CUFE y el código QR
    Y el XML firmado, la respuesta de la DIAN y el PDF se guardan con su hash SHA-256
    Y el cliente recibe el XML y el PDF por correo
    Y se publica el evento "invoice.accepted"

  @R-FE-002
  Escenario: [009-02] Mientras no esté aceptada no se entrega nada al cliente
    Cuando la factura está en estado "TRANSMITTING"
    Entonces no se envía ningún correo ni se expone el PDF al cliente

  @R-FE-005
  Escenario: [009-03] Una diferencia de CUFE entre el sistema y el proveedor genera una alerta
    Cuando el proveedor responde "ACCEPTED" con un CUFE distinto del calculado por el sistema
    Entonces se registra una alerta de discrepancia de CUFE
    Y la factura no se entrega al cliente hasta que se revise

  @R-FE-008 @R-FE-004
  Escenario: [009-04] Un rechazo se corrige y se retransmite con el mismo número
    Cuando el proveedor responde "REJECTED" con el mensaje "Dato inválido del adquirente"
    Entonces el estado de la factura es "REJECTED" y los motivos quedan guardados completos
    Cuando se corrige el dato del adquirente y se retransmite
    Entonces la factura conserva el número "SETP1"
    Y no se consume ningún número adicional del rango

  @R-FE-008
  Escenario: [009-05] Un error transitorio se reintenta consultando el estado antes de reenviar
    Cuando el proveedor no responde en el tiempo de espera
    Entonces la transmisión se reintenta con retroceso exponencial
    Y antes de reenviar se consulta el estado por la referencia de la transmisión
    Y nunca se transmiten dos documentos distintos con el mismo número

  @R-FE-011
  Escenario: [009-06] Con una indisponibilidad prolongada el sistema opera en contingencia
    Cuando el proveedor y la DIAN no están disponibles por más del umbral configurado
    Entonces el sistema permite emitir en modo de contingencia
    Y los documentos pendientes aparecen en una cola visible para transmitirlos al restablecerse el servicio

  @R-FE-009
  Escenario: [009-07] Un documento aceptado no se modifica
    Dado que la factura "SETP1" está aceptada
    Cuando se intenta editar sus líneas o importes
    Entonces se rechaza con el código "DOCUMENT_NOT_EDITABLE"
    Y el único camino de corrección es emitir una nota crédito o una nota débito

  @P-V
  Escenario: [009-08] Una respuesta del proveedor que no cumple el esquema no cambia el estado
    Cuando el proveedor responde con un cuerpo que no cumple el esquema esperado
    Entonces la respuesta se rechaza al validarla
    Y la factura conserva su estado
    Y se registra el error para revisión

  @ADR-0003
  Escenario: [009-09] Cambiar de adaptador no cambia los resultados del dominio
    Dado dos adaptadores distintos del puerto, ambos simulados
    Cuando se transmite la misma factura con cada uno
    Entonces los estados, los eventos de dominio y los asientos resultantes son idénticos

  @R-FE-003
  Esquema del escenario: [009-10] El sistema alerta cuando el rango de numeración está por agotarse o vencer
    Dado un rango con <restantes> números restantes que vence en <dias> días y umbrales de alerta de 50 números y 30 días
    Cuando se revisa el rango
    Entonces <resultado> alerta

    Ejemplos:
      | restantes | dias | resultado |
      | 500       | 200  | no hay    |
      | 40        | 200  | hay       |
      | 500       | 20   | hay       |

  @R-FE-012
  Esquema del escenario: [009-11] El dígito de verificación del NIT se valida con el módulo 11
    Dado un adquirente con NIT "<nit>" y dígito de verificación "<dv>"
    Cuando se valida su identificación
    Entonces el resultado es "<resultado>"

    Ejemplos:
      | nit       | dv | resultado |
      | 800197268 | 4  | válido    |
      | 890903938 | 8  | válido    |
      | 860034313 | 7  | válido    |
      | 800197268 | 5  | inválido  |

  @R-FE-012
  Escenario: [009-12] El consumidor final usa la identificación genérica
    Dado una venta a un consumidor final sin datos de identificación
    Cuando se prepara el documento
    Entonces el adquirente usa la identificación genérica de consumidor final del Anexo Técnico

  @R-FE-007 @P-III
  Escenario: [009-13] Una falla del renderizador o del correo no cambia el estado fiscal
    Dado que la factura fue aceptada
    Cuando el renderizador de PDF no está disponible
    Entonces la factura sigue "ACCEPTED"
    Y el PDF queda pendiente con reintentos
    Cuando el renderizador se recupera
    Entonces se genera el PDF, se guarda y se envía el correo

  @P-III @ADR-0006
  Escenario: [009-14] La transmisión ocurre fuera de la transacción comercial
    Cuando se emite una factura
    Entonces la emisión se confirma sin esperar la respuesta de la DIAN
    Y la transmisión se registra como un evento de salida para el worker

  @R-FE-013
  Escenario: [009-15] Los documentos fiscales se conservan con su hash
    Dado una factura aceptada
    Cuando se consultan sus archivos fiscales
    Entonces cada archivo tiene registrado su hash SHA-256 y coincide con el contenido almacenado
