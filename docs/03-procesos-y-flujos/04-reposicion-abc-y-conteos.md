# Reposición, clasificación ABC y conteos cíclicos

Estado: **Fase 1 (actualizada)** · Reglas: R-INV-020…023 (ABC y conteos), R-INV-030…034 (punto de reorden) ·
Escenarios ejecutables: [`007`](../specs/007-clasificacion-abc-y-conteos/spec.md) y
[`008`](../specs/008-punto-de-reorden/spec.md)

## 1. Trabajos programados de logística

```mermaid
sequenceDiagram
    autonumber
    participant SCH as Planificador (worker)
    participant UC as Caso de uso (Application)
    participant DB as PostgreSQL
    participant OUT as Outbox y webhooks
    actor Bod as Bodega y compras

    rect rgb(240, 245, 255)
    Note over SCH,DB: Mensual: clasificacion ABC (R-INV-020 y R-INV-021)
    SCH->>UC: ClassifyInventoryAbc(tenant)
    UC->>DB: Lee costo de ventas netas por item en la ventana y valor promedio del inventario
    UC->>UC: Pareto por acumulado previo, rotacion y matriz de clase final
    UC->>UC: Aplica la regla de estabilidad: baja de clase solo tras dos calculos consecutivos
    UC->>DB: INSERT abc_classification (historial) y actualiza item.abc_class
    UC->>DB: INSERT cycle_count_task segun la politica de cada clase
    UC->>OUT: inventory.abc.reclassified por cada cambio
    end

    rect rgb(240, 250, 240)
    Note over SCH,DB: Diario y al recibir mercancia: punto de reorden (R-INV-030 a R-INV-034)
    SCH->>UC: ComputeReorderPoints(tenant)
    UC->>DB: Lee demanda diaria neta, dias con disponible cero, lead times reales y ordenes abiertas
    UC->>UC: d, desviacion estandar, L, SS = z por raiz de (L por sigma_d al cuadrado + d al cuadrado por sigma_L al cuadrado)
    UC->>UC: ROP = d por L + SS, posicion = disponible + pendiente en ordenes
    UC->>DB: UPSERT reorder_metrics
    alt posicion menor o igual a ROP
        UC->>OUT: inventory.reorder.required con item, posicion, ROP y cantidad sugerida
        OUT-->>Bod: Alerta (tiempo real en clase A)
    end
    end

    rect rgb(255, 248, 235)
    Note over Bod,DB: Conteo ciclico (R-INV-022)
    Bod->>UC: RegisterCycleCount(tarea, cantidades contadas)
    UC->>DB: Compara contra el sistema, genera ajustes ADJUST_IN o ADJUST_OUT al costo del item
    UC->>DB: Asiento del ajuste, en la misma transaccion
    UC->>DB: Marca la tarea ADJUSTED
    end
```

Notas:

- Los tres bloques son **casos de uso independientes**, cada uno con su transacción (el último cumple la
  regla de transaccionalidad: ajuste de kardex y asiento juntos).
- Los cálculos de ABC y ROP son **servicios de dominio puros** (`AbcClassifier`, `ReorderPointCalculator`): no
  conocen la base de datos; el caso de uso les entrega datos ya leídos y la fecha (sin `Date.now()`).
- Un conteo vencido de clase A puede **bloquear el cierre del período** (R-INV-022, R-CON-011).
