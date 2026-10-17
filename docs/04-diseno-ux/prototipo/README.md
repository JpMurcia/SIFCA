# Prototipo navegable

Las 141 vistas de las [maquetas](../maquetas/README.md) agrupadas en **80 pantallas** y enlazadas entre sí: el menú
lateral, los botones principales y la barra inferior de la app móvil llevan a la pantalla correspondiente. Incluye
cinco **flujos guiados** (venta a crédito, comprobante contable, migración, pedido desde la vitrina y cobro exprés),
cambio entre los temas Claro y Slate y avisos en los puntos donde falta una pantalla (brechas G-01…G-04 y m4 de la
[auditoría](../../roadmap-specs.md) §1.3).

**Abrirlo:** `index.html` en un navegador (funciona sin servidor). Teclas: `←` `→` pantalla anterior o siguiente (o paso
del flujo), `Z` mostrar zonas clicables, `T` cambiar de tema. Cada pantalla tiene enlace propio (`index.html#s-3a`).

Es un prototipo **de imágenes con zonas clicables**: los formularios no se llenan y los datos son los de las maquetas.

## Regenerarlo

Cuando cambien las maquetas, desde la raíz del repositorio y con Playwright disponible:

```bash
# 1. Capturas y textos de cada vista (las maquetas cargan React 18.3.1 desde unpkg; capture.cjs lo sirve desde
#    REACT_DIR si no hay salida a Internet: react.js y react-dom.js de los paquetes npm react@18.3.1 y react-dom@18.3.1)
PW=$(npm root -g)/playwright V=$REACT_DIR node docs/04-diseno-ux/prototipo/fuente/capture.cjs <carpeta-con-las-tandas> <salida>
# 2. Catálogo de pantallas, zonas clicables y flujos (editar las tablas S, SIDE, CONTENT y PER del script)
python3 docs/04-diseno-ux/prototipo/fuente/build_proto.py <salida>/frames.json <salida>/data.json
# 3. Insertar data.json en fuente/template.html (marcador __DATA__) y copiar <salida>/img/ junto a index.html
```

`capture.cjs` espera los archivos con su nombre original del ZIP de diseño (`SIFCA Tanda N.dc.html`).
