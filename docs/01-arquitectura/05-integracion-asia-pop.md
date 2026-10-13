# Integración con Asia-POP (motor de plantillas y PDF)

Estado: **borrador de Fase 1** · Repositorio: <https://github.com/JpMurcia/Asia-POP> (revisado en su rama
principal el 13-oct-2026, solo lectura; **este repositorio no se modificó**).

## 1. Qué es Asia-POP hoy (hechos leídos en su código)

| Tema | Hecho | Dónde se verificó |
|---|---|---|
| Qué hace | Genera un **catálogo PDF** (A4, máximo 3 productos por página) a partir de productos de Alegra y productos propios | `README.md` |
| Stack | Node.js 22 + **Express** + **SQLite** (servidor); React + Tailwind (interfaz); **Puppeteer** imprime la misma vista que se ve en pantalla | `README.md`, `package.json` |
| Despliegue | Aplicación **local**: escucha solo en `127.0.0.1`; usuario `admin` semilla; sesión por cookie | `README.md`, `backend/src/auth/*` |
| Fuente de datos | `AlegraClient` de **solo lectura** (Basic auth); base configurable con `ALEGRA_BASE_URL`; token guardado cifrado desde una pantalla de la propia app | `backend/src/alegra/alegra.client.ts`, `docs/Alegra integracion.md` |
| Endpoints de Alegra usados | `GET /company`, `GET /item-categories`, `GET /items?status=active&mode=advanced&start&limit=30` | `alegra.client.ts` |
| Modelo normalizado | `NormalizedItem { id, name, description, price, imageUrls[], soldOut, categoryId, categoryName, type }` | `backend/src/alegra/alegra.mapper.ts` |
| Plantillas | Documento JSON por plantilla: **4 páginas fijas** (`portada`, `seccion`, `productos`, `politicas`), paleta de 6 colores, par tipográfico, elementos (texto, insignia, forma, imagen) y **bloques automáticos** (`intro`, `products`, `terms`, `footer`); editor visual con deshacer/rehacer y atajos | `backend/src/catalog/template.ts`, `frontend/src/pages/TemplateEditor/*` |
| Flujo de generación | `POST /catalog/prepare` → revisión → `POST /catalog/generate` (202) → trabajo asíncrono → PDF en disco (los 10 últimos) | `backend/src/api/catalog.routes.ts` |
| Vista de impresión | El navegador sin interfaz lee `GET /catalog/payload/:prepareId` (JSON `CatalogPayload`) y renderiza con el **mismo componente** que la vista previa | `catalog.routes.ts`, `frontend/src/print/*` |
| Imágenes | Descarga con tope, reconoce por bytes, caché local y versión «Optimizada» para PDFs livianos | `backend/src/pdf/*` |
| Principios (constitución) | I: Alegra es la fuente de verdad **y solo de lectura**; III: credenciales cifradas y **todas las rutas exigen sesión**; escucha solo en `localhost`; IV: fidelidad visual | `.specify/memory/constitution.md` |
| Proceso | Spec Kit (`specs/001…006`), pruebas con Vitest, `docs/` con diseño | `README.md`, `.specify/` |

### Conclusión del diagnóstico

Asia-POP es **una aplicación de un solo propósito (catálogo), de un solo inquilino, con sesión de navegador y
confinada a localhost**. Eso condiciona la integración:

- ✅ Lo reutilizable tal cual: el motor de renderizado HTML→PDF con Puppeteer, el editor visual de plantillas,
  la gestión de tipografías locales, la optimización de imágenes, el patrón «misma vista = vista previa = PDF».
- ⚠️ Lo que **no** sirve como servicio sin cambios: la autenticación por sesión, el confinamiento a
  localhost, las 4 páginas fijas orientadas a catálogo, el almacenamiento de SQLite de una sola tienda y el
  flujo `prepare/generate` acoplado a Alegra.

## 2. Tres niveles de integración

| Nivel | Qué ofrece | Cambios en Asia-POP | Cuándo |
|---|---|---|---|
| **0 — Fachada Alegra** | Asia-POP sigue generando el catálogo leyendo de SIFCA como si fuera Alegra | **Ninguno de código**: `ALEGRA_BASE_URL` apunta a `/compat/alegra/v1` de SIFCA y el «token» es una API Key (ver `02-…/06-…` §5) | F3 (rápido, valida el camino) |
| **1 — Catálogo nativo** | Fuente de datos propia de SIFCA con más información (variantes, listas de precio, disponible por bodega, publicación en vitrina) | Un segundo adaptador de fuente junto a `AlegraClient` (AP-CR-01) | F6 |
| **2 — Documentos transaccionales** | Facturas, cotizaciones, recibos, estados de cuenta y catálogos como PDF bajo demanda, con **plantillas por tipo de documento** | Capacidad nueva de «renderizar documento» (AP-CR-02…10) | F3 (factura/cotización) y F4 |

Los niveles 0 y 1 son **extracción de datos hacia Asia-POP** (catálogos). El nivel 2 es **SIFCA enviando
datos a Asia-POP para que los convierta en documento**, que es el más exigente y el que cambia la naturaleza
de Asia-POP.

## 3. Cambios requeridos en Asia-POP (solicitudes de cambio `AP-CR`)

Estas solicitudes se proponen al dueño de Asia-POP; **no se aplicaron**. Cada una debería abrirse como una
*feature* en su propio flujo Spec Kit (`specs/007-…`).

| ID | Cambio | Motivo | Nivel |
|---|---|---|---|
| AP-CR-01 | Fuente de datos abstracta: extraer una interfaz de «proveedor de catálogo» (`CatalogSource`) y añadir `SifcaSource` | Hoy solo existe `AlegraClient` | 1 |
| AP-CR-02 | **Autenticación de servicio** además de la de sesión: credencial de máquina con firma HMAC (o API Key + mTLS) para rutas `/v1/render/*` | La constitución (III) exige sesión en todas las rutas; un llamador máquina-a-máquina no puede iniciar sesión | 2 |
| AP-CR-03 | **Escuchar en una interfaz de red interna** configurable (no solo `127.0.0.1`), con lista de IP permitidas | SIFCA llama por red | 2 |
| AP-CR-04 | Endpoint **sin estado** `POST /v1/render/documents`: recibe el documento y la referencia de plantilla, devuelve PDF (o un trabajo) sin tocar Alegra | El flujo `prepare/generate` está acoplado al catálogo | 2 |
| AP-CR-05 | **Multi-inquilino de plantillas**: espacio de nombres por `tenantId` (plantillas, logos, tipografías, datos del negocio) o una instancia por empresa | Hoy hay una sola tienda; ver Q-03 | 2 |
| AP-CR-06 | **Nuevos tipos de página/documento** en el modelo de plantillas: `factura`, `cotizacion`, `recibo`, `estado_cuenta` con bloques automáticos nuevos (§5) | Hoy las páginas son `portada/seccion/productos/politicas` | 2 |
| AP-CR-07 | **Bloques de tabla repetitiva** (líneas) con paginación automática y cabecera repetida, **bloque de totales** y **bloque de código QR** | No existen; son indispensables para facturas | 2 |
| AP-CR-08 | **Versionado de plantillas**: cada render declara `templateId` + `templateVersion`; plantillas publicadas son inmutables | Reproducibilidad (§6) | 2 |
| AP-CR-09 | Respuesta con **metadatos**: número de páginas, tamaño, hash SHA-256, versión de plantilla y de motor | Auditoría y caché en SIFCA | 2 |
| AP-CR-10 | **Límites y aislamiento**: cola con concurrencia máxima, tiempo máximo por render, tope de tamaño del cuerpo, `--no-sandbox` solo bajo contenedor sin privilegios | Seguridad y estabilidad con Puppeteer | 2 |
| AP-CR-11 | Enmienda de la constitución: I («Alegra es la única fuente de verdad») pasa a «el sistema de origen es de solo lectura»; III añade el principio de credenciales de servicio | Mantener la gobernanza de Asia-POP coherente | 0–2 |
| AP-CR-12 | Pruebas de contrato con los esquemas de §4 | Evitar rupturas silenciosas | 2 |

> **Alternativa si Asia-POP no puede evolucionar al ritmo de SIFCA:** renderizar los PDF de documentos
> transaccionales dentro de SIFCA (un módulo `documents` con Puppeteer propio) y dejar a Asia-POP **solo**
> para catálogos. El diseño del puerto `DocumentRenderer` (§4.1) permite elegir sin tocar el resto del
> sistema. La decisión se toma con el spike S-PDF (§9).

## 4. Contrato SIFCA ↔ Asia-POP (nivel 2)

### 4.1 Puerto en SIFCA

El módulo `documents` expone el puerto `DocumentRenderer`:

| Operación | Entrada | Salida |
|---|---|---|
| `render(request)` | Tipo de documento, referencia de plantilla, datos canónicos, opciones | `RenderResult` (PDF + metadatos) o error tipificado |
| `renderAsync(request)` | Lo mismo | `jobId`; el resultado llega por sondeo o devolución de llamada |
| `listTemplates(type)` | Tipo de documento | Plantillas disponibles y su versión publicada |
| `health()` | — | Estado y versión del motor |

Adaptadores previstos: `AsiaPopRenderer` (HTTP) y, de reserva, `LocalPuppeteerRenderer`.

### 4.2 API que expone Asia-POP (propuesta)

Definida formalmente en [`openapi/asia-pop-render.v1.draft.yaml`](openapi/asia-pop-render.v1.draft.yaml).

| Método y ruta | Descripción |
|---|---|
| `POST /v1/render/documents` | Renderiza un documento de forma **síncrona** (hasta un tiempo máximo) y devuelve `application/pdf` con metadatos en encabezados; si excede el tiempo, responde `202` con `jobId` |
| `POST /v1/render/jobs` | Encola un render y devuelve `202 { jobId }` |
| `GET /v1/render/jobs/{jobId}` | Estado (`queued`, `running`, `succeeded`, `failed`) y, si terminó, URL de descarga de corta vida |
| `GET /v1/templates?documentType=` | Plantillas por tipo, con versión publicada |
| `GET /v1/health` | Salud y versión |

### 4.3 Solicitud de render

```jsonc
{
  "requestId": "0192f6d6-6c5e-7b9a-bd23-8a1f6b0e9c11",   // idempotencia: mismo id ⇒ mismo resultado
  "tenantId": "0192f6d5-1111-7000-9000-aaaaaaaaaaaa",
  "documentType": "invoice",                               // invoice | credit_note | debit_note | quote | receipt | account_statement | catalog
  "template": { "id": "factura-clasica", "version": 3 },   // versión exacta (AP-CR-08)
  "locale": "es-CO",
  "options": { "pageSize": "A4", "imageQuality": "optimized" },
  "data": { /* DTO canónico del documento, ver §5 */ }
}
```

### 4.4 Respuesta

- `200 OK`, `Content-Type: application/pdf`, cuerpo = PDF, y encabezados:
  `X-Render-Request-Id`, `X-Render-Pages`, `X-Render-Sha256`, `X-Render-Template: factura-clasica@3`,
  `X-Render-Engine: <versión>`.
- Errores en formato `application/problem+json` (RFC 9457): `422` datos que no cumplen el esquema,
  `404` plantilla inexistente, `409` versión de plantilla no publicada, `413` solicitud demasiado grande,
  `429` límite de tasa, `503` motor saturado (con `Retry-After`).

### 4.5 Seguridad del canal

| Control | Detalle |
|---|---|
| Red | Asia-POP **no se publica a internet**; solo accesible desde la red interna de SIFCA (AP-CR-03) |
| Autenticación | Firma HMAC-SHA-256 sobre `método + ruta + marca de tiempo + hash del cuerpo`, con secreto por entorno; ventana de 5 minutos contra repetición. Alternativa: mTLS |
| Datos | Solo viajan los datos necesarios para dibujar el documento; **no** se envían claves, tokens ni costos internos |
| Aislamiento | `tenantId` obligatorio en cada solicitud; Asia-POP rechaza plantillas/imágenes de otro inquilino |
| Entradas no confiables | Todo texto (nombres, descripciones) se escapa; las imágenes solo se aceptan por URL firmada de SIFCA o como datos `data:` con tope de tamaño; el HTML no se construye por concatenación |
| Registro | Se registran `requestId`, `tenantId`, plantilla, duración y resultado; **nunca** el cuerpo completo |

## 5. DTO canónico de documento

SIFCA entrega datos **ya calculados**: Asia-POP no suma, no redondea ni calcula impuestos (separación de
responsabilidades: R-CON-009). Los importes viajan como **cadenas decimales** (`"1190000.00"`).

```jsonc
{
  "issuer": {
    "legalName": "ASIANPOP MARKET+ S.A.S.", "tradeName": "AsianPop Market+",
    "nit": "900123456", "dv": "7",
    "address": "Cra 10 # 18-15 centro", "city": "Florencia", "department": "Caquetá",
    "phones": ["310 669 0585"], "email": "ventas@example.com",
    "fiscalResponsibilities": ["O-13", "O-15"],
    "logo": { "ref": "https://files.internal/logo.png?sig=…" }
  },
  "customer": {
    "legalName": "Cliente Ejemplo S.A.S.", "idType": "NIT", "idNumber": "901234567", "dv": "7",
    "address": "Calle 1 # 2-3", "city": "Bogotá", "email": "compras@example.com"
  },
  "document": {
    "kind": "invoice", "prefix": "SETP", "number": "990000123", "fullNumber": "SETP990000123",
    "issuedAt": "2026-10-13T14:30:00-05:00", "dueDate": "2026-11-12",
    "paymentForm": "CREDITO", "paymentMethod": "Transferencia", "currency": "COP",
    "notes": "Gracias por su compra"
  },
  "lines": [
    { "lineNo": 1, "code": "RAM-001", "description": "Ramen picante x5", "unit": "Und",
      "quantity": "20.0000", "unitPrice": "100000.00", "discount": "0.00",
      "taxes": [ { "name": "IVA", "ratePercent": "19.00", "amount": "380000.00" } ],
      "lineTotal": "2000000.00" }
  ],
  "totals": {
    "subtotal": "2000000.00", "discounts": "0.00",
    "taxes": [ { "name": "IVA 19%", "base": "2000000.00", "amount": "380000.00" } ],
    "withholdings": [ ],                              // solo si el emisor retiene (p. ej. documento soporte); en una factura de venta las retenciones sufridas NO se imprimen
    "total": "2380000.00", "payable": "2380000.00",
    "amountInWords": "DOS MILLONES TRESCIENTOS TREINTA MIL PESOS M/CTE"
  },
  "fiscal": {                                         // obligatorio solo en documentos electrónicos DIAN
    "cufe": "…96 hex…", "qrData": "…contenido del QR…", "qrUrl": "https://…",
    "validatedAt": "2026-10-13T14:30:07-05:00",
    "numbering": { "resolution": "18760000001", "resolutionDate": "2019-01-19",
                   "prefix": "SETP", "from": "990000000", "to": "995000000", "validUntil": "2027-01-19" },
    "softwareProvider": "Proveedor tecnológico (NIT …)"
  },
  "extras": { }                                       // campos adicionales por tipo de documento
}
```

(Los valores de resolución, NIT y CUFE son ficticios.)

### Bloques automáticos nuevos que Asia-POP debe ofrecer (AP-CR-06/07)

| Bloque | Contenido | ¿Se puede quitar? |
|---|---|---|
| `issuer` | Datos y logo del emisor | No |
| `customer` | Datos del adquirente | No |
| `lines-table` | Tabla de líneas con columnas configurables y paginación con cabecera repetida | No |
| `totals` | Subtotal, descuentos, impuestos, retenciones, total, valor en letras | No |
| `fiscal-footer` | CUFE, resolución de numeración, proveedor tecnológico | No (en documentos DIAN) |
| `qr` | Código QR | No (en documentos DIAN) |
| `payment-info` | Forma y medio de pago, vencimiento | Sí |
| `notes` | Observaciones | Sí |

Los bloques marcados «No» garantizan que **ninguna plantilla pueda omitir información legalmente
exigible** (R-FE-007); la plantilla solo cambia colores, tipografías, posiciones y estilo.

## 6. Reproducibilidad y almacenamiento del PDF

- La factura electrónica **legal** es el XML firmado; el PDF es su representación gráfica (R-FE-007).
- SIFCA llama a Asia-POP **una sola vez** por documento aceptado, guarda el PDF en su almacenamiento y su
  hash SHA-256, y a partir de ahí **sirve esa copia**: nunca regenera una factura ya emitida (la plantilla
  podría haber cambiado).
- Documentos no fiscales (cotizaciones, estados de cuenta) pueden regenerarse; se cachean por clave
  `(documentId, templateId@version, hash de datos)`.
- Para reproducir un PDF antiguo, Asia-POP debe conservar versiones publicadas de plantillas (AP-CR-08).

## 7. Catálogos (niveles 0 y 1)

### Nivel 0 (sin cambios en Asia-POP)
Ver `02-normativa-y-reglas/06-referencia-api-alegra.md` §5. Verificación recomendada antes de F3: levantar
la fachada de SIFCA en un entorno de pruebas y ejecutar contra ella la suite que Asia-POP ya tiene con su
servidor simulado de Alegra.

### Nivel 1 (fuente nativa)
Feed `GET /integrations/catalog-feed/items` (propuesto en el OpenAPI de SIFCA) que entrega, por ítem:
identificador, nombre, descripción, categoría, **precio con IVA incluido/excluido explícito**, imágenes con
URL firmada, `soldOut` y cantidad disponible, tipo y componentes de kits, y `publishedInStorefront`. Asia-POP
lo adapta a su `NormalizedItem` (AP-CR-01). **Los catálogos PDF no deben incluir costos ni datos internos.**

## 8. Operación

| Tema | Decisión propuesta |
|---|---|
| Despliegue | Contenedor Docker de Asia-POP con Chromium, **sin estado crítico** salvo plantillas y activos (volumen persistente). SIFCA y Asia-POP en la misma red interna |
| Multi-inquilino | Instancia compartida con `tenantId` (AP-CR-05) cuando Q-03 se resuelva así; hasta entonces, una instancia por empresa para el piloto |
| Concurrencia | Navegador reutilizado, máximo N páginas simultáneas; el resto en cola con límite y *backpressure* (`503` + `Retry-After`) |
| Tiempo máximo | 30 s para facturas; 120 s para catálogos grandes (siempre por trabajo asíncrono) |
| Fallo de Asia-POP | El worker de SIFCA reintenta con *backoff*; el documento fiscal ya está **aceptado**, solo su PDF queda pendiente, y la UI lo muestra como «PDF en preparación» |
| Observabilidad | `requestId` común en ambos sistemas; métricas de duración y de cola |

## 9. Spikes y pruebas

| Spike / prueba | Criterio de aceptación |
|---|---|
| **S-PDF (1–2 días)** | Con una plantilla de factura hecha a mano (HTML + CSS de impresión) renderizar con Puppeteer: 1 factura de 3 líneas y 1 de 120 líneas (paginación, cabecera repetida, totales solo en la última página, QR legible) en < 3 s; tabla correcta con caracteres en español |
| **S-CATALOG** | La fachada de SIFCA pasa la suite de Asia-POP con el mock de Alegra |
| Contrato | Los esquemas de `openapi/asia-pop-render.v1.draft.yaml` se validan en ambos lados (SIFCA genera, Asia-POP valida) |
| Carga | 20 renders concurrentes sin errores ni fugas de memoria durante 10 minutos |
| Seguridad | Solicitud con firma vencida, cuerpo alterado o `tenantId` ajeno ⇒ rechazada |
| Fidelidad | La vista previa del editor y el PDF son visualmente idénticos (principio IV de Asia-POP) |

## 10. Riesgos

| ID | Riesgo | Mitigación |
|---|---|---|
| R-AP-01 | Asia-POP es de un solo propósito y de un solo inquilino; el nivel 2 es una evolución mayor | Empezar por el nivel 0; spike S-PDF; alternativa de renderizar dentro de SIFCA |
| R-AP-02 | Acoplar el calendario de SIFCA al de otro repositorio | Contrato versionado (`/v1`), pruebas de contrato y puerto `DocumentRenderer` con adaptador de reserva |
| R-AP-03 | Puppeteer como componente crítico del flujo fiscal | PDF fuera de la transacción fiscal; el documento queda aceptado aunque el PDF tarde |
| R-AP-04 | Datos personales de clientes viajan a otro servicio | Red interna, minimización (§4.5), sin persistencia del cuerpo en Asia-POP |
| R-AP-05 | Plantillas que omiten información obligatoria | Bloques automáticos no eliminables (§5) |
