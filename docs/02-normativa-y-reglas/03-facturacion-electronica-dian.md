# Facturación electrónica DIAN (UBL 2.1)

> ## Advertencia de uso
> No se pudo acceder al Anexo Técnico oficial desde el entorno en el que se redactó este documento. Lo que
> sigue es el **mapa de requisitos** para planificar y diseñar. Los valores exactos (códigos, orden de campos
> del CUFE, reglas de validación, tolerancias) **deben tomarse del Anexo Técnico vigente** y de sus vectores de
> prueba antes de escribir código. Cada dato está marcado ✅ / ⚠️ / 🔶 (ver [`README.md`](README.md)).

## 1. Marco normativo

| Norma | Aporta | Estado |
|---|---|---|
| Estatuto Tributario art. 615 y 616-1 | Obligación de facturar y sistema de facturación (incluye factura electrónica) | 🔶 |
| Decreto 358 de 2020 | Reglamenta el sistema de facturación electrónica | 🔶 |
| **Resolución DIAN 000165 de 1-nov-2023** | Desarrolla el sistema de facturación y los proveedores tecnológicos; adopta la versión **1.9** del Anexo Técnico de factura electrónica de venta; crea el Anexo Técnico 1.0 del documento equivalente electrónico | ⚠️ ([INCP](https://incp.org.co/publicaciones/infoincp-publicaciones/impuestos/nacionales/2023/11/nuevas-disposiciones-sobre-el-sistema-de-facturacion-electronica/), [CIJUF](https://cijuf.org.co/node/25671)) |
| Resolución DIAN 000119 de 2024 | Modificó plazos del documento equivalente electrónico | ⚠️ |
| Versiones posteriores del Anexo Técnico | **Se desconoce si existe una posterior a la 1.9** | 🔶 — verificar en el sitio de la DIAN antes de F3 |

## 2. Modalidades de emisión y decisión de diseño

**Decisión Q-02 (vigente):** la primera fase emite mediante un **Proveedor Tecnológico Autorizado (PTA)**,
**desacoplado por una interfaz de servicio** (`EInvoiceProvider`, ADR-0003) para permitir **facturación directa**
en el futuro sin tocar el dominio.

| Modalidad | Qué implica | Decisión |
|---|---|---|
| **Proveedor tecnológico autorizado (PTA)** | El proveedor firma, transmite y valida; SIFCA le entrega los datos (por su API) y recibe el resultado | **Primera fase (Q-02, ADR-0003)** |
| Facturación directa (software propio) | Habilitación ante la DIAN (set de pruebas), certificado de firma digital, firma XAdES, operación 24/7 | **Futura:** se añade como otro adaptador de `EInvoiceProvider` |
| Solución gratuita de la DIAN | Portal web para bajo volumen | No aplica a un sistema contable integrado |

Requisitos previos de la empresa cliente (con PTA) 🔶: RUT con la responsabilidad de facturador electrónico,
**autorización de numeración** (prefijo y rango) solicitada en los servicios de la DIAN, y el PTA registrado
como proveedor tecnológico de la empresa.

## 3. Tipos de documento (códigos de referencia) 🔶

Tomar la tabla oficial del Anexo al implementar.

| Documento | Código `InvoiceTypeCode` / equivalente | Notas |
|---|---|---|
| Factura electrónica de venta | 01 | Documento principal |
| Factura electrónica de exportación | 02 | Fuera del MVP |
| Factura por contingencia del facturador | 03 | R-FE-011 |
| Factura por contingencia DIAN | 04 | R-FE-011 |
| Nota crédito electrónica | 91 | Referencia a la factura |
| Nota débito electrónica | 92 | Referencia a la factura |
| Documento soporte en adquisiciones a no obligados a facturar | 05 | R-FE-014 |
| Nota de ajuste al documento soporte | 95 | R-FE-014 |
| Documento equivalente electrónico — tiquete POS | 20 | R-FE-015 |
| `AttachedDocument` | — | Contenedor: XML firmado + respuesta de la DIAN; es lo que se envía al cliente |
| `ApplicationResponse` | — | Respuesta de la DIAN y eventos RADIAN (fuera del MVP) |

## 4. Reglas

### R-FE-001 · Quién debe facturar electrónicamente
Los responsables de IVA y demás obligados a facturar según el calendario y las excepciones de la DIAN. El
sistema registra por empresa si es **facturador electrónico** (`tenant.is_electronic_invoicer`) y bloquea la
emisión de facturas de venta si no está habilitada la numeración y el proveedor.
- **Estado:** 🔶

### R-FE-002 · Validación previa
La factura electrónica **debe ser validada por la DIAN antes de entregarse al adquirente**. Solo un documento
con estado `ACCEPTED` (o `ACCEPTED_WITH_NOTES`) se envía al cliente y se considera expedido.
- **Efecto en el sistema:** el PDF que se entrega al cliente se genera **después** de la aceptación (necesita
  CUFE y QR definitivos); el correo con XML + PDF solo sale tras aceptación.
- **Estado:** 🔶

### R-FE-003 · Numeración autorizada
La numeración proviene de una **resolución de autorización de la DIAN**: prefijo, rango (desde-hasta),
fecha de resolución, vigencia y **clave técnica**. Un número solo puede usarse si pertenece a un rango activo
y vigente de la empresa. El sistema alerta cuando el rango está por agotarse o vencer.
- **Modelo:** `sales.numbering_range`.
- **Estado:** 🔶 — vigencia del rango (24 meses según la práctica) por confirmar.

### R-FE-004 · Consecutivo sin saltos dentro del rango
Los números se consumen en orden estricto y sin saltos ni repeticiones. Se asigna en la misma transacción que
emite el documento (INV-06). El número queda **consumido al emitir**; un documento **rechazado** por la DIAN
no se considera expedido (R-FE-008) y se corrige conservando el número.
- **Prueba de concurrencia:** 2 hilos × 1.000 emisiones sobre el mismo rango ⇒ números contiguos y únicos.

### R-FE-005 · CUFE y CUDE
Cada documento lleva un identificador único calculado con SHA-384:

- **CUFE** (factura de venta): hash de la concatenación de campos del documento más la **clave técnica** del
  rango de numeración.
- **CUDE** (notas, documento soporte, equivalente POS): igual, con el **PIN del software** en lugar de la clave
  técnica.

Esquema de campos (🔶, **de memoria — NO implementar desde aquí**; una guía de terceros publica un orden
similar pero la fuente oficial es el Anexo Técnico):

| Elemento | Contenido |
|---|---|
| `NumFac` | Prefijo + número de la factura |
| `FecFac`, `HorFac` | Fecha `AAAA-MM-DD` y hora `HH:MM:SS-05:00` |
| `ValFac` | Valor antes de impuestos |
| `CodImp1`/`ValImp1` | IVA: código `01` y valor |
| `CodImp2`/`ValImp2` | INC: código `04` y valor |
| `CodImp3`/`ValImp3` | ICA: código `03` y valor |
| `ValTot` | Valor a pagar |
| `NitOfe`, `NumAdq` | Identificación del emisor y del adquirente |
| `ClTec` o PIN | Clave técnica del rango (CUFE) o PIN del software (CUDE) |
| `TipoAmbiente` | 1 producción · 2 habilitación/pruebas |

Formato de los importes (dos decimales, punto decimal, sin separador de miles), codificación UTF-8 y hash en
hexadecimal minúsculas: **tomar del Anexo**.

- **Prueba obligatoria:** el sistema debe reproducir **bit a bit** los CUFE/CUDE de los ejemplos oficiales del
  Anexo antes de F3 (vectores guardados como *fixtures*). Si el proveedor tecnológico calcula el CUFE,
  SIFCA igualmente lo recalcula para detectar diferencias.

### R-FE-006 · Código QR
La representación gráfica incluye un QR con los datos del documento y un enlace a la consulta pública de la
DIAN (en producción y en habilitación hay direcciones distintas) que se alimenta del CUFE/CUDE. El contenido
exacto (campos y URL) se toma del Anexo.
- **Estado:** 🔶

### R-FE-007 · Representación gráfica (PDF)
El PDF es la **representación gráfica** del documento XML firmado; el XML es el documento legal. Debe incluir
como mínimo 🔶: identificación del emisor (razón social, NIT-DV), del adquirente, nombre del documento
(«Factura electrónica de venta»), prefijo y número, fecha y hora de expedición, descripción, cantidad y
valor de cada ítem, IVA/INC discriminados, total, forma y medio de pago, datos de la **resolución de
numeración** (número, fecha, prefijo, rango, vigencia), **CUFE**, **QR** y datos del software/proveedor.
- Se genera mediante el puerto `DocumentRenderer` del núcleo (PDF del PTA o renderizador mínimo propio,
  ADR-0008). Un motor externo (fase futura) solo puede ofrecer una representación **alternativa**; el contenido
  obligatorio **no es editable** por ninguna plantilla (los bloques «CUFE», «QR», «resolución» y «totales» son
  automáticos y no se pueden quitar).
- El PDF emitido se guarda **una vez** y se conserva; no se regenera para consultas posteriores.

### R-FE-008 · Estados DIAN
| Respuesta de la DIAN | Estado en SIFCA | Qué hacer |
|---|---|---|
| Aceptada | `ACCEPTED` | Generar PDF, enviar al cliente |
| Aceptada con notificaciones | `ACCEPTED_WITH_NOTES` | Igual que la anterior; las notificaciones se muestran al usuario |
| Rechazada | `REJECTED` | El documento **no está expedido**: mostrar los motivos, permitir corregir y retransmitir con el mismo número (R-FE-004) |
| Error de comunicación o sin respuesta | `ERROR` (transitorio) | Reintentos con *backoff*; consulta de estado antes de reenviar para evitar duplicados |

Las reglas de validación de la DIAN se clasifican en **rechazo** y **notificación** 🔶; los mensajes se
guardan completos en `validation_messages` y se traducen a texto accionable para el usuario.

### R-FE-009 · Un documento aceptado no se modifica
Para cambiar el efecto de una factura aceptada se emite una **nota crédito** (anulación total, devolución,
descuento) o **nota débito** (intereses, gastos, ajuste de valor). No existe «anular» ni «editar» una factura
aceptada.

### R-FE-010 · Notas crédito y débito
- Referencian la factura original (su CUFE y número).
- Llevan un **concepto de corrección** de la tabla oficial 🔶: para nota crédito, devolución parcial,
  anulación, rebaja, descuento, etc.; para nota débito, intereses, gastos por cobrar, cambio de valor.
- La suma de notas crédito sobre una factura **no puede exceder** el valor de la factura.
- Una nota crédito de anulación total revierte contablemente la factura (P-02) y repone inventario a su costo
  original (R-INV-005).

### R-FE-011 · Contingencia
Cuando el facturador no puede transmitir (falla de internet o de su sistema) o la DIAN no está disponible,
existe la **factura por contingencia** con numeración y reglas propias, y obligación de transmitir los
documentos pendientes cuando se restablezca el servicio 🔶. El sistema debe permitir emitir en contingencia
y mantener una **cola de pendientes** visible. Está ligado a la pregunta Q-06 (POS sin internet).

### R-FE-012 · Identificación del adquirente
- Tipo de documento y número, con **dígito de verificación (DV)** cuando es NIT.
- Persona jurídica o natural; responsabilidades fiscales del adquirente (código RUT, p. ej. `O-13`
  gran contribuyente, `O-15` autorretenedor, `O-23` agente de retención de IVA, `O-47` régimen simple,
  `R-99-PN` no responsable) 🔶.
- **Consumidor final:** identificación genérica `222222222222` con el tipo de documento que indique el Anexo
  🔶; sirve solo para ventas que el Anexo permita así (tope y restricciones por confirmar).
- **Cálculo del DV (módulo 11).** Se multiplican los dígitos, de derecha a izquierda, por los pesos
  `3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71`; se suman; con `r = suma mod 11`, el DV es `r`
  si `r < 2`, y `11 − r` en otro caso. Vectores de prueba: `800197268 → 4` (NIT de la DIAN),
  `890903938 → 8`, `860034313 → 7`.

### R-FE-013 · Conservación
El XML firmado, la respuesta de la DIAN y el PDF se conservan en almacenamiento inmutable con el *hash*
SHA-256 registrado. Política mínima propuesta ≥ 10 años 🔶 (confirmar con el contador).

### R-FE-014 · Documento soporte
Cuando se compra a personas **no obligadas a facturar**, la empresa emite el **documento soporte** (y su nota
de ajuste) como sustento de costos y deducciones; tiene numeración y transmisión propias. Hasta F4.
- **Estado:** 🔶

### R-FE-015 · POS: documento equivalente electrónico
Las ventas de mostrador con sistema POS se soportan con el **documento equivalente electrónico (tiquete
POS)**; si el cliente pide factura de venta con sus datos, se emite factura electrónica. Los tiquetes POS
**no** dan derecho a IVA descontable ni a costo/deducción para el adquirente 🔶. Los plazos de obligatoriedad
cambiaron (Resolución 119 de 2024 ⚠️): verificar fecha vigente.

## 5. Estructura del documento UBL 2.1 (mapa de bloques) 🔶

```text
<Invoice>                              (o CreditNote, DebitNote)
 ├─ ext:UBLExtensions
 │    ├─ DianExtensions               (control de numeración, fuente, proveedor de software,
 │    │                                 código de seguridad del software, proveedor de autorización,
 │    │                                 código QR)
 │    └─ ds:Signature                 (firma XAdES del emisor)
 ├─ cbc:UBLVersionID / CustomizationID / ProfileID / ProfileExecutionID
 ├─ cbc:ID  (prefijo + número) · cbc:UUID (CUFE/CUDE)
 ├─ cbc:IssueDate · IssueTime · DueDate · InvoiceTypeCode · DocumentCurrencyCode
 ├─ cac:AccountingSupplierParty       (emisor)
 ├─ cac:AccountingCustomerParty       (adquirente)
 ├─ cac:PaymentMeans · cac:PaymentTerms
 ├─ cac:TaxTotal                      (por impuesto)
 ├─ cac:LegalMonetaryTotal            (extensión, base, total con impuestos, descuentos, cargos, a pagar)
 └─ cac:InvoiceLine (n)               (cantidad, unidad, valor, impuestos de línea, ítem, precio)
```

- El **código de seguridad del software** es un SHA-384 de `IDSoftware + PIN + número de documento` 🔶.
- El proveedor de autorización es la DIAN (su NIT: `800197268`, DV `4`).
- Cada total de impuestos del documento debe coincidir con la suma de los impuestos de línea (R-IMP-003).
- Validación local previa: esquema XSD de UBL 2.1 + reglas del Anexo, para fallar antes de transmitir.

## 6. Puerto del proveedor tecnológico (diseño)

El dominio de `einvoicing` depende de un puerto, no de un proveedor:

| Operación del puerto | Descripción |
|---|---|
| `submit(document)` | Entrega los datos (o el XML construido) y devuelve una referencia de transmisión |
| `getStatus(reference)` | Consulta idempotente del estado (aceptado, rechazado, en proceso) |
| `fetchArtifacts(reference)` | XML firmado, respuesta DIAN, `AttachedDocument` |
| `fetchValidationResult(reference)` | Datos finales de la validación: CUFE/CUDE, contenido del QR, fecha de validación, mensajes |
| `capabilities()` | Qué tipos de documento soporta (factura, notas, soporte, POS) |

Requisitos de cualquier adaptador: **idempotencia** (reintentar no duplica documentos), tiempos de espera,
reintentos con *backoff*, registro completo de petición/respuesta (sin credenciales) y pruebas contra el
ambiente de pruebas del proveedor y el de habilitación de la DIAN.

> **Selección del PTA (Q-13):** criterios: costo por documento, soporte de notas, documento soporte y POS, API
> REST con *sandbox*, entrega de XML firmado y `AttachedDocument`, **entrega de la representación gráfica
> (PDF)** (si no, el renderizador mínimo del núcleo la genera, S-02), tiempos de respuesta, política de
> reintentos e historial de disponibilidad.
>
> **Ubicación en la arquitectura:** el puerto `EInvoiceProvider` se define en la capa Application de
> `einvoicing`; el adaptador del PTA vive en `infrastructure/clients` y valida con Zod cada respuesta del
> proveedor antes de usarla (constitución V). Un adaptador de facturación directa futura implementa el mismo
> puerto.

## 7. Máquina de estados del documento de venta

Ver el diagrama y las transiciones en
[`03-procesos-y-flujos/01-flujo-venta-catalogo-a-factura.md`](../03-procesos-y-flujos/01-flujo-venta-catalogo-a-factura.md) §4.

## 8. Estrategia de pruebas

| Nivel | Qué se prueba |
|---|---|
| Unitarias | DV del NIT, CUFE/CUDE contra vectores oficiales, formateo de importes, redondeo |
| Contrato | Respuestas simuladas del proveedor (aceptado, notificaciones, rechazado, error, tiempo agotado) |
| Esquema | XML generado valida contra XSD de UBL 2.1 y reglas del Anexo |
| Integración | Ciclo completo en el ambiente de **habilitación** de la DIAN a través del proveedor |
| Concurrencia | Consecutivos sin saltos bajo carga (R-FE-004) |
| Regresión normativa | Cada cambio del Anexo agrega casos nuevos; no se borran los antiguos |
