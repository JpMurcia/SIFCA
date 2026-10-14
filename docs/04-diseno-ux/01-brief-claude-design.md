# Brief maestro para Claude Design — maqueta de SIFCA

> **Cómo usarlo:** pega este documento completo en Claude Design y adjunta `02-…`, `03-…`, `04-…` y `06-…` de esta carpeta.
> Pide la maqueta por **tandas** (§9). Todo lo que necesitas está aquí; los anexos añaden detalle por pantalla.

---

## 1. Qué es SIFCA

**SIFCA — Sistema Integral Fiscal y Contable Ágil** es una plataforma **SaaS multiempresa** para empresas colombianas:

- **Back-office (privado):** ERP contable y administrativo — contabilidad, ventas y facturación electrónica DIAN,
  cartera, compras, inventario con kardex y costeo, impuestos y retenciones, integraciones.
- **Vitrina (pública):** sitio web por empresa con catálogo y pedidos en línea.
- **Móvil:** consulta y operación en calle (fase posterior).

Promesa: **rigor contable con agilidad de uso.** El contador debe sentir la solidez de un sistema contable clásico
(partida doble, inmutabilidad, períodos, auditoría) con la rapidez de una herramienta moderna (teclado, búsqueda global,
errores que se explican).

**Estado real:** existe el backend de **Contabilidad** (comprobantes, borradores, reversiones, períodos, cierre anual,
libros diario y mayor, balance de prueba) probado de punta a punta. Las demás áreas están **especificadas pero sin
construir**. No hay interfaz todavía: esta maqueta será la primera.

## 2. Para quién se diseña

| Persona | Qué hace | Qué necesita de la interfaz |
|---|---|---|
| **Contador / revisor fiscal** (principal) | Registra y revisa comprobantes, cierra períodos, consulta libros y balance, valida impuestos | Teclado, densidad, trazabilidad, cero ambigüedad, poder explicar cada cifra |
| **Auxiliar contable** | Digita comprobantes y documentos todo el día | Velocidad: captura tipo hoja de cálculo, pegar filas, autocompletar por código |
| **Facturador / vendedor** | Cotiza, factura, ve cupo del cliente | Flujo corto, ver el crédito del cliente antes de emitir, estado ante la DIAN claro |
| **Cartera / cobrador** | Cobra, aplica recibos, gestiona mora | Edades de cartera, estado de cuenta, compromisos de pago |
| **Bodeguero / jefe de inventario** | Recibe, despacha, cuenta, repone | Existencias, kardex, conteos, alertas de reposición |
| **Gerente / dueño** | Mira el estado del negocio | Tablero simple, alertas, cartera, balance |
| **Integrador (técnico)** | Conecta sistemas por API y **migra datos** desde otro sistema | Conectores, claves, webhooks, importación con vista previa, mapeos, conciliación |
| **Visitante de la vitrina** | Navega el catálogo y hace un pedido | Simplicidad, confianza, rapidez en móvil |

## 3. Principios de diseño (obligatorios)

1. **Serio, ágil y legible.** Sobrio; sin decoración; el color significa algo.
2. **Densidad con aire.** Muchos datos a la vez en tablas compactas (28 px por fila por defecto), con modos Normal y Cómodo.
3. **Los números mandan.** Cifras tabulares, alineadas a la derecha, con formato `es-CO` (`$ 1.190.000,00`); totales siempre visibles.
4. **Lo inmutable se ve inmutable.** Un comprobante contabilizado **no tiene «Editar» ni «Eliminar»**; se **Reversa**.
   Etiquetas `Contabilizado`, `Reversado por AJ-2`, `Reversión de AJ-1` visibles y enlazadas.
5. **El período contable siempre a la vista** (chip `Oct 2026 · Abierto` en la barra superior).
6. **Nada se esconde, todo se explica.** Un saldo contrario a la naturaleza de la cuenta se **marca**, no se oculta; un
   rechazo dice qué pasó, por qué y qué hacer, con su regla (`R-CON-001`).
7. **Teclado primero** (paleta `Ctrl/Cmd+K`, atajos visibles) y el ratón también.
8. **El color nunca es el único mensaje**; **débito y crédito se distinguen por columna, no por color** (no usar rojo/verde para eso).
9. **Un solo patrón** de lista, documento, diálogo de motivo y grilla de líneas en toda la aplicación.
10. **Todo es configurable por empresa** (cuentas por defecto, numeración, impuestos con vigencia, umbrales, mapeos de
    migración, límites de integración) y cada cambio deja bitácora; lo que **no** se configura son los invariantes
    contables (partida doble, inmutabilidad, períodos cerrados, aislamiento). Ver `06-…`.

## 4. Reglas del dominio que la interfaz debe respetar

- **Partida doble:** Σ débitos = Σ créditos; cada línea tiene **un solo lado** (débito o crédito), valor positivo, hasta
  2 decimales; mínimo 2 líneas (máximo 500). El botón *Contabilizar* solo se habilita cuando **cuadra**; el pie muestra
  `Σ Débitos · Σ Créditos · Diferencia`.
- **Cuentas:** solo cuentas **de movimiento y activas** reciben líneas; algunas **exigen tercero** y/o **centro de costo**.
- **Períodos:** un mes **cerrado** no admite comprobantes; **reabrirlo** es excepcional: permiso especial, **motivo
  obligatorio** y queda en bitácora. Cerrar exige balance cuadrado y **cero borradores** con fecha en el mes.
- **Inmutabilidad:** corregir = **reversar** (motivo obligatorio, fecha opcional, queda un comprobante nuevo que
  referencia al original). Un comprobante se reversa **una sola vez**; la reversión también puede reversarse.
- **Fechas:** la fecha contable no tiene zona horaria; las horas se muestran en **hora de Colombia**.
- **Dinero:** nunca coma flotante; las cifras son cadenas decimales exactas.
- **Créditos (ventas a crédito):** cupo por cliente, plazo, edades de cartera (Corriente · 1–30 · 31–60 · 61–90 · +90);
  un documento que excede el cupo o con mora queda **retenido** hasta que alguien con permiso lo **libere con motivo**.
  Estado de crédito por prevalencia: Suspendido > Bloqueado por mora > Bloqueado por cupo > En alerta > Al día.
  **No hay préstamos ni intereses de mora automáticos.**
- **Factura electrónica:** estados `Borrador → Emitida → En transmisión → Aceptada | Rechazada`; una factura aceptada
  no se edita (se corrige con nota crédito); solo se entrega al cliente cuando está aceptada.
- **Inventario:** costeo **Promedio ponderado** (por defecto) o **PEPS** (obligatorio en perecederos); **UEPS no es un
  método de costeo** (solo política de despacho físico, con advertencia); el método se bloquea cuando hay movimientos.

## 5. Navegación (resumen; detalle en `02-…`)

Barra superior: empresa · botón de búsqueda `Ctrl K` · **chip del período** · alertas · usuario.
Menú lateral (contraíble a íconos), en este orden:
**Inicio · Ventas · Cartera · Compras · Inventario · Contabilidad · Impuestos · Factura electrónica · Terceros ·
Catálogo y vitrina · Integraciones · Configuración.**
**Integraciones** contiene: Conectores · **Migración de datos** · Mapeos · Ejecuciones y errores · API Keys · Webhooks.
**Configuración** contiene: Empresa · Usuarios y roles · Numeración · Parámetros · Cuentas por defecto · Plantillas · Bitácora.
Profundidad máxima: grupo → pantalla → pestaña. **Contabilidad** contiene: Comprobantes · Nuevo comprobante ·
Borradores · Plan de cuentas · Libro diario · Libro mayor · Balance de prueba · Períodos · Cierre anual.

## 6. Sistema visual (resumen; detalle y contrastes en `04-…`)

- Tema **claro** y **oscuro**. Primario `#0B5CAD`; texto `#1B2430`; secundario `#4B5767`; superficie `#F4F6F8`;
  éxito `#17663E/#E6F4EA`; advertencia `#7A4B00/#FFF1D6`; peligro `#A8201A/#FDECEA`; neutro `#3F4A59/#E9EDF2`.
  Contrastes ya calculados (≥ 4,5:1 en texto).
- Tipografía **Inter** con **cifras tabulares**; códigos y hashes en monoespaciada. Base 4 px, radio 6/10 px, bordes antes
  que sombras.
- Idioma de la interfaz: **español (Colombia)**. Fechas `14/10/2026`; importes `$ 1.190.000,00`; NIT `900.123.456-7`.
- Accesibilidad **WCAG 2.1 AA**: foco visible, teclado completo, errores con texto+ícono, `aria-live` para la diferencia
  del comprobante.

## 7. Alcance de la primera maqueta (prioridad)

| Prioridad | Pantallas | Por qué |
|---|---|---|
| **P1 — con detalle máximo** | Cascarón (barra superior + menú + paleta) · **Contabilidad completa**: Lista de comprobantes · **Editor de comprobante** · Detalle (con diálogo *Reversar*) · Borradores · Libro diario · Libro mayor · **Balance de prueba** · **Períodos** (cerrar/reabrir) · Cierre anual · Plan de cuentas | Es lo único con backend real; permite validar el diseño contra el sistema |
| **P2 — a nivel de campos y estados** | Terceros (cliente con crédito) · **Factura de venta** (con línea de tiempo DIAN y retención de crédito) · Cartera por edades · Recibo de caja · Nota crédito/devolución | Flujo comercial principal |
| **P3 — esquema** | Ítems · Existencias y Kardex · ABC y conteos · Reposición · Compras · Factura electrónica (documentos y rangos) · Impuestos · API Keys y Webhooks · Bitácora · **Configuración por empresa** | Completa el mapa |
| **P3 — flujo completo** | **Integraciones y migración de datos** (asistente de 9 pasos desde Alegra o archivos, mapeos, ensayo, conciliación, ejecuciones) | Es un flujo guiado y debe poder recorrerse; es fase final (F8) pero se diseña desde ya |
| **P4 — después** | Vitrina pública (inicio, catálogo, ficha, pedido) · App móvil | Fases posteriores |

**Fuera de alcance (no maquetar):** préstamos y financiación, nómina, activos fijos, información exógena y declaraciones,
conciliación bancaria, multimoneda, manufactura, pasarela de pagos.

## 8. Datos de ejemplo (usar estos, son consistentes y cuadran)

Empresa: «Comercializadora Andina S.A.S.», NIT `900.123.456-7`. Octubre de 2026.

**Comprobantes contabilizados** (todos cuadrados):

| Fecha | Comprobante | Descripción | Líneas |
|---|---|---|---|
| 01/10/2026 | AJ-1 | Apertura de inventario aportado como capital | Dr `1435` 1.000.000 · Cr `3115` 1.000.000 |
| 05/10/2026 | FV-1 | Factura de venta a crédito con IVA | Dr `130505` 1.190.000 (tercero: cliente) · Cr `4135` 1.000.000 · Cr `2408` 190.000 |
| 05/10/2026 | FV-2 | Costo de ventas | Dr `6135` 600.000 · Cr `1435` 600.000 |
| 10/10/2026 | NC-1 | Nota crédito por devolución parcial | Dr `4175` 200.000 · Dr `2408` 38.000 · Cr `130505` 238.000 |
| 10/10/2026 | NC-2 | Reingreso al costo de salida | Dr `1435` 120.000 · Cr `6135` 120.000 |
| 20/10/2026 | RC-1 | Recibo de caja | Dr `1110` 952.000 · Cr `130505` 952.000 |

**Balance de prueba al 31/10/2026 (debe coincidir):**
`1110` 952.000 D · `1435` 520.000 D · `2408` 152.000 C · `3115` 1.000.000 C · `4135` 1.000.000 C · `4175` 200.000 D ·
`6135` 480.000 D · **Totales 2.152.000 / 2.152.000 — Cuadrado.** (`130505` con movimientos de 1.190.000 en cada lado y saldo 0.)

**Plan de cuentas (extracto):** `1105 Caja`, `1110 Bancos`, `130505 Clientes nacionales` (exige tercero), `1435 Mercancías`,
`2408 IVA por pagar`, `3115 Aportes sociales`, `4135 Comercio al por mayor y al por menor`, `4175 Devoluciones en
ventas`, `5105 Gastos de personal` (exige centro de costo), `6135 Costo de ventas`, `5905 Ganancias y pérdidas`,
`3605 Utilidad del ejercicio`.

**Períodos 2026:** Ene–Sep `Cerrado`, Oct `Abierto`, Nov–Dic `Abierto`. **Cierre anual de ejemplo:** utilidad de
320.000 (1.000.000 − 200.000 − 480.000).

**Casos de error para mostrar:** comprobante que no cuadra (100.000,00 vs 99.999,99 → diferencia 0,01); fecha en
septiembre (cerrado); cuenta `130505` sin tercero; cierre de octubre bloqueado por 1 borrador.

## 9. Orden de trabajo (pide una tanda a la vez)

1. **Tanda 1 — Cascarón y tokens:** layout (barra superior, menú lateral, chip de período), paleta de comandos,
   tema claro/oscuro, componentes base (botón, campo, tabla densa, etiquetas de estado, diálogo, toast, banner).
2. **Tanda 2 — Contabilidad (P1):** las 10 pantallas, con **todos los estados** (vacío, cargando, error, éxito) y los
   errores del §4. Prototipo clicable de los flujos: *crear → contabilizar → ver → reversar* y *cerrar mes (bloqueado →
   corregir → cerrado) → reabrir con motivo*.
3. **Tanda 3 — Comercial (P2):** terceros con crédito, factura (con retención por cupo y línea de tiempo DIAN), cartera,
   recibo, nota crédito.
4. **Tanda 4 — Inventario, compras, impuestos y FE (P3).**
5. **Tanda 5 — Integraciones, migración y configuración (P3):** pantallas IN.1–IN.10 y el patrón de configuración de
   `06-…`; prototipo clicable *conectar Alegra → mapear → ensayar → ejecutar → conciliar*.
6. **Tanda 6 — Vitrina y móvil (P4).**

## 10. Entregables esperados por tanda

- Maqueta **navegable** (HTML/React) en 1440 px (escritorio), 1024 px (tableta) y 390 px (móvil) donde aplique.
- Tema claro y oscuro; modo de densidad Compacta y Normal.
- Cada pantalla con sus **estados**: vacío, cargando (esqueleto), error, éxito y, si aplica, sin permiso.
- Un **inventario de componentes** y de **tokens** usados.
- Una **nota por pantalla** con decisiones de diseño y dudas abiertas.

## 11. Criterios de aceptación de la maqueta

- [ ] El balance de prueba de ejemplo suma exactamente **2.152.000 / 2.152.000** y muestra el sello `Cuadrado`.
- [ ] El editor de comprobante **no permite contabilizar descuadrado**; muestra la **diferencia** en vivo.
- [ ] **Ninguna pantalla** ofrece Editar o Eliminar sobre un comprobante contabilizado; sí ofrece **Reversar** con motivo.
- [ ] El **chip del período** está en todas las pantallas y avisa si la fecha cae en un período cerrado.
- [ ] Cerrar un mes con un borrador pendiente **no se puede** y lista la causa con enlace.
- [ ] Reabrir un período exige **motivo** (≥ 5 caracteres) y avisa que queda en bitácora.
- [ ] Los errores usan los **textos del catálogo** (`03-…` A.0) y marcan la celda correspondiente.
- [ ] La **paleta `Ctrl+K`** funciona (acciones, pantallas, registros; prefijos `>`, `@`, `#`).
- [ ] Débito y crédito se distinguen por **columna**, nunca solo por color; todo estado lleva texto o ícono.
- [ ] Formatos `es-CO` en todas las cifras y fechas; contrastes de `04-…` §2 respetados.
- [ ] El asistente de migración no deja ejecutar con problemas que **Bloquean**, es reanudable y termina en una **conciliación** con sello en texto.
- [ ] Deshacer una corrida avisa que se generan reversiones; las credenciales del conector se ven enmascaradas y Alegra figura como **solo lectura**.
- [ ] Cada pantalla de configuración tiene pestaña **Historial** y el aviso «no afecta documentos ya contabilizados».

## 12. Qué NO hacer

- No inventar funcionalidades fuera de alcance (préstamos, nómina, etc.) ni menús que no estén en este mapa.
- No dejar fijo en pantalla lo que `06-…` §5 define como configurable; no ofrecer configurar los invariantes de `06-…` §6.
- No copiar la interfaz, los íconos ni la marca de otro software contable: la propuesta es **propia**.
- No usar números decimales con punto en pantalla (`1,190,000.00`); respetar `es-CO`.
- No mostrar botones de edición en documentos inmutables; no ocultar saldos «raros».
- No depender del color para comunicar débito/crédito, éxito o error.

## 13. Dudas abiertas que la maqueta puede ayudar a decidir

1. ¿El editor de comprobante debe abrirse como pantalla completa o como panel lateral deslizante?
2. ¿«Reversar» debe mostrar siempre una vista previa de las líneas invertidas? (propuesto: sí)
3. ¿Qué tan visible debe ser la bitácora en cada documento (pestaña «Historial»)? (propuesto: sí, pestaña)
4. ¿Se necesita un tablero de inicio por rol (contador, gerente, cartera)? (propuesto: sí, simple)
5. Comparación con el programa de referencia del mercado: pendiente de las capturas de `05-…` §3.
