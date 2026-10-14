# Referencia de la API de Alegra y compatibilidad funcional

## 0. Cómo se obtuvo esta información (leer primero)

`developer.alegra.com` **no fue accesible** desde el entorno donde se redactó este documento, así que no se
leyó la documentación oficial. Las fuentes, de mayor a menor confianza:

| Fuente | Qué aporta | Confianza |
|---|---|---|
| **Proyecto Asia-POP** (`docs/Alegra integracion.md` y `backend/src/alegra/*`), cuyo autor verificó contra una cuenta real de Alegra (4-oct-2026, solo lectura) | Autenticación, paginación, forma de `company`, `item-categories` e `items` (incluidas las fotos), errores | ✅ para lo verificado allí (se cita) |
| Resúmenes de terceros (envoltorios y descripciones OpenAPI no oficiales de Alegra) | Lista de recursos disponibles | ⚠️ |
| Conocimiento general del autor | Forma aproximada de facturas, contactos y pagos | 🔶 |

> **Tarea previa a F3:** descargar la documentación OpenAPI/Postman oficial de Alegra a
> `docs/02-normativa-y-reglas/referencias/alegra/`, reemplazar las filas 🔶 de este documento por datos ✅ y
> versionar el cambio. No se debe construir la fachada opcional de compatibilidad (§5) sin ese paso.

## 1. Para qué sirve esta referencia

1. **Compatibilidad funcional:** SIFCA debe ofrecer lo que un usuario de Alegra espera (contactos, ítems,
   facturas, pagos, listas de precios), con vocabulario reconocible.
2. **Compatibilidad técnica con herramientas ya construidas** (opcional y fuera del núcleo, §5): Asia-POP hoy
   lee de Alegra.
3. **Migración de datos:** importar desde Alegra a SIFCA (contactos, ítems, saldos iniciales) sin escribir en
   Alegra.

SIFCA **no es un clon de Alegra**: su API nativa es propia (ver `01-arquitectura/04-…`).

## 2. Hechos verificados (✅, de Asia-POP)

| Tema | Detalle |
|---|---|
| Base URL | `https://api.alegra.com/api/v1` |
| Autenticación | HTTP Basic: `Authorization: Basic base64(correo:token)` |
| Paginación | `start` (desplazamiento) y `limit`; **máximo 30**; superarlo da `400`. Se termina cuando una página trae menos de `limit` elementos |
| Validar credenciales | `GET /company` (respuesta `200` si son válidas) |
| Errores | `401`/`403` credenciales rechazadas · `429` límite de tasa (con `Retry-After`) |
| Categorías | `GET /item-categories` → `{ id, name, status, parent: { id } \| null }` |
| Ítems | `GET /items?status=active&mode=advanced&start=0&limit=30` |
| `mode=simple` | **Omite `images`**. Con `advanced` (o sin `mode`) las fotos vienen |
| Identificadores | Se tratan como **texto opaco** (el formato de ID cambió en Alegra); pueden llegar como número o cadena |
| Campos de un ítem | `id`, `name`, `description`, `status`, `type` (`simple` · `kit` · `variantParent` · `variant`), `category { id, name }`, `price`, `images`, `inventory`, `trackInventory` |
| `price` | Puede ser un **número** o una **lista** `[ { idPriceList, price, name } ]` (se prefiere la lista con `idPriceList = 1`) |
| `inventory` | `{ quantity, availableQuantity, trackInventory }` |
| Fotos | `images: [ { id, name, url, favorite } ]`; **la principal es la `favorite: true`** (no existe `isPrimary`) y no tiene por qué ser la primera; hasta 3 por ítem |
| URL de la foto | `https` del CDN de Alegra, **firmada** (`Expires`, `Signature`, `Key-Pair-Id`), vigencia ≈ 7 días; responde `200` con `Content-Type: binary/octet-stream` aunque sea JPG/PNG: la imagen se reconoce por sus bytes |
| Escritura | `POST`/`DELETE` en `/items/{id}/attachment` suben/eliminan adjuntos (escriben en Alegra) |
| Stock agotado | `soldOut` si controla inventario y la cantidad disponible es `≤ 0`; si no controla inventario, está disponible |

## 3. Recursos de Alegra y su correspondencia en SIFCA

| Recurso Alegra (ruta) | Qué es | Confianza de la ruta | Equivalente en SIFCA | Observaciones |
|---|---|---|---|---|
| `/company` | Datos de la empresa | ✅ | `core.tenant` | Solo validación de credenciales |
| `/contacts` | Terceros (clientes y proveedores en una sola entidad con *tipo*) | ⚠️ | `parties.party` (`kind`) | Alegra usa un único recurso con tipos; SIFCA igual (`kind` admite varios) |
| `/items` | Productos y servicios | ✅ | `catalog.item` | Tipos `simple/kit/variantParent/variant` ⇒ R-INV-012 |
| `/item-categories` | Categorías de ítems | ✅ | `catalog.item_category` | Árbol (campo `parent`) |
| `/price-lists` | Listas de precios | ⚠️ | `catalog.price_list` | `price` de un ítem puede ser una lista (ver §2) |
| `/taxes` | Impuestos | ⚠️ | `tax.tax` + `tax.tax_rate` | En SIFCA las tarifas tienen vigencia |
| `/retentions` | Retenciones | ⚠️ | `tax.tax` (`kind = WITHHOLDING`) | — |
| `/warehouses` | Bodegas | ⚠️ | `inventory.warehouse` | — |
| `/invoices` | Facturas de venta | ⚠️ | `sales.document` (`doc_type = INVOICE`) | Alegra devuelve el estado de la factura electrónica dentro del propio recurso 🔶 |
| `/invoices/{id}/email` | Enviar factura por correo | ⚠️ | Acción `send` del documento | — |
| `/estimates` | Cotizaciones | ⚠️ | `sales.document` (`QUOTE`) | — |
| `/credit-notes`, `/debit-notes` | Notas crédito y débito | ⚠️ | `sales.document` (`CREDIT_NOTE`, `DEBIT_NOTE`) | — |
| `/bills` | Facturas de compra | ⚠️ | `purchases.document` (`SUPPLIER_INVOICE`) | — |
| `/purchase-orders` | Órdenes de compra | ⚠️ | `purchases.document` (`PURCHASE_ORDER`) | — |
| `/payments` | Pagos recibidos y emitidos | ⚠️ | `arap.receipt` (`CASH_RECEIPT` / `DISBURSEMENT`) | — |
| `/bank-accounts` | Cuentas bancarias | ⚠️ | cuentas contables de bancos | — |
| `/categories` (plan de cuentas) y `/journals` (asientos manuales) | Contabilidad | 🔶 | `acc.account`, `acc.journal_entry` | Verificar nombres de ruta |
| `/webhooks/subscriptions` | Suscripciones a eventos | ⚠️ | `integ.webhook_endpoint` | — |

## 4. Hipótesis de forma de los documentos principales (🔶 — verificar)

Solo para orientar el diseño del modelo; **no usar como contrato** hasta contrastar con la documentación:

| Recurso | Campos que se espera encontrar |
|---|---|
| Factura | Fecha, vencimiento, cliente (referencia), líneas (ítem, precio, cantidad, descuento, impuestos), forma de pago (contado/crédito), medio de pago, plantilla de numeración, estado, observaciones, bodega, vendedor, bloque con el estado ante la DIAN (incluye CUFE) |
| Contacto | Nombre, tipo de identificación y número (con DV), tipo de persona, régimen, tipos (cliente/proveedor), contacto y dirección, listas de precio |
| Pago | Fecha, tipo (entrada/salida), cuenta bancaria, medio de pago, facturas a las que se aplica con su valor |

Qué aprender de este modelo para SIFCA: un **recurso único de terceros con múltiples tipos**; **plantillas de
numeración** elegibles por documento; el **estado fiscal embebido** en la factura; **pagos con aplicación a
varias facturas**. Todo ello ya está contemplado en `02-modelo-de-datos-preliminar.md`.

## 5. Fachada de compatibilidad (opcional, fuera del núcleo)

Por decisión Q-03, **no hay fachada de compatibilidad con Alegra en el núcleo** de SIFCA. Si en la fase
futura/experimental se decide ofrecerla, sería un paquete opcional separado, de solo lectura, que traduzca los
tres endpoints que hoy consume Asia-POP y cuya forma está verificada en §2:

| Endpoint | Respuesta esperada |
|---|---|
| `GET /company` | `200` (solo se usa el código de estado) |
| `GET /item-categories?start&limit` | Arreglo de `{ id, name, status, parent }` |
| `GET /items?status=active&mode=advanced&start&limit` | Arreglo de ítems con los campos de §2; `availableQuantity` = **disponible**; fotos con `favorite` y URL firmada accesible sin credenciales; `start/limit` con máximo 30 |

Requisitos previos: verificar la documentación oficial (§0) y contar con la suite de pruebas de contrato de
Asia-POP (`backend/tests/fixtures/alegra-mock.ts`). Ver `01-arquitectura/05-integracion-asia-pop.md`.

## 6. Principios de usabilidad que SIFCA adopta

Decisiones de producto de SIFCA, inspiradas en lo que los usuarios de ERPs en línea valoran (no son una
descripción de ningún producto en particular):

1. **Crear sin salir:** crear un tercero o un ítem desde el formulario de factura, en un panel lateral.
2. **Valores por defecto inteligentes:** plazo, bodega, lista de precios y vendedor se heredan del cliente y
   del usuario; el cursor entra directo al primer campo útil.
3. **Totales y retenciones en vivo** mientras se digitan las líneas.
4. **Lenguaje de negocio en la superficie, asiento a un clic:** quien factura ve «venta», quien contabiliza
   ve el asiento («Ver asiento contable» abre el comprobante generado).
5. **Estados visibles y explicados:** cada documento muestra su estado fiscal (borrador, en validación,
   aceptada, rechazada con motivos legibles) y qué hacer.
6. **De cualquier cifra al origen:** en cada reporte, hacer clic en un saldo abre los comprobantes que lo
   componen.
7. **Todo con teclado y con paleta de comandos** (`01-vision-general-y-modulos.md` §8).
8. **Importar y exportar** (CSV/XLSX) en cada maestro y en los saldos iniciales.

## 7. Lista de verificación pendiente

- [ ] Descargar y versionar la documentación oficial (§0).
- [ ] Confirmar rutas y forma de `contacts`, `invoices`, `payments`, `taxes`, `retentions`, `warehouses`.
- [ ] Confirmar la forma del bloque de estado fiscal de la factura y sus valores.
- [ ] Confirmar límites de tasa documentados y el comportamiento de `429`.
- [ ] Decidir si se justifica construir la fachada opcional de §5.
