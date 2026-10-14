# Referencias y benchmark: REA, SamitSQL, Alegra

Este documento deja claro **qué se investigó, de dónde salió cada dato, qué está verificado y qué no**, y explica la
decisión sobre cómo obtener la navegación de SamitSQL para la maqueta. Marcadores: ✅ contrastado con una fuente que se
cita · ⚠️ fuente secundaria · 🔶 sin contrastar (conocimiento general o dicho en una conversación con un asistente).

## 1. Qué se investigó

### 1.1 REA («Reverse Engineer Anything»)

| Dato | Estado | Fuente |
|---|---|---|
| Herramienta de código abierto que conecta asistentes de IA (Claude Code, Cursor, Windsurf) con desensambladores/descompiladores (Ghidra, Hopper, IDA) para analizar software compilado | ⚠️ | Conversación previa con un asistente (Gemini) aportada por el usuario; **no se instaló ni se ejecutó REA** en este proyecto |
| Repositorio `morluto/rea`, paquete npm `rea-agents`, sitio `rea.tools` | ⚠️ | Idem (no se visitaron) |
| Flujo: descompilar → comprender → recrear; todo local | ⚠️ | Idem |
| Para una aplicación de escritorio .NET basta con tener los archivos instalados; los procedimientos almacenados y *triggers* viven en el servidor y exigen conexión | 🔶 | Idem; afirmación general, no probada aquí |

### 1.2 SamitSQL / SAMIT

| Dato | Estado | Fuente |
|---|---|---|
| Empresa colombiana de software contable y ERP, con sede en Florencia (Caquetá); producto tradicional de escritorio **SAMITsql**, versión alojada **SamitCloud** y app **Samit Móvil** para preventistas | 🔶 | Solo la conversación con el asistente; **no se contrastó** con el sitio de la empresa ni con fuentes independientes |
| Líneas funcionales: POS, inventarios, nómina, cartera, facturación electrónica | 🔶 | Idem |
| Compite localmente con Siigo y World Office | 🔶 | Idem |
| **Estructura de menús, pantallas y navegación de SamitSQL** | ❌ **Desconocida** | No se tiene ninguna captura, manual ni acceso al producto |

### 1.3 Alegra

| Dato | Estado | Fuente |
|---|---|---|
| API (autenticación, paginación, ítems, categorías, fotos, stock) | ✅ | Verificada por el proyecto Asia-POP contra una cuenta real; ver [`06-referencia-api-alegra.md`](../02-normativa-y-reglas/06-referencia-api-alegra.md) |
| Organización general del menú (Ventas, Compras/Gastos, Inventario, Contabilidad, Bancos, Reportes, Configuración) | 🔶 | Conocimiento general; **no se abrió el producto** desde este entorno |
| Se tomó como referencia de «agilidad» visual (flujos cortos, lenguaje cercano) | 🔶 | Conversación inicial con el usuario |

### 1.4 Otras fuentes ya incorporadas al proyecto

Normativa colombiana (DIAN, UVT, retenciones, NIIF), librerías (Prisma, Zod, NestJS) y modelo de datos: ver el
[informe del proyecto](../informe-del-proyecto.md) §4 y el registro de verificación en
[`02-normativa-y-reglas/README.md`](../02-normativa-y-reglas/README.md).

## 2. Decisión: no se usó REA ni se descompiló SamitSQL

| # | Motivo |
|---|---|
| R-1 | **Decisión del proyecto.** En el encargo de la Fase 1 se acordó **no hacer ingeniería inversa** de SamitSQL ni de ningún producto comercial; SIFCA se construye «desde cero» sobre normatividad pública y buenas prácticas de usabilidad |
| R-2 | **No hace falta para el diseño.** La distribución de pantallas, los menús y la navegación son visibles para cualquier usuario del programa. Se obtienen **usándolo** (capturas de pantalla, manual de usuario, videos de capacitación), sin abrir binarios |
| R-3 | **Riesgo legal.** Descompilar software comercial suele estar restringido por su licencia (EULA) y por derechos de autor; aunque sea «solo para estudiar», copiar estructuras de pantalla o código protegido pondría en riesgo a SIFCA. Lo que sí es legítimo es **analizar la funcionalidad observable** (qué opciones existen y cómo se agrupan) y diseñar una propuesta **propia** |
| R-4 | **Es inviable aquí.** El entorno de trabajo no tiene SamitSQL instalado ni acceso a él |
| R-5 | **REA no ayudaría a lo que se pide.** Descompilar revela lógica y consultas internas, no el diseño visual; la «maqueta y navegación» se aprenden de la interfaz |

> Si en el futuro se decidiera analizar el producto de otro modo, debe hacerse con licencia vigente, revisando su
> contrato de uso, y dejando por escrito el alcance. Esa decisión no es de este documento.

## 3. Cómo completar la navegación de SamitSQL (hoja de captura)

Para que la propuesta tenga como contraste el **vocabulario y la agrupación real** de un programa contable local, quien
tenga una **licencia o demo** de SamitSQL (o su manual de usuario) puede completar esto **sin tocar el código del
programa**. Las capturas se guardan en `docs/04-diseno-ux/referencias/samit/` (carpeta a crear al aportarlas).

### 3.1 Qué capturar

| # | Captura | Para qué sirve | Nombre de archivo sugerido |
|---|---|---|---|
| C-1 | Pantalla principal tras iniciar sesión | Distribución general, tablero, accesos directos | `00-principal.png` |
| C-2 | Cada menú de primer nivel **abierto** (y submenús hasta el 3.º nivel) | Árbol de navegación completo | `10-menu-<nombre>.png` |
| C-3 | Pantalla de **comprobante contable** (nuevo y consulta) | Campos, orden, teclas rápidas, validaciones | `20-comprobante-nuevo.png`, `21-comprobante-consulta.png` |
| C-4 | Pantalla de **factura de venta** | Cabecera, líneas, totales, formas de pago | `30-factura.png` |
| C-5 | Lista de **reportes** (contables, de inventario, de cartera) | Qué informes esperan los usuarios | `40-reportes.png` |
| C-6 | Pantalla de **terceros** y de **ítems/inventario** | Campos y pestañas habituales | `50-terceros.png`, `51-items.png` |
| C-7 | **Parámetros / configuración** (empresa, numeración, impuestos) | Qué se parametriza y dónde | `60-parametros.png` |
| C-8 | Cuadro de **atajos de teclado** o ayuda | Convenciones de teclado del público objetivo | `70-atajos.png` |
| C-9 | Una pantalla de **error o validación** típica | Tono y claridad de los mensajes | `80-error.png` |
| C-10 | Si existe, **SamitCloud / Móvil**: inicio y pedido | Diferencias de navegación web/móvil | `90-cloud-*.png`, `91-movil-*.png` |

> Ocultar datos personales o de clientes reales en las capturas.

### 3.2 Matriz de navegación a completar (árbol del menú)

| Nivel 1 | Nivel 2 | Nivel 3 | Nombre exacto en SamitSQL | Atajo | Equivalente propuesto en SIFCA | Observación |
|---|---|---|---|---|---|---|
| _(completar)_ | | | | | | |

### 3.3 Matriz comparativa de funcionalidad (qué existe y qué falta en SIFCA)

| Funcionalidad que ofrece el programa de referencia | ¿La cubre alguna spec de SIFCA? | ¿Entra en el MVP? | Decisión |
|---|---|---|---|
| _(completar a partir de las capturas)_ | Spec 0xx / fuera de alcance | Sí / No | |

Lo que el programa de referencia tenga y SIFCA declare **fuera de alcance** (nómina, activos fijos, exógena,
conciliación bancaria, multimoneda, manufactura — ver [`00-alcance…`](../00-alcance-supuestos-y-roadmap.md) §3) se
registra como «fuera de alcance» **y no se maqueta**.

## 4. Convenciones del software contable colombiano que la propuesta ya asume (🔶 sin contrastar)

Estas son prácticas habituales del mercado, tomadas de conocimiento general. **Son hipótesis a validar** con
capturas (§3) y con usuarios:

| Hipótesis | Se refleja en la propuesta como |
|---|---|
| El contador espera ver **códigos de cuenta PUC** y trabajar con ellos, no solo con nombres | Selector de cuenta por código **o** nombre; el código siempre visible |
| Los documentos se identifican por **tipo-número** (`FV-125`, `RC-8`) | Etiquetas `AJ-1`; búsqueda con `#` en la paleta |
| El teclado numérico y `Enter`/`Tab` para capturar líneas es crítico | Grilla tipo hoja de cálculo (`04-…` §6.2) |
| Existe una pantalla de **«ventanas abiertas»** o acceso por código de opción | Paleta de comandos (`Ctrl+K`) como equivalente moderno |
| Se imprime y se exporta a PDF/Excel con frecuencia | Acciones «Imprimir/PDF» y «Exportar» 💡 en listas y libros |
| La **gestión de cartera** (edades, abonos, estado de cuenta) es una pantalla central para el gerente | Grupo propio **Cartera** en el menú de primer nivel |
| Los parámetros de empresa (numeración, impuestos, cuentas por defecto) son un menú aparte | Grupo **Configuración** |

## 5. Qué sí aporta la investigación a la maqueta

1. **Alcance funcional** acotado y priorizado (qué pantallas existen) — viene de las specs, no de copiar a nadie.
2. **Lenguaje del dominio** (comprobante, causar, tercero, cartera, kardex) — vocabulario público de la contabilidad
   colombiana.
3. **Una lista de comprobaciones** (§3) para contrastar la propuesta con el mercado antes de construir.
4. **Una propuesta propia** de navegación, atajos y componentes que privilegia lo que la normativa y el negocio exigen
   (inmutabilidad visible, período siempre a la vista, errores explicables).
