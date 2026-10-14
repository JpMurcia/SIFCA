# Catálogo de pantallas

Cada pantalla indica: **propósito**, **usuario**, **datos** (campos y columnas), **acciones**, **estados** (vacío,
cargando, error, éxito), **reglas que la maqueta debe respetar** y, si existe backend, el **endpoint**. Los datos de
ejemplo salen del libro de referencia verificado de la spec 001 (`docs/02-normativa-y-reglas/01-…` §5) y están en
pesos colombianos con formato `es-CO` (`$ 1.190.000,00`).

Estado: ✅ backend implementado y probado · 📐 especificado, sin backend · 💡 propuesta.

---

## Parte A — Contabilidad ✅ (maquetar con el máximo detalle)

Contrato de referencia:
[`accounting.v1.openapi.yaml`](../specs/001-contabilidad-comprobantes-inmutables/contracts/accounting.v1.openapi.yaml).
Todas las rutas cuelgan de `/api/v1`.

### A.0 Errores y cómo se muestran (aplica a todas las pantallas de Contabilidad)

Los errores llegan como `application/problem+json` con un `code` estable y, a veces, una lista `errors[]` con
`field`, `message` y `rule`. **El texto en español de la derecha es el que debe mostrar la maqueta.**

| `code` | HTTP | Cuándo | Texto sugerido | Dónde se muestra |
|---|---|---|---|---|
| `ENTRY_NOT_BALANCED` | 422 | Σ débitos ≠ Σ créditos | «El comprobante no cuadra: débitos $ 100.000,00 ≠ créditos $ 99.999,99. Diferencia: $ 0,01.» | Banner sobre la grilla y contador de diferencia en el pie |
| `VALIDATION_FAILED` | 422 | Esquema o regla de línea | Un mensaje por cada elemento de `errors[]` | En la **celda** indicada por `field` (`lines[2].accountCode`, `lines[0].partyId`, `lines[1].amount`, `description`, `accountingDate`) y resumen arriba |
| `PERIOD_CLOSED` | 409 | Fecha en período cerrado | «El período 2026-09 está cerrado. Cambia la fecha contable o pide que lo reabran.» | Junto al campo Fecha contable |
| `PERIOD_NOT_FOUND` | 422 | Fecha sin período creado | «No existe un período contable para esa fecha. Crea el año fiscal en Períodos.» | Junto a Fecha contable, con enlace a Períodos |
| `ALREADY_REVERSED` | 409 | Segunda reversión | «Este comprobante ya fue reversado por AJ-2.» | Diálogo de reversión |
| `PERIOD_CLOSE_BLOCKED` | 409 | Cierre rechazado | Lista de causas (`errors[]`): «Hay 1 borrador(es) con fecha en el período…» | Diálogo de cierre, con enlaces a cada causa |
| `FORBIDDEN` | 403 | Falta permiso | «No tienes permiso para esta acción (accounting.period.reopen).» | Toast; el botón ya debería estar oculto o deshabilitado con explicación |
| `NOT_FOUND` | 404 | Id inexistente | «No encontramos ese registro.» | Página de error con enlace a la lista |
| `CONFLICT` | 409 | Borrador con versión vieja; período ya cerrado/abierto; año ya creado/cerrado | Mensaje del servidor (`detail`) | Diálogo: «El borrador cambió. Recargar» |
| `IDEMPOTENCY_CONFLICT` | 422 | Misma clave, otro cuerpo | «Este envío ya se había realizado con otros datos. Recarga la página.» | Toast |
| `UNAUTHENTICATED` | 401 | Sin sesión | Redirige al inicio de sesión | — |
| `INTERNAL_ERROR` | 500 | Falla inesperada | «Ocurrió un error inesperado. Código de seguimiento: <requestId>.» | Página/Toast con el `requestId` copiable |

> `ENTRY_IMMUTABLE` (405) **no debe verse nunca** en la maqueta: no existen los botones «Editar» ni «Eliminar» de un
> comprobante contabilizado.

### A.1 Lista de comprobantes — `/contabilidad/comprobantes`

| | |
|---|---|
| **Usuario** | Contador, auxiliar contable |
| **Propósito** | Encontrar y abrir comprobantes contabilizados; empezar uno nuevo |
| **Endpoint** | `GET /accounting/journal-entries` (paginación por cursor, 25 por página) |
| **Filtros** | Rango de fechas (`from`, `to`), Tipo (`voucherType`: AJ, FV, NC, RC, CE, CI), Cuenta (`accountCode`), Origen (`sourceType`: MANUAL, SALES_DOCUMENT, RECEIPT, PURCHASE_DOCUMENT, STOCK_ADJUSTMENT, YEAR_CLOSING, REVERSAL) |
| **Columnas** | Fecha contable · Tipo-Número (`AJ-1`) · Descripción · Origen · Débito total · Crédito total · Estado/etiquetas · Registrado por/cuándo |
| **Etiquetas de fila** | `Contabilizado` (siempre) · `Reversado por AJ-2` (si `reversedBy`) · `Reversión de AJ-1` (si `reversalOf`) · `Cierre anual` (YEAR_CLOSING) |
| **Acciones** | Nuevo comprobante (`N`) · Abrir (Enter) · Exportar a CSV 💡 · Limpiar filtros |
| **Estados** | Vacío: «Aún no hay comprobantes en este rango» + botón «Nuevo comprobante» · Cargando: filas esqueleto · Error: banner con reintento y `requestId` |
| **Reglas** | Nunca hay «Editar» ni «Eliminar» por fila. Los más recientes primero (fecha y id descendentes). Los importes alineados a la derecha con cifras tabulares |

Datos de ejemplo (libro de referencia de octubre de 2026):

| Fecha | Comprobante | Descripción | Origen | Débito | Crédito |
|---|---|---|---|---:|---:|
| 20/10/2026 | RC-1 | P-03 Recibo de caja | Manual | $ 952.000,00 | $ 952.000,00 |
| 10/10/2026 | NC-2 | P-02 Reingreso al costo de salida | Manual | $ 120.000,00 | $ 120.000,00 |
| 10/10/2026 | NC-1 | P-02 Nota crédito por devolución parcial | Manual | $ 238.000,00 | $ 238.000,00 |
| 05/10/2026 | FV-2 | P-01 Costo de ventas | Manual | $ 600.000,00 | $ 600.000,00 |
| 05/10/2026 | FV-1 | P-01 Factura de venta a crédito con IVA | Manual | $ 1.190.000,00 | $ 1.190.000,00 |
| 01/10/2026 | AJ-1 | Apertura de inventario aportado como capital | Manual | $ 1.000.000,00 | $ 1.000.000,00 |

### A.2 Editor de comprobante — `/contabilidad/comprobantes/nuevo`

| | |
|---|---|
| **Usuario** | Contador, auxiliar contable |
| **Propósito** | Registrar un comprobante manual de partida doble que cuadre |
| **Endpoints** | `GET /accounting/voucher-types` (tipos y siguiente número orientativo) · `GET /accounting/accounts?q=&postableOnly=true` (autocompletar cuentas) · `POST /accounting/journal-entries` (contabilizar, con cabecera `Idempotency-Key`) · `POST /accounting/journal-drafts` / `PUT …/{id}` (borrador) |
| **Permiso** | `accounting.entry.post` |

**Cabecera:**

| Campo | Tipo | Regla de validación (del contrato) |
|---|---|---|
| Tipo de comprobante | Lista (código 1–5 letras mayúsculas) | Obligatorio; muestra «Siguiente número: 5» (orientativo, el real se asigna al contabilizar) |
| Fecha contable | Fecha `YYYY-MM-DD` | Si se deja vacía, se usa hoy en **hora de Colombia**. Debe caer en un período **abierto** (chip de estado junto al campo) |
| Descripción | Texto 1–500 | Obligatorio; contador de caracteres |
| Origen | Solo lectura = «Manual» | Los otros orígenes los generan los módulos, no se eligen aquí |

**Grilla de líneas** (edición tipo hoja de cálculo; mínimo 2 y máximo 500 líneas):

| Columna | Tipo | Regla |
|---|---|---|
| # | Número | Automático |
| Cuenta | Autocompletar por **código o nombre** | Solo cuentas de movimiento y activas. Al elegirla muestra insignias: `Exige tercero`, `Exige centro de costo` |
| Tercero | Autocompletar | **Obligatorio** si la cuenta exige tercero (R-CON-008) |
| Centro de costo | Lista | **Obligatorio** si la cuenta lo exige (R-CON-008) |
| Débito | Importe `0,00` | Solo uno de los dos lados (R-CON-002); hasta 2 decimales; no negativo |
| Crédito | Importe `0,00` | Idem. Al escribir en uno, el otro se vacía |
| Descripción de la línea | Texto ≤ 500 | Opcional |
| Referencia de documento | Texto ≤ 60 | Opcional (p. ej. `FV-1`) |
| Vencimiento | Fecha | Opcional (para cartera) |

**Pie de la grilla (siempre visible):** `Σ Débitos` · `Σ Créditos` · **`Diferencia`** (en rojo suave si ≠ 0, en verde con
«Cuadra» si = 0). El botón **Contabilizar** (`Ctrl+Enter`) solo se habilita cuando cuadra y hay ≥ 2 líneas válidas.

**Acciones:** Guardar borrador (`Ctrl+S`) · Contabilizar · Descartar · Agregar línea · Pegar filas desde una hoja de
cálculo (`Ctrl+V`) · Mover/duplicar/quitar línea.

**Estados y comportamientos:**
- Tras contabilizar con éxito (`201`): mensaje «Contabilizado como AJ-5» y navegación al detalle del comprobante.
- Reintento por falla de red con la misma `Idempotency-Key`: si el servidor ya lo creó responde `200` con el
  mismo comprobante; la interfaz lo trata como éxito sin duplicar.
- Errores: ver A.0. Los errores de línea marcan la celda y llevan el foco a la primera.
- Salir con cambios sin guardar: diálogo «¿Guardar como borrador?».
- Si el período de la fecha está cerrado: aviso inmediato junto a la fecha (sin esperar al servidor).

Ejemplo precargado «Venta de contado» (para la maqueta):

| Cuenta | Descripción | Débito | Crédito |
|---|---|---:|---:|
| 1105 Caja | Venta de contado | $ 100.000,00 | |
| 4135 Comercio al por mayor y al por menor | Venta de contado | | $ 100.000,00 |

### A.3 Detalle de comprobante — `/contabilidad/comprobantes/:id`

| | |
|---|---|
| **Propósito** | Ver un comprobante contabilizado y, si hay un error, **reversarlo** |
| **Endpoints** | `GET /accounting/journal-entries/{id}` · `POST …/{id}/reversal` (permiso `accounting.entry.reverse`) |
| **Cabecera** | `AJ-1` · etiquetas `Contabilizado` y, según el caso, `Reversado por AJ-2` / `Reversión de AJ-1` · Fecha contable · Período · Descripción · Origen y documento fuente (enlace) · Registrado por y cuándo (UTC mostrado en hora de Colombia) |
| **Líneas (solo lectura)** | # · Cuenta (código y nombre) · Tercero · Centro de costo · Débito · Crédito · Descripción · Referencia · Vencimiento · totales al pie |
| **Acciones** | **Reversar** (si no está reversado y hay permiso) · Ver en libro mayor (por línea) · Imprimir/PDF 💡 · Copiar enlace |
| **No existe** | Editar · Eliminar (el comprobante es inmutable; ver `04-sistema-de-diseno.md` §6.1) |

**Diálogo «Reversar comprobante»:**
- Explica: «Se creará un comprobante nuevo con los lados invertidos que neutraliza a AJ-1. El original no se modifica.»
- Campos: **Motivo** (obligatorio, 5–500 caracteres) y **Fecha contable de la reversión** (opcional; por defecto *hoy en
  hora de Colombia*; debe estar en un período abierto — pregunta abierta al contador, ver `validacion-contador.md`
  pregunta 1).
- Vista previa: tabla de las líneas invertidas.
- Resultado `201`: navega a la reversión mostrando el enlace «Reversión de AJ-1». Errores: `ALREADY_REVERSED`,
  `PERIOD_CLOSED`, `VALIDATION_FAILED` (p. ej. una cuenta que ya no admite movimientos).

### A.4 Borradores — `/contabilidad/borradores`

| | |
|---|---|
| **Propósito** | Retomar o descartar comprobantes sin contabilizar; **bloquean el cierre del mes** |
| **Endpoints** | `GET /accounting/journal-drafts?periodId=` · `PUT/DELETE …/{id}` |
| **Columnas** | Tipo · Fecha contable · Descripción · N.º de líneas · Σ débito · Σ crédito · **¿Cuadra?** · Última modificación · Autor |
| **Acciones** | Abrir en el editor · Descartar (con confirmación; es el único borrado permitido) |
| **Reglas** | El borrador admite descuadre y datos incompletos. Aviso destacado: «Los borradores con fecha en un período impiden cerrarlo». Si otro usuario lo cambió: error `CONFLICT` → diálogo «El borrador cambió; recargar» (control de versión) |
| **Vacío** | «No hay borradores. Los borradores que dejes sin contabilizar aparecerán aquí.» |

### A.5 Libro diario — `/contabilidad/diario`

`GET /accounting/reports/journal?from=&to=&limit=&cursor=` — cronológico por `(fecha, tipo, número, línea)`.
Filtros: rango de fechas (obligatorio). Columnas: Fecha · Comprobante · Línea · Cuenta · Tercero · Descripción ·
Débito · Crédito. Agrupación visual por comprobante. Paginación con «Cargar más» y desplazamiento infinito. «El mismo
rango siempre produce el mismo resultado» (reproducible, R-CON-010): se puede mostrar una *huella* del informe 💡.

### A.6 Libro mayor — `/contabilidad/mayor`

`GET /accounting/reports/general-ledger?accountCode=&from=&to=`. Selector de cuenta (autocompletar) y rango. Muestra
**Saldo inicial**, movimientos con **saldo acumulado** y **Saldo final**, expresados en la **naturaleza de la cuenta**
(positivo = saldo normal). `404 NOT_FOUND` si la cuenta no existe.

Ejemplo — cuenta `1435 Mercancías`, 01–31/10/2026: saldo inicial $ 0,00 → AJ-1 +$ 1.000.000,00 (saldo $ 1.000.000,00) →
FV-2 −$ 600.000,00 (saldo $ 400.000,00) → NC-2 +$ 120.000,00 (saldo $ 520.000,00) → **saldo final $ 520.000,00**.

### A.7 Balance de prueba — `/contabilidad/balance-de-prueba`

`GET /accounting/reports/trial-balance?from=&to=&level=` donde `level` ∈ {1, 2, 4, 6, 8} acumula por prefijo del
código (sin valor = cuentas de movimiento).

| Elemento | Detalle |
|---|---|
| Controles | Rango de fechas · Nivel (segmentado: Clase · Grupo · Cuenta · Subcuenta · Auxiliar) · Ocultar saldos en cero |
| Columnas | Cuenta · Nombre · **Saldo inicial** (Débito/Crédito) · **Movimiento** (Débito/Crédito) · **Saldo final** (Débito/Crédito) |
| Indicador de cuadre | Pie con totales y un sello `Cuadrado` (si `balanced`) o `Descuadrado` en rojo |
| `contraNature` | Si el saldo final tiene el lado contrario a la naturaleza de la cuenta se muestra una **marca de alerta** con tooltip «Saldo contrario a la naturaleza de la cuenta (R-CON-013)». **No se oculta** |
| Acciones | Abrir el mayor de la cuenta (clic en la fila) · Exportar 💡 |

Resultado esperado con el libro de referencia (octubre de 2026) — **estos números deben coincidir en la maqueta**:

| Cuenta | Débito | Crédito |
|---|---:|---:|
| 1110 Bancos | $ 952.000,00 | |
| 1435 Mercancías | $ 520.000,00 | |
| 2408 Impuesto sobre las ventas por pagar | | $ 152.000,00 |
| 3115 Aportes sociales | | $ 1.000.000,00 |
| 4135 Comercio al por mayor y al por menor | | $ 1.000.000,00 |
| 4175 Devoluciones en ventas | $ 200.000,00 | |
| 6135 Costo de ventas | $ 480.000,00 | |
| **Totales** | **$ 2.152.000,00** | **$ 2.152.000,00** |

(`130505 Clientes nacionales` aparece con movimientos de $ 1.190.000,00 en cada lado y saldo final en cero.)

### A.8 Períodos — `/contabilidad/periodos`

| | |
|---|---|
| **Endpoints** | `GET /accounting/periods?year=` · `POST /accounting/fiscal-years` · `POST …/periods/{id}/close` · `POST …/periods/{id}/reopen` |
| **Vista** | Selector de año y **cuadrícula de 12 meses**: cada tarjeta muestra mes, rango de fechas, estado `Abierto`/`Cerrado`, quién y cuándo lo cerró, y número de borradores pendientes |
| **Acciones** | Crear año fiscal (si no existe; permiso `accounting.period.manage`) · **Cerrar mes** (`accounting.period.close`) · **Reabrir** (`accounting.period.reopen`, excepcional) |

**Diálogo «Cerrar mes»:** muestra las comprobaciones antes de confirmar — «Balance de prueba cuadrado ✓», «Sin
borradores ✓/✗», más las que añadan otros módulos (conciliaciones de inventario y cartera). Si hay causas de bloqueo
(`PERIOD_CLOSE_BLOCKED`), el botón «Cerrar» queda deshabilitado y cada causa lleva un enlace («Ver 1 borrador»).
**Diálogo «Reabrir período»:** advertencia en tono de precaución, campo **Motivo** obligatorio (5–500) y texto «Quedará
registrado en la bitácora con tu usuario». Tras cerrar, ningún usuario puede contabilizar en ese mes.

Ejemplo: Ene–Sep 2026 `Cerrado`, Oct `Abierto`, Nov–Dic `Abierto`.

### A.9 Cierre anual — `/contabilidad/cierre-anual`

Asistente de 3 pasos (permiso `accounting.year.close`) sobre `POST /accounting/fiscal-years/{year}/closing`:
1. **Parámetros:** año, fecha contable del cierre (por defecto 31/12), cuenta de **Ganancias y pérdidas** y cuenta de
   **Utilidad o pérdida del ejercicio** (selectores; la empresa las parametriza — R-CON-012 está pendiente de
   validación del contador), tipo de comprobante (`CI` por defecto).
2. **Vista previa:** resultado del ejercicio (utilidad o pérdida) y el comprobante que se generará (líneas que llevan a
   cero las clases 4, 5, 6 y 7).
3. **Confirmar:** el sistema crea **un** comprobante `Cierre anual`, **reversible** mientras no se cierre el siguiente
   ejercicio.
Errores: `CONFLICT` si el ejercicio ya tiene un cierre vigente (aparece el enlace al comprobante y la opción de
reversarlo antes de repetir); `VALIDATION_FAILED` si no hay saldos de resultado. Ejemplo: utilidad de $ 320.000,00
(1.000.000 − 200.000 − 480.000).

### A.10 Plan de cuentas — `/contabilidad/plan-de-cuentas`

Solo lectura hoy (`GET /accounting/accounts`; la gestión del plan **no tiene API** todavía 💡). Árbol por niveles
(Clase 1, Grupo 2, Cuenta 4, Subcuenta 6, Auxiliar 8+). Columnas: Código · Nombre · Naturaleza (Débito/Crédito) ·
`Admite movimiento` · `Exige tercero` · `Exige centro de costo` · `Activa`. Buscar por código o nombre; filtro
«Solo cuentas de movimiento». Las cuentas con movimientos no cambian de código ni de naturaleza.

---

## Parte B — Ventas, cartera, compras e inventario 📐 (maquetar a nivel de campos y estados)

> Estas pantallas **no tienen backend**. Su contenido sale de las specs 002–011; los nombres de campo siguen el
> modelo de datos preliminar. Donde se indica «ilustrativo» las cifras no vienen de una regla.

### B.1 Terceros (clientes y proveedores) — `/terceros/clientes`, `/terceros/proveedores`

Campos (`PARTY`): tipo (cliente/proveedor/ambos), tipo y número de identificación + **dígito de verificación**
(NIT validado, R-FE-012), razón social, nombre comercial, **responsabilidades fiscales**, régimen de IVA,
¿declarante de renta?, ¿agente retenedor?, CIIU, municipio. Del cliente a crédito: **cupo de crédito**, **plazo en días**,
**estado de crédito**. Pestañas: Datos · Crédito y cartera · Documentos · Contactos. Cambiar el cupo o el plazo exige
permiso y queda en bitácora con valor anterior y nuevo (spec 003 FR-012).

### B.2 Factura de venta — `/ventas/facturas` (lista) y `/ventas/facturas/:id` (editor/detalle)

Editor con cabecera (cliente con **resumen de crédito visible**: cupo, exposición, disponible; forma de pago contado/
crédito; plazo; vencimiento calculado; medio de pago; bodega) y grilla de líneas (ítem, descripción, cantidad, precio,
descuento, IVA con tipo y porcentaje, total de línea; **IVA calculado por línea** y total = suma de líneas).
**Línea de tiempo del documento:** `Borrador → Emitida → En transmisión → Aceptada` o `Rechazada`
(+ `Anulada`). Acciones según estado: Emitir (`Ctrl+Enter`), Reenviar, Crear nota crédito, Descargar XML/PDF,
Enviar por correo. Una factura **aceptada** no se edita (spec 009 FR-007).

Estados de error a maquetar (spec 002): stock insuficiente por línea, período cerrado, rango de numeración agotado o
vencido, NIT inválido, **retención de crédito** («Excede el cupo en $ X»). Los efectos de la emisión (consecutivo,
impuestos, inventario, cartera, cupo y asiento) son **una sola operación atómica**: la interfaz muestra «Emitida» o un
error, nunca un estado a medias. Panel «Contabilización» con enlaces a los comprobantes generados (FV-… y costo).

### B.3 Retención de crédito y cupos — `/cartera/credito`

Lista de documentos **retenidos** (`CREDIT_HOLD`: causa, excedente, cliente, fecha). Acción **Liberar** (permiso y
**motivo obligatorio**; queda en bitácora, spec 003 FR-009). Estado de crédito del cliente por prevalencia:
**Suspendido > Bloqueado por mora > Bloqueado por cupo > En alerta > Al día**; alertas al 80 % y 100 % del cupo.

### B.4 Cartera por edades — `/cartera/edades`

Matriz por cliente con cubetas **Corriente · 1–30 · 31–60 · 61–90 · Más de 90** a una **fecha de corte**; totales; el
total **cuadra con el libro mayor** (indicador de conciliación). Clic en una celda abre las facturas. **No hay intereses
de mora automáticos** (si la empresa los cobra, usa nota débito manual).

### B.5 Recibo de caja — `/cartera/recibos/nuevo`

Cliente, fecha, medio de pago, valor recibido; **aplicaciones** a facturas (por defecto las más antiguas vencidas
primero, editable); **retenciones sufridas** (tipo y valor); el **neto en banco** = valor aplicado − retenciones; el
sobrante queda como **anticipo/saldo a favor**. Los recibos son de solo inserción: se corrigen con un recibo de reversa.

### B.6 Nota crédito / devolución — `/ventas/notas/nueva`

Se inicia desde una factura **aceptada** (acción contextual). Por línea: cantidad a devolver (nunca más de lo vendido
menos lo ya devuelto) y **condición** del producto: `Disponible`, `Averiada` o `Vencida`; bodega destino según la
condición; opción de dar de baja lo averiado; **concepto de corrección DIAN**. Vista previa: reversión proporcional del
ingreso, IVA y costo; reingreso **al costo con que salió**; efecto en cartera (reduce saldo o genera saldo a favor) y
cupo liberado. Debe referenciar el CUFE de la factura.

### B.7 Compras — `/compras/facturas/nueva`, `/compras/egresos`, `/compras/devoluciones`

Factura de proveedor: líneas con **valoración de entrada** (precio − descuentos + costos de adquisición + IVA no
descontable), **IVA descontable**, **retenciones practicadas** (ReteFuente por concepto, ReteIVA, ReteICA) con su base
mínima y vigencia, vencimiento. Documento soporte para proveedores no obligados a facturar. Comprobante de egreso con
aplicaciones. Devolución a proveedor al costo de la compra original (PEPS: capa exacta). Certificados de retención por
tercero y concepto. *Ejemplos de retenciones de la spec 005:* 50.000; 0; 40.000; 28.500; 9.660.

### B.8 Ítems — `/inventario/items`

Campos (`ITEM`): SKU, nombre, tipo (simple, kit, variante, servicio), ¿controla inventario?, ¿lotes?, ¿vencimiento?,
**método de costeo** (Promedio ponderado por defecto · PEPS — **obligatorio si es perecedero**; no existe UEPS como
costeo), **política de despacho** (FEFO · FIFO · UEPS · Manual; al elegir UEPS aparece la advertencia de que es solo
despacho físico y no cambia el costo), impuesto, categoría, unidad, **clase ABC** (A/B/C con insignia «nuevo» o
«sin rotación»), demanda manual, publicado en la vitrina. El método de costeo queda **bloqueado** cuando el ítem tiene
movimientos.

### B.9 Existencias y Kardex — `/inventario/existencias`, `/inventario/kardex`

Existencias por ítem/bodega/lote: físico, **reservado**, **disponible**, costo promedio, valor. Tipos de bodega:
principal, avería, cuarentena, tránsito. Kardex: fecha, documento, entrada, salida, **costo**, **saldo** de cantidad y de
valor; en PEPS, detalle de **capas** consumidas. Los movimientos son de solo inserción (se corrigen con un movimiento
inverso). Conciliación del kardex con la cuenta contable (indicador).

### B.10 Clasificación ABC y conteos — `/inventario/abc`

Tabla: ítem, valor de consumo anual, % acumulado previo, clase de Pareto, vueltas por año, rotación, **clase final**.
Umbrales A hasta 80 %, B hasta 95 %, C el resto (configurables). Un ítem sube de inmediato y baja tras dos cálculos
consecutivos; historial. Tareas de **conteo cíclico** por clase (bodega, fecha límite, estado, diferencias). Un conteo
vencido de clase A puede bloquear el cierre del período (configurable).

### B.11 Reposición — `/inventario/reposicion`

Por ítem: demanda promedio diaria y desviación, tiempo de entrega y desviación, nivel de servicio por clase (z),
**stock de seguridad**, **punto de reorden** (ROP = d × L + SS), **posición** (disponible + en órdenes abiertas),
**cantidad sugerida**, marca `Confianza baja` cuando hay menos de 30 días de datos. Acción: crear orden de compra
sugerida. *Ejemplos de la spec 008:* ROP 167, 211 y 173.

### B.12 Factura electrónica — `/fe/documentos`, `/fe/rangos`, `/fe/contingencia`

Documentos con estado ante la DIAN: **Aceptada**, **Aceptada con notificaciones**, **Rechazada** (motivos completos),
**Error transitorio** (reintento). Rangos de numeración (resolución, prefijo, desde, hasta, vigencia, siguiente
número) con **alerta antes de agotarse o vencer**. Cola de contingencia visible. Archivos fiscales (XML firmado,
respuesta DIAN, PDF) con **hash SHA-256**. Un documento solo se entrega al cliente cuando está aceptado.

### B.13 Impuestos — `/impuestos/tarifas`, `/impuestos/retenciones`

Tarifas con **vigencia** (desde/hasta), base mínima en UVT, fuente y **estado de verificación** (✅/⚠️/🔶 como
insignia). UVT por año con su resolución. Conceptos de retención. Cada documento guarda un *snapshot* de lo aplicado.
Si dos tarifas coinciden con igual especificidad el cálculo falla y se avisa al contador.

### B.14 Integraciones — `/integraciones/api-keys`, `/integraciones/webhooks`

API Keys: nombre, prefijo, **alcances mínimos**, vencimiento, último uso, estado. **La clave completa se muestra una
sola vez** al crearla (pantalla de copiado con advertencia) y luego solo el prefijo; acción **Rotar** y **Revocar**.
Webhooks: URL, eventos suscritos, secreto de firma, estado; **entregas** (intentos, código de respuesta, próximo
reintento) con acción **Reenviar**. Los destinos privados se rechazan.

### B.15 Bitácora de auditoría — `/configuracion/auditoria` 💡

Lista de eventos (cierre/reapertura de períodos, liberación de retenciones de crédito, cambios de cupo, ajustes de
inventario…): fecha, usuario, acción, entidad, **motivo**, valor anterior y nuevo. Solo lectura; no se puede borrar.
*(Hoy la bitácora se escribe en base de datos; no hay API de consulta.)*

---

## Parte C — Vitrina pública 📐 (Next.js)

| Pantalla | Contenido |
|---|---|
| Inicio de la empresa | Marca por empresa (logo y color), buscador, categorías, destacados |
| Catálogo | Rejilla de productos con foto principal, nombre, precio vigente y **disponibilidad** (`Agotado` si el stock disponible ≤ 0) |
| Ficha de producto | Hasta 3 fotos, descripción, variantes, precio, cantidad, «Agregar al pedido» |
| Pedido | Carrito, datos del cliente, forma de pago (contado/crédito si tiene cupo); **el precio lo fija el servidor** (nunca el navegador) |
| Confirmación | Estado `Pendiente de confirmación` o `Retenido por crédito`, con número de pedido |

---

## Parte D — Estados globales de interfaz (todas las pantallas)

| Estado | Comportamiento |
|---|---|
| Cargando | Esqueletos que respetan la forma de la tabla; no bloquear toda la página |
| Vacío | Mensaje que explica **por qué** está vacío y ofrece la acción principal |
| Error de red | Banner con «Reintentar» y `requestId` copiable |
| Sin permiso | La entrada de menú no aparece; si se llega por enlace: página 403 con «Pedir acceso» |
| Sesión vencida | Redirige a iniciar sesión conservando la ruta de destino |
| Cambios sin guardar | Diálogo de confirmación antes de salir |
| Solo lectura | Documentos inmutables: sin controles de edición y con la explicación «Para corregir, usa Reversar» |
