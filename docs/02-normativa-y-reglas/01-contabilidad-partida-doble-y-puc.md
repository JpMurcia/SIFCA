# Contabilidad: partida doble, PUC y comprobantes

Estado de verificación: ver el registro en [`README.md`](README.md). Las citas sin marcador son 🔶 hasta
que un contador las valide.

## 1. Marco normativo y de reporte

| Norma | Qué aporta al sistema | Estado |
|---|---|---|
| Ley 1314 de 2009 | Convergencia a estándares internacionales de información financiera; base de los marcos técnicos | 🔶 |
| Decreto 2420 de 2015 (Decreto Único Reglamentario de normas de contabilidad, información financiera y aseguramiento) y sus modificaciones | Marcos técnicos por grupo: **Grupo 1** NIIF plenas, **Grupo 2** NIIF para las Pymes, **Grupo 3** contabilidad simplificada para microempresas | 🔶 |
| NIIF para las Pymes (Sección 3 y siguientes) | Estados financieros: situación financiera, resultado integral, cambios en el patrimonio, flujos de efectivo, notas | 🔶 |
| Código de Comercio (obligación de llevar contabilidad y libros de comercio) | Libros oficiales: diario, mayor y balances, inventarios y balances | 🔶 (artículos por confirmar) |
| Decreto 2650 de 1993 (PUC para comerciantes) | Estructura clásica de clases/grupos/cuentas que adoptó el mercado | 🔶 — su obligatoriedad para quienes aplican NIIF es discutible; ver §3 |
| Estatuto Tributario art. 771-2 y 616-1 | Soporte con factura para costos, deducciones e IVA descontable | 🔶 |
| Ley 43 de 1990 | Profesión de contador: responsabilidad de firmar estados financieros | 🔶 |

> **Marco contable por defecto: Grupo 2 (S-03).** Los clientes del Grupo 3 usan reglas simplificadas
> (Q-05); el motor de comprobantes es el mismo, cambia la plantilla de estados financieros.

## 2. Reglas de partida doble y comprobantes

### R-CON-001 · Todo comprobante cuadra
**Σ débitos = Σ créditos**, en pesos y con 2 decimales exactos, antes de contabilizar.
- **Fuente:** principio de partida doble (base de toda la contabilidad).
- **Prueba:** propiedad con `fast-check`: para cualquier lista de líneas generada que cumpla R-CON-002,
  `post()` solo tiene éxito si las sumas coinciden; el *constraint trigger* de la base rechaza la inserción
  descuadrada incluso si el código falla.

### R-CON-002 · Cada línea tiene un solo lado, positivo
Una línea tiene `debit > 0` y `credit = 0`, o `credit > 0` y `debit = 0`. Nada de negativos ni de ambos.
- **Motivo:** los «negativos» ocultan errores de signo; una reversión se hace con el lado opuesto.
- **Prueba:** `CHECK ((debit > 0) <> (credit > 0))`.

### R-CON-003 · Mínimo dos líneas y solo cuentas auxiliares activas
Un comprobante tiene al menos dos líneas y solo se mueve en cuentas **auxiliares** (`allows_posting = true`)
y activas. Las cuentas de clase, grupo, cuenta y subcuenta son acumuladoras.

### R-CON-004 · Solo en períodos abiertos
La fecha contable debe pertenecer a un período `OPEN`. Un período cerrado rechaza cualquier comprobante, aun
con permisos de administrador; reabrirlo es una operación explícita, auditada y con permiso propio
(`accounting.period.reopen`).

### R-CON-005 · Inmutabilidad y reversión
Un comprobante contabilizado **no se edita ni se elimina**. Se corrige con un comprobante de **reversión**
(mismas cuentas, lados invertidos, mismo tercero y referencia al original) seguido, si aplica, del comprobante
correcto. La reversión se fecha en el período abierto actual salvo que el original sea del mismo período
abierto.
- **Prueba:** `UPDATE`/`DELETE` sobre `journal_entry`/`journal_line` fallan por *trigger*; `reverse(entry)`
  produce Σ por cuenta = 0 al sumarse con el original.

### R-CON-006 · Consecutivo propio por tipo de comprobante, sin saltos ni duplicados
Cada tipo de comprobante (`FV`, `NC`, `RC`, `CE`, `NOT`, `AJ`…) tiene su numeración. La numeración puede
reiniciar por año (`numbering_scope = YEAR`). El número se asigna **dentro de la transacción** que contabiliza;
si la transacción falla, no se consume número.
- **Distinto de la numeración DIAN** de facturas (R-FE-003/004), que es una autorización externa por rango.
  Un documento fiscal tiene ambos: su número DIAN y su comprobante contable.

### R-CON-007 · Trazabilidad al documento fuente
Todo comprobante automático guarda `source_type` + `source_id`. Para cada documento fuente, los totales
del comprobante coinciden con los del documento (base, impuestos, retenciones, total). Un trabajo de
conciliación interna lo verifica periódicamente (INV-10).

### R-CON-008 · Tercero y dimensión obligatorios según la cuenta
Las cuentas con `requires_party = true` (clientes, proveedores, anticipos, impuestos y retenciones por
pagar/cobrar, anticipos) exigen `party_id` en cada línea; las que tengan `requires_cost_center = true`
exigen centro de costo. **Motivo:** sin tercero por línea no se pueden producir cartera, certificados de
retención ni información exógena.

### R-CON-009 · Aritmética decimal y redondeo
1. Todo importe usa decimal exacto (`NUMERIC`/`Decimal`), **nunca** `float`.
2. Importes en COP con **2 decimales**; costo unitario con 6; cantidades con 4.
3. Redondeo **mitad hacia arriba** (*half-up*) sobre el valor absoluto, **por línea**, y los totales del
   documento son la **suma de las líneas ya redondeadas** (no se recalculan desde la base total). Esto es lo
   que permite que los totales coincidan con lo transmitido a la DIAN.
4. Cuando un reparto proporcional deja un residuo (p. ej. prorrateo de descuento), el residuo se asigna a la
   última línea.
- **Estado:** 🔶 — la tolerancia de redondeo que acepta la validación de la DIAN debe tomarse del Anexo
  Técnico y probarse con sus vectores.
- **Ejemplo:** 3 líneas de $333,33 → subtotal $999,99, no $1.000,00.

### R-CON-010 · Libros oficiales
El sistema produce, por rango de fechas o por período, los libros **Diario** (cronológico), **Mayor y
balances** (por cuenta, con saldo inicial, movimientos y saldo final) y **Inventarios y balances**. Cada
reporte es reproducible: mismos datos y rango producen el mismo resultado byte a byte (útil para
auditoría).

### R-CON-011 · Cierre mensual
Cerrar un período exige: sin comprobantes en borrador, balance de prueba cuadrado, conciliaciones internas
en verde (INV-10) y permiso `accounting.period.close`. Tras el cierre, el balance del período se puede
materializar (§5 de `02-modelo-de-datos…`).

### R-CON-012 · Cierre anual
Al cerrar el ejercicio se cancelan las cuentas de resultado (clases 4, 5, 6 y 7) contra la cuenta de
**Ganancias y pérdidas** (grupo 59) y se traslada el resultado a **Utilidad o pérdida del ejercicio**
(grupo 36) 🔶. Se genera como un comprobante de cierre normal (R-CON-001…008) y es reversible mientras el
siguiente ejercicio no esté cerrado.

### R-CON-013 · Naturaleza de las cuentas
Cada cuenta tiene naturaleza **débito** (activos, gastos, costos, cuentas de orden deudoras) o **crédito**
(pasivos, patrimonio, ingresos, cuentas de orden acreedoras). El saldo se presenta según su naturaleza; un
saldo contrario se muestra con signo y se marca como alerta, no se oculta.

### R-CON-014 · Fecha, hora y zona
La fecha contable es una fecha (`date`); no depende de la zona horaria. Los instantes se guardan en UTC y se
presentan en `America/Bogota`. Una factura emitida a las 23:30 hora Colombia del 31 de enero pertenece a enero.

## 3. Plan de cuentas (PUC)

### 3.1 Estructura

| Nivel | Dígitos | Ejemplo | ¿Se mueve? |
|---|---|---|---|
| Clase | 1 | `1` Activo | No |
| Grupo | 2 | `13` Deudores | No |
| Cuenta | 4 | `1305` Clientes | No (acumuladora) |
| Subcuenta | 6 | `130505` Clientes nacionales | Depende de la política de la empresa |
| Auxiliar | 8 o más | `13050501` | Sí |

| Clase | Nombre | Naturaleza |
|---|---|---|
| 1 | Activo | Débito |
| 2 | Pasivo | Crédito |
| 3 | Patrimonio | Crédito |
| 4 | Ingresos | Crédito |
| 5 | Gastos | Débito |
| 6 | Costos de ventas | Débito |
| 7 | Costos de producción o de operación | Débito |
| 8 | Cuentas de orden deudoras | Débito |
| 9 | Cuentas de orden acreedoras | Crédito |

### 3.2 Estatus del PUC y decisión de diseño

El PUC del Decreto 2650 de 1993 fue la estructura que adoptó el mercado y sigue siendo la referencia de
codificación de casi todo el software contable colombiano. Con la convergencia a NIIF su obligatoriedad
como norma para quienes aplican NIIF es discutible 🔶, y la Superintendencia Financiera tiene un plan propio
para sus vigilados. **Decisiones:**

1. SIFCA siembra un plan de cuentas inicial **basado en la estructura clásica**, revisado por el contador y
   alineado a las partidas de los estados financieros NIIF Pymes.
2. El plan es **por empresa y editable** (agregar auxiliares, desactivar cuentas), pero los niveles de
   clase, grupo y cuenta de 4 dígitos usados por las plantillas son **protegidos**.
3. Las plantillas de contabilización (§4) referencian **conceptos** (`REVENUE`, `VAT_OUTPUT`, `RECEIVABLE`…),
   no códigos; cada empresa mapea concepto → cuenta (`posting_rule_line`). Así el plan puede cambiar sin tocar
   código.

### 3.3 Cuentas de 4 dígitos usadas en los ejemplos 🔶

| Cuenta | Nombre | Naturaleza | Concepto |
|---|---|---|---|
| 1105 | Caja | Débito | `CASH` |
| 1110 | Bancos | Débito | `BANK` |
| 1305 | Clientes | Débito | `RECEIVABLE` |
| 1355 | Anticipo de impuestos y contribuciones o saldos a favor | Débito | `TAX_ADVANCE` (subcuentas: retención en la fuente, IVA retenido, ICA retenido a favor) |
| 1435 | Mercancías no fabricadas por la empresa | Débito | `INVENTORY_GOODS` |
| 2205 | Proveedores nacionales | Crédito | `PAYABLE` |
| 2335 | Costos y gastos por pagar | Crédito | `EXPENSE_PAYABLE` |
| 2805 | Anticipos y avances recibidos | Crédito | `CUSTOMER_ADVANCE` |
| 1330 | Anticipos y avances (entregados a proveedores) | Débito | `SUPPLIER_ADVANCE` |
| 5xxx | Pérdida por avería/merma de inventario (cuenta configurable) | Débito | `INVENTORY_LOSS_EXPENSE` |
| 2365 | Retención en la fuente | Crédito | `WITHHOLDING_INCOME_PAYABLE` |
| 2367 | Impuesto a las ventas retenido | Crédito | `WITHHOLDING_VAT_PAYABLE` |
| 2368 | Impuesto de industria y comercio retenido | Crédito | `WITHHOLDING_ICA_PAYABLE` |
| 2408 | Impuesto sobre las ventas por pagar (subcuentas: IVA generado / IVA descontable) | Crédito | `VAT_OUTPUT`, `VAT_INPUT` |
| 3115 | Aportes sociales / capital | Crédito | `EQUITY_CAPITAL` |
| 4135 | Comercio al por mayor y al por menor (ingresos) | Crédito | `REVENUE` |
| 4175 | Devoluciones en ventas (DB) | Débito | `SALES_RETURNS` |
| 4210 | Financieros (ingresos) | Crédito | `INTEREST_INCOME` |
| 5135 | Servicios (gastos operacionales de administración) | Débito | `EXPENSE_SERVICES` |
| 5305 | Financieros (gastos no operacionales) | Débito | `INTEREST_EXPENSE` |
| 6135 | Comercio al por mayor y al por menor (costo de ventas) | Débito | `COGS` |

## 4. Plantillas de contabilización automática

Cada plantilla define el comprobante que genera un evento. Los ejemplos usan pesos y las cifras se
verificaron con cálculo exacto. Cuentas a 4 dígitos; las subcuentas son configurables por empresa.

### P-01 · Factura de venta a crédito con IVA (evento `InvoiceIssued`)

Venta de 10 unidades a $100.000, IVA 19 %, costo promedio $60.000.

| Cuenta | Débito | Crédito |
|---|---:|---:|
| 1305 Clientes | 1190000 | |
| 4135 Ingresos por ventas | | 1000000 |
| 2408 IVA generado | | 190000 |
| **Subtotal comprobante FV** | **1190000** | **1190000** |

Comprobante de costo (mismo evento, generado por `inventory` al costo del método del ítem: promedio, R-INV-003, o PEPS, R-INV-016):

| Cuenta | Débito | Crédito |
|---|---:|---:|
| 6135 Costo de ventas | 600000 | |
| 1435 Mercancías | | 600000 |

> En ventas **de contado**, la línea de `1305` se reemplaza por `1105`/`1110` según el medio de pago.

### P-02 · Nota crédito por devolución parcial (evento `CreditNoteIssued`)

Devolución de 2 de las 10 unidades de P-01: subtotal $200.000, IVA $38.000, total $238.000. El inventario
reingresa al **costo con el que salió** (R-INV-005): 2 × 60.000 = $120.000.

| Cuenta | Débito | Crédito |
|---|---:|---:|
| 4175 Devoluciones en ventas | 200000 | |
| 2408 IVA generado (reverso) | 38000 | |
| 1305 Clientes | | 238000 |
| 1435 Mercancías | 120000 | |
| 6135 Costo de ventas (reverso) | | 120000 |

### P-03 · Recibo de caja sin retenciones (evento `ReceiptRegistered`)

Cobro del saldo de P-01 tras P-02: $1.190.000 − $238.000 = $952.000.

| Cuenta | Débito | Crédito |
|---|---:|---:|
| 1110 Bancos | 952000 | |
| 1305 Clientes | | 952000 |

### P-04 · Venta a un agente de retención (retenciones sufridas)

Se separa en dos comprobantes, porque el cliente retiene **al pagar** (política por defecto
`retentions_recognized_at = RECEIPT`; configurable a `INVOICE`).

Venta de $2.000.000 + IVA 19 % ($380.000) = $2.380.000. Retenciones del ejemplo (ver
[`02-impuestos…`](02-impuestos-y-retenciones.md) §6): ReteFuente 2,5 % = $50.000; ReteIVA 15 % del IVA =
$57.000; ReteICA ilustrativa 9,66 ‰ = $19.320.

**a) Factura**

| Cuenta | Débito | Crédito |
|---|---:|---:|
| 1305 Clientes | 2380000 | |
| 4135 Ingresos por ventas | | 2000000 |
| 2408 IVA generado | | 380000 |

**b) Recibo de caja con retenciones** (neto recibido: 2.380.000 − 50.000 − 57.000 − 19.320 = **2.253.680**)

| Cuenta | Débito | Crédito |
|---|---:|---:|
| 1110 Bancos | 2253680 | |
| 1355 Retención en la fuente a favor | 50000 | |
| 1355 IVA retenido a favor | 57000 | |
| 1355 ICA retenido a favor | 19320 | |
| 1305 Clientes | | 2380000 |
| **Totales** | **2380000** | **2380000** |

### P-05 · Compra de mercancía con retención (evento `SupplierInvoiceRegistered`)

200 unidades a $10.000 = $2.000.000 + IVA 19 % ($380.000). Compra de bienes: la base ($2.000.000) supera la
base mínima de 27 UVT ($1.414.098), ReteFuente 2,5 % = $50.000 (proveedor declarante de renta).

| Cuenta | Débito | Crédito |
|---|---:|---:|
| 1435 Mercancías | 2000000 | |
| 2408 IVA descontable | 380000 | |
| 2365 Retención en la fuente | | 50000 |
| 2205 Proveedores | | 2330000 |
| **Totales** | **2380000** | **2380000** |

### P-06 · Compra de servicios con ReteFuente, ReteIVA y ReteICA

Servicio de $1.000.000 + IVA $190.000. ReteFuente servicios 4 % = $40.000; ReteIVA 15 % del IVA = $28.500;
ReteICA ilustrativa 9,66 ‰ = $9.660.

| Cuenta | Débito | Crédito |
|---|---:|---:|
| 5135 Servicios (gasto) | 1000000 | |
| 2408 IVA descontable | 190000 | |
| 2365 Retención en la fuente | | 40000 |
| 2367 IVA retenido | | 28500 |
| 2368 ICA retenido | | 9660 |
| 2335 Costos y gastos por pagar | | 1111840 |
| **Totales** | **1190000** | **1190000** |

### P-07 · Comprobante de egreso (pago a proveedor)

| Cuenta | Débito | Crédito |
|---|---:|---:|
| 2205 Proveedores | 2330000 | |
| 1110 Bancos | | 2330000 |

### P-08 · Documento soporte en adquisiciones a no obligados a facturar

Débito: gasto o costo (o inventario); Crédito: `2335`/`2205` y retenciones que correspondan. Sin IVA
descontable cuando el vendedor no es responsable de IVA. Los casos con IVA asumido por servicios del exterior
quedan para una fase posterior 🔶.

### P-09 · Anticipo de cliente y saldo a favor

Un recibo de caja que no se aplica por completo, o una nota crédito sobre una factura ya pagada, deja un
**saldo a favor** del cliente (cuenta 2805 «Anticipos y avances recibidos» 🔶; concepto `CUSTOMER_ADVANCE`).

| Momento | Débito | Crédito |
|---|---|---|
| Recibo de 500.000 sin factura asociada | 1110 Bancos 500000 | 2805 Anticipos de clientes 500000 |
| Aplicación del anticipo a una factura de 500.000 | 2805 Anticipos de clientes 500000 | 1305 Clientes 500000 |

### P-10 · Cierre de ejercicio (R-CON-012)

Cancela clases 4, 5 y 6 contra 59 y traslada a 36. Se genera por un caso de uso específico, no por el flujo
normal de documentos.

### P-11 · Nota crédito con devolución en mal estado (avería/merma)

Continuación de P-02: de las 2 unidades devueltas, 1 es `RESELLABLE` y 1 `DAMAGED`. Todo a costo de salida
60.000 (R-INV-042). La unidad averiada reingresa a la bodega de avería y se da de baja en la misma
transacción (`write_off_on_return = true`).

| Cuenta | Débito | Crédito |
|---|---:|---:|
| 4175 Devoluciones en ventas | 200000 | |
| 2408 IVA generado (reverso) | 38000 | |
| 1305 Clientes | | 238000 |
| 1435 Mercancías (reingreso de las 2 unidades) | 120000 | |
| 6135 Costo de ventas (reverso) | | 120000 |
| 5xxx Pérdida por avería de inventario (cuenta configurable `INVENTORY_LOSS_EXPENSE`) | 60000 | |
| 1435 Mercancías (baja de la unidad averiada) | | 60000 |
| **Totales** | **418000** | **418000** |

Efecto neto: el costo de ventas baja 120.000, el gasto por avería sube 60.000 y el inventario disponible
sube 1 unidad (60.000).

### P-12 · Devolución a proveedor con nota crédito del proveedor

Se devuelven 100 unidades de la compra de P-05 (costo unitario 10.000): base 1.000.000 + IVA 190.000.
La retención practicada se reversa en proporción: 2,5 % de 1.000.000 = 25.000 🔶 (la base mínima de la
compra original se evaluó sobre la operación completa).

| Cuenta | Débito | Crédito |
|---|---:|---:|
| 2205 Proveedores | 1165000 | |
| 2365 Retención en la fuente (reverso) | 25000 | |
| 1435 Mercancías | | 1000000 |
| 2408 IVA descontable (reverso) | | 190000 |
| **Totales** | **1190000** | **1190000** |

Si el proveedor ya había sido pagado, `Dr 2205` se reemplaza por `Dr 1330 Anticipos y avances (saldo a
favor con el proveedor)` o por el cobro del reembolso.

## 5. Balance de prueba de referencia (fixture)

Conjunto P-01 → P-02 → P-03, con apertura de inventario por $1.000.000 aportados como capital
(`Dr 1435 / Cr 3115`). Debe producir:

| Cuenta | Débito | Crédito |
|---|---:|---:|
| 1110 Bancos | 952000 | |
| 1305 Clientes | 0 | 0 |
| 1435 Mercancías (1.000.000 − 600.000 + 120.000) | 520000 | |
| 2408 IVA (190.000 − 38.000) | | 152000 |
| 3115 Capital | | 1000000 |
| 4135 Ingresos por ventas | | 1000000 |
| 4175 Devoluciones en ventas | 200000 | |
| 6135 Costo de ventas (600.000 − 120.000) | 480000 | |
| **Totales** | **2152000** | **2152000** |

**Prueba:** `trialBalance(asOf)` devuelve exactamente esta tabla y sus totales cuadran (R-CON-001); la
utilidad bruta es 1.000.000 − 200.000 − 480.000 = **320.000**.

## 6. Estados financieros (alcance por fases)

| Estado | Fase | Notas |
|---|---|---|
| Balance de prueba | F2 | Por cuenta, con saldo inicial, débitos, créditos y saldo final |
| Estado de situación financiera | F2–F3 | Clasificación corriente / no corriente por cuenta (atributo del plan) |
| Estado de resultados | F2–F3 | Ingresos − devoluciones − costo de ventas − gastos |
| Flujo de efectivo (método indirecto) | Posterior | Requiere clasificación de cuentas por actividad |
| Cambios en el patrimonio y notas | Posterior | Plantilla asistida por el contador |
