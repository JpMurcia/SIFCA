# Contrato de API y Swagger/OpenAPI

Estado: **borrador de Fase 1** · Contratos de diseño (validados sintácticamente como OpenAPI 3.1):
[`openapi/sifca.v1.draft.yaml`](openapi/sifca.v1.draft.yaml) ·
[`openapi/asia-pop-render.v1.draft.yaml`](openapi/asia-pop-render.v1.draft.yaml)

## 1. Enfoque: código primero, contrato versionado

| Decisión | Detalle |
|---|---|
| El OpenAPI se **genera** desde NestJS (`@nestjs/swagger`) | La fuente de verdad en ejecución son los controladores y los DTO; no hay un YAML que mantener a mano en paralelo |
| Se **versiona una instantánea** | En cada cambio de API, el CI exporta `openapi.json` a `docs/01-arquitectura/openapi/generated/` y falla si difiere de la confirmada: ningún cambio de API pasa sin que se vea en el *diff* |
| Se **comprueban cambios incompatibles** | El CI compara contra la versión publicada anterior con una herramienta de *diff* de OpenAPI (p. ej. `oasdiff`) y bloquea cambios que rompen clientes sin subir la versión mayor |
| Se **lintea** el contrato | Reglas de estilo con Spectral: `operationId` único, descripciones, ejemplos, esquemas de error, sin `additionalProperties` accidentales |
| Se **generan clientes** | `packages/api-client` desde el OpenAPI para admin, vitrina y móvil |
| Los borradores de esta carpeta | Se usan como **referencia de diseño** y, durante F2, se contrastan con el generado para detectar derivas |

## 2. Convenciones de la API

### 2.1 Rutas y verbos

| Tema | Regla |
|---|---|
| Base | `/api/v1` (versión mayor en la ruta; los cambios compatibles no la cambian) |
| Recursos | Sustantivos en plural y *kebab-case*: `/sales/invoices`, `/receivables/receipts`; subrecursos y acciones explícitas: `POST /sales/invoices/{id}/issue` |
| Acciones de dominio | Se modelan como `POST` sobre `.../{acción}` (emitir, anular con nota, aplicar), no como `PATCH` de un campo `status`: el estado lo decide el dominio |
| Verbos | `GET` seguro y sin efectos · `POST` crea o ejecuta · `PUT` solo reemplazo completo de configuraciones · `PATCH` fusión parcial de maestros · `DELETE` solo para lo que se puede eliminar (nunca documentos contables) |
| `operationId` | `<modulo>_<recurso>_<accion>` en *snake_case* (`sales_invoices_issue`): produce nombres estables en los clientes generados |

### 2.2 Formato de datos

| Tema | Regla |
|---|---|
| JSON | `camelCase`; `null` explícito cuando el campo existe pero no tiene valor; los opcionales ausentes se omiten |
| Identificadores | UUID v7 como texto |
| **Dinero, cantidades, porcentajes** | **Cadenas decimales** (`"1190000.00"`, `"19.00"`); nunca `number`. Evita la pérdida de precisión de `float` y las sorpresas de redondeo entre sistemas (R-CON-009). *Excepción:* la fachada de compatibilidad con Alegra usa números porque imita su formato |
| Fechas y horas | `date` (`2026-10-13`) para fechas contables; `date-time` ISO 8601 con desfase (`2026-10-13T14:30:00-05:00`) para instantes |
| Enumeraciones | `UPPER_SNAKE_CASE`; agregar valores es un cambio compatible, así que los clientes deben tolerar valores desconocidos |
| Moneda | COP implícita en el MVP; el campo `currency` se reserva |
| Campos calculados | Los entrega el servidor; el cliente **nunca** envía totales, impuestos ni retenciones (el servidor recalcula; ver R-IMP) |

### 2.3 Paginación, filtros y orden

- **Cursor opaco:** `?limit=25&cursor=…`; respuesta `{ "data": [...], "page": { "nextCursor": "…", "hasMore": true } }`.
  `limit` entre 1 y 100 (por defecto 25). No hay `offset`: se evita la inconsistencia con datos que cambian.
- **Filtros** como parámetros simples (`status=ACCEPTED&issuedFrom=2026-10-01`); `q` para texto libre.
- **Orden:** `sort=-issuedAt,number` (prefijo `-` descendente). Solo se puede ordenar por campos indexados y
  documentados.
- **Fachada Alegra:** `start`/`limit` con máximo 30, para ser idéntica (ver `02-…/06-…`).

### 2.4 Errores (RFC 9457, `application/problem+json`)

```json
{
  "type": "https://docs.sifca.example/errors/insufficient-stock",
  "title": "Stock insuficiente",
  "status": 409,
  "code": "INSUFFICIENT_STOCK",
  "detail": "El ítem RAM-001 tiene 5 disponibles y se pidieron 8.",
  "requestId": "0192f6d6-6c5e-7b9a-bd23-8a1f6b0e9c11",
  "errors": [{ "field": "lines[0].quantity", "message": "Máximo 5" }]
}
```

- `code` es **estable y legible por máquina**: los clientes lo usan para decidir; `title`/`detail` son para
  personas y pueden cambiar.
- Mapeo: `400` solicitud mal formada · `401` sin autenticar · `403` sin permiso o alcance · `404` no existe (o
  no pertenece a la empresa; no se revela) · `409` conflicto de estado de negocio (período cerrado, rango agotado,
  stock) · `412` fallo de `If-Match` · `422` validación de datos · `429` límite de tasa · `5xx` falla del servidor.
- Códigos de negocio iniciales: `VALIDATION_FAILED`, `INSUFFICIENT_STOCK`, `NUMBERING_RANGE_EXHAUSTED`,
  `NUMBERING_RANGE_EXPIRED`, `PERIOD_CLOSED`, `DOCUMENT_NOT_EDITABLE`, `CREDIT_LIMIT_EXCEEDED`,
  `ENTRY_NOT_BALANCED`, `DIAN_REJECTED`, `IDEMPOTENCY_KEY_REUSED`, `RATE_LIMITED`. Se mantienen en un
  catálogo único (`docs/…/errores.md`, a crear en F2).
- Jamás se devuelven trazas de pila ni mensajes de la base de datos.

### 2.5 Idempotencia, concurrencia y límites

| Mecanismo | Uso |
|---|---|
| `Idempotency-Key` (encabezado) | Todos los `POST` que crean dinero, stock o documentos fiscales; ventana de 24 h; mismo cuerpo ⇒ misma respuesta, distinto cuerpo ⇒ `422 IDEMPOTENCY_KEY_REUSED` |
| `ETag` / `If-Match` | Edición de maestros (terceros, ítems): bloqueo optimista con el campo `version`; fallo ⇒ `412` |
| Límite de tasa | Por API Key y por IP en `/public/*`; encabezados `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` y, al excederlo, `429` con `Retry-After` |
| Tamaño | Cuerpo máximo 1 MB (5 MB en importaciones) |
| Correlación | `X-Request-Id` de entrada se respeta o se genera; sale en la respuesta, en logs y en `Problem.requestId` |
| Tiempo máximo | 30 s en la API; lo más lento va a tareas asíncronas con `202` y estado consultable |

### 2.6 Operaciones asíncronas

Emitir una factura devuelve `202` con el documento en estado `ISSUED`/`TRANSMITTING`; el estado final
(`ACCEPTED`, `REJECTED`) llega por **webhook** o consultando el recurso. No se mantiene la conexión abierta
esperando a la DIAN.

## 3. Autenticación y alcances (*scopes*)

| Esquema | Quién | Cómo |
|---|---|---|
| `bearerAuth` | Usuarios del back-office y la app móvil | JWT de vida corta (≈ 15 min) + *refresh token* rotatorio con detección de reutilización |
| `apiKeyAuth` | Integraciones | Encabezado `X-API-Key: sk_live_<prefijo>_<secreto>`; solo se guarda el *hash* (SHA-256) del secreto y el prefijo para identificarla; el secreto se muestra **una vez** |
| `basicAuthApiKey` | Solo la fachada de compatibilidad Alegra | `Authorization: Basic base64(<prefijo>:<secreto>)` |
| `hmacSignature` | Llamadas entre SIFCA y Asia-POP | Ver `05-integracion-asia-pop.md` §4.5 |

Alcances de una API Key (mínimo privilegio; cada llave pertenece a **una empresa**):

| Alcance | Permite |
|---|---|
| `catalog:read` / `catalog:write` | Leer / modificar ítems, categorías, precios |
| `inventory:read` | Leer existencias y kardex |
| `parties:read` / `parties:write` | Terceros |
| `orders:write` | Crear pedidos |
| `invoices:read` / `invoices:write` / `invoices:issue` | Facturas: leer / crear borradores / emitir |
| `receipts:write` / `receivables:read` | Recibos de caja / estados de cuenta |
| `reports:read` | Reportes |
| `webhooks:manage` | Suscripciones de webhooks |
| `compat:alegra:read` | Fachada de compatibilidad |

Además: caducidad opcional, restricción por IP, límite de tasa propio, registro del último uso, y rotación
con solapamiento (dos llaves vigentes durante el cambio).

## 4. Webhooks

### 4.1 Eventos iniciales

| Evento | Cuándo |
|---|---|
| `invoice.issued` | Se asignó número y se emitió localmente |
| `invoice.accepted` | La DIAN aceptó (con o sin notificaciones); ya hay CUFE y PDF |
| `invoice.rejected` | La DIAN rechazó; incluye mensajes |
| `stock.changed` | Cambió el disponible de un ítem (con el valor nuevo) |
| `order.created` | Entró un pedido web |
| `receipt.registered` | Se registró un recibo de caja |

### 4.2 Sobre del evento y entrega

```json
{
  "id": "0192f6d7-0000-7000-8000-000000000001",
  "type": "invoice.accepted",
  "createdAt": "2026-10-13T14:30:07-05:00",
  "companyId": "0192f6d5-1111-7000-9000-aaaaaaaaaaaa",
  "data": { "invoiceId": "0192f6d6-…", "fullNumber": "SETP990000123", "total": "2380000.00" }
}
```

| Aspecto | Regla |
|---|---|
| Garantía | **Al menos una vez**; el receptor deduplica por `id` |
| Orden | No garantizado; los eventos llevan `createdAt` y el recurso se puede consultar para el estado actual |
| Firma | Encabezado `SIFCA-Signature: t=<segundos>,v1=<HMAC-SHA-256 hex de "<t>.<cuerpo>">`; secreto por suscripción; el receptor valida firma y que `t` esté dentro de ±5 min |
| Reintentos | Retroceso exponencial: 1 min, 5 min, 30 min, 2 h, 6 h, 12 h, 24 h; después, el evento queda `FAILED` y la suscripción puede suspenderse automáticamente tras N fallas seguidas |
| Respuesta esperada | `2xx` en menos de 10 s; cualquier otra cosa se reintenta |
| Transporte | Solo HTTPS; se bloquean destinos a redes privadas y *loopback* (mitigación de SSRF) |
| Observabilidad | Registro de cada entrega (estado, duración, intentos) consultable y con opción de **reenviar** manualmente |
| Rotación de secreto | Dos secretos válidos durante la transición |

## 5. Catálogo de endpoints (resumen por módulo)

Detalle y esquemas: ver el OpenAPI. `R` = lectura, `W` = escritura.

| Módulo | Endpoints principales | Alcance típico |
|---|---|---|
| Terceros | `GET/POST /parties`, `GET/PATCH /parties/{id}` | `parties:*` |
| Catálogo | `GET/POST /items`, `GET/PATCH /items/{id}`, `/item-categories`, `/price-lists` | `catalog:*` |
| Inventario | `GET /inventory/stock`, `GET /inventory/movements` (kardex), `POST /inventory/adjustments`, `POST /inventory/transfers` | `inventory:*` |
| Ventas | `POST /sales/quotes`, `POST /sales/orders`, `GET/POST /sales/invoices`, `POST /sales/invoices/{id}/issue`, `GET /sales/invoices/{id}/pdf`, `GET /sales/invoices/{id}/xml`, `POST /sales/invoices/{id}/credit-notes`, `POST /sales/invoices/{id}/debit-notes` | `invoices:*` |
| POS | `POST /pos/sessions`, `POST /pos/sales`, `POST /pos/sessions/{id}/close` | `pos:*` |
| Compras | `GET/POST /purchases/bills`, `POST /purchases/support-documents` | `purchases:*` |
| Cartera | `POST /receivables/receipts`, `GET /receivables/customers/{id}/statement`, `GET /receivables/aging` | `receivables:*` |
| Préstamos | `POST /lending/loans`, `GET /lending/loans/{id}/schedule`, `POST /lending/loans/{id}/payments`, `POST /lending/loans/{id}/prepayments` | `lending:*` |
| Contabilidad | `GET /accounting/accounts`, `POST /accounting/entries`, `POST /accounting/entries/{id}/reverse`, `GET /accounting/periods`, `POST /accounting/periods/{id}/close` | `accounting:*` |
| Reportes | `GET /reports/trial-balance`, `/general-ledger`, `/journal`, `/balance-sheet`, `/income-statement`, `/kardex` | `reports:read` |
| Vitrina | `GET /public/catalog`, `POST /public/orders` | sin auth, con límite de tasa |
| Integraciones | `GET /integrations/catalog-feed/items`, `/integrations/webhook-endpoints`, `/compat/alegra/v1/*` | `catalog:read`, `webhooks:manage`, `compat:alegra:read` |
| Búsqueda global | `GET /search?q=&types=` (alimenta la paleta de comandos) | según tipos pedidos |

## 6. Cómo se escribe un controlador NestJS para que el OpenAPI salga bien

Reglas para el equipo (el código llega en F2; el ejemplo es ilustrativo):

1. **Un DTO por cuerpo de entrada y otro por salida.** No se exponen entidades del ORM ni del dominio.
2. **Validación con `class-validator`** en los DTO de entrada y `ValidationPipe` global con
   `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`: los campos desconocidos se rechazan.
3. **Decoradores obligatorios:** `@ApiTags`, `@ApiOperation({ operationId })`, `@ApiProperty` con `description`
   y `example` en cada campo de DTO, y una respuesta tipada por cada código posible
   (`@ApiOkResponse`, `@ApiCreatedResponse`, `@ApiConflictResponse`…), incluida la de error `Problem`.
4. **Seguridad declarada:** `@ApiBearerAuth()` / `@ApiSecurity('api-key')`, y el alcance requerido con un
   decorador propio `@RequiredScopes('invoices:issue')` que además alimenta una extensión `x-required-scopes`
   en el OpenAPI (como en el borrador).
5. **Montos como cadena:** un decorador `@MoneyString()` que valida el patrón decimal y documenta el esquema
   `Money`; un *transformer* convierte entre `string` y `Decimal` en el borde del controlador.
6. **Plugin de CLI de `@nestjs/swagger`** para inferir propiedades de los DTO y reducir ruido.
7. **Documentación de la API:** Swagger UI y `openapi.json` solo en entornos de desarrollo/pruebas o tras
   autenticación; en producción se publica el `openapi.json` en el portal de desarrolladores.

```ts
// Ilustrativo (no es código de la aplicación)
@ApiTags('Sales')
@Controller('sales/invoices')
export class InvoicesController {
  @Post(':invoiceId/issue')
  @HttpCode(202)
  @RequiredScopes('invoices:issue')
  @ApiOperation({ operationId: 'sales_invoices_issue', summary: 'Emite la factura' })
  @ApiAcceptedResponse({ type: InvoiceDto })
  @ApiConflictResponse({ type: ProblemDto })
  issue(@Param('invoiceId', ParseUUIDPipe) id: string, @Headers('idempotency-key') key?: string) { /* … */ }
}
```

## 7. Pruebas del contrato

| Prueba | Qué garantiza |
|---|---|
| Instantánea del OpenAPI | Ningún cambio de API pasa sin revisión |
| *Diff* de cambios incompatibles | Los clientes existentes no se rompen |
| Pruebas de esquema en integración | Las respuestas reales cumplen el esquema declarado (validador en las pruebas de integración) |
| Contrato con Asia-POP | Mismo esquema validado de ambos lados (`asia-pop-render.v1.draft.yaml`) |
| Contrato de la fachada Alegra | Pasa la suite del servidor simulado de Asia-POP |
| Seguridad | Cada endpoint exige el alcance declarado; ninguna ruta de `/public/*` devuelve campos internos (prueba de «lista blanca» de campos) |
