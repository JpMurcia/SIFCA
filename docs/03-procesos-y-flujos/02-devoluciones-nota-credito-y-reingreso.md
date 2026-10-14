# Devoluciones (RMA): nota crédito y reingreso al kardex

Estado: **Fase 1 (actualizada)** · Reglas: R-INV-040…046 (devoluciones), R-INV-001/003/016 (costeo), R-FE-009/010
(notas), R-CAR-005/008 (cartera y cupo), R-CON-005 (contraasientos), plantillas contables P-02, P-11 y P-12 ·
Gobernanza: constitución I (inmutabilidad) y III (transacción ACID) · Escenarios ejecutables:
[`004`](../specs/004-devoluciones-ventas-nota-credito/spec.md) y [`005`](../specs/005-compras-y-devolucion-proveedor/spec.md)

## 1. Qué cubre

| Tipo | Documento | Efecto en inventario | Efecto en dinero |
|---|---|---|---|
| **Devolución en venta**, total o parcial | **Nota crédito electrónica** DIAN sobre una factura aceptada | Reingreso al kardex según el estado del producto: disponible o avería/merma | Reversa de ingreso, **IVA** y costo de ventas; ajuste de **cartera** o saldo a favor; reversa proporcional de retenciones 🔶 |
| **Devolución a proveedor** | Nota crédito del proveedor (o nota de ajuste del documento soporte) | Salida de kardex al costo correspondiente | Reduce cuentas por pagar; reversa de IVA descontable y retenciones practicadas |

Principio común: lo que se mueve lo hace **al costo con el que se movió originalmente**, nunca al costo del
día (R-INV-005, R-INV-042). Nada se edita: la devolución es un conjunto de **movimientos y asientos nuevos que
contrarrestan** a los originales (constitución I).

## 2. Devolución en venta: secuencia completa

```mermaid
sequenceDiagram
    autonumber
    actor Op as Operador
    participant API as API (Presentation)
    participant UC as RegisterSalesReturn (Application)
    participant UOW as UnitOfWork
    participant DB as PostgreSQL
    participant TAX as tax
    participant INV as inventory
    participant ARAP as receivables-payables
    participant ACC as accounting
    participant WK as Worker (einvoicing)
    participant PTA as PTA
    participant DIAN as DIAN
    participant DR as DocumentRenderer
    participant MAIL as Correo
    actor Cli as Cliente

    Op->>API: POST /sales/invoices/:id/credit-notes con lineas, cantidad y condicion
    API->>UC: execute(entrada cruda, Idempotency-Key)
    UC->>UC: Valida con Zod: cantidades positivas y condicion RESELLABLE, DAMAGED o EXPIRED
    UC->>UOW: run(operacion)
    UOW->>DB: BEGIN con timeout y aislamiento explicitos
    UOW->>DB: set_config('app.tenant_id', tenant, true)

    rect rgb(255, 245, 245)
    Note over UC,DB: Elegibilidad (R-INV-040)
    UC->>DB: SELECT factura y lineas FOR UPDATE
    UC->>UC: Factura ACCEPTED, periodo abierto y dentro de la ventana de devolucion
    UC->>UC: Cantidad devuelta acumulada no excede lo vendido por linea
    end

    UC->>TAX: Reversa proporcional con el snapshot de tarifas de la factura original
    TAX-->>UC: IVA revertido y retenciones proporcionales
    UC->>DB: SELECT rango de notas credito FOR UPDATE y asigna numero

    UC->>INV: Evento CreditNoteIssued (en proceso)
    rect rgb(240, 250, 240)
    Note over INV,DB: Reingreso al kardex (R-INV-041 y R-INV-042)
    loop Por cada linea devuelta
        INV->>DB: Lee unit_cost_at_sale y los consumos del movimiento SALE_OUT original
        alt Costeo promedio ponderado
            INV->>DB: SELECT item_cost FOR UPDATE
            INV->>INV: Valor de reingreso = costo original de salida, nuevo promedio derivado
        else Costeo PEPS
            INV->>DB: SELECT capas consumidas FOR UPDATE
            INV->>DB: INSERT consumo RESTORE en las capas exactas y sube remaining_quantity
        end
        alt Condicion RESELLABLE
            INV->>DB: INSERT RETURN_IN a bodega vendible, sube disponible
        else Condicion DAMAGED o EXPIRED
            INV->>DB: INSERT RETURN_IN a bodega de averia, no sube disponible
            opt write_off_on_return es verdadero
                INV->>DB: INSERT ADJUST_OUT de la baja al mismo costo
            end
        end
    end
    end

    UC->>ARAP: Evento CreditNoteIssued (en proceso)
    rect rgb(240, 245, 255)
    Note over ARAP,DB: Cartera y cupo (R-CAR-005 y R-CAR-008)
    alt Factura sin pagar o con saldo
        ARAP->>DB: Aplica la nota al saldo de la factura
    else Factura pagada
        ARAP->>DB: Registra saldo a favor del cliente (anticipo)
    end
    ARAP->>DB: Recalcula customer_credit_snapshot y libera cupo
    end

    UC->>ACC: Evento CreditNoteIssued (en proceso)
    ACC->>ACC: Arma el asiento: devoluciones en ventas, IVA, cartera, inventario, costo (P-02 o P-11)
    ACC->>DB: INSERT journal_entry y journal_line (contraasiento, nada se edita)
    Note over DB: El constraint trigger verifica debitos igual a creditos al COMMIT

    UC->>DB: INSERT documento NOTA CREDITO en ISSUED, INSERT outbox_event (return.received, stock.changed)
    UOW->>DB: COMMIT
    UC-->>API: Nota credito ISSUED
    API-->>Op: 202 Accepted

    rect rgb(255, 248, 235)
    Note over WK,DIAN: Transmision asincrona de la nota credito (R-FE-010)
    WK->>WK: Construye UBL con referencia al CUFE de la factura y el concepto de correccion
    WK->>PTA: submit(nota credito)
    PTA->>DIAN: Firma y transmite
    DIAN-->>PTA: Respuesta de validacion
    alt Aceptada
        PTA-->>WK: ACCEPTED con CUFE de la nota
        WK->>DR: Representacion grafica
        DR-->>WK: PDF
        WK->>MAIL: Envia XML y PDF
        MAIL-->>Cli: Nota credito electronica
        WK-->>Op: Webhook invoice.accepted (documento tipo credit_note)
    else Rechazada
        PTA-->>WK: REJECTED con mensajes
        WK-->>Op: Notificacion con motivos
        Note over Op,WK: Se corrige y se retransmite con el mismo numero
    end
    end
```

Lectura del diagrama:

- **Toda la parte superior es una sola transacción** (pasos hasta el `COMMIT`): elegibilidad, número de la
  nota, reingreso al kardex, cartera/cupo y asiento. Si algo falla —por ejemplo, el asiento descuadrado—
  **no queda** movimiento de stock, ni consumo de capa, ni número consumido, ni saldo de cartera alterado.
- La **transmisión a la DIAN es posterior** y asíncrona (igual que la factura); el rechazo se corrige
  conservando el número y, si cambian valores, con un nuevo contraasiento (ADR-0006).
- Las **retenciones sufridas** ya reconocidas en recibos se reversan en proporción 🔶 (decisión pendiente
  del contador, Q-14).

## 3. Decisión por línea: dónde reingresa y a qué costo

```mermaid
flowchart TD
    start(["Linea devuelta"]) --> elig{"Cantidad devuelta mas lo ya devuelto<br/>menor o igual a lo vendido?"}
    elig -- No --> err["409 RETURN_EXCEEDS_SOLD"]
    elig -- Si --> cond{"Condicion declarada"}
    cond -- RESELLABLE --> wh1["Bodega vendible de origen<br/>suma al disponible"]
    cond -- DAMAGED --> wh2["Bodega de averia<br/>no suma al disponible"]
    cond -- EXPIRED --> wh2
    wh1 --> cost{"Metodo de costeo del item"}
    wh2 --> cost
    cost -- Promedio ponderado --> avg["Reingresa al costo de salida original<br/>unit_cost_at_sale<br/>recalcula el promedio derivado"]
    cost -- PEPS --> fifo["Restituye las capas exactas consumidas<br/>en orden inverso al consumo"]
    avg --> wo{"Averiado o vencido y<br/>write_off_on_return?"}
    fifo --> wo
    wo -- Si --> loss["Baja ADJUST_OUT al mismo costo<br/>gasto por averia configurable"]
    wo -- No --> keep["Queda en bodega de averia<br/>pendiente: merma o devolucion al proveedor"]
    loss --> fin(["Asiento y cartera"])
    keep --> fin
```

## 4. Efecto por caso (matriz)

| Condición | Costeo | Factura | Inventario | Cartera | Asiento (resumen) |
|---|---|---|---|---|---|
| `RESELLABLE` | Promedio | Sin pagar | `RETURN_IN` vendible al costo original; promedio recalculado | Reduce el saldo; libera cupo | P-02 |
| `RESELLABLE` | PEPS | Sin pagar | Restituye las capas consumidas | Reduce el saldo; libera cupo | P-02 |
| `RESELLABLE` | Cualquiera | **Pagada** | Igual | **Saldo a favor** del cliente (P-09) o egreso | P-02 + P-09 |
| `DAMAGED`/`EXPIRED` | Cualquiera | Sin pagar | `RETURN_IN` a avería; con baja inmediata `ADJUST_OUT` | Reduce el saldo; libera cupo | **P-11** (gasto por avería) |
| Devolución **total** | Cualquiera | Cualquiera | Todas las líneas según su condición | Saldo de la factura = 0 | Concepto «anulación» de la nota crédito |

## 5. Ejemplo numérico de punta a punta

Factura aceptada: 10 unidades a $100.000 + IVA 19 % ($190.000) = $1.190.000; costo de salida $60.000 por
unidad. Se devuelven **2 unidades**: 1 `RESELLABLE` y 1 `DAMAGED`, con baja inmediata.

| Concepto | Valor |
|---|---:|
| Subtotal devuelto (2 × 100.000) | 200000 |
| IVA revertido (19 %) | 38000 |
| **Total de la nota crédito** | **238000** |
| Costo reingresado (2 × 60.000) | 120000 |
| Del cual dado de baja por avería (1 × 60.000) | 60000 |

Asiento: el de **P-11** (`418.000` = `418.000`). Efectos: el disponible sube **1** unidad; el saldo de la
factura baja $238.000 (si estaba sin pagar) y el cupo se libera en la misma cifra; el costo de ventas baja
$120.000 y el gasto por avería sube $60.000.

**Variante PEPS:** si el ítem se costea en PEPS y las 10 unidades vendidas consumieron la capa 1 (@ $60.000),
la unidad vendible restituye 1 unidad de la capa 1 y la averiada se restituye y luego se da de baja; el valor
del inventario queda igual que en promedio porque ambas capas tenían el mismo costo (con capas de costo
distinto, la restitución respeta la capa original; ejemplo en R-INV-042).

## 6. Devolución a proveedor (secuencia resumida)

```mermaid
sequenceDiagram
    autonumber
    actor Op as Operador
    participant API as API (Presentation)
    participant UC as RegisterPurchaseReturn (Application)
    participant UOW as UnitOfWork
    participant DB as PostgreSQL
    participant INV as inventory
    participant ARAP as receivables-payables
    participant ACC as accounting

    Op->>API: POST /purchases/bills/:id/returns con lineas y cantidades
    API->>UC: execute(entrada cruda)
    UC->>UC: Valida con Zod
    UC->>UOW: run(operacion)
    UOW->>DB: BEGIN y set_config del tenant
    UC->>DB: SELECT compra y lineas FOR UPDATE
    UC->>UC: Cantidad devuelta acumulada no excede lo recibido
    UC->>INV: Evento PurchaseReturned (en proceso)
    alt Promedio ponderado
        INV->>DB: Salida RETURN_OUT al costo de la compra original, actualiza item_cost
    else PEPS
        INV->>DB: Salida desde la capa de esa entrada, limitada a su cantidad restante
    end
    UC->>ARAP: Evento PurchaseReturned (en proceso)
    alt Compra sin pagar
        ARAP->>DB: Reduce la cuenta por pagar del proveedor
    else Compra pagada
        ARAP->>DB: Registra saldo a favor con el proveedor (anticipo)
    end
    UC->>ACC: Evento PurchaseReturned (en proceso)
    ACC->>DB: Asiento P-12 con reversa de IVA descontable y retenciones proporcionales
    UC->>DB: INSERT outbox_event (stock.changed, purchase.returned)
    UOW->>DB: COMMIT
    API-->>Op: 201 Devolucion registrada
```

Si el proveedor es **no obligado a facturar** y la compra se soportó con **documento soporte**, la
devolución se formaliza con su **nota de ajuste** (R-FE-014). El proveedor obligado a facturar emite su nota
crédito electrónica y SIFCA la registra y la asocia.

## 7. Atomicidad y puntos de falla

| Punto de falla (dentro de la transacción) | Resultado |
|---|---|
| Cantidad excede lo vendido | `409 RETURN_EXCEEDS_SOLD`; nada cambia |
| Ventana de devolución vencida | `409 RETURN_WINDOW_EXPIRED` salvo permiso `sales.return.override` |
| Capa PEPS a restituir no encontrada (dato inconsistente) | Error y rollback; alerta para revisión (INV-13) |
| Asiento descuadrado | El *constraint trigger* falla al `COMMIT`; rollback completo |
| Reintento del mismo `POST` | La clave de idempotencia devuelve la misma nota; no se duplica el reingreso |
| Falla de la DIAN o del PTA | La nota ya existe localmente (`ISSUED`); la transmisión se reintenta o se corrige (R-FE-008) |

## 8. Eventos publicados

| Evento | Cuándo | Consumidores típicos |
|---|---|---|
| `return.received` | Al emitir la nota crédito con reingreso | Integraciones, reporte de devoluciones |
| `stock.changed` | Por cada línea reingresada | Sistemas externos de inventario |
| `credit.limit.warning` / `credit.status.changed` | Si la liberación de cupo cambia el estado de crédito | Cartera |
| `invoice.accepted` (de la nota) | Tras la aceptación de la DIAN | Cliente (correo) |
