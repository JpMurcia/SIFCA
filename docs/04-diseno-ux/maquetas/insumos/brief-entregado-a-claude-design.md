# SIFCA — Brief de diseño de interfaz (Claude Design)

Oct 14, 2026 · @Juan Pablo Murcia Cortes

## 1. Contexto, personas y principios

**SIFCA (Sistema Integral Fiscal y Contable Ágil)** es una plataforma SaaS multiempresa para empresas colombianas: ERP contable y administrativo (contabilidad, ventas con facturación electrónica DIAN, cartera, compras, inventario con kardex, impuestos, integraciones), una vitrina pública por empresa y, más adelante, una app móvil. La promesa es *rigor contable con agilidad de uso*.

Cómo usar este documento: pégalo completo en Claude Design y pide la maqueta por tandas (§7). Estado real: solo **Contabilidad** tiene backend probado; el resto está especificado y sin construir. No existe interfaz todavía.

| Persona | Qué hace | Qué necesita |
| --- | --- | --- |
| Contador / revisor fiscal (principal) | Registra y revisa comprobantes, cierra períodos, consulta libros | Teclado, densidad, trazabilidad, poder explicar cada cifra |
| Auxiliar contable | Digita comprobantes todo el día | Captura tipo hoja de cálculo, autocompletar por código |
| Facturador / vendedor | Cotiza y factura | Ver el crédito del cliente antes de emitir; estado DIAN claro |
| Cartera / cobrador | Cobra, aplica recibos | Edades de cartera, estado de cuenta |
| Bodeguero | Recibe, cuenta, repone | Existencias, kardex, conteos, alertas |
| Gerente / dueño | Mira el negocio | Tablero simple y alertas |
| Integrador (técnico) | Conecta sistemas y migra datos | Conectores, claves, webhooks, importación con vista previa |
| Visitante de la vitrina | Navega y pide | Simplicidad y rapidez en móvil |

**Principios obligatorios**

1. Serio, ágil y legible: sobrio, el color significa algo.
2. Densidad con aire: tablas compactas (28 px por fila), modos Normal y Cómodo.
3. Los números mandan: cifras tabulares a la derecha, formato `es-CO` (`$ 1.190.000,00`), totales siempre visibles.
4. Lo inmutable se ve inmutable: un comprobante contabilizado no tiene «Editar» ni «Eliminar»; se **Reversa**.
5. El período contable siempre a la vista (chip `Oct 2026 · Abierto`).
6. Nada se esconde, todo se explica: los rechazos dicen qué pasó, por qué y qué hacer, con su regla (`R-CON-001`).
7. Teclado primero (`Ctrl/Cmd+K`) y ratón también.
8. El color nunca es el único mensaje; débito y crédito se distinguen por columna, no por color.
9. Un solo patrón de lista, documento, diálogo de motivo y grilla de líneas.
10. **Todo es configurable**: cuentas, impuestos, numeraciones, mapeos y umbrales no quedan fijos en pantalla; se parametrizan por empresa y dejan bitácora.

## 2. Reglas del dominio que la interfaz debe respetar

Si la maqueta contradice una de estas reglas, la maqueta está mal.

| Área | Regla | Efecto en la interfaz |
| --- | --- | --- |
| Partida doble | Σ débitos = Σ créditos; una línea tiene un solo lado, valor positivo, hasta 2 decimales; de 2 a 500 líneas | *Contabilizar* solo se habilita si cuadra; el pie muestra Σ Débitos, Σ Créditos y Diferencia en vivo |
| Cuentas | Solo cuentas de movimiento y activas reciben líneas; algunas exigen tercero o centro de costo | El selector de cuenta oculta las acumuladoras; el campo exigido se marca antes de enviar |
| Períodos | Un mes cerrado no admite comprobantes; reabrir exige permiso, motivo y queda en bitácora; cerrar exige balance cuadrado y cero borradores | Chip del período en todas las pantallas; cierre bloqueado lista la causa con enlace |
| Inmutabilidad | Corregir es reversar (motivo obligatorio, fecha opcional); se reversa una sola vez | Sin Editar ni Eliminar; etiquetas «Reversado por AJ-2» / «Reversión de AJ-1» enlazadas |
| Fechas y dinero | La fecha contable no tiene zona horaria; las horas se muestran en hora de Colombia; el dinero nunca es coma flotante | Formato `es-CO`; cifras como texto decimal exacto |
| Crédito | Cupo, plazo y edades Corriente, 1–30, 31–60, 61–90, +90; lo que excede cupo o tiene mora queda retenido hasta liberarlo con motivo; sin préstamos ni intereses automáticos | Estado de crédito por prevalencia: Suspendido > Bloqueado por mora > Bloqueado por cupo > En alerta > Al día |
| Factura electrónica | Borrador, Emitida, En transmisión, Aceptada o Rechazada; la aceptada no se edita (nota crédito); se entrega solo si está aceptada | Línea de tiempo de estados; acciones según estado |
| Inventario | Costeo Promedio ponderado (por defecto) o PEPS (obligatorio en perecederos); UEPS no es método de costeo; el método se bloquea con movimientos | Selector de método con advertencia; candado cuando hay movimientos |
| Datos importados | Lo migrado entra como borrador revisable o como comprobante de apertura; nunca modifica lo contabilizado | Vista previa y conciliación antes de confirmar (ver §5) |

**Ninguna regla marcada como pendiente de validación por el contador pasa a producción sin su visto bueno.** La maqueta puede mostrar la regla, pero el texto fiscal definitivo lo fija el contador.

## 3. Navegación

El menú lateral tiene 12 grupos con profundidad máxima de tres niveles (grupo, pantalla, pestaña) y sigue el proceso contable, no las tablas de la base de datos. Leyenda: ✅ backend probado · 📐 especificado, sin construir · 💡 propuesta de diseño.

**Barra superior (siempre visible):** logo y empresa con NIT · búsqueda «Buscar o ejecutar… `Ctrl K`» · **chip del período** («Oct 2026 · Abierto»; en rojo suave si está cerrado) · campana de alertas (cupo al 80 % y 100 %, mora, rechazos DIAN, reposición, **errores de integración**) · usuario (formato, tema claro/oscuro/denso, salir).

| Grupo | Pantallas | Estado |
| --- | --- | --- |
| Inicio | Tablero por rol, alertas y tareas | 💡 |
| Ventas | Cotizaciones, Pedidos, Facturas de venta, Notas crédito y débito, Punto de venta | 📐 |
| Cartera | Cartera por edades, Recibos de caja, Estado de cuenta, Cupos y retenciones | 📐 |
| Compras | Órdenes, Facturas de proveedor, Comprobantes de egreso, Devoluciones | 📐 |
| Inventario | Ítems, Existencias, Kardex, Ajustes y traslados, ABC y conteos, Reposición | 📐 |
| **Contabilidad** | Comprobantes, Nuevo comprobante, Borradores, Plan de cuentas, Libro diario, Libro mayor, Balance de prueba, Períodos, Cierre anual | ✅ |
| Impuestos | Tarifas y vigencias, Retenciones y UVT | 📐 |
| Factura electrónica | Documentos y estado DIAN, Rangos de numeración, Cola de contingencia | 📐 |
| Terceros | Clientes, Proveedores | 📐 |
| Catálogo y vitrina | Publicación, Pedidos web | 📐 |
| **Integraciones** | Conectores, **Migración de datos**, Mapeos, Ejecuciones y errores, API Keys, Webhooks y entregas | 📐 / 💡 (ver §5) |
| **Configuración** | Empresa, Usuarios y roles, Numeración, **Parámetros**, Cuentas por defecto, Plantillas, Bitácora | 💡 |

**Paleta `Ctrl/Cmd+K`:** sin prefijo mezcla pantallas, acciones y registros; `>` acciones (`> Nuevo comprobante`, `> Reversar este comprobante`, `> Importar datos`); `@` terceros; `#` documentos por número (`#AJ-1`); `/` ayuda. Muestra el atajo de cada acción, recientes, acciones contextuales y solo lo que el usuario puede hacer; tolera tildes.

**Atajos propuestos:** `G` luego `C/V/I/T` (ir a), `N` nuevo, `/` filtrar, `Ctrl+S` guardar borrador, `Ctrl+Enter` contabilizar o emitir (solo si es válido), `Tab`/`Enter`/flechas en la grilla, `Ctrl+V` pega varias filas desde una hoja de cálculo, `Alt+↑/↓` mueve fila, `Esc` cierra, `?` lista los atajos.

**Flujos que la maqueta debe poder recorrer**

1. Lista de comprobantes → Nuevo → Guardar borrador → Contabilizar (solo si cuadra) → Detalle → Reversar con motivo → Detalle de la reversión → Ver original.
2. Períodos → Cerrar mes → ¿causas de bloqueo? (borradores, balance) → corregir → cerrado en bitácora → Reabrir con permiso y motivo.
3. Venta a crédito: pedido o factura → ¿cupo y mora? → emitir, o retención de crédito → liberar con motivo o cobrar → estado DIAN → entrega al cliente → devolución con nota crédito.
4. **Migrar desde otro sistema:** Integraciones → Conectores → elegir origen → credenciales y prueba → qué traer → mapeos → vista previa → ensayo → ejecutar → conciliar → cierre de la migración (§5).

## 4. Catálogo de pantallas

Todas las pantallas llevan estados de vacío, cargando (esqueleto), error, éxito y sin permiso. Contabilidad se maqueta con el máximo detalle porque su backend existe y permite validar el diseño; el resto, a nivel de campos y estados.

### 4.1 Contabilidad ✅ (prioridad P1)

| Pantalla | Ruta | Qué debe mostrar | Regla que manda |
| --- | --- | --- | --- |
| Lista de comprobantes | `/contabilidad/comprobantes` | Filtros por fechas, tipo (AJ, FV, NC, RC, CE, CI), cuenta y origen; columnas fecha, número, descripción, origen, débito, crédito, etiquetas, autor; 25 por página | Sin «Editar» ni «Eliminar» por fila; etiquetas Contabilizado, Reversado por, Reversión de, Cierre anual |
| Editor de comprobante | `/contabilidad/comprobantes/nuevo` | Cabecera (tipo con «siguiente número» orientativo, fecha, descripción, origen Manual) y grilla tipo hoja de cálculo: cuenta, tercero, centro de costo, débito, crédito, descripción, referencia, vencimiento | Pie con Σ Débitos, Σ Créditos y **Diferencia**; Contabilizar (`Ctrl+Enter`) solo si cuadra; pegar filas; aviso inmediato si el período está cerrado |
| Detalle de comprobante | `/contabilidad/comprobantes/:id` | Cabecera con número, etiquetas, fecha, período, autor; líneas; enlaces a original o reversión; pestaña Historial | Solo la acción **Reversar**, con diálogo de motivo y vista previa de las líneas invertidas |
| Borradores | `/contabilidad/borradores` | Lista y edición; los borradores no consumen consecutivo | Un borrador con fecha en un mes bloquea su cierre |
| Libro diario | `/contabilidad/diario` | Movimientos por rango, orden estable | Mismo rango, mismo resultado |
| Libro mayor | `/contabilidad/mayor` | Por cuenta: saldo inicial, movimientos, saldo corriente | Saldo contrario a la naturaleza: se marca, no se oculta |
| Balance de prueba | `/contabilidad/balance-de-prueba` | Saldos por cuenta y totales con sello Cuadrado / No cuadra | El ejemplo suma 2.152.000 / 2.152.000 |
| Períodos | `/contabilidad/periodos` | 12 meses del año con estado; Cerrar y Reabrir | Cerrar lista causas de bloqueo con enlace; reabrir exige permiso y motivo de al menos 5 caracteres |
| Cierre anual | `/contabilidad/cierre-anual` | Resumen de resultado y cuentas de traslado (5905, 3605) | Genera un comprobante reversible |
| Plan de cuentas | `/contabilidad/plan-de-cuentas` | Árbol por nivel, naturaleza, si exige tercero o centro de costo, si es de movimiento | Lectura hoy; edición es propuesta |

**Errores y su texto en pantalla** (llegan como `problem+json` con un `code` estable y, a veces, `errors[]` con campo y regla)

| Código | Cuándo | Texto | Dónde |
| --- | --- | --- | --- |
| `ENTRY_NOT_BALANCED` | Σ débitos ≠ Σ créditos | «El comprobante no cuadra: débitos $ 100.000,00 ≠ créditos $ 99.999,99. Diferencia: $ 0,01.» | Banner sobre la grilla y pie |
| `VALIDATION_FAILED` | Regla de línea o esquema | Un mensaje por elemento de `errors[]` | En la celda indicada y resumen arriba |
| `PERIOD_CLOSED` | Fecha en período cerrado | «El período 2026-09 está cerrado. Cambia la fecha contable o pide que lo reabran.» | Junto a la fecha |
| `PERIOD_NOT_FOUND` | Fecha sin período | «No existe un período contable para esa fecha. Crea el año fiscal en Períodos.» | Con enlace a Períodos |
| `ALREADY_REVERSED` | Segunda reversión | «Este comprobante ya fue reversado por AJ-2.» | Diálogo |
| `PERIOD_CLOSE_BLOCKED` | Cierre rechazado | Lista de causas, p. ej. «Hay 1 borrador(es) con fecha en el período…» | Diálogo con enlaces |
| `FORBIDDEN` | Falta permiso | «No tienes permiso para esta acción (accounting.period.reopen).» | Toast; el botón debería estar oculto o explicado |
| `CONFLICT` | Borrador desactualizado u otra concurrencia | Mensaje del servidor | Diálogo «Recargar» |
| `INTERNAL_ERROR` | Falla inesperada | «Ocurrió un error inesperado. Código de seguimiento: …» con el `requestId` copiable | Página o toast |

Un reintento por falla de red con la misma clave de idempotencia puede devolver el mismo comprobante: la interfaz lo trata como éxito sin duplicar.

### 4.2 Comercial 📐 (P2, campos y estados)

- **Terceros:** cliente con cupo, plazo, estado de crédito (por prevalencia) y saldo; proveedor con retenciones aplicables.
- **Factura de venta:** editor con ítems, impuestos calculados línea a línea, aviso de cupo antes de emitir, **línea de tiempo DIAN** (Borrador → Emitida → En transmisión → Aceptada o Rechazada) y retención de crédito liberable con motivo.
- **Cartera por edades**, **recibo de caja** (aplicación a facturas) y **nota crédito o devolución** con reingreso al kardex.

### 4.3 Inventario, compras, impuestos y FE 📐 (P3, esquema)

Ítems, existencias y kardex (costo promedio o PEPS), ABC y conteos, reposición, compras y devolución a proveedor, tarifas y retenciones, documentos y rangos de factura electrónica con cola de contingencia, **bitácora de auditoría**. Integraciones y migración tienen su propia sección (§5).

### 4.4 Vitrina pública y móvil 📐 (P4)

Inicio, catálogo, ficha de producto, carrito y pedido en móvil primero; app móvil con Inicio, Cartera, Alertas y Más.

### 4.5 Estados globales (todas las pantallas)

Vacío con una acción clara, cargando con esqueleto, error con reintento y `requestId`, sin permiso con explicación, sin conexión, sesión vencida y confirmación de salir con cambios sin guardar.

## 5. Integraciones, migración de datos y configuración

SIFCA debe poder traer los datos de otro sistema (primero **Alegra**, luego archivos CSV/XLSX), conectarse a terceros y adaptarse a cada empresa sin tocar código. Es la fase final del roadmap (F8), pero se diseña desde ya. Nada de esto está construido: se maqueta como flujo guiado (migración completa) y como esquema (el resto).

### 5.1 Qué se integra

| Tipo | Conector | Dirección | Estado |
| --- | --- | --- | --- |
| Origen de datos | **Alegra** (API REST) | Entrada, solo lectura | 💡 F8 |
| Origen de datos | **Archivos CSV / XLSX** con plantillas descargables (sirve para otros sistemas vía exportación) | Entrada | 💡 F8 |
| Factura electrónica | Proveedor tecnológico (PTA) | Salida y estado | 📐 spec 009 |
| API pública | API Keys con alcances y límites | Entrada | 📐 spec 011 |
| Eventos | Webhooks firmados con reintentos y registro de entregas | Salida | 📐 spec 011 |
| Exportación | Reportes y maestros a CSV/XLSX | Salida | 💡 |

### 5.2 Lo que se sabe de la API de Alegra

La documentación oficial no fue accesible desde el entorno de redacción; lo siguiente viene de un proyecto hermano que la probó contra una cuenta real (✅) y de herramientas de terceros (⚠️). Antes de programar el conector hay que descargar y versionar la documentación oficial.

| Tema | Detalle | Certeza |
| --- | --- | --- |
| Base y autenticación | `https://api.alegra.com/api/v1`, HTTP Basic con correo y token; token *Bearer* para apps de marketplace | ✅ / ⚠️ |
| Paginación | `start` + `limit`, máximo 30 por página; más da `400` | ✅ |
| Validar credenciales | `GET /company` | ✅ |
| Límite de tasa | `429` con `Retry-After`; el valor del límite se desconoce | ✅ el código · 🔶 el valor |
| Identificadores | Texto opaco | ✅ |
| Recursos | Contactos, ítems, categorías y listas de precio, bodegas, impuestos y retenciones, centros de costo, facturas, notas, cotizaciones, compras, pagos, cuentas bancarias, plan de cuentas (`categories`), asientos (`journals`), suscripciones a webhooks | ⚠️ |

### 5.3 Reglas de la migración (el contador debe validarlas)

1. **Estrategia recomendada: saldos iniciales a la fecha de corte** — un comprobante de apertura que cuadra, cartera y cuentas por pagar abiertas y existencias iniciales con su costo. El histórico completo es opcional.
2. Si el comprobante de apertura no cuadra, **no se contabiliza**: la corrida se detiene y muestra la diferencia.
3. Lo importado pasa por los **mismos casos de uso** que lo digitado y lleva origen `MIGRATION` y su referencia externa; volver a correr no duplica.
4. Las facturas históricas **no se retransmiten a la DIAN**: quedan de solo lectura con el número y el CUFE de origen 🔶.
5. **Nunca se escribe en el sistema de origen.**
6. Deshacer una corrida **no borra** lo contabilizado: genera reversiones; los maestros sin uso se desactivan.
7. La migración termina solo cuando la **conciliación** cuadra por cuenta, por tercero y por ítem y bodega (tolerancia configurable, cero por defecto en dinero).
8. Las credenciales se guardan cifradas, se muestran enmascaradas y se pueden revocar.

### 5.4 Pantallas a maquetar

| Id | Pantalla | Ruta | Qué debe mostrar |
| --- | --- | --- | --- |
| IN.1 | Conectores | `/integraciones/conectores` | Galería de tarjetas (Alegra, Archivos, Proveedor de factura electrónica, API Keys, Webhooks) con estado, última sincronización y errores como «Alegra rechazó las credenciales (401)» |
| IN.2 | Configurar Alegra | `/integraciones/conectores/alegra` | Nombre, correo, token enmascarado, **Probar conexión** (muestra la empresa), URL base, tamaño de página 1–30, pausa y reintentos ante `429`; modo solo lectura con candado |
| IN.3 | **Asistente de migración** | `/integraciones/migracion/nueva` | 9 pasos reanudables: Origen y fecha de corte → Estrategia → Qué traer → Mapeos → Revisión de datos → Ensayo → Ejecución → Conciliación → Cierre |
| IN.4 | Mapeos | `/integraciones/migracion/:id/mapeos` | Tabla editable por entidad: valor de origen, valor en SIFCA, confianza (Exacto, Sugerido, Sin resolver), acción; plantillas reutilizables; importar y exportar CSV; no avanza con obligatorios sin resolver |
| IN.5 | Informe del ensayo | `/integraciones/migracion/:id/ensayo` | Conteos por entidad (leídos, a crear, a actualizar, ignorados, con error), problemas Bloquea o Advierte, descarga de rechazados; **Ejecutar** solo sin bloqueos |
| IN.6 | Conciliación | `/integraciones/migracion/:id/conciliacion` | Vistas por cuenta, por tercero y por ítem y bodega: origen, SIFCA, diferencia; sello Cuadra / No cuadra con texto; aceptar diferencia con motivo solo dentro de la tolerancia |
| IN.7 | Ejecuciones y errores | `/integraciones/ejecuciones` | Corridas con estado (Ensayo, En ejecución, Pausada, Conciliando, Cerrada, Revertida, Con errores), reintentar fallidos, deshacer corrida |
| IN.8 | Sincronización continua | `/integraciones/conectores/alegra/sincronizacion` | Esquema opcional: entidades, frecuencia, conflictos (gana el origen, gana SIFCA, preguntar) 💡 posterior |
| IN.9 | API Keys | `/integraciones/api-keys` | Prefijo visible, alcances, último uso; el secreto se muestra una sola vez; rotar y revocar |
| IN.10 | Webhooks | `/integraciones/webhooks` | Suscripciones con secreto de firma, registro de entregas, reenviar y pausar |

Orden de las entidades a migrar (cada una depende de la anterior): empresa → plan de cuentas → impuestos y retenciones → terceros → bodegas, categorías y listas de precio → ítems → existencias iniciales con costo → saldos iniciales contables → cartera y cuentas por pagar abiertas → histórico (solo en la estrategia completa).

### 5.5 Configuración por empresa (`/configuracion`)

Todo lo que cambia por empresa, por norma o por negocio es un **dato con vigencia y bitácora**, no código.

| Grupo | Qué se configura |
| --- | --- |
| Empresa | Razón social, NIT, régimen, logo, zona horaria de presentación |
| Numeración | Prefijo y consecutivo por tipo de comprobante; rangos de factura electrónica |
| Plan de cuentas | Cuentas auxiliares; si exigen tercero o centro de costo; activar o desactivar |
| **Cuentas por defecto** | Qué cuenta usa cada evento: ventas, IVA, costo, inventario, caja, bancos, retenciones, redondeo, 5905 y 3605 |
| Impuestos y retenciones | Tarifas con vigencia, base mínima en UVT, UVT del año |
| Crédito y cartera | Cupo y plazo por defecto, umbrales 80 % y 100 %, días de mora, quién libera retenciones |
| Inventario | Método de costeo, política de despacho, cortes ABC, nivel de servicio |
| Períodos | Año fiscal, motivo mínimo para reabrir |
| Roles, plantillas, alertas, integraciones, interfaz | Permisos por rol; PDF y correos; qué se avisa y a quién; conectores y claves; tema y densidad |

**Un solo patrón de pantalla:** lista a la izquierda, formulario a la derecha, «vigencia desde» cuando aplique, motivo en cambios sensibles, pestaña Historial y el aviso «Este cambio no afecta documentos ya contabilizados».

**No es configurable:** partida doble, inmutabilidad (se corrige reversando), bloqueo de períodos cerrados, aislamiento entre empresas, dinero exacto con dos decimales y la bitácora de cambios.

### 5.6 Fase y radar

F8 — Integraciones y migración: specs propuestas 013 (configuración por empresa), 014 (conectores) y 015 (migración). Criterio de salida: migrar una empresa de prueba con conciliación en cero y poder deshacer la corrida sin perder la inmutabilidad. Para no cerrar puertas se decide desde ahora una tabla de referencias externas por empresa, el origen `MIGRATION` en comprobantes y una cola de trabajos largos (el *outbox* de la spec 011).

## 6. Sistema de diseño y accesibilidad

Todo lo de esta sección es una propuesta de partida para que la maqueta sea coherente; los valores se pueden cambiar, pero no los principios, la accesibilidad WCAG 2.1 AA ni los formatos `es-CO`. Los contrastes están calculados con la relación de luminancia de WCAG.

| Token (tema claro) | Valor | Uso | Contraste del texto |
| --- | --- | --- | --- |
| `--bg` | `#FFFFFF` | Fondo de página y tablas | — |
| `--surface` | `#F4F6F8` | Barras laterales, cabeceras de tabla, tarjetas | — |
| `--text` | `#1B2430` | Texto principal | 15,65:1 sobre fondo |
| `--text-muted` | `#4B5767` | Texto secundario | 7,35:1 sobre fondo |
| `--primary` | `#0B5CAD` | Acción principal, enlaces, selección | 6,67:1 (texto blanco en botón) |
| `--success` | `#17663E` sobre `#E6F4EA` | Cuadrado, aceptada, abierto | 6,15:1 |
| `--warning` | `#7A4B00` sobre `#FFF1D6` | Advertencias, saldo contrario, borrador | 6,64:1 |
| `--danger` | `#A8201A` sobre `#FDECEA` | Errores, descuadre, rechazo | 6,36:1 |
| `--info` | `#0B5CAD` sobre `#E8F1FB` | Información | 5,85:1 |
| `--neutral` | `#3F4A59` sobre `#E9EDF2` | Contabilizado, Reversado | 7,65:1 |
| `--border-strong` | `#7B8794` | Bordes de campos | 3,66:1 (no texto, mínimo 3:1) |

**Tema oscuro** (recomendado): fondo `#11161D`, texto `#E6EAF0` (15,04:1), secundario `#A9B4C2` (8,64:1), primario `#7DB7F2` (8,59:1).

**Reglas de color:** el rojo es solo para error, descuadre o rechazo; **débito y crédito se distinguen por columna y encabezado, nunca por rojo y verde**; un saldo negativo lleva «−», no solo color; período `Abierto` en verde y `Cerrado` en neutro con candado (cerrar es normal, no un error).

**Tipografía:** Inter con cifras tabulares en todos los números; monoespaciada solo para códigos de cuenta, CUFE, hashes y claves. Escala 12, 13, 14 (tablas), 16 (formularios), 20, 24, 32. **Forma:** base de 4 px, radio 6 px en controles y 10 px en tarjetas y diálogos; bordes antes que sombras.

| Densidad | Alto de fila | Texto de tabla | Uso |
| --- | --- | --- | --- |
| Compacta (por defecto en Contabilidad) | 28 px | 13 px | Grillas de líneas, libros, kardex |
| Normal | 36 px | 14 px | Listas generales |
| Cómoda | 44 px | 16 px | Móvil y táctil (objetivo ≥ 44 px) |

**Componentes propios de SIFCA**

- **Cabecera de documento inmutable:** título (`AJ-1`), etiquetas de estado (Contabilizado con candado, Reversado por …), fecha, período, origen, autor con hora de Colombia; acción **Reversar** secundaria; nunca Editar ni Eliminar.
- **Grilla de líneas editable:** navegación tipo hoja de cálculo, pegar varias filas, autocompletar de cuenta por código o nombre, celda con error con borde, ícono y mensaje asociado; pie fijo con Σ Débitos, Σ Créditos y Diferencia.
- **Chip de período, diálogo de motivo** (mínimo 5 caracteres, aviso de bitácora) y **etiquetas de estado** con ícono y texto.
- **Para integraciones:** asistente por pasos con avance guardado, tabla de mapeo con confianza (Exacto, Sugerido, Sin resolver), barra de progreso por entidad con pausar, informe de ensayo con severidad (Bloquea, Advierte) y panel de conciliación con sello Cuadra / No cuadra.
- **Formularios de configuración:** patrón lista y detalle con «vigencia desde», motivo en cambios sensibles y pestaña Historial.

**Formatos `es-CO`:** fechas `14/10/2026`; importes `$ 1.190.000,00` (punto de miles, coma decimal); NIT `900.123.456-7`; horas en hora de Colombia. Nunca `1,190,000.00`.

**Accesibilidad:** foco siempre visible, teclado completo en cada flujo, errores con texto e ícono (no solo color), `aria-live` para la diferencia del comprobante y el progreso de la migración, objetivos táctiles de 44 px en móvil, `prefers-reduced-motion` respetado.

## 7. Datos de ejemplo, entrega por tandas y criterios de aceptación

### 7.1 Datos de ejemplo de contabilidad (usar estos; cuadran)

Empresa «Comercializadora Andina S.A.S.», NIT `900.123.456-7`, octubre de 2026.

| Fecha | Comprobante | Descripción | Líneas |
| --- | --- | --- | --- |
| 01/10/2026 | AJ-1 | Apertura de inventario aportado como capital | Dr `1435` 1.000.000 · Cr `3115` 1.000.000 |
| 05/10/2026 | FV-1 | Factura de venta a crédito con IVA | Dr `130505` 1.190.000 (tercero: cliente) · Cr `4135` 1.000.000 · Cr `2408` 190.000 |
| 05/10/2026 | FV-2 | Costo de ventas | Dr `6135` 600.000 · Cr `1435` 600.000 |
| 10/10/2026 | NC-1 | Nota crédito por devolución parcial | Dr `4175` 200.000 · Dr `2408` 38.000 · Cr `130505` 238.000 |
| 10/10/2026 | NC-2 | Reingreso al costo de salida | Dr `1435` 120.000 · Cr `6135` 120.000 |
| 20/10/2026 | RC-1 | Recibo de caja | Dr `1110` 952.000 · Cr `130505` 952.000 |

**Balance de prueba al 31/10/2026:** `1110` 952.000 D · `1435` 520.000 D · `2408` 152.000 C · `3115` 1.000.000 C · `4135` 1.000.000 C · `4175` 200.000 D · `6135` 480.000 D · **totales 2.152.000 / 2.152.000, Cuadrado** (`130505` mueve 1.190.000 en cada lado y queda en 0).

**Plan de cuentas (extracto):** `1105 Caja`, `1110 Bancos`, `130505 Clientes nacionales` (exige tercero), `1435 Mercancías`, `2408 IVA por pagar`, `3115 Aportes sociales`, `4135 Comercio al por mayor y al por menor`, `4175 Devoluciones en ventas`, `5105 Gastos de personal` (exige centro de costo), `6135 Costo de ventas`, `5905 Ganancias y pérdidas`, `3605 Utilidad del ejercicio`. **Períodos 2026:** enero a septiembre Cerrado, octubre a diciembre Abierto. **Cierre anual de ejemplo:** utilidad de 320.000.

**Errores para mostrar:** comprobante que no cuadra (100.000,00 contra 99.999,99, diferencia 0,01); fecha en septiembre (cerrado); cuenta `130505` sin tercero; cierre de octubre bloqueado por 1 borrador.

### 7.2 Datos de ejemplo de migración (otra empresa, para no mezclar con lo anterior)

Empresa «Papelería Los Andes S.A.S.» migra desde Alegra con fecha de corte **30/09/2026** y estrategia de saldos iniciales.

| Saldo inicial | Cuenta | Débito | Crédito |
| --- | --- | --: | --: |
| Bancos | `1110` | $ 2.000.000,00 |  |
| Clientes (Distribuidora El Roble S.A.S., NIT 900.456.789-1) | `130505` | $ 1.190.000,00 |  |
| Mercancías | `1435` | $ 1.000.000,00 |  |
| Proveedores (Papeles del Valle Ltda.) | `2205` |  | $ 650.000,00 |
| IVA por pagar | `2408` |  | $ 190.000,00 |
| Aportes sociales | `3115` |  | $ 3.350.000,00 |
| **Totales** |  | **$ 4.190.000,00** | **$ 4.190.000,00** |

- **Ensayo (lo que muestra la pantalla):** 148 terceros y 1.236 ítems leídos; 3 problemas que **Advierten** (NIT sin dígito de verificación) y 1 que **Bloquea** (impuesto «IVA 19 %» sin mapear). Al mapearlo, el botón Ejecutar se habilita.
- **Conciliación que debe verse:** cuentas y cartera con diferencia $ 0,00 (Cuadra); un caso «No cuadra»: mercancías con valor de origen $ 1.000.000,00 y en SIFCA $ 0,00 porque faltó el costo unitario inicial; se corrige cargando el costo y repitiendo.
- **Errores de conexión:** credenciales rechazadas (401) y espera por límite de tasa (429).

### 7.3 Entrega por tandas (pedir una a la vez)

1. **Cascarón y tokens:** barra superior, menú, chip de período, paleta `Ctrl+K`, tema claro y oscuro, componentes base.
2. **Contabilidad (P1):** las 10 pantallas con todos sus estados; prototipos clicables *crear, contabilizar, ver, reversar* y *cerrar mes (bloqueado, corregir, cerrado) y reabrir con motivo*.
3. **Comercial (P2):** terceros con crédito, factura con retención por cupo y línea de tiempo DIAN, cartera, recibo, nota crédito.
4. **Inventario, compras, impuestos y factura electrónica (P3).**
5. **Integraciones, migración y configuración (P3 con el asistente completo):** IN.1 a IN.10 y el patrón de configuración; prototipo clicable *conectar Alegra, mapear, ensayar, ejecutar, conciliar*.
6. **Vitrina y móvil (P4).**

Cada tanda entrega una maqueta navegable en 1440, 1024 y 390 px donde aplique, en tema claro y oscuro, con estados vacío, cargando, error, éxito y sin permiso, un inventario de componentes y tokens, y una nota por pantalla con decisiones y dudas.

### 7.4 Criterios de aceptación

- [ ] El balance de prueba de ejemplo suma exactamente 2.152.000 / 2.152.000 y muestra el sello Cuadrado.
- [ ] El editor de comprobante no permite contabilizar descuadrado y muestra la diferencia en vivo.
- [ ] Ninguna pantalla ofrece Editar o Eliminar sobre un comprobante contabilizado; sí ofrece Reversar con motivo.
- [ ] El chip del período está en todas las pantallas y avisa si la fecha cae en un período cerrado.
- [ ] Cerrar un mes con un borrador pendiente no se puede y lista la causa con enlace.
- [ ] Reabrir un período exige motivo de al menos 5 caracteres y avisa que queda en bitácora.
- [ ] Los errores usan los textos del catálogo (§4.1) y marcan la celda correspondiente.
- [ ] La paleta `Ctrl+K` funciona (acciones, pantallas, registros; prefijos `>`, `@`, `#`).
- [ ] Débito y crédito se distinguen por columna; todo estado lleva texto o ícono.
- [ ] Formatos `es-CO` en todas las cifras y fechas; contrastes de §6 respetados.
- [ ] El asistente de migración no deja ejecutar con problemas que Bloquean y es reanudable en cualquier paso.
- [ ] La conciliación muestra origen, SIFCA y diferencia por cuenta, tercero e ítem, con el sello en texto.
- [ ] Deshacer una corrida avisa que se generan reversiones y no se borra nada contabilizado.
- [ ] Las credenciales del conector siempre aparecen enmascaradas; el modo de Alegra se ve como solo lectura.
- [ ] Cada pantalla de configuración tiene Historial y el aviso de que no afecta documentos ya contabilizados.

### 7.5 Qué no hacer

- No inventar funciones fuera de alcance (préstamos, nómina, activos fijos, exógena, conciliación bancaria, multimoneda, manufactura, pasarela de pagos) ni menús que no estén en §3.
- No copiar la interfaz, los íconos ni la marca de otro software contable: la propuesta es propia.
- No mostrar editar sobre documentos inmutables ni ocultar saldos «raros»; no depender del color.
- No dejar valores fijos que §5.5 define como configurables (cuentas, numeración, impuestos, umbrales, mapeos).

### 7.6 Dudas abiertas que la maqueta puede ayudar a decidir

1. ¿Editor de comprobante en pantalla completa o en panel lateral?
2. ¿«Reversar» muestra siempre una vista previa de las líneas invertidas? (propuesto: sí)
3. ¿Pestaña Historial en cada documento? (propuesto: sí)
4. ¿Tablero de inicio por rol? (propuesto: sí, simple)
5. ¿La migración es un asistente aparte o una sección de Configuración?
6. La navegación de otros programas contables sigue sin documentar: se necesita capturas o una demo.

### Fuentes

- [alegra-cli](https://github.com/jjuanrivvera/alegra-cli) (herramienta de terceros): lista de recursos, filtros, paginación y autenticación de la API de Alegra; consultada el 14/10/2026. ⚠️ no es documentación oficial.
- Documentación oficial de Alegra (`developer.alegra.com`): **no accesible** desde el entorno de redacción.
- Repositorio SIFCA, `docs/`: reglas, specs, arquitectura y verificaciones de Asia-POP contra una cuenta real de Alegra (4/10/2026, solo lectura).
