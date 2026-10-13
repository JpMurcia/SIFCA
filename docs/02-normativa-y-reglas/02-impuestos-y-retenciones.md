# Impuestos y retenciones

Estado de verificación: ver [`README.md`](README.md). **Las cifras de este documento son parámetros de
ejemplo con su estado de verificación; ninguna se codifica: se cargan como datos con vigencia (ADR-0005) y
las valida el contador.**

## 1. Marco normativo

| Norma | Aplica a | Estado |
|---|---|---|
| Estatuto Tributario (ET), Libro III — IVA: arts. 420 (hecho generador), 424 y 476 (excluidos), 468 (tarifa general 19 %), 468-1 (tarifa 5 %), 477 (exentos), 485 y 488 (IVA descontable), 437-1 y 437-2 (retención de IVA) | IVA, ReteIVA | 🔶 |
| ET arts. 512-1 y ss. | Impuesto nacional al consumo (INC; p. ej. 8 % en restaurantes) | 🔶 |
| ET Libro II — Retención en la fuente (arts. 365 y ss.); art. 381 (certificados de retención) | ReteFuente | 🔶 |
| Decreto Único Reglamentario 1625 de 2016, Libro 1, Parte 2, Título 4, Capítulo 1 | Bases mínimas y tarifas de retención en la fuente por concepto | 🔶 |
| Decreto 572 de 2025 | Modificó bases y tarifas de retención; **arts. 2 a 8 suspendidos provisionalmente** por el Consejo de Estado (auto del 7-may-2026) | ⚠️ |
| Ley 14 de 1983 y Decreto-Ley 1333 de 1986; acuerdos municipales | Impuesto de industria y comercio (ICA) y su retención (ReteICA) | 🔶 |
| Resolución DIAN 000238 de 15-dic-2025 | **UVT 2026 = $52.374** | ✅ |

## 2. Parámetros con vigencia

Toda cifra normativa vive en tablas con ventana de vigencia (`valid_from`, `valid_to`) y referencia a la
norma que la sustenta. El motor siempre consulta por **fecha del documento**, nunca por «hoy».

### 2.1 Valor de la UVT

| Año | UVT (COP) | Norma | Estado |
|---:|---:|---|---|
| 2024 | 47.065 | Resolución DIAN 000187 de 2023 | 🔶 |
| 2025 | 49.799 | Resolución DIAN 000193 de 2024 | 🔶 |
| 2026 | **52.374** | Resolución DIAN 000238 de 2025 | ✅ |

### 2.2 Ejemplo de por qué los parámetros no pueden estar en el código

| Ventana de aplicación | Tabla aplicable de bases (compras / servicios) | Estado |
|---|---|---|
| Hasta mediados de 2025 | DUR 1625/2016: 27 UVT / 4 UVT | 🔶 |
| Desde el 1-jul-2025 hasta el 7-may-2026 | Decreto 572 de 2025: 10 UVT / 2 UVT (según Alegra) | ⚠️ |
| Desde el 8-may-2026 | Vuelven las bases del DUR 1625/2016 por la suspensión provisional | ⚠️ |

> Las fechas exactas de inicio y la vigencia de la suspensión a hoy (13-oct-2026) **deben confirmarse**: una
> suspensión provisional puede levantarse o convertirse en nulidad. El diseño admite las tres ventanas
> sin tocar código: tres filas en `tax.tax_rate` con sus `valid_from`/`valid_to`.
> La suspensión provisional rige hacia adelante: los documentos de la ventana intermedia **no se recalculan
> automáticamente**; si el contador decide corregirlos, se hace con notas/ajustes manuales y auditados.

## 3. IVA

### R-IMP-001 · Tarifas de IVA
Tarifa general **19 %**; tarifa reducida **5 %**; bienes **exentos** (0 % con derecho a devolución);
**excluidos** (sin IVA, sin derecho a descuento); y operaciones **no gravadas**. Cada ítem tiene un
impuesto asignado en `catalog.item.tax_id`; el tipo (gravado, exento, excluido, no gravado) afecta el
reporte, por lo que se guarda además del porcentaje.
- **Fuente:** ET arts. 468, 468-1, 477, 424 y 476 🔶.

### R-IMP-002 · Base gravable
La base de IVA de una línea es `cantidad × precio unitario − descuentos que no están condicionados`. Los
descuentos condicionados no reducen la base 🔶 (confirmar tratamiento exacto con el contador).

### R-IMP-003 · IVA por línea y redondeo
El IVA se calcula **por línea**, se redondea a 2 decimales (*half-up*, R-CON-009) y el IVA del documento es
la **suma** de los IVA de las líneas.
- **Ejemplo:** 3 líneas de $333,33 con IVA 19 %: por línea = 63,33 → total IVA **189,99**. Calculado sobre el
  total (999,99 × 19 %) daría 190,00. El sistema debe producir 189,99.
- **Estado:** 🔶 (alinear con la regla de validación de la DIAN para los totales de impuestos).

### R-IMP-004 · IVA descontable
Solo es descontable el IVA de compras con factura (o documento equivalente) que cumpla requisitos y con
destino a operaciones gravadas o exentas. Si la empresa realiza operaciones gravadas y excluidas, el IVA
descontable se prorratea 🔶. El primer alcance asume 100 % gravadas.
- **Fuente:** ET arts. 485, 488 y 771-2 🔶.

### R-IMP-005 · Impuesto nacional al consumo (INC)
Con tarifa y destino propios (p. ej. restaurantes 8 %); se modela como otro `tax` de tipo `SALES_TAX` con
código DIAN propio. Un mismo ítem no tiene IVA e INC a la vez, salvo disposición expresa.
- **Fuente:** ET art. 512-1 y ss. 🔶.

### R-IMP-006 · Otros impuestos al consumo y especiales
Impuesto a las bolsas plásticas, impuestos saludables (bebidas azucaradas, ultraprocesados), ICO, etc.
Quedan **fuera del MVP**, pero `tax.kind` y el código DIAN por impuesto permiten agregarlos como datos.

## 4. Retención en la fuente por renta (ReteFuente)

### R-IMP-010 · Quién retiene
Retiene el **agente de retención** (personas jurídicas, ciertas personas naturales comerciantes, entidades
públicas…). `company.is_withholding_agent` y las responsabilidades RUT del tercero determinan si hay retención
en cada documento.
- **Fuente:** ET art. 368 🔶.

### R-IMP-011 · Base y momento
La base es el valor del pago o abono en cuenta **antes de IVA**. Se practica al realizar el pago o abono en
cuenta, lo que ocurra primero 🔶. Por eso, en compras, el sistema **causa** la retención al registrar la
factura del proveedor (abono en cuenta), y en ventas la reconoce, por defecto, al registrar el recibo de caja
(P-04).

### R-IMP-012 · Concepto, cuantía mínima y tarifa
Cada compra/servicio se clasifica por **concepto** (`withholding_concept`). Cada concepto tiene una base
mínima (en UVT) y una tarifa que depende de si el beneficiario del pago es **declarante de renta** o no.
La base mínima se compara **por operación** (por cada pago o abono en cuenta). Cuando el documento mezcla
conceptos, se agrupa por concepto.

| Concepto | Base mínima | Tarifa declarante | Tarifa no declarante | Estado |
|---|---|---|---|---|
| Compras generales | 27 UVT (= $1.414.098 en 2026) | 2,5 % | 3,5 % | ⚠️ (tabla DUR 1625/2016 tras la suspensión) |
| Servicios generales | 4 UVT (= $209.496) | 4 % | 6 % | ⚠️ |
| Honorarios y comisiones | Sin mínimo (> $0) | 11 % personas jurídicas · personas naturales: 10 % hasta 3.300 UVT acumulados en el año y 11 % por encima | 11 % | ⚠️ |
| Arrendamiento de bienes inmuebles | 27 UVT | 3,5 % | 3,5 % | 🔶 |
| Arrendamiento de bienes muebles | Sin mínimo | 4 % | 4 % | 🔶 |
| Otros conceptos (transporte, rendimientos financieros, etc.) | — | — | — | Cargar de la **tabla oficial** |

Tabla alternativa del Decreto 572 de 2025 (ventana intermedia, ver §2.2): compras 10 UVT y servicios 2 UVT ⚠️
según [Alegra](https://blog.alegra.com/colombia/tabla-de-retencion-en-la-fuente-2026/).

**Ejemplos (UVT 2026 = $52.374):**

| Caso | Base | Mínimo | ¿Retiene? | ReteFuente |
|---|---:|---:|---|---:|
| Compra de bienes $1.000.000, proveedor declarante | 1000000 | 1414098 | No (base < mínimo) | 0 |
| Compra de bienes $2.000.000, proveedor declarante | 2000000 | 1414098 | Sí, 2,5 % | 50000 |
| Compra de bienes $2.000.000, proveedor no declarante | 2000000 | 1414098 | Sí, 3,5 % | 70000 |
| Servicio de $200.000, declarante | 200000 | 209496 | No | 0 |
| Servicio de $1.000.000, declarante | 1000000 | 209496 | Sí, 4 % | 40000 |
| Servicio de $1.000.000, no declarante | 1000000 | 209496 | Sí, 6 % | 60000 |
| Honorarios de $3.000.000, persona jurídica | 3000000 | — | Sí, 11 % | 330000 |

### R-IMP-013 · Certificados
La empresa que retiene entrega al tercero un **certificado de retención** anual (o a solicitud) con las
retenciones practicadas por concepto, base y tarifa (ET art. 381 🔶). El sistema conserva por línea
contable el tercero y el concepto (R-CON-008) para poder generarlo.

### R-IMP-014 · Autorretención
La autorretención especial del impuesto de renta y las empresas autorretenedoras (responsabilidad RUT O-15)
quedan **fuera del MVP**. El campo `fiscal_responsibilities` del tercero y de la empresa las prevé.

## 5. Retención de IVA (ReteIVA) y de ICA (ReteICA)

### R-IMP-020 · ReteIVA
Los **agentes de retención de IVA** (p. ej. grandes contribuyentes, entidades estatales, quienes contratan con
no domiciliados; responsabilidad RUT O-23 🔶) retienen el **15 % del IVA** facturado, sobre operaciones con
responsables de IVA y superando las mismas bases mínimas de compras/servicios 🔶.
- **Fuente:** ET arts. 437-1 y 437-2 🔶.
- **Ejemplo:** IVA de $380.000 → ReteIVA = 15 % × 380.000 = **57.000**. IVA de $190.000 → **28.500**.

### R-IMP-021 · ReteICA
El ICA es **municipal**. La retención depende de que el municipio designe agentes de retención; la tarifa
está expresada **por mil (‰)** y depende de la actividad económica (CIIU) del tercero y del municipio. Base:
ingresos gravables sin IVA.
- **Modelo:** `tax_rate.conditions = { municipality_code, ciiu_code }`, tarifa en ‰ normalizada a
  porcentaje.
- **Ejemplo (tarifa ilustrativa 9,66 ‰, no corresponde a ningún municipio):** base $2.000.000 → ReteICA =
  2.000.000 × 9,66 / 1.000 = **19.320**; base $1.000.000 → **9.660**.
- **Fuente:** Ley 14 de 1983, Decreto-Ley 1333 de 1986 y acuerdos municipales 🔶.
- **Pendiente:** cargar la tabla de tarifas de los municipios de las primeras empresas cliente.

## 6. Ejemplos completos

### 6.1 Venta a un agente de retención (con asientos en P-04)

| Concepto | Valor |
|---|---:|
| Subtotal | 2000000 |
| IVA 19 % | 380000 |
| **Total factura** | **2380000** |
| ReteFuente 2,5 % (base 2.000.000 ≥ 1.414.098) | 50000 |
| ReteIVA 15 % del IVA | 57000 |
| ReteICA 9,66 ‰ (ilustrativa) | 19320 |
| **Neto a recibir** | **2253680** |

### 6.2 Misma venta de $1.000.000 + IVA a un agente de retención

Base de compras = 1.000.000 < 1.414.098 ⇒ ReteFuente **0**; ReteIVA con la misma base mínima ⇒ **0** 🔶;
ReteICA no tiene mínimo en el ejemplo ⇒ 9.660. Neto = 1.190.000 − 9.660 = **1.180.340**.

### 6.3 Compra de servicios (con asientos en P-06)

| Concepto | Valor |
|---|---:|
| Servicio | 1000000 |
| IVA 19 % | 190000 |
| **Total factura** | **1190000** |
| ReteFuente servicios 4 % (declarante) | 40000 |
| ReteIVA 15 % | 28500 |
| ReteICA 9,66 ‰ | 9660 |
| **Neto a pagar** | **1111840** |

## 7. Diseño del motor de impuestos

```text
calcularImpuestos(documento, fecha) ──►
  1. por cada línea:
       - impuestos de venta (IVA/INC) según item.tax_id, tarifa vigente en `fecha`
       - base, tarifa y monto redondeados por línea (R-CON-009)
  2. agrupa líneas por concepto de retención
  3. por cada retención posible (ReteFuente, ReteIVA, ReteICA):
       - ¿la empresa/tercero es agente? (R-IMP-010, R-IMP-020, R-IMP-021)
       - selecciona la fila de tax_rate con (vigencia ∩ conditions) más específica
       - compara la base con la base mínima del concepto (en UVT × valor UVT del año)
       - calcula monto (half-up)
  4. devuelve: líneas de impuesto, líneas de retención y los snapshots (tax_rate_id, base, tarifa)
```

Reglas de implementación:

- **Determinista y puro:** misma entrada + mismas tablas ⇒ misma salida; sin acceso a red ni a «hoy».
- **Resolución de ambigüedad:** si más de una tarifa coincide, gana la de condiciones más específicas; si
  empatan, el cálculo **falla** (no se adivina) y se registra para el contador.
- **Snapshots:** el documento guarda `tax_rate_id`, base y tarifa aplicadas; cambiar las tablas después no
  altera documentos emitidos.
- **Pruebas:** tabla de casos (§4 y §6) como *tests* de verdad: cada fila de ejemplo es un caso, con la
  UVT y la tabla de la fecha que corresponda. Cada vez que cambie la norma se agrega una ventana y los casos
  de esa fecha.

## 8. Pendientes de validación por el contador

- [ ] Vigencia a hoy de la suspensión del Decreto 572 y fecha exacta de inicio de sus bases.
- [ ] Tabla oficial completa de conceptos de ReteFuente (con tarifas de personas naturales y no declarantes).
- [ ] Tratamiento de descuentos condicionados y de la base mínima cuando un pago cubre varias facturas.
- [ ] Bases mínimas de ReteIVA (¿las mismas de compras/servicios?).
- [ ] Qué clientes son agentes de ReteICA y las tarifas de sus municipios.
- [ ] Política de reconocimiento de retenciones sufridas: en la factura o en el recibo (P-04).
- [ ] Impacto de clientes en Régimen Simple (Q-04).
