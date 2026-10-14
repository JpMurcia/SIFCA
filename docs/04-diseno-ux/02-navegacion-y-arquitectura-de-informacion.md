# Navegación y arquitectura de información

Insumo para la maqueta. Leyenda de estado: ✅ el backend existe y está probado · 📐 especificado en una spec, sin
backend aún · 💡 propuesta de diseño sin spec (decisión pendiente).

## 1. Principios de navegación

| # | Principio | Consecuencia en el diseño |
|---|---|---|
| N-1 | **El teclado primero**: el contador trabaja horas sin soltar el teclado | Toda acción frecuente tiene atajo; la paleta `Ctrl/Cmd+K` llega a cualquier pantalla, acción o registro (CP-01…CP-07) |
| N-2 | **El menú sigue el proceso contable**, no la tabla de la base de datos | Grupos por actividad: Ventas, Cartera, Compras, Inventario, Contabilidad… |
| N-3 | **Lo inmutable se ve inmutable** | Un comprobante contabilizado no tiene «Editar» ni «Eliminar»: tiene «Reversar». Las etiquetas *Contabilizado*, *Reversado por…* y *Reversión de…* son visibles |
| N-4 | **El período contable siempre a la vista** | Chip permanente en la barra superior («Oct 2026 · Abierto») y aviso al intentar operar en un período cerrado |
| N-5 | **Estados explicables** | Cada rechazo muestra el código estable, la causa en español y la regla (p. ej. `R-CON-001`) |
| N-6 | **Un solo lugar por tarea**; el resto son enlaces | Un documento se puede abrir desde la lista, la paleta o un enlace de otro documento |
| N-7 | **Profundidad máxima de 3 niveles** en el menú | Grupo → pantalla → pestaña; lo demás se resuelve con filtros y paleta |

## 2. Mapa del sitio (back-office)

```mermaid
flowchart LR
    Raiz["SIFCA back-office"]

    subgraph Inicio["Inicio"]
        I1["Tablero 💡"]
        I2["Alertas y tareas pendientes 💡"]
    end

    subgraph Ventas["Ventas 📐"]
        V1["Cotizaciones"]
        V2["Pedidos"]
        V3["Facturas de venta"]
        V4["Notas crédito y débito"]
        V5["Punto de venta POS"]
    end

    subgraph Cartera["Cartera 📐"]
        C1["Cartera por edades"]
        C2["Recibos de caja"]
        C3["Estado de cuenta del cliente"]
        C4["Cupos y retenciones de crédito"]
        C5["Gestión de cobranza"]
    end

    subgraph Compras["Compras 📐"]
        P1["Órdenes de compra"]
        P2["Facturas de proveedor"]
        P3["Comprobantes de egreso"]
        P4["Devoluciones a proveedor"]
        P5["Certificados de retención"]
    end

    subgraph Inventario["Inventario 📐"]
        N1["Ítems"]
        N2["Existencias"]
        N3["Kardex"]
        N4["Ajustes y traslados"]
        N5["Lotes y vencimientos"]
        N6["Clasificación ABC y conteos"]
        N7["Reposición y punto de reorden"]
    end

    subgraph Contabilidad["Contabilidad ✅"]
        A1["Comprobantes"]
        A2["Borradores"]
        A3["Plan de cuentas"]
        A4["Libro diario"]
        A5["Libro mayor"]
        A6["Balance de prueba"]
        A7["Períodos"]
        A8["Cierre anual"]
    end

    subgraph Impuestos["Impuestos 📐"]
        T1["Tarifas y vigencias"]
        T2["Retenciones y UVT"]
    end

    subgraph FE["Factura electrónica 📐"]
        F1["Documentos y estado DIAN"]
        F2["Rangos de numeración"]
        F3["Cola de contingencia"]
    end

    subgraph Terceros["Terceros 📐"]
        R1["Clientes"]
        R2["Proveedores"]
    end

    subgraph Canal["Catálogo y vitrina 📐"]
        S1["Publicación del catálogo"]
        S2["Pedidos web"]
    end

    subgraph Integ["Integraciones 📐"]
        G1["Conectores"]
        G2["Migración de datos"]
        G3["Mapeos"]
        G4["Ejecuciones y errores"]
        G5["API Keys"]
        G6["Webhooks y entregas"]
    end

    subgraph Conf["Configuración 💡"]
        K1["Empresa"]
        K2["Usuarios y roles"]
        K3["Numeración de comprobantes"]
        K4["Parámetros"]
        K6["Cuentas por defecto"]
        K7["Plantillas y alertas"]
        K5["Bitácora de auditoría"]
    end

    Raiz --> Inicio
    Raiz --> Ventas
    Raiz --> Cartera
    Raiz --> Compras
    Raiz --> Inventario
    Raiz --> Contabilidad
    Raiz --> Impuestos
    Raiz --> FE
    Raiz --> Terceros
    Raiz --> Canal
    Raiz --> Integ
    Raiz --> Conf
```

## 3. Menú lateral (propuesta)

Orden de arriba hacia abajo. Los grupos se pueden contraer; el menú se puede reducir a íconos. El grupo
**Contabilidad** es el único con backend real hoy y debe maquetarse con el mayor detalle.

| Grupo | Pantalla | Ruta | Permiso (✅ = existe en el backend) | Estado | Spec |
|---|---|---|---|---|---|
| **Inicio** | Tablero | `/` | — | 💡 | — |
| **Ventas** | Cotizaciones | `/ventas/cotizaciones` | `sales.quote.read` 💡 | 📐 | 002 |
| | Pedidos | `/ventas/pedidos` | `sales.order.read` 💡 | 📐 | 002, 003 |
| | Facturas de venta | `/ventas/facturas` | `sales.invoice.read` 💡 | 📐 | 002, 009 |
| | Notas crédito y débito | `/ventas/notas` | `sales.note.read` 💡 | 📐 | 004 |
| | Punto de venta | `/ventas/pos` | `sales.pos.use` 💡 | 📐 | — (Q-06 abierta) |
| **Cartera** | Cartera por edades | `/cartera/edades` | `receivables.read` 💡 | 📐 | 003 |
| | Recibos de caja | `/cartera/recibos` | `receivables.receipt.read` 💡 | 📐 | 003 |
| | Estado de cuenta | `/cartera/clientes/:id/estado-de-cuenta` | `receivables.read` 💡 | 📐 | 003 |
| | Cupos y retenciones | `/cartera/credito` | `receivables.credit.read` 💡 | 📐 | 003 |
| **Compras** | Órdenes de compra | `/compras/ordenes` | `purchases.order.read` 💡 | 📐 | 005, 008 |
| | Facturas de proveedor | `/compras/facturas` | `purchases.invoice.read` 💡 | 📐 | 005 |
| | Comprobantes de egreso | `/compras/egresos` | `purchases.payment.read` 💡 | 📐 | 005 |
| | Devoluciones a proveedor | `/compras/devoluciones` | `purchases.return.read` 💡 | 📐 | 005 |
| **Inventario** | Ítems | `/inventario/items` | `catalog.item.read` 💡 | 📐 | 006 |
| | Existencias | `/inventario/existencias` | `inventory.read` 💡 | 📐 | 006 |
| | Kardex | `/inventario/kardex` | `inventory.read` 💡 | 📐 | 006 |
| | Ajustes y traslados | `/inventario/movimientos` | `inventory.adjust` 💡 | 📐 | 006 |
| | Clasificación ABC y conteos | `/inventario/abc` | `inventory.abc.read` 💡 | 📐 | 007 |
| | Reposición | `/inventario/reposicion` | `inventory.reorder.read` 💡 | 📐 | 008 |
| **Contabilidad** | Comprobantes | `/contabilidad/comprobantes` | `accounting.report.read` ✅ | ✅ | 001 |
| | Nuevo comprobante | `/contabilidad/comprobantes/nuevo` | `accounting.entry.post` ✅ | ✅ | 001 |
| | Borradores | `/contabilidad/borradores` | `accounting.entry.post` ✅ | ✅ | 001 |
| | Plan de cuentas | `/contabilidad/plan-de-cuentas` | `accounting.report.read` ✅ (solo lectura) | ✅ lectura · 💡 edición | 001 |
| | Libro diario | `/contabilidad/diario` | `accounting.report.read` ✅ | ✅ | 001 |
| | Libro mayor | `/contabilidad/mayor` | `accounting.report.read` ✅ | ✅ | 001 |
| | Balance de prueba | `/contabilidad/balance-de-prueba` | `accounting.report.read` ✅ | ✅ | 001 |
| | Períodos | `/contabilidad/periodos` | `accounting.report.read` ✅ · `accounting.period.close` ✅ · `accounting.period.reopen` ✅ · `accounting.period.manage` ✅ | ✅ | 001 |
| | Cierre anual | `/contabilidad/cierre-anual` | `accounting.year.close` ✅ | ✅ | 001 |
| **Impuestos** | Tarifas y vigencias | `/impuestos/tarifas` | `tax.read` 💡 | 📐 | 010 |
| | Retenciones y UVT | `/impuestos/retenciones` | `tax.read` 💡 | 📐 | 010 |
| **Factura electrónica** | Documentos y estado DIAN | `/fe/documentos` | `einvoice.read` 💡 | 📐 | 009 |
| | Rangos de numeración | `/fe/rangos` | `einvoice.range.manage` 💡 | 📐 | 009 |
| | Cola de contingencia | `/fe/contingencia` | `einvoice.read` 💡 | 📐 | 009 |
| **Terceros** | Clientes | `/terceros/clientes` | `parties.read` 💡 | 📐 | 003 |
| | Proveedores | `/terceros/proveedores` | `parties.read` 💡 | 📐 | 005 |
| **Catálogo y vitrina** | Publicación | `/canal/catalogo` | `catalog.publish` 💡 | 📐 | 002 |
| | Pedidos web | `/canal/pedidos` | `sales.order.read` 💡 | 📐 | 002 |
| **Integraciones** | Conectores | `/integraciones/conectores` | `integrations.manage` 💡 | 💡 | 014 (propuesta) |
| | Migración de datos | `/integraciones/migracion` | `integrations.migrate` 💡 | 💡 | 015 (propuesta) |
| | Mapeos | `/integraciones/migracion/:id/mapeos` | `integrations.migrate` 💡 | 💡 | 015 (propuesta) |
| | Ejecuciones y errores | `/integraciones/ejecuciones` | `integrations.read` 💡 | 💡 | 014/015 |
| | API Keys | `/integraciones/api-keys` | `integrations.manage` 💡 | 📐 | 011 |
| | Webhooks | `/integraciones/webhooks` | `integrations.manage` 💡 | 📐 | 011 |
| **Configuración** | Empresa · Usuarios y roles · Numeración · Parámetros · Cuentas por defecto · Plantillas y alertas · Bitácora | `/configuracion/…` | spec de IAM pendiente | 💡 | 012, 013 (propuesta) |

> Los permisos marcados 💡 son **nombres propuestos** para mantener un esquema `modulo.recurso.accion`; los marcados ✅
> existen hoy en el backend y están listados en
> [`contracts/ports.md`](../specs/001-contabilidad-comprobantes-inmutables/contracts/ports.md) §5.
> Un usuario **no ve** las entradas del menú para las que no tiene permiso de lectura.

## 4. Barra superior (siempre visible)

| Zona | Contenido | Comportamiento |
|---|---|---|
| Izquierda | Logo SIFCA y **nombre de la empresa** (NIT) | En el MVP un *tenant* es una empresa (S-01); si hubiese varias, aquí va el selector |
| Centro | Botón de búsqueda «Buscar o ejecutar…  `Ctrl K`» | Abre la paleta de comandos |
| Derecha | **Chip del período** («Oct 2026 · Abierto» / «Sep 2026 · Cerrado») | Clic abre Períodos; en rojo suave si el período de trabajo está cerrado |
| | Campana de **alertas** | Cupo al 80 % y 100 %, mora, rechazos DIAN, reposición requerida, conteos vencidos clase A (specs 003, 007, 008, 009) |
| | Menú de usuario | Idioma/formato, tema claro/oscuro/denso, cerrar sesión |

## 5. Paleta de comandos (`Ctrl/Cmd + K`)

Requisitos ya fijados en `01-arquitectura/01-vision-general-y-modulos.md` §8 (CP-01…CP-07).

| Prefijo | Qué busca | Ejemplos |
|---|---|---|
| (ninguno) | Pantallas, acciones y registros mezclados | «balance», «clientes», «FV-1» |
| `>` | Acciones | `> Nuevo comprobante`, `> Reversar este comprobante`, `> Cerrar período` |
| `@` | Terceros | `@Distribuidora` |
| `#` | Documentos por número | `#AJ-1`, `#FV-125` |
| `/` | Ayuda | `/atajos` |

Comportamientos que la maqueta debe mostrar: resultados agrupados por tipo con su ícono; el **atajo** de cada acción
a la derecha; sección «Recientes»; acciones **contextuales** (estando en un comprobante aparece «Reversar»; en una
factura, «Crear nota crédito»); búsqueda tolerante a tildes; solo muestra lo que el usuario puede hacer.

## 6. Atajos de teclado (💡 propuesta)

| Atajo | Acción | Dónde |
|---|---|---|
| `Ctrl/Cmd + K` | Paleta de comandos | Global |
| `G` luego `C` / `V` / `I` / `T` | Ir a Contabilidad / Ventas / Inventario / Terceros | Global (estilo «ir a») |
| `N` | Nuevo (documento del módulo actual) | Listas |
| `/` | Enfocar el filtro de la lista | Listas |
| `Ctrl/Cmd + S` | Guardar borrador | Editores |
| `Ctrl/Cmd + Enter` | Contabilizar / emitir (solo habilitado si es válido) | Editores |
| `Tab` / `Enter` / flechas | Moverse entre celdas de la grilla | Líneas de comprobante y factura |
| `Ctrl/Cmd + V` | Pegar varias filas desde una hoja de cálculo | Grilla de líneas |
| `Alt + ↑ / ↓` | Mover la fila | Grilla de líneas |
| `Insert` / `Ctrl+Backspace` | Insertar / quitar línea (solo en borradores) | Grilla de líneas |
| `Esc` | Cerrar diálogo o paleta | Global |
| `?` | Ver todos los atajos | Global |

## 7. Flujos de navegación clave

### 7.1 Contabilizar, corregir y cerrar el mes

```mermaid
flowchart TD
    A["Lista de comprobantes"] -->|"N o botón Nuevo"| B["Editor de comprobante"]
    B -->|"Guardar borrador"| D["Borradores"]
    D -->|"Abrir"| B
    B -->|"Contabilizar si cuadra"| C["Detalle del comprobante - Contabilizado"]
    B -->|"Rechazo 422 o 409"| B
    C -->|"Reversar con motivo"| E["Detalle de la reversión"]
    E -->|"Ver original"| C
    C -->|"Ver en mayor"| M["Libro mayor de la cuenta"]
    A --> P["Períodos"]
    P -->|"Cerrar mes"| X{"¿Hay causas de bloqueo?"}
    X -->|"Sí: borradores, balance"| P
    X -->|"No"| Q["Período cerrado y registrado en bitácora"]
    Q -->|"Reabrir con permiso y motivo"| P
```

### 7.2 Venta a crédito con cupo (📐 spec 002 y 003)

```mermaid
flowchart TD
    V["Nuevo pedido o factura"] --> W{"Cupo y mora"}
    W -->|"Dentro del cupo"| X["Emitir factura"]
    W -->|"Excede o en mora"| H["Retención de crédito CREDIT_HOLD"]
    H -->|"Liberar con permiso y motivo"| X
    H -->|"Cobrar y liberar"| R["Recibo de caja"]
    X --> Y["Estado ante la DIAN: enviada, aceptada o rechazada"]
    Y -->|"Aceptada"| Z["Entrega al cliente: PDF y correo"]
    Y -->|"Rechazada"| X2["Corregir y reenviar conservando el número"]
    Z -->|"Devolución"| N["Nota crédito y reingreso al kardex"]
```

### 7.3 Migrar desde otro sistema (💡 specs 014 y 015, fase F8)

```mermaid
flowchart TD
    A["Conectores"] -->|"Elegir Alegra o archivos"| B["Credenciales y Probar conexión"]
    B -->|"Asistente de migración"| C["Origen, fecha de corte y estrategia"]
    C --> D["Qué traer y Mapeos"]
    D --> E["Revisión de datos"]
    E --> F["Ensayo sin efectos"]
    F -->|"Hay problemas que Bloquean"| D
    F -->|"Sin bloqueos"| G["Ejecución con progreso"]
    G -->|"Errores"| H["Ejecuciones y errores - reintentar"]
    H --> G
    G --> I["Conciliación origen contra SIFCA"]
    I -->|"No cuadra"| D
    I -->|"Cuadra"| J["Cierre de la migración"]
    J -->|"Deshacer corrida"| K["Reversiones, nunca borrado"]
```

Detalle de cada pantalla (IN.1–IN.10) en [`06-integraciones-migracion-y-configuracion.md`](06-integraciones-migracion-y-configuracion.md).

## 8. Qué muestra cada tipo de documento en su cabecera

Convención visual común (se detalla en `04-sistema-de-diseno.md` §6): **título** (tipo y número, p. ej. `AJ-1`),
**etiquetas de estado**, **enlaces de trazabilidad** («Reversión de AJ-1», «Reversado por AJ-2», «Documento fuente
FV-125»), **fecha contable y período**, **autor y fecha de contabilización** y **acciones permitidas** según estado y
permiso.

## 9. Móvil y vitrina

| Superficie | Alcance de la primera maqueta | Navegación |
|---|---|---|
| Back-office responsivo (≥ 360 px) | Solo **consulta** y aprobaciones simples (cartera, alertas, balance) | Menú en cajón; paleta como pantalla completa |
| App Expo (F7) 📐 | Consulta de cartera, alertas y recibos de caja en calle 💡 | Pestañas inferiores: Inicio · Cartera · Alertas · Más |
| Vitrina pública (Next.js, F6) 📐 | Catálogo, ficha de producto, carrito y pedido | Cabecera con buscador y carrito; sin menú del back-office |
