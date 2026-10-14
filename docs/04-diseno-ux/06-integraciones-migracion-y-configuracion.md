# Integraciones, migración de datos y configuración

Insumo para la maqueta **y** para las specs futuras. Leyenda: ✅ verificado · ⚠️ fuente de terceros · 🔶 hipótesis a
verificar · 💡 propuesta de diseño · 📐 especificado en una spec existente. **Nada de aquí está construido**: es la
fase final del roadmap (F8), pero queda en el radar desde ahora para no cerrar puertas en el modelo de datos.

Documentos relacionados: referencia funcional de la API de Alegra
([`02-normativa-y-reglas/06-referencia-api-alegra.md`](../02-normativa-y-reglas/06-referencia-api-alegra.md)),
integración con Asia-POP ([`01-arquitectura/05-integracion-asia-pop.md`](../01-arquitectura/05-integracion-asia-pop.md)),
spec 011 (API Keys y webhooks).

## 1. Principios

| # | Principio | Consecuencia |
|---|---|---|
| IG-1 | **Todo es configurable por empresa, nada queda fijo en código ni en pantalla** | Cuentas por defecto, numeraciones, impuestos con vigencia, umbrales de crédito, mapeos y límites de tasa son datos con bitácora |
| IG-2 | **Configurable no significa saltarse los invariantes** | Partida doble, inmutabilidad, bloqueo de períodos, RLS y moneda exacta **no** se configuran (§6) |
| IG-3 | **La migración nunca escribe en el sistema de origen** | Conectores de origen en solo lectura (ya es la regla de Asia-POP) |
| IG-4 | **Lo importado pasa por los mismos casos de uso** | Un comprobante migrado se contabiliza con las mismas reglas que uno digitado; si no cuadra, se rechaza |
| IG-5 | **Idempotente y reanudable** | Volver a ejecutar no duplica: cada registro importado guarda su referencia externa |
| IG-6 | **Ensayar antes de escribir** | Toda corrida tiene un modo ensayo que muestra qué pasaría, sin efectos |
| IG-7 | **Conciliar o no se cierra** | La migración solo se da por terminada cuando origen y SIFCA cuadran |
| IG-8 | **Un conector es un adaptador, no una dependencia del núcleo** | El dominio no conoce a Alegra; el adaptador traduce (capa anticorrupción). Cambiar de origen no toca la contabilidad |

## 2. Qué se integra

| Tipo | Conector | Dirección | Fase | Estado |
|---|---|---|---|---|
| Origen de datos | **Alegra** (API REST) | Entrada, solo lectura | F8 | 💡 |
| Origen de datos | **Archivos CSV / XLSX** con plantillas descargables (sirve para cualquier otro sistema, incluido SamitSQL, mediante exportación) | Entrada | F8 (la importación de maestros puede adelantarse) | 💡 |
| Factura electrónica | **Proveedor tecnológico (PTA)** detrás del puerto `EInvoiceProvider` | Salida y estado | F3 | 📐 spec 009 |
| API pública | **API Keys** con alcances y límites | Entrada | F2 | 📐 spec 011 |
| Eventos | **Webhooks** con firma, reintentos y registro de entregas | Salida | F2 / F7 | 📐 spec 011 |
| Exportación | Reportes y maestros a CSV/XLSX | Salida | F2 en adelante | 💡 |
| Catálogo externo | Asia-POP consume el catálogo de SIFCA | Salida | Futura | 📐 doc 05 |

Fuera de alcance por ahora: pasarelas de pago, bancos y conciliación bancaria, nómina, exógena.

## 3. Alegra como origen de datos

### 3.1 Lo que se sabe de su API (y con qué certeza)

| Tema | Detalle | Certeza |
|---|---|---|
| URL base y autenticación | `https://api.alegra.com/api/v1`; HTTP Basic con correo y token de API | ✅ (Asia-POP, cuenta real) |
| Alternativa de autenticación | Token *Bearer* para aplicaciones de marketplace con OAuth | ⚠️ (herramienta de terceros) |
| Paginación | `start` + `limit`, máximo 30 por página; superarlo da `400` | ✅ |
| Validar credenciales | `GET /company` | ✅ |
| Límite de tasa | `429` con `Retry-After`; los valores del límite **no se conocen** | ✅ el código · 🔶 el valor |
| Identificadores | Texto opaco (pueden llegar como número o cadena) | ✅ |
| Filtros | `status`, `type` (p. ej. contactos `client`), rangos de fecha, `mode` en ítems | ⚠️ |
| Webhooks | Existe un recurso de suscripciones a eventos; **nombres de eventos sin verificar** | ⚠️ / 🔶 |
| Documentación oficial | `developer.alegra.com` **no fue accesible** desde el entorno de redacción | — |

Recursos reportados por una herramienta de terceros que envuelve la API ⚠️ (no son la documentación oficial; sirven para
dimensionar el trabajo): **maestros** `contacts`, `items`, `item-categories`, `price-lists`, `warehouses`, `taxes`,
`retentions`, `cost-centers`, `terms`, `sellers`, `currencies`, `number-templates`, `custom-fields`, `variant-attributes`;
**ventas** `invoices`, `global-invoices`, `recurring-invoices`, `credit-notes`, `income-debit-notes`, `estimates`,
`remissions`, `additional-charges`; **compras** `bills`, `debit-notes`, `purchase-orders`; **pagos y bancos** `payments`,
`bank-accounts`, `reconciliations`; **inventario** `warehouse-transfers`, `inventory-adjustments`; **contabilidad**
`categories` (plan de cuentas), `journals`; **otros** `company`, `users`, `reports`, `webhook-subscriptions`.

> **Tarea previa a construir el conector** (ya registrada en `06-referencia-api-alegra.md` §7): descargar la
> documentación OpenAPI/Postman oficial, versionarla y reemplazar las filas ⚠️/🔶. Hasta entonces el conector se
> diseña, no se programa.

### 3.2 Correspondencia con SIFCA

El mapa completo recurso por recurso está en `06-referencia-api-alegra.md` §3. Lo que añade la migración:

| Alegra | SIFCA | Qué hay que decidir en el mapeo |
|---|---|---|
| `categories` (plan de cuentas) | `acc.account` | Cuenta a cuenta: **mantener el código** o asignar el del PUC de SIFCA; naturaleza, si exige tercero o centro de costo |
| `taxes`, `retentions` | `tax.tax` + `tax.tax_rate` con vigencia | Qué impuesto de Alegra equivale a qué impuesto de SIFCA y a qué cuenta contable |
| `contacts` (tipo cliente/proveedor) | `parties.party` | Tipo de identificación, dígito de verificación, régimen; duplicados por NIT |
| `items`, `item-categories`, `price-lists` | `catalog.item`, `catalog.item_category`, `catalog.price_list` | Tipo (simple, kit, variante), si controla inventario, método de costeo, impuestos por defecto |
| `warehouses` | `inventory.warehouse` | Bodega a bodega |
| Existencias de `items.inventory` | Movimientos de apertura de kardex | **Costo unitario inicial**: Alegra no siempre lo entrega por bodega → se pide al usuario o se importa por archivo |
| `invoices` / `bills` con saldo | Documentos abiertos de cartera / cuentas por pagar | Solo lo **abierto** a la fecha de corte (recomendado) o todo el histórico |
| `payments` | Recibos y egresos | Solo si se importa histórico |
| `journals` | Comprobantes históricos | Solo si se importa histórico; entran por el caso de uso de contabilización |
| `number-templates` | Numeración de SIFCA | **No** se importa el consecutivo: se configura la numeración de SIFCA (§5) |

### 3.3 Reglas de la migración (a validar con el contador antes de producción)

| Id | Regla | Certeza |
|---|---|---|
| MG-01 | **Estrategia recomendada: saldos iniciales a la fecha de corte** — un comprobante de apertura que cuadra, más cartera y cuentas por pagar abiertas, más existencias iniciales. El histórico completo es opcional | 💡 |
| MG-02 | Un comprobante de apertura que no cuadra **no se contabiliza**; la corrida se detiene con el detalle de la diferencia | 💡 (deriva de R-CON-001 ✅) |
| MG-03 | Los períodos anteriores al corte deben existir; el histórico importado se contabiliza con los períodos **abiertos** y luego se cierran. Un período cerrado sigue sin admitir comprobantes (R-CON-004 ✅) | 💡 |
| MG-04 | Las facturas históricas **no se retransmiten a la DIAN**: se guardan como documentos de solo lectura con el número y el CUFE de origen | 🔶 (confirmar con contador y PTA) |
| MG-05 | Lo importado lleva origen `MIGRATION` y la referencia externa (`sistema`, `entidad`, `id externo`); es único por empresa | 💡 |
| MG-06 | Deshacer una corrida **no borra** lo contabilizado: genera reversiones (R-CON-005 ✅); los maestros sin uso se desactivan | 💡 |
| MG-07 | La conciliación final compara origen y SIFCA por **cuenta**, por **tercero** (cartera) y por **ítem y bodega** (cantidad y valor). Tolerancia configurable; **por defecto cero** en dinero | 💡 |
| MG-08 | Los identificadores del origen se tratan como texto opaco; se respeta `429` y `Retry-After`; nunca se supera el tamaño de página permitido | ✅ |
| MG-09 | Las credenciales del origen se guardan **cifradas**, se muestran enmascaradas y se pueden revocar; solo las ve quien tiene el permiso `integrations.manage` | 💡 |

## 4. Pantallas de Integraciones (para la maqueta)

Ruta base `/integraciones`. Permiso propuesto `integrations.manage` (lectura: `integrations.read`) 💡. Prioridad de
maqueta: **P3 (esquema)** salvo la migración, que se maqueta completa porque es un flujo guiado.

### IN.1 Conectores — `/integraciones/conectores`

Galería de tarjetas: **Alegra**, **Archivos CSV/XLSX**, **Proveedor de factura electrónica**, **API Keys**, **Webhooks**.
Cada tarjeta: estado (`No conectado` · `Conectado` · `Error`), última sincronización, botón principal. Estados: vacío,
error de credenciales («Alegra rechazó las credenciales (401). Revisa el correo y el token.»), límite de tasa
(«Alegra pidió esperar 30 s; reanudamos solos.»).

### IN.2 Configurar conector — `/integraciones/conectores/alegra`

| Campo | Notas |
|---|---|
| Nombre de la conexión | Libre |
| Correo de la cuenta de Alegra | Obligatorio |
| Token de API | Enmascarado; «Probar conexión» llama a `GET /company` y muestra el nombre de la empresa |
| URL base | Editable (por defecto la oficial) |
| Tamaño de página | 1–30 (por defecto 30) |
| Pausa entre peticiones y reintentos ante `429` | Configurables |
| Modo | Solo lectura (fijo, con candado y explicación) |

### IN.3 Asistente de migración — `/integraciones/migracion/nueva`

Asistente de **9 pasos** con avance guardado (se puede salir y volver; es reanudable). Cada paso muestra qué
sigue y qué se puede deshacer.

1. **Origen:** Alegra o archivos; fecha de corte (por defecto, el último día del mes anterior a hoy).
2. **Estrategia:** *Saldos iniciales* (recomendada) o *Histórico completo*, con una comparación breve de ambas.
3. **Qué traer:** casillas por entidad, en orden de dependencia (ver tabla).
4. **Mapeos:** pantalla IN.4.
5. **Revisión de datos:** duplicados, campos faltantes, NIT inválidos, cuentas sin mapear.
6. **Ensayo:** corrida sin efectos; informe con conteos y problemas (pantalla IN.5).
7. **Ejecución:** barra de progreso por entidad, pausar y reanudar, errores en vivo.
8. **Conciliación:** origen contra SIFCA (pantalla IN.6).
9. **Cierre:** resumen, firma de quien migró y, si aplica, cierre de los períodos importados.

Orden de entidades (cada una depende de la anterior):

| # | Entidad | Obligatoria | Nota |
|---|---|---|---|
| 1 | Datos de la empresa | Sí | Solo validación; no sobrescribe sin confirmar |
| 2 | Plan de cuentas | Sí | Base de todo lo contable |
| 3 | Impuestos y retenciones | Sí | Con vigencias |
| 4 | Terceros | Sí | Clientes y proveedores |
| 5 | Bodegas, categorías y listas de precio | Si hay inventario | — |
| 6 | Ítems | Si hay inventario o ventas | Con fotos opcionales |
| 7 | Existencias iniciales | Si hay inventario | Pide costo unitario |
| 8 | Saldos iniciales contables | Sí (estrategia 1) | Comprobante de apertura |
| 9 | Cartera y cuentas por pagar abiertas | Recomendada | Facturas con saldo |
| 10 | Histórico de documentos | Solo estrategia 2 | Facturas, notas, pagos, comprobantes |

### IN.4 Mapeos — `/integraciones/migracion/:id/mapeos`

Tablas editables, una pestaña por entidad. Columnas: **Valor de origen** (con ejemplo) · **Valor en SIFCA** (lista con
búsqueda) · **Confianza** (`Exacto` · `Sugerido` · `Sin resolver`) · **Acción** (usar · crear nuevo · ignorar). Reglas:
sugerencias automáticas por código o nombre; no se avanza mientras haya `Sin resolver` obligatorios; los mapeos se
**guardan como plantilla** y se reutilizan en otra corrida; se pueden importar y exportar en CSV.

### IN.5 Informe del ensayo — `/integraciones/migracion/:id/ensayo`

Tarjetas con conteos por entidad (leídos · a crear · a actualizar · a ignorar · con error), tabla de problemas con
severidad (`Bloquea` · `Advierte`), enlace a la fila de origen, y descarga CSV de rechazados. El botón **Ejecutar** se
habilita solo sin bloqueos.

### IN.6 Conciliación — `/integraciones/migracion/:id/conciliacion`

Tres vistas: **por cuenta** (saldo origen · saldo SIFCA · diferencia), **por tercero** (cartera) y **por ítem y
bodega** (cantidad y valor). Totales con sello `Cuadra` / `No cuadra`; la diferencia se resalta con texto, no solo con
color. Se puede aceptar una diferencia con motivo, que queda en bitácora, solo si la tolerancia configurada lo permite.

### IN.7 Ejecuciones y errores — `/integraciones/ejecuciones`

Lista de todas las corridas (migraciones y sincronizaciones): fecha, conector, tipo, estado
(`Ensayo` · `En ejecución` · `Pausada` · `Conciliando` · `Cerrada` · `Revertida` · `Con errores`), quién la lanzó, duración y
conteos. Detalle con registro de eventos, **reintentar fallidos** y **deshacer corrida** (con el aviso de MG-06).

### IN.8 Sincronización continua — `/integraciones/conectores/alegra/sincronizacion` 💡 (fase posterior)

Opcional: dirección (solo entrada), entidades, frecuencia, política de conflictos (*gana el origen* · *gana SIFCA* ·
*preguntar*) y ventana de silencio. Se maqueta como esquema; no es parte de la primera entrega de migración.

### IN.9 API Keys — `/integraciones/api-keys` 📐 (spec 011)

Lista (nombre, prefijo visible, alcances, último uso, estado), crear (el secreto se muestra **una sola vez**), rotar y
revocar. Alcances y límite de peticiones configurables por clave.

### IN.10 Webhooks — `/integraciones/webhooks` 📐 (spec 011)

Suscripciones (URL, eventos, secreto de firma), **registro de entregas** (código de respuesta, intentos, próximo
reintento), reenviar manualmente y pausar. Eventos de dominio disponibles: comprobante contabilizado, comprobante
reversado, período cerrado, período reabierto, año cerrado (los demás llegan con las specs 002–009).

## 5. Configuración por empresa — `/configuracion`

Principio IG-1: lo que cambia por empresa, por normativa o por negocio es un **dato con vigencia y bitácora**, no código.

| Grupo | Qué se configura | Quién | Estado |
|---|---|---|---|
| Empresa | Razón social, NIT, régimen, dirección, logo, zona horaria de presentación | Administrador | 💡 |
| Numeración | Prefijo y consecutivo por tipo de comprobante; rangos de factura electrónica (resolución, vigencia) | Contador | 📐 spec 009 · 💡 |
| Plan de cuentas | Cuentas auxiliares, si exigen tercero o centro de costo, activar/desactivar | Contador | 💡 (hoy solo lectura) |
| **Cuentas por defecto** | Qué cuenta usa cada evento: ventas, IVA, costo de ventas, inventario, caja, bancos, retenciones, ajuste por redondeo, 5905 y 3605 en el cierre | Contador | 💡 |
| Impuestos y retenciones | Tarifas con vigencia, base mínima en UVT, UVT del año | Contador | 📐 spec 010 |
| Crédito y cartera | Cupo y plazo por defecto, umbrales de alerta (80 % y 100 %), días de mora, quién puede liberar retenciones | Cartera / gerente | 📐 spec 003 |
| Inventario | Método de costeo por empresa o por ítem (promedio / PEPS), política de despacho, cortes de ABC, nivel de servicio para reposición | Jefe de inventario | 📐 specs 006–008 |
| Períodos | Año fiscal, motivo mínimo para reabrir | Contador | ✅ en parte |
| Roles y permisos | Qué rol puede qué | Administrador | 📐 spec 012 pendiente |
| Plantillas | PDF de documentos y correos | Administrador | 💡 |
| Alertas | Qué se avisa, a quién y por qué canal | Administrador | 💡 |
| Integraciones | Conectores, mapeos, límites de tasa, webhooks, claves | Integrador | §4 |
| Interfaz | Tema, densidad, formato de números y fechas | Cada usuario | 💡 |

Patrón de pantalla de configuración (uno solo para todas): lista a la izquierda, formulario a la derecha, **vigencia
desde** cuando aplique, botón **Guardar** que pide motivo en cambios sensibles, pestaña **Historial** con quién cambió
qué y cuándo, y aviso «Este cambio no afecta documentos ya contabilizados».

## 6. Lo que NO es configurable

| Invariante | Por qué |
|---|---|
| Partida doble (Σ débitos = Σ créditos) | Base de la contabilidad (R-CON-001) |
| Inmutabilidad de lo contabilizado; corregir es reversar | R-CON-005, constitución I |
| Un período cerrado no admite comprobantes | R-CON-004 |
| Aislamiento por empresa (RLS) | Constitución IV |
| Dinero sin coma flotante, dos decimales | R-CON-009 |
| Registro en bitácora de cambios de configuración | Trazabilidad |

## 7. Lo que hay que decidir ahora para no cerrar puertas (radar)

| Decisión | Por qué ahora | Dónde |
|---|---|---|
| Tabla de **referencias externas** (`sistema`, `entidad`, `id externo` → id interno, único por empresa) | Sin ella no hay idempotencia ni conciliación | Modelo de datos, esquema `integ` |
| Valor de origen **`MIGRATION`** para comprobantes | Distinguir lo migrado de lo digitado; hoy el catálogo de orígenes no lo incluye | Spec 001 (extensión menor) |
| Extender el ámbito de la **configuración** a una tabla genérica con vigencia | Evita una tabla por cada parámetro | Spec de configuración |
| Cola de trabajos para tareas largas (migración, sincronización) | El *outbox* de la spec 011 ya es el candidato | Spec 011 |
| Plantillas de importación CSV/XLSX por maestro | Se pueden adelantar a F2 y F3 como importación de terceros e ítems | Specs 002, 006 |

## 8. Fase y especificaciones propuestas

| Fase | Contenido | Spec propuesta |
|---|---|---|
| **F8 — Integraciones y migración** | Conectores, migración desde Alegra y archivos, conciliación, sincronización opcional | **013** Configuración por empresa · **014** Conectores e integración · **015** Migración de datos |

Criterio de salida de F8 (propuesto): migrar una empresa de prueba desde Alegra (o archivos) con la conciliación en cero
por cuenta, tercero e ítem, y deshacer la corrida sin perder la inmutabilidad.

## 9. Preguntas abiertas

1. ¿Qué empresas piloto migrarán y desde qué sistema(s)? (define si el segundo conector es Siigo, World Office u otro).
2. ¿Se migra **histórico** o basta con saldos iniciales y cartera abierta? (contador).
3. ¿Qué hacer con las facturas electrónicas históricas: solo consulta o también reimpresión? (contador y PTA).
4. ¿Se necesita sincronización continua o solo migración de una vez?
5. ¿Quién administra las credenciales de Alegra en la empresa y cómo se rotan?
6. ¿Los eventos de webhooks de Alegra sirven para sincronizar? (requiere la documentación oficial).
