# Sistema de diseño (propuesta)

Todo lo de este documento es **propuesta de diseño**: un punto de partida concreto para que la maqueta sea coherente.
Los valores se pueden cambiar; lo que **no** se negocia son los principios (§1), la accesibilidad (§8) y los formatos
`es-CO` (§7). Las decisiones sobre qué biblioteca de componentes se usa al construir (Ant Design 5 + grilla editable
en el back-office; Tailwind + shadcn/ui en la vitrina) están en
[`03-evaluacion-de-librerias.md`](../01-arquitectura/03-evaluacion-de-librerias.md) §3 y siguen **provisionales**
hasta el *spike* S-UI; la maqueta no depende de ellas.

## 1. Principios de diseño

| # | Principio | Cómo se nota en pantalla |
|---|---|---|
| D-1 | **Serio, ágil y legible**: transmite rigor contable sin parecer software de escritorio antiguo | Sobrio, mucho espacio útil, sin adornos; color solo con significado |
| D-2 | **Densidad con aire**: el contador ve muchos datos a la vez | Tablas compactas por defecto (28 px por fila), 3 niveles de densidad configurables |
| D-3 | **Los números mandan** | Cifras tabulares alineadas a la derecha, separador de miles, totales siempre visibles |
| D-4 | **Lo inmutable se ve inmutable** | Documentos contabilizados en modo lectura con etiqueta propia; la corrección es «Reversar» |
| D-5 | **Nada se esconde: se explica** | Saldos contrarios a la naturaleza con alerta; rechazos con causa y regla |
| D-6 | **Teclado primero, ratón también** | Foco siempre visible, atajos visibles en los menús y en la paleta |
| D-7 | **Color nunca es el único mensaje** | Todo estado lleva texto o ícono además del color (daltonismo, impresión en gris) |
| D-8 | **Misma lógica en todas las pantallas** | Un solo patrón de lista, de documento, de diálogo de motivo y de grilla de líneas |

## 2. Color

Paleta propuesta con **contrastes calculados** (relación de luminancia WCAG 2.1; mínimo exigido: 4,5:1 para texto y
3:1 para bordes y elementos de interfaz).

### 2.1 Tema claro

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#FFFFFF` | Fondo de página y tablas |
| `--surface` | `#F4F6F8` | Barras laterales, cabeceras de tabla, tarjetas |
| `--text` | `#1B2430` | Texto principal |
| `--text-muted` | `#4B5767` | Texto secundario |
| `--border` | `#D5DBE3` | Separadores (decorativos) |
| `--border-strong` | `#7B8794` | Bordes de campos y controles |
| `--primary` | `#0B5CAD` | Acción principal, enlaces, selección |
| `--success-bg` / `--success-fg` | `#E6F4EA` / `#17663E` | Cuadrado, aceptada, abierto |
| `--warning-bg` / `--warning-fg` | `#FFF1D6` / `#7A4B00` | Advertencias, saldo contrario, borrador |
| `--danger-bg` / `--danger-fg` | `#FDECEA` / `#A8201A` | Errores, descuadre, rechazada |
| `--info-bg` / `--info-fg` | `#E8F1FB` / `#0B5CAD` | Información |
| `--neutral-bg` / `--neutral-fg` | `#E9EDF2` / `#3F4A59` | Etiqueta «Reversado», «Contabilizado» |

| Combinación | Contraste | Cumple |
|---|---:|:-:|
| Texto principal sobre fondo | 15,65:1 | ✅ AA y AAA |
| Texto secundario sobre fondo | 7,35:1 | ✅ AA y AAA |
| Texto secundario sobre superficie | 6,78:1 | ✅ AA |
| Texto blanco sobre `--primary` (botón) | 6,67:1 | ✅ AA |
| `--primary` como texto o enlace sobre fondo | 6,67:1 | ✅ AA |
| Éxito (texto sobre su fondo) | 6,15:1 | ✅ AA |
| Advertencia (texto sobre su fondo) | 6,64:1 | ✅ AA |
| Peligro (texto sobre su fondo) | 6,36:1 | ✅ AA |
| Info (texto sobre su fondo) | 5,85:1 | ✅ AA |
| Neutro (texto sobre su fondo) | 7,65:1 | ✅ AA |
| Borde de campo sobre fondo (no texto) | 3,66:1 | ✅ ≥ 3:1 |

### 2.2 Tema oscuro (opcional en la primera maqueta, recomendado)

| Token | Valor | Contraste |
|---|---|---:|
| `--bg` | `#11161D` | — |
| `--text` sobre `--bg` | `#E6EAF0` | 15,04:1 |
| `--text-muted` sobre `--bg` | `#A9B4C2` | 8,64:1 |
| `--primary` (texto/enlace) sobre `--bg` | `#7DB7F2` | 8,59:1 |
| Texto del botón primario `#08121F` sobre `--primary` | — | 8,89:1 |
| Éxito `#7FD6A0` sobre `#14281D` | — | 8,90:1 |
| Advertencia `#F2C46D` sobre `#2B2110` | — | 9,71:1 |
| Peligro `#F5A59F` sobre `#34171A` | — | 8,39:1 |

### 2.3 Significado del color (reglas)

- **Rojo** solo para error, descuadre o rechazo. **No** se usa rojo para «crédito» ni verde para «débito»: débito y
  crédito se distinguen por **columna y encabezado**, no por color (convención contable y accesibilidad).
- Un saldo con signo negativo se escribe con «−» delante; el color no sustituye el signo.
- Estados de período: `Abierto` verde, `Cerrado` neutro con candado (no rojo: cerrar es normal).

## 3. Tipografía

| Rol | Propuesta | Notas |
|---|---|---|
| Interfaz | **Inter** (o la fuente del sistema como respaldo) | Con `font-variant-numeric: tabular-nums` **en todas las cifras** |
| Códigos e identificadores | Fuente monoespaciada (p. ej. JetBrains Mono) | Solo códigos de cuenta, CUFE, hashes y claves |
| Escala | 12 · 13 · 14 (base de tablas) · 16 (base de formularios) · 20 · 24 · 32 | Interlineado 1,4 en texto; 1,25 en tablas densas |
| Pesos | 400 normal · 500 énfasis · 600 títulos y totales | Los totales de pie en 600 |

## 4. Espaciado, forma y elevación

Base de **4 px**. Espacios: 4 · 8 · 12 · 16 · 24 · 32. Radio de esquina 6 px (controles) y 10 px (tarjetas y diálogos).
Elevación mínima: bordes finos antes que sombras; sombra solo en menús flotantes, diálogos y la paleta.

## 5. Densidad

| Modo | Alto de fila | Tamaño de texto de tabla | Uso |
|---|---:|---:|---|
| Compacta (por defecto en Contabilidad) | 28 px | 13 px | Grillas de líneas, libros, kardex |
| Normal | 36 px | 14 px | Listas generales |
| Cómoda | 44 px | 16 px | Móvil y pantallas táctiles (objetivo táctil ≥ 44 px) |

## 6. Componentes contables (los que distinguen a SIFCA)

### 6.1 Cabecera de documento inmutable

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  AJ-1   [Contabilizado]  [Reversado por AJ-2]                 ⋯  [Reversar]   │
│  Apertura de inventario aportado como capital                                 │
│  Fecha contable 01/10/2026 · Período Oct 2026 · Origen Manual                 │
│  Registrado por M. Pérez el 14/10/2026 04:07 (hora de Colombia)               │
└──────────────────────────────────────────────────────────────────────────────┘
```

Reglas: **sin** botones Editar/Eliminar; la etiqueta `Contabilizado` es neutra con ícono de candado; `Reversado por…`
y `Reversión de…` son **enlaces**; el botón `Reversar` es secundario (no primario) y abre el diálogo de motivo.

### 6.2 Grilla de líneas editable

Comportamiento tipo hoja de cálculo: `Tab`/`Enter`/flechas navegan; `Ctrl+V` pega varias filas; autocompletar de
cuenta por código o nombre; la celda con error lleva borde rojo, ícono y mensaje asociado (`aria-describedby`); la
fila nueva siempre está al final; totales **pegados al pie** (`position: sticky`). Número de línea y marcadores
(`Exige tercero`, `Exige centro de costo`) en la cuenta. 300 líneas deben ser fluidas (virtualización).

### 6.3 Pie de totales y diferencia

Tres cifras alineadas a la derecha: `Σ Débitos` · `Σ Créditos` · `Diferencia`. Cuando la diferencia es 0 aparece
«Cuadra» con ícono de verificación y el botón «Contabilizar» se habilita; si no, la diferencia se muestra en rojo con su
valor y una región `aria-live="polite"` la anuncia a lectores de pantalla.

### 6.4 Chip de período

`Oct 2026 · Abierto` (verde) / `Sep 2026 · Cerrado 🔒` (neutro). Clic → pantalla Períodos. Si la fecha de un documento
cae en un período cerrado, el campo de fecha muestra el aviso en línea.

### 6.5 Celda de importe

Alineada a la derecha, cifras tabulares, símbolo `$` solo en totales y tarjetas (no en cada celda). Cero se muestra
como «0,00» (o «—» si la columna lo admite); nunca vacío en columnas de importe de solo lectura.

### 6.6 Selector de cuenta

Campo con autocompletar: escribe «1105» o «caja»; muestra `1105 · Caja`, naturaleza y las insignias de exigencias;
resalta la coincidencia; no permite elegir cuentas acumuladoras ni inactivas (aparecen atenuadas con explicación).

### 6.7 Diálogo de motivo (acciones con bitácora)

Se usa en **Reversar**, **Reabrir período**, **Liberar retención de crédito**, **Ajustar inventario**: título claro de la
consecuencia, texto «Quedará registrado en la bitácora con tu usuario», campo de motivo obligatorio con mínimo visible
(«mín. 5 caracteres»), botón de confirmación con el verbo exacto («Reversar comprobante»), nunca «Aceptar».

### 6.8 Lista de causas de bloqueo

Para `PERIOD_CLOSE_BLOCKED` y similares: lista de verificación con ✓/✗ por comprobación, texto de la causa, regla
asociada y enlace a la pantalla que la resuelve.

### 6.9 Insignias de estado

| Tipo | Etiquetas (texto exacto) | Color |
|---|---|---|
| Comprobante | `Contabilizado` · `Reversado` · `Reversión` · `Cierre anual` | Neutro / info |
| Período | `Abierto` · `Cerrado` | Éxito / neutro |
| Borrador | `Borrador` · `No cuadra` | Advertencia |
| Documento de venta | `Borrador` · `Emitida` · `En transmisión` · `Aceptada` · `Rechazada` · `Anulada` | Neutro · info · info · éxito · peligro · neutro |
| Crédito del cliente | `Al día` · `En alerta` · `Bloqueado por cupo` · `Bloqueado por mora` · `Suspendido` | Éxito · advertencia · peligro · peligro · neutro |
| Clase ABC | `A` · `B` · `C` (+ `Nuevo`, `Sin rotación`) | Distinguibles también por letra |
| Verificación normativa | `✅ Validada` · `⚠️ Por confirmar` · `🔶 Sin contrastar` | Éxito · advertencia · neutro |

### 6.10 Línea de tiempo de estado

Para documentos con ciclo de vida (factura → DIAN): pasos horizontales con el actual resaltado, hora de cada transición
y, si falla, el motivo completo con acción de reintento.

### 6.11 Componentes de integración y configuración

| Componente | Comportamiento |
|---|---|
| **Asistente por pasos** | Lista de pasos con estado (pendiente · actual · completo · con problema), avance guardado y botón *Volver*; cada paso dice qué sigue y qué se puede deshacer |
| **Tabla de mapeo** | Valor de origen → valor en SIFCA, con confianza (`Exacto` · `Sugerido` · `Sin resolver`) en **texto e ícono**; filtro «solo sin resolver»; plantillas reutilizables |
| **Barra de progreso por entidad** | Leídos / procesados / con error, `aria-live` educado, botones Pausar y Reanudar |
| **Informe de ensayo** | Conteos por entidad y tabla de problemas con severidad `Bloquea` (peligro) o `Advierte` (advertencia) |
| **Panel de conciliación** | Origen · SIFCA · Diferencia; sello `Cuadra` / `No cuadra` con texto; diferencia alineada a la derecha con signo |
| **Campo de secreto** | Enmascarado, con «Mostrar» temporal y «Copiar»; los secretos de una sola vez se muestran con advertencia |
| **Formulario de configuración** | Lista a la izquierda, formulario a la derecha, «vigencia desde», motivo en cambios sensibles, pestaña Historial |

## 7. Formatos `es-CO` (obligatorios)

| Dato | Presentación | Entrada | En la API |
|---|---|---|---|
| Importe | `$ 1.190.000,00` (punto de miles, coma decimal, 2 decimales) | Acepta `1190000,5` y pegado desde hoja de cálculo | Cadena decimal `"1190000.50"` |
| Cantidad | Hasta 4 decimales | — | Cadena decimal |
| Costo unitario | Hasta 6 decimales | — | Cadena decimal |
| Porcentaje | `19 %` | — | Cadena decimal |
| Fecha | `14/10/2026` (día/mes/año) | Teclear `14102026` o `14/10/26` | `2026-10-14` |
| Fecha y hora | `14/10/2026 04:07` en **hora de Colombia** (UTC−5, sin horario de verano) | — | Instante ISO en UTC |
| Identificación | NIT con **dígito de verificación**: `900.123.456-7` | Validar el DV al salir del campo | Número y DV por separado |
| Período | `Oct 2026` o `2026-10` | — | `year` y `month` |

**Nunca** se calcula con números de coma flotante en el cliente: los importes viajan como cadenas y se operan con una
librería decimal (la suma de las líneas redondeadas es la que manda).

## 8. Accesibilidad (objetivo: WCAG 2.1 AA)

| Requisito | Criterio |
|---|---|
| Contraste | Tabla de §2: texto ≥ 4,5:1; bordes de controles ≥ 3:1 |
| Teclado | Todo es operable sin ratón; orden de tabulación lógico; sin trampas de foco; atajos documentados (`02-…` §6) |
| Foco | Anillo visible de 2 px con contraste ≥ 3:1 en todos los controles y celdas |
| Semántica | Tablas con `<th scope>`; grilla editable con `role="grid"`; diálogos con `role="dialog"` y foco atrapado; paleta como `combobox` |
| Errores | Texto + ícono + `aria-describedby`; resumen al enviar con enlaces a cada campo; no depender del color |
| Anuncios | `aria-live` para la diferencia del comprobante, los totales y los toasts |
| Tamaño | Texto escalable al 200 % sin pérdida; objetivos táctiles ≥ 44 px en móvil (≥ 24 px en escritorio) |
| Movimiento | Respetar `prefers-reduced-motion`; sin animaciones esenciales |
| Idioma | `lang="es-CO"`; mensajes de error en español claro, sin jerga técnica (el `code` va en un detalle copiable) |

## 9. Responsividad

| Ancho | Comportamiento |
|---|---|
| ≥ 1280 px | Menú lateral expandido (240 px), contenido a ancho completo |
| 1024–1279 px | Menú lateral reducido a íconos |
| 768–1023 px | Menú en cajón; tablas con desplazamiento horizontal y primera columna fija |
| < 768 px | Solo consulta y aprobaciones; listas en tarjetas; grilla de líneas de solo lectura |

## 10. Contenido y tono (microcopia)

- Voz: segunda persona del singular («Cambia la fecha contable»), directa y sin culpar al usuario.
- Los botones llevan **verbos exactos**: «Contabilizar», «Reversar comprobante», «Cerrar mes», «Descartar borrador».
- Un error responde a tres preguntas: **qué pasó**, **por qué** y **qué hacer**.
- Vocabulario fijo: *comprobante* (no «asiento» en la interfaz, salvo en ayudas), *contabilizar*, *reversar*,
  *período*, *tercero*, *causar*. Un glosario corto accesible desde `?`.
