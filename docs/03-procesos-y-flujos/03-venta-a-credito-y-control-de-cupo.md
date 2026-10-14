# Venta a crédito: control de cupo, mora y bloqueo de despacho

Estado: **Fase 1 (actualizada)** · Reglas: R-CAR-002, 003, 006, 008, 012…015 · Gobernanza: constitución III
(el consumo de cupo es parte de la transacción comercial) · Escenarios ejecutables:
[`003-ventas-credito-y-cartera`](../specs/003-ventas-credito-y-cartera/spec.md)

## 1. Control de crédito al confirmar, facturar y despachar

```mermaid
sequenceDiagram
    autonumber
    actor Op as Vendedor o cajero
    participant API as API (Presentation)
    participant UC as ConfirmOrder / IssueInvoice (Application)
    participant UOW as UnitOfWork
    participant DB as PostgreSQL
    participant ARAP as receivables-payables (CreditPolicyPort)
    actor Cart as Responsable de cartera

    Op->>API: Confirma pedido a credito o emite factura CREDITO
    API->>UC: execute(entrada cruda)
    UC->>UC: Valida con Zod
    UC->>UOW: run(operacion)
    UOW->>DB: BEGIN y set_config del tenant
    UC->>ARAP: check(cliente, valor del documento)
    ARAP->>DB: SELECT customer_credit_snapshot FOR UPDATE
    ARAP->>ARAP: exposicion = cartera + pedidos confirmados - saldos a favor
    alt credit_limit es 0 o nulo
        ARAP-->>UC: CREDIT_NOT_ALLOWED
        UC-->>API: 409 solo contado
    else Cliente suspendido, en mora sobre el umbral o excede el cupo
        ARAP-->>UC: Retener (causa, exposicion, excedente)
        UC->>DB: INSERT credit_hold y estado CREDIT_HOLD, INSERT outbox_event credit.hold.created
        UOW->>DB: COMMIT del estado retenido
        UC-->>API: 409 CREDIT_LIMIT_EXCEEDED o CUSTOMER_BLOCKED_OVERDUE
        API-->>Op: Documento retenido
        Note over Cart: Recibe credit.hold.created
    else Dentro del cupo
        ARAP->>DB: Reserva o consume cupo en el snapshot
        ARAP-->>UC: Permitido
        UC->>DB: Continua el flujo comercial dentro de la misma transaccion
        UOW->>DB: COMMIT
        UC-->>API: Documento confirmado o emitido
    end
```

Notas:

- El control se hace **dentro** de la transacción comercial, con el snapshot bloqueado (`FOR UPDATE`): dos
  pedidos simultáneos que juntos superen el cupo **no** pasan ambos.
- Una retención **no borra ni edita** el documento: cambia su estado y registra la causa (principio I).
- Una venta de **contado** nunca consume cupo ni se retiene por cupo; un cliente `BLOQUEADO_MORA` puede
  comprar de contado.

## 2. Liberación de un documento retenido

```mermaid
sequenceDiagram
    autonumber
    actor Cart as Responsable con permiso sales.credit.release
    participant API as API (Presentation)
    participant UC as ReleaseCreditHold (Application)
    participant UOW as UnitOfWork
    participant DB as PostgreSQL
    participant ARAP as receivables-payables

    Cart->>API: POST /sales/orders/:id/credit-release con motivo
    API->>UC: execute(entrada cruda)
    UC->>UC: Valida con Zod: motivo obligatorio de 5 a 500 caracteres
    UC->>UOW: run(operacion)
    UOW->>DB: BEGIN y set_config del tenant
    UC->>DB: SELECT credit_hold FOR UPDATE, debe estar en HELD
    UC->>ARAP: Reserva el cupo del documento pese al excedente (excepcion)
    UC->>DB: UPDATE estado del documento a liberado, INSERT bitacora con usuario y motivo
    UC->>DB: INSERT outbox_event credit.hold.released
    UOW->>DB: COMMIT
    API-->>Cart: 200 Documento liberado
```

## 3. Recepción de un abono y efecto en cupo y estado

```mermaid
sequenceDiagram
    autonumber
    actor Op as Cajero o cobranza
    participant API as API (Presentation)
    participant UC as RegisterReceipt (Application)
    participant UOW as UnitOfWork
    participant DB as PostgreSQL
    participant ARAP as receivables-payables
    participant ACC as accounting

    Op->>API: POST /receivables/receipts con valor, retenciones sufridas y aplicaciones
    API->>UC: execute(entrada cruda, Idempotency-Key)
    UC->>UC: Valida con Zod
    UC->>UOW: run(operacion)
    UOW->>DB: BEGIN y set_config del tenant
    UC->>DB: SELECT facturas a aplicar FOR UPDATE
    UC->>UC: Suma de aplicaciones no excede el recibo ni el saldo de cada factura
    UC->>ARAP: Evento ReceiptRegistered (en proceso)
    ARAP->>DB: INSERT receipt y receipt_allocation, factura queda PARCIAL o PAGADA
    ARAP->>DB: Recalcula customer_credit_snapshot, libera cupo y recalcula estado y edades
    UC->>ACC: Evento ReceiptRegistered (en proceso)
    ACC->>DB: Asiento de recibo (P-03, P-04b o P-09) cuadrado
    opt El estado de credito cambia
        UC->>DB: INSERT outbox_event credit.status.changed
    end
    UOW->>DB: COMMIT
    API-->>Op: 201 Recibo registrado
```

## 4. Trabajos programados de cartera

| Trabajo | Frecuencia | Qué hace | Reglas |
|---|---|---|---|
| Recalcular edades y estado de crédito | Diario (madrugada, hora de Bogotá) | Recorre facturas con saldo, calcula la mora, actualiza el snapshot y emite `receivable.overdue` y `credit.status.changed` | R-CAR-006, 013, 014 |
| Conciliar cartera con el mayor | Diario | Compara Σ cartera por cliente con las cuentas de clientes; alerta y bloquea el cierre mensual si difieren | R-CAR-001, INV-14 |
| Recordatorios de cobro | Según política | Envía recordatorios por canales autorizados | R-CAR-009 |
| Expirar reservas de cupo de pedidos sin confirmar | Cada hora | Libera cupo reservado por pedidos vencidos | R-CAR-008 |
