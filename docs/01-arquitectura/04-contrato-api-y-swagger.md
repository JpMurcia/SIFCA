# Contrato de API y Swagger/OpenAPI

Estado: **Fase 1 (actualizada)** · Contrato de diseño (validado sintácticamente como OpenAPI 3.1):
[`openapi/sifca.v1.draft.yaml`](openapi/sifca.v1.draft.yaml) · Gobernanza: constitución, principios V y IX.

> **Integración externa (decisión vigente):** SIFCA expone **contratos OpenAPI limpios y webhooks estándar**;
> cualquier motor externo (por ejemplo Asia-POP, fase futura/experimental) los **consume**. SIFCA nunca invoca
> a esos motores en su camino crítico (ADR-0008).

## 1. Enfoque: Zod primero, contrato derivado y versionado

| Decisión | Detalle |
|---|---|
| **Zod es la fuente de verdad** (ADR-0009) | Los esquemas de `packages/contracts` definen entradas, salidas, errores, eventos y webhooks. **No** se usa `class-validator` ni DTO con decoradores de validación |
| El OpenAPI se **deriva** de los esquemas | Con la conversión nativa de Zod 4 (`z.toJSONSchema`) o una librería que la use (decisión en el spike S-ZOD); `@nestjs/swagger` solo se mantiene si hace falta para servir Swagger UI |
| Se **versiona una instantánea** | En cada cambio, el CI exporta `openapi.json` a `docs/01-arquitectura/openapi/generated/` y falla si difiere de la confirmada: ningún cambio de API pasa sin verse en el *diff* |
| Se **comprueban cambios incompatibles** | El CI compara contra la versión publicada anterior con una herramienta de *diff* de OpenAPI (p. ej. `oasdiff`) y bloquea cambios que rompen clientes sin subir la versión mayor |
| Se **lintea** el contrato | Reglas de estilo con Spectral: `operationId` único, descripciones, ejemplos, esquemas de error |
| El **cliente** reutiliza los esquemas | `packages/api-client` usa los tipos inferidos de `contracts`; el frontend valida formularios con los mismos esquemas |
| El borrador de esta carpeta | Es **referencia de diseño**; en F2 se contrasta con el derivado para detectar derivas |

> **Limitación conocida de Zod → JSON Schema:** los refinamientos, transformaciones y mensajes personalizados
> no se reflejan en el esquema generado ✅ ([zod.dev](https://zod.dev/json-schema)). Las reglas entre campos
> (p. ej. `dueDate ≥ issueDate`) se describen también en la `description` del esquema para que el OpenAPI
> las documente.

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
| **Dinero, cantidades, porcentajes** | **Cadenas decimales** (`"1190000.00"`, `"19.00"`); nunca `number`. Evita la pérdida de precisión de `float` y las sorpresas de redondeo entre sistemas (R-CON-009). Se validan con Zod (patrón y escala) |
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
  `NUMBERING_RANGE_EXPIRED`, `PERIOD_CLOSED`, `DOCUMENT_NOT_EDITABLE`, `ENTRY_NOT_BALANCED`, `DIAN_REJECTED`,
  `IDEMPOTENCY_KEY_REUSED`, `RATE_LIMITED`; crédito: `CREDIT_LIMIT_EXCEEDED`, `CUSTOMER_BLOCKED_OVERDUE`,
  `CREDIT_NOT_ALLOWED`; inventario: `COSTING_METHOD_NOT_ALLOWED`, `COSTING_METHOD_LOCKED`; devoluciones:
  `RETURN_EXCEEDS_SOLD`, `RETURN_WINDOW_EXPIRED`. Se mantienen en un catálogo único
  (`docs/…/errores.md`, a crear en F2) y se declaran como esquemas Zod.
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
| `credit:read` / `credit:release` | Consultar estado de crédito y cupo / liberar documentos retenidos |
| `documents:read` / `documents:write` | Leer datos de render de un documento / devolver un PDF generado por un motor externo |

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
| `return.received` | Se emitió una nota crédito con reingreso al kardex (incluye condición de cada línea) |
| `credit.limit.warning` / `credit.limit.exceeded` | La exposición de un cliente alcanza 80 % del cupo / lo supera |
| `credit.hold.created` / `credit.hold.released` | Un documento queda retenido por crédito / se libera |
| `receivable.overdue` | Una factura entra en mora o cambia de rango de edad |
| `inventory.reorder.required` | La posición de inventario de un ítem cruza su punto de reorden |
| `inventory.abc.reclassified` | Cambia la clase ABC de un ítem |

### 4.2 Sobre del evento y entrega

```json
{
  "id": "0192f6d7-0000-7000-8000-000000000001",
  "type": "invoice.accepted",
  "createdAt": "2026-10-13T14:30:07-05:00",
  "tenantId": "0192f6d5-1111-7000-9000-aaaaaaaaaaaa",
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
| Inventario | `GET /inventory/stock`, `GET /inventory/movements` (kardex), `POST /inventory/adjustments`, `POST /inventory/transfers`, `GET /inventory/items/{id}/costing` (capas o promedio), `GET /inventory/abc`, `POST /inventory/abc/recalculate`, `GET /inventory/reorder` (ROP, posición y sugerido), `GET/POST /inventory/cycle-counts` | `inventory:*` |
| Ventas | `POST /sales/quotes`, `POST /sales/orders`, `POST /sales/orders/{id}/confirm`, `POST /sales/orders/{id}/credit-release`, `GET/POST /sales/invoices`, `POST /sales/invoices/{id}/issue`, `GET /sales/invoices/{id}/pdf`, `GET /sales/invoices/{id}/xml`, `GET /sales/invoices/{id}/render-data`, `PUT /sales/invoices/{id}/rendered-documents/{kind}`, `POST /sales/invoices/{id}/credit-notes` (devolución total o parcial con reingreso a kardex), `POST /sales/invoices/{id}/debit-notes` | `invoices:*`, `credit:release`, `documents:*` |
| POS | `POST /pos/sessions`, `POST /pos/sales`, `POST /pos/sessions/{id}/close` | `pos:*` |
| Compras | `GET/POST /purchases/bills`, `POST /purchases/support-documents`, `POST /purchases/bills/{id}/returns` (devolución a proveedor) | `purchases:*` |
| Cartera y crédito | `POST /receivables/receipts`, `POST /receivables/receipts/{id}/reverse`, `GET /receivables/customers/{id}/statement`, `GET /receivables/customers/{id}/credit` (cupo, exposición, estado), `PUT /parties/{id}/credit-terms` (cupo y plazo), `GET /receivables/aging`, `GET /receivables/credit-holds`, `POST /receivables/collection-actions` | `receivables:*`, `credit:*` |
| Contabilidad | `GET /accounting/accounts`, `POST /accounting/entries`, `POST /accounting/entries/{id}/reverse`, `GET /accounting/periods`, `POST /accounting/periods/{id}/close` | `accounting:*` |
| Reportes | `GET /reports/trial-balance`, `/general-ledger`, `/journal`, `/balance-sheet`, `/income-statement`, `/kardex` | `reports:read` |
| Vitrina | `GET /public/catalog`, `POST /public/orders` | sin auth, con límite de tasa |
| Integraciones | `GET /integrations/catalog-feed/items`, `/integrations/webhook-endpoints` | `catalog:read`, `webhooks:manage` |
| Búsqueda global | `GET /search?q=&types=` (alimenta la paleta de comandos) | según tipos pedidos |

## 6. Cómo se escribe un endpoint (Presentation) con Zod

Reglas para el equipo (el código llega en F2; el ejemplo es ilustrativo):

1. **Los esquemas viven en `packages/contracts`**, uno por cuerpo de entrada, salida y error; los tipos se
   infieren con `z.infer`. No se crean clases DTO con decoradores de validación.
2. **El controlador no valida ni contiene reglas:** extrae el cuerpo/parámetros crudos, llama al caso de uso y
   devuelve su resultado. La validación ocurre al inicio de `execute` del caso de uso (principio V).
3. **Objetos estrictos:** los esquemas de entrada usan `strict()`: los campos desconocidos se rechazan.
4. **Importes como cadena decimal:** helpers `nonNegativeMoney`, `positiveQuantity`, etc.; la conversión a
   `Money`/`Quantity` ocurre en Application.
5. **Seguridad declarada:** el esquema de seguridad y el alcance requerido (`x-required-scopes`) se declaran
   junto al endpoint y alimentan el OpenAPI; un *guard* de Presentation los hace cumplir.
6. **Errores:** un filtro de excepciones traduce `ZodError` a `422 Problem` (`VALIDATION_FAILED`) y los errores
   de negocio tipificados a su `Problem` con `code` estable.
7. **Documentación:** Swagger UI y `openapi.json` solo en desarrollo/pruebas o tras autenticación; en
   producción se publica el `openapi.json` en el portal de desarrolladores.

```ts
// Ilustrativo (no es código de la aplicación)
// packages/contracts: la ÚNICA definición del contrato
export const IssueInvoiceInput = z.object({
  invoiceId: uuidV7,
  idempotencyKey: z.string().min(8).max(128).optional(),
}).strict();

// application/use-cases/issue-invoice.ts: valida en el borde del caso de uso
export class IssueInvoice {
  async execute(raw: unknown) {
    const input = IssueInvoiceInput.parse(raw);        // nada inválido pasa de aquí
    return this.uow.run(async () => { /* crédito, consecutivo, inventario, cartera, asiento, outbox */ });
  }
}

// presentation/http/invoices.controller.ts: solo traduce
@Post(':invoiceId/issue') @HttpCode(202) @RequiredScopes('invoices:issue')
issue(@Param('invoiceId') invoiceId: string, @Headers('idempotency-key') key?: string) {
  return this.issueInvoice.execute({ invoiceId, idempotencyKey: key });
}
```

## 7. Pruebas del contrato

| Prueba | Qué garantiza |
|---|---|
| Instantánea del OpenAPI | Ningún cambio de API pasa sin revisión |
| *Diff* de cambios incompatibles | Los clientes existentes no se rompen |
| Pruebas de esquema en integración | Las respuestas reales cumplen el esquema declarado (validador en las pruebas de integración) |
| Contrato con un consumidor externo | Los esquemas de `contracts` publicados se validan contra respuestas reales en pruebas de integración |
| Seguridad | Cada endpoint exige el alcance declarado; ninguna ruta de `/public/*` devuelve campos internos (prueba de «lista blanca» de campos) |
