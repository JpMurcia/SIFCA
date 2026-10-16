/* SIFCA icon set + automatic action-icon decorator.
   <sf-icon name="VE"></sf-icon> renders an inline stroke icon (inherits currentColor; size via width/height).
   Buttons/links whose label starts with a known verb or module name get a leading icon automatically.
   Opt out with data-noico on the element. */
(function () {
  if (window.__sfIcons) return;
  const I = {
    home:'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z',
    receipt:'M6 2.5h12v19l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h4',
    wallet:'M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l12-4v4M16 13.5h2',
    cart:'M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 7H6M9 20h.01M17 20h.01',
    box:'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
    book:'M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5zM4 19.5A1.5 1.5 0 0 0 5.5 21H20M8 7h8M8 11h6',
    percent:'M19 5 5 19M7 4.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM17 14.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z',
    filecheck:'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 14.5l2 2 4-4',
    users:'M16 20v-1.5A3.5 3.5 0 0 0 12.5 15h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.2a3.5 3.5 0 0 1 0 6.6',
    store:'M4 10v10h16V10M3 4h18l-1 5H4zM4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M10 20v-5h4v5',
    plug:'M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5',
    sliders:'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
    search:'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
    plus:'M12 5v14M5 12h14', minus:'M5 12h14',
    check:'M5 12.5l4.5 4.5L19 7.5', x:'M6 6l12 12M18 6 6 18',
    bell:'M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15zM10 21h4',
    user:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
    grid:'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    logout:'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
    send:'M21 3 10 14M21 3l-7 18-4-7-7-4z',
    download:'M12 4v11M7 10l5 5 5-5M5 20h14', upload:'M12 15V4M7 9l5-5 5 5M5 20h14',
    refresh:'M20 12a8 8 0 1 1-2.34-5.66L20 8.5M20 3.5v5h-5',
    filter:'M4 5h16l-6 7v6l-4 2v-8z',
    edit:'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
    trash:'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    eye:'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    lock:'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4', unlock:'M6 11h12v10H6zM8 11V7a4 4 0 0 1 7.5-1.9',
    truck:'M3 6h11v10H3zM14 9h4l3 3v4h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    chat:'M4 20l1.3-3.9A8 8 0 1 1 8 19zM9 10h.01M12 10h.01M15 10h.01',
    calendar:'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
    file:'M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h4',
    print:'M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z',
    warn:'M12 3 2 20h20zM12 10v4M12 17h.01',
    info:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
    help:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01',
    pause:'M8 5v14M16 5v14', play:'M7 4v16l13-8z',
    copy:'M8 8h12v12H8zM16 8V4H4v12h4',
    link:'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
    mail:'M3 5h18v14H3zM3 6l9 7 9-7',
    phone:'M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2',
    pin:'M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    tag:'M3 12V3h9l9 9-9 9zM7.5 7.5h.01',
    clock:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
    shield:'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z',
    arrowR:'M5 12h14M13 6l6 6-6 6', arrowL:'M19 12H5M11 6l-6 6 6 6', chevR:'M9 6l6 6-6 6', chevD:'M6 9l6 6 6-6',
    save:'M5 3h11l3 3v15H5zM8 3v5h7V3M8 21v-7h8v7',
    history:'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
    undo:'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
    chart:'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3',
    cash:'M3 6h18v12H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 9h.01M18 15h.01',
    bank:'M3 10 12 4l9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18',
    zap:'M13 2 4 14h7l-1 8 9-12h-7z',
    moon:'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
    sun:'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
    wifioff:'M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 4-2.3M19 12.5a10 10 0 0 0-2.1-1.6M12 20h.01',
    list:'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    repeat:'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
    key:'M15 7.5a3.5 3.5 0 1 1-1 2.5L4 20v-3h3v-2h2l3.5-3.5',
    building:'M4 21V4h10v17M14 9h6v12M8 8h2M8 12h2M8 16h2M3 21h18',
    scale:'M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0zM8 21h8',
    table:'M3 4h18v16H3zM3 10h18M3 15h18M9 4v16',
    globe:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
    drop:'M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z',
    star:'M12 3l2.7 5.6 6.3.9-4.5 4.4 1 6.1-5.5-2.9-5.5 2.9 1-6.1L3 9.5l6.3-.9z',
    layers:'M12 3 2 8l10 5 10-5zM2 13l10 5 10-5',
    pen:'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'
  };
  const ALIAS = {IN:'home', VE:'receipt', CA:'wallet', CO:'cart', IV:'box', CT:'book', IM:'percent', FE:'filecheck', TE:'users', VI:'store', IG:'plug', CF:'sliders',
    PA:'file', AS:'drop', EM:'box', SE:'shield'};
  const get = n => I[ALIAS[n] || n] || null;
  window.__sfIcons = {I, ALIAS, get};

  const svg = (d, sw) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.8) + '" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%" aria-hidden="true"><path d="' + d + '"/></svg>';
  class SfIcon extends HTMLElement {
    static get observedAttributes() { return ['name', 'stroke']; }
    connectedCallback() { this.render(); }
    attributeChangedCallback() { this.render(); }
    render() {
      const d = get(this.getAttribute('name'));
      const r = this.shadowRoot || this.attachShadow({mode: 'open'});
      r.innerHTML = '<style>:host{display:inline-block;flex:none;width:1.15em;height:1.15em;line-height:0}svg{display:block;width:100%;height:100%}</style>' + (d ? svg(d, this.getAttribute('stroke')) : '');
    }
  }
  if (!customElements.get('sf-icon')) customElements.define('sf-icon', SfIcon);

  // label → icon (normalized, matched as whole leading words)
  const MAP = [
    ['cerrar sesion','logout'],['iniciar sesion','key'],['ingresar','key'],['volver a pedir','repeat'],['repetir pedido','repeat'],['mis pedidos','list'],
    ['factura electronica','filecheck'],['preguntar por whatsapp','chat'],['whatsapp','chat'],['ver pedido','cart'],['ver carrito','cart'],['ir al catalogo','store'],
    ['sin conexion','wifioff'],['marcar como leidas','check'],['marcar todo','check'],['ajustar a existencias','sliders'],['registrar pago','cash'],['recibo de caja','cash'],
    ['inicio','home'],['ventas','receipt'],['cartera','wallet'],['compras','cart'],['inventario','box'],['contabilidad','book'],['impuestos','percent'],['terceros','users'],
    ['catalogo','store'],['integraciones','plug'],['configuracion','sliders'],['alertas','bell'],['notificaciones','bell'],['mas','grid'],['perfil','user'],['cuenta','user'],
    ['papeleria','file'],['aseo','drop'],['empaque','box'],['seguridad','shield'],
    ['buscar','search'],['carrito','cart'],['agregar','plus'],['anadir','plus'],['nuevo','plus'],['nueva','plus'],['crear','plus'],
    ['guardar','save'],['enviar','send'],['reenviar','send'],['transmitir','send'],['confirmar','check'],['aprobar','check'],['aceptar','check'],['autorizar','check'],['marcar','check'],['listo','check'],['entendido','check'],
    ['cancelar','x'],['rechazar','x'],['anular','x'],['descartar','x'],['cerrar periodo','lock'],['cerrar ano','lock'],['cerrar','x'],['reabrir','unlock'],['bloquear','lock'],['desbloquear','unlock'],
    ['descargar','download'],['exportar','download'],['importar','upload'],['subir','upload'],['cargar','upload'],
    ['reintentar','refresh'],['sincronizar','refresh'],['actualizar','refresh'],['recalcular','refresh'],['reanudar','play'],['iniciar','play'],['ejecutar','play'],['correr','play'],['pausar','pause'],['detener','pause'],
    ['editar','edit'],['corregir','edit'],['modificar','edit'],['cambiar','edit'],['eliminar','trash'],['borrar','trash'],['quitar','trash'],
    ['ver','eye'],['mostrar','eye'],['ocultar','eye'],['vista previa','eye'],['previsualizar','eye'],['abrir','arrowR'],['ir a','arrowR'],['seguir','arrowR'],['continuar','arrowR'],['siguiente','arrowR'],
    ['volver','arrowL'],['atras','arrowL'],['anterior','arrowL'],['imprimir','print'],
    ['facturar','filecheck'],['emitir','filecheck'],['contabilizar','book'],['reversar','undo'],['deshacer','undo'],['restaurar','undo'],['ajustar','sliders'],['filtrar','filter'],['filtros','filter'],
    ['copiar','copy'],['duplicar','copy'],['conectar','plug'],['desconectar','plug'],['reconectar','plug'],['probar','zap'],['simular','zap'],['ensayar','zap'],['escribir','chat'],['llamar','phone'],['correo','mail'],
    ['historial','history'],['bitacora','history'],['conciliar','scale'],['pagar','cash'],['cobrar','cash'],['transferencia','bank'],['contraentrega','cash'],['credito','wallet'],
    ['domicilio','truck'],['despachar','truck'],['enviado','truck'],['marcar enviado','truck'],['entregar','check'],['entregado','check'],['recoger','store'],['reservar','lock'],
    ['publicar','globe'],['despublicar','eye'],['ayuda','help'],['seguimiento','truck'],['cliente','user'],['clientes','users'],['proveedor','building'],['proveedores','building'],
    ['periodos','calendar'],['periodo','calendar'],['cierre','lock'],['resumen','chart'],['reportes','chart'],['informes','chart'],['libro','book'],['balance','scale'],['comprobante','receipt'],['comprobantes','receipt'],
    ['tema','moon'],['slate','moon'],['oscuro','moon'],['claro','sun'],['plantilla','layers'],['plantillas','layers'],['usuarios','users'],['roles','shield'],['firmar','pen'],['adjuntar','link'],['compartir','link']
  ].sort((a, b) => b[0].length - a[0].length);
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const pick = label => { for (const [k, v] of MAP) if (label === k || label.startsWith(k + ' ')) return v; return null; };

  const enc = d => 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>') + '")';
  const css = ['[data-ico]::before{content:"";display:inline-block;flex:none;width:1.1em;height:1.1em;margin-right:.45em;vertical-align:-.2em;background:currentColor;-webkit-mask:var(--sfi) center/contain no-repeat;mask:var(--sfi) center/contain no-repeat}',
    '[data-ico-gap]::before{margin-right:0}', '[data-ico-pos=top]::before{width:22px;height:22px;margin:0 0 1px 0}']
    .concat(Object.keys(I).map(k => '[data-ico="' + k + '"]{--sfi:' + enc(I[k]) + '}')).join('\n');
  const st = document.createElement('style'); st.id = 'sf-icons-css'; st.textContent = css; document.head.appendChild(st);

  const SEL = 'button, a[href], [role="tab"]';
  function decorate(el) {
    if (el.hasAttribute('data-noico') || el.closest('[data-noico]') || el.classList.contains('dv-oid') || el.classList.contains('dv-tid')) return;
    if (el.getAttribute('role') === 'switch') return;
    const label = norm(el.textContent);
    if (el.dataset.icoL === label) return;
    el.dataset.icoL = label;
    const first = el.firstElementChild, firstNode = el.firstChild;
    const hasLead = el.querySelector('sf-icon, svg, img') || (firstNode && firstNode.nodeType === 1 && !norm(firstNode.textContent));
    const ic = label.length >= 2 && !hasLead ? pick(label) : null;
    if (!ic) { el.removeAttribute('data-ico'); return; }
    el.setAttribute('data-ico', ic);
    const cs = getComputedStyle(el);
    if (cs.display.includes('flex') && cs.flexDirection.startsWith('column')) el.setAttribute('data-ico-pos', 'top'); else el.removeAttribute('data-ico-pos');
    if ((cs.display.includes('flex') || cs.display.includes('grid')) && parseFloat(cs.columnGap) > 0) el.setAttribute('data-ico-gap', ''); else el.removeAttribute('data-ico-gap');
  }
  let q = false;
  const scan = () => { q = false; document.querySelectorAll(SEL).forEach(decorate); };
  const sched = () => { if (!q) { q = true; requestAnimationFrame(scan); } };
  const start = () => { scan(); new MutationObserver(sched).observe(document.body, {subtree: true, childList: true, characterData: true}); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
