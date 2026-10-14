# language: es
@P-II
Característica: Punto de reorden y stock de seguridad
  Para reponer a tiempo sin inmovilizar capital
  El sistema calcula ROP = d × L + SS y avisa cuando la posición de inventario lo cruza

  @R-INV-032
  Escenario: [008-01] Punto de reorden con tiempo de entrega constante al 95 %
    Dado un ítem con demanda promedio diaria de 20, tiempo de entrega de 7 días y desviación de la demanda de 6
    Y un nivel de servicio del 95 % con z de 1.645
    Cuando se calcula el punto de reorden
    Entonces el stock de seguridad es 27
    Y el punto de reorden es 167

  @R-INV-032
  Escenario: [008-02] La variabilidad del tiempo de entrega aumenta el stock de seguridad
    Dado el mismo ítem con una desviación del tiempo de entrega de 2 días
    Cuando se calcula el punto de reorden
    Entonces el stock de seguridad es 71
    Y el punto de reorden es 211

  @R-INV-032
  Escenario: [008-03] Un ítem de clase A usa un nivel de servicio del 98 %
    Dado el mismo ítem de clase A con z de 2.0537
    Cuando se calcula el punto de reorden con tiempo de entrega constante
    Entonces el stock de seguridad es 33
    Y el punto de reorden es 173

  @R-INV-032
  Esquema del escenario: [008-04] El nivel de servicio por defecto depende de la clase ABC
    Dado un ítem de clase <clase>
    Cuando se consulta su nivel de servicio objetivo
    Entonces el nivel es <nivel> con z de <z>

    Ejemplos:
      | clase | nivel | z      |
      | A     | 98 %  | 2.0537 |
      | B     | 95 %  | 1.6449 |
      | C     | 90 %  | 1.2816 |

  @R-INV-033 @R-INV-034
  Escenario: [008-05] La alerta se emite cuando la posición cruza el punto de reorden
    Dado un ítem con punto de reorden de 167 y 150 unidades disponibles
    Cuando existe una orden de compra abierta de 40 unidades
    Entonces la posición de inventario es 190 y no hay alerta
    Cuando la orden de compra se cancela
    Entonces la posición es 150
    Y se publica el evento "inventory.reorder.required" con el ítem, la posición, el ROP y la cantidad sugerida

  @R-INV-034
  Escenario: [008-06] La cantidad sugerida lleva la posición al nivel máximo
    Dado un ítem con punto de reorden de 167, demanda diaria de 20 y ciclo de pedido de 14 días
    Y una posición de inventario de 150
    Cuando se calcula la cantidad sugerida
    Entonces el nivel máximo es 447 y la cantidad sugerida es 297

  @R-INV-030
  Escenario: [008-07] La demanda excluye los días sin disponibilidad
    Dado una ventana de 90 días en la que el ítem estuvo sin disponible durante 10 días
    Y ventas netas de 1600 unidades en los 80 días restantes
    Cuando se calcula la demanda promedio diaria
    Entonces la demanda promedio es 20

  @R-INV-030
  Escenario: [008-08] Con menos de 30 días de historia se usa la demanda manual con baja confianza
    Dado un ítem con 20 días de historia y una demanda manual de 15 por día
    Cuando se calcula el punto de reorden
    Entonces se usa la demanda de 15
    Y las métricas quedan marcadas "LOW_CONFIDENCE"

  @R-INV-030
  Escenario: [008-09] Las devoluciones restan y los traslados y ajustes no cuentan como demanda
    Dado un día con ventas de 30 unidades, una devolución de 5, un traslado de 100 y un ajuste de 10
    Cuando se calcula la demanda de ese día
    Entonces la demanda neta de ese día es 25

  @R-INV-031
  Escenario: [008-10] El tiempo de entrega es el promedio de las últimas recepciones
    Dado las últimas cinco recepciones de un ítem con tiempos de entrega de 6, 7, 8, 7 y 7 días
    Cuando se calcula el tiempo de entrega
    Entonces el tiempo de entrega es 7 días
    Y la desviación del tiempo de entrega es 0.7071

  @R-INV-031
  Escenario: [008-11] Sin historial se usa el tiempo de entrega pactado con el proveedor
    Dado un ítem sin recepciones previas y un tiempo de entrega pactado de 10 días
    Cuando se calcula el tiempo de entrega
    Entonces el tiempo de entrega es 10 días

  @R-INV-032
  Esquema del escenario: [008-12] El redondeo depende de si la unidad es contable
    Dado un ítem de unidad <unidad> con un stock de seguridad calculado de 26.1136
    Cuando se redondea el stock de seguridad
    Entonces el resultado es <resultado>

    Ejemplos:
      | unidad       | resultado |
      | contable     | 27        |
      | fraccionaria | 26.1136   |

  @R-INV-034
  Escenario: [008-13] Cada alerta conserva los valores con los que se calculó
    Dado una alerta de reposición emitida
    Cuando el auditor consulta la alerta
    Entonces ve la demanda, el tiempo de entrega, el nivel de servicio, el stock de seguridad, el ROP y la posición usados
