# language: es
@P-II
Característica: Clasificación ABC y conteos cíclicos
  Para concentrar el control en lo que más importa
  El inventario se clasifica por valor de consumo y rotación, y cada clase tiene su política de conteo

  Antecedentes:
    Dado los parámetros por defecto: ventana de 12 meses, Pareto 80 % y 95 %, rotación alta 6,0 y baja 2,0

  @R-INV-020
  Escenario: [007-01] Clasificación de referencia con diez ítems
    Dado los siguientes valores de consumo anual y rotación:
      | item | consumo  | vueltas |
      | P01  | 48000000 | 8.0     |
      | P02  | 30000000 | 6.0     |
      | P03  | 9000000  | 1.5     |
      | P04  | 7000000  | 3.5     |
      | P05  | 5000000  | 5.0     |
      | P06  | 2500000  | 2.5     |
      | P07  | 1800000  | 12.0    |
      | P08  | 1200000  | 3.0     |
      | P09  | 900000   | 1.0     |
      | P10  | 600000   | 1.0     |
    Cuando se calcula la clasificación ABC
    Entonces el total de consumo es 106000000
    Y el acumulado previo del ítem P03 es 73.58 %
    Y las clases finales son:
      | item | clase |
      | P01  | A     |
      | P02  | A     |
      | P03  | B     |
      | P04  | B     |
      | P05  | B     |
      | P06  | B     |
      | P07  | B     |
      | P08  | C     |
      | P09  | C     |
      | P10  | C     |

  @R-INV-020
  Esquema del escenario: [007-02] La matriz combina la clase de Pareto con la rotación
    Dado un ítem de clase de Pareto <pareto> y rotación <rotacion>
    Cuando se determina su clase final
    Entonces la clase final es <clase>

    Ejemplos:
      | pareto | rotacion | clase |
      | A      | ALTA     | A     |
      | A      | MEDIA    | A     |
      | A      | BAJA     | B     |
      | B      | ALTA     | B     |
      | B      | MEDIA    | B     |
      | B      | BAJA     | B     |
      | C      | ALTA     | B     |
      | C      | MEDIA    | C     |
      | C      | BAJA     | C     |

  @R-INV-020
  Escenario: [007-03] El ítem que cruza el umbral queda en la clase donde empieza
    Dado un ítem cuyo acumulado previo es 73.58 % y su propio consumo lo lleva a 82.08 %
    Cuando se determina su clase de Pareto
    Entonces su clase de Pareto es A

  @R-INV-020
  Escenario: [007-04] Los ítems nuevos y sin ventas reciben clase provisional con marca
    Dado un ítem con 40 días de historia y otro sin ventas en la ventana
    Cuando se calcula la clasificación
    Entonces el primero es clase B con la marca "NEW"
    Y el segundo es clase C con la marca "NO_ROTATION"

  @R-INV-020
  Escenario: [007-05] El desempate es determinista por código de ítem
    Dado dos ítems "A-100" y "A-200" con el mismo valor de consumo
    Cuando se calcula la clasificación dos veces con los mismos datos
    Entonces "A-100" precede a "A-200" en ambos cálculos

  @R-INV-021
  Escenario: [007-06] Un ítem baja de clase solo tras dos cálculos consecutivos y sube de inmediato
    Dado un ítem de clase "A"
    Cuando el cálculo mensual lo ubica en "B" por primera vez
    Entonces sigue siendo "A"
    Cuando el cálculo del mes siguiente también lo ubica en "B"
    Entonces pasa a "B" y se registra el cambio en el historial
    Y se publica el evento "inventory.abc.reclassified"
    Cuando un cálculo posterior lo ubica en "A"
    Entonces sube a "A" de inmediato

  @R-INV-022
  Escenario: [007-07] Se generan conteos cíclicos con la frecuencia de cada clase
    Dado ítems de las clases A, B y C en la bodega "Principal"
    Cuando se planifican los conteos del año
    Entonces los ítems A tienen un conteo mensual, los B uno trimestral y los C uno semestral

  @R-INV-022 @R-CON-011
  Escenario: [007-08] Un conteo vencido de clase A puede bloquear el cierre del período
    Dado la configuración que bloquea el cierre por conteos de clase A vencidos
    Y un conteo de clase A vencido sin justificación
    Cuando el contador intenta cerrar el período
    Entonces se rechaza el cierre indicando el conteo pendiente
    Cuando se registra el conteo o una justificación
    Entonces el cierre procede

  @R-INV-022 @R-INV-011
  Escenario: [007-09] Los ajustes de conteo de clase A requieren aprobación de un segundo usuario
    Dado un conteo de clase A con una diferencia de 3 unidades a costo 10000
    Cuando el usuario que contó intenta aplicar el ajuste
    Entonces queda pendiente de aprobación
    Cuando un segundo usuario con permiso lo aprueba
    Entonces se registra la salida de ajuste de 3 unidades a costo 10000 y su comprobante

  @R-INV-023
  Escenario: [007-10] Los movimientos manuales sobre ítems de clase A quedan destacados
    Dado un ítem de clase A
    Cuando un usuario registra un ajuste manual con su motivo
    Entonces la bitácora lo marca como excepción de clase A
    Y aparece en el reporte de excepciones del cierre mensual
