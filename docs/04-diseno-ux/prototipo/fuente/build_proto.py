import json, sys
src, out = sys.argv[1], sys.argv[2]
F = {f['id']: f for f in json.load(open(src))}

# (claro, slate, título, módulo, plataforma)
S = [
 ('2a','2b','Inicio de sesión','Acceso','web'),
 ('4a','4b','Tablero por rol','Inicio','web'), ('4c',None,'Tablero · 1024 px','Inicio','web'),
 ('1c','1d','Lista de comprobantes','Contabilidad','web'), ('1e','1f','Lista · 1024 px y paleta Ctrl+K','Contabilidad','web'),
 ('5a','5b','Comprobantes y borradores','Contabilidad','web'), ('3a','3b','Editor de comprobante','Contabilidad','web'),
 ('3c','3d','Detalle y reversión','Contabilidad','web'), ('3e','3f','Libros diario y mayor','Contabilidad','web'),
 ('3g','3h','Balance de prueba','Contabilidad','web'), ('3i','3j','Períodos y cierre de mes','Contabilidad','web'),
 ('5e','5f','Cierre anual','Contabilidad','web'), ('5c','5d','Plan de cuentas','Contabilidad','web'),
 ('7a','7b','Cotizaciones y pedidos','Ventas','web'), ('7ad',None,'Cotizaciones · 1024 px','Ventas','web'),
 ('2c','2d','Factura de venta','Ventas','web'), ('4m','4n','Notas crédito y débito','Ventas','web'), ('4o',None,'Notas · 1024 px','Ventas','web'),
 ('3k','3l','Cartera por edades','Cartera','web'), ('7c','7d','Estado de cuenta','Cartera','web'),
 ('7e','7f','Órdenes de compra y devoluciones','Compras','web'), ('4d','4e','Factura de proveedor','Compras','web'), ('4f',None,'Factura de proveedor · 1024 px','Compras','web'),
 ('4g','4h','Comprobante de egreso','Compras','web'), ('4i',None,'Egreso · 1024 px','Compras','web'),
 ('2e','2f','Existencias, ABC y kardex','Inventario','web'), ('7g','7h','Maestro de ítems','Inventario','web'),
 ('7i','7j','Ajustes y traslados','Inventario','web'), ('7k','7l','Conteo físico','Inventario','web'), ('7ae',None,'Conteo en tableta · 1024 px','Inventario','web'),
 ('7m','7n','Reposición','Inventario','web'),
 ('3m','3n','Tarifas y factura electrónica DIAN','Impuestos y FE','web'), ('7o','7p','Retenciones y UVT','Impuestos y FE','web'),
 ('7q','7r','Rangos de numeración','Impuestos y FE','web'), ('7s','7t','Cola de contingencia','Impuestos y FE','web'),
 ('4j','4k','Ficha de tercero','Terceros','web'), ('4l',None,'Ficha de tercero · 1024 px','Terceros','web'),
 ('6g','6h','Publicación en la vitrina','Catálogo y vitrina','web'), ('6i','6j','Pedidos web','Catálogo y vitrina','web'),
 ('2g','2h','Conectores y Alegra','Integraciones','web'), ('2i','2j','Asistente de migración','Integraciones','web'),
 ('7y','7z','Cierre de la migración','Integraciones','web'), ('5g','5h','Ejecuciones y errores','Integraciones','web'),
 ('5m','5n','Sincronización continua','Integraciones','web'), ('5i','5j','API Keys','Integraciones','web'), ('5k','5l','Webhooks','Integraciones','web'),
 ('3q','3r','Empresa y multiempresa','Configuración','web'), ('5o','5p','Parámetros por empresa','Configuración','web'),
 ('7u','7v','Usuarios y roles','Configuración','web'), ('7w','7x','Plantillas PDF','Configuración','web'), ('3o','3p','Bitácora de auditoría','Configuración','web'),
 ('5q','5r','Errores tipificados y estados','Estados globales','web'), ('7af','7ag','Sin permiso (403)','Estados globales','web'),
 ('7ah','7ai','Cargando con esqueleto','Estados globales','web'), ('7aj',None,'Lista vacía','Estados globales','web'),
 ('6u','6v','Ingreso a la app','App móvil','movil'), ('2k','2o','Acceso','App móvil','movil'), ('6k','6o','Inicio','App móvil','movil'),
 ('6l','6p','Cartera','App móvil','movil'), ('6m','6q','Alertas','App móvil','movil'), ('6n','6r','Más','App móvil','movil'),
 ('1g','1h','POS · catálogo y pedido','App móvil','movil'), ('2l','2p','POS · cobro','App móvil','movil'),
 ('3s','3v','Cobro · cliente y cupo','App móvil','movil'), ('3t','3w','Cobro · registrar abono','App móvil','movil'), ('3u','3x','Cobro · recibo emitido','App móvil','movil'),
 ('6a',None,'Tienda · escritorio','Vitrina pública','vitrina'), ('6b',None,'Tienda · 1024 px con pedido','Vitrina pública','vitrina'),
 ('6c',None,'Inicio y catálogo','Vitrina pública','vitrina'), ('2m','2q','Catálogo','Vitrina pública','vitrina'),
 ('6s',None,'Buscador','Vitrina pública','vitrina'), ('6t',None,'Resultados de búsqueda','Vitrina pública','vitrina'),
 ('6d',None,'Ficha de producto','Vitrina pública','vitrina'), ('2n','2r','Carrito y pedido por WhatsApp','Vitrina pública','vitrina'),
 ('6e',None,'Datos de entrega y pago','Vitrina pública','vitrina'), ('6f',None,'Seguimiento del pedido','Vitrina pública','vitrina'),
 ('1a','1b','Tokens y componentes','Sistema de diseño','sistema'),
 ('7aa',None,'Densidad compacta','Sistema de diseño','sistema'), ('7ab',None,'Densidad normal','Sistema de diseño','sistema'), ('7ac',None,'Densidad cómoda','Sistema de diseño','sistema'),
]
frame2screen = {}
for c,s,*_ in S:
    frame2screen[c]=c
    if s: frame2screen[s]=c
assert set(frame2screen)==set(F), set(F)-set(frame2screen)

GAPS = {
 'G-01': ('Retención de crédito y liberación con motivo', 'No hay maqueta de /cartera/credito: lista de documentos retenidos por cupo o mora y la acción «Liberar» con motivo obligatorio (R-CAR-012).'),
 'G-02': ('Factura emitida y su contabilización', 'No hay maqueta del detalle de factura emitida: estado ante la DIAN, panel «Contabilización» con los comprobantes FV y de costo, y enlace al kardex.'),
 'G-03': ('Recibo de caja web', 'No hay maqueta de /cartera/recibos/nuevo: aplicación a facturas, retenciones sufridas y anticipos (R-CAR-003, R-CAR-004). En móvil existe el abono simple.'),
 'G-04': ('Estados financieros NIIF', 'No hay maqueta del estado de situación financiera ni del estado de resultados (spec 019).'),
 'm4':   ('Recuperar contraseña', 'El enlace existe en el ingreso pero no hay pantalla de recuperación (spec 012).'),
}
SIDE = {'Inicio':'4a','Ventas':'7a','Cotizaciones':'7a','Pedidos':'7a','Facturas de venta':'2c','Facturas':'2c','Notas crédito y débito':'4m',
 'Punto de venta':'1g','Cartera':'3k','Cartera por edades':'3k','Recibos de caja':'gap:G-03','Estado de cuenta':'7c','Cupos y retenciones':'gap:G-01','Cupos y bloqueos':'gap:G-01',
 'Compras':'7e','Órdenes de compra':'7e','Órdenes':'7e','Facturas de proveedor':'4d','Comprobantes de egreso':'4g','Cuentas por pagar':'4g','Devoluciones':'7e',
 'Inventario':'2e','Ítems':'7g','Existencias':'2e','Kardex':'2e','Ajustes y traslados':'7i','ABC y conteos':'7k','Reposición':'7m',
 'Contabilidad':'5a','Comprobantes':'5a','Nuevo comprobante':'3a','Borradores':'5a','Libro diario':'3e','Libro mayor':'3e','Balance de prueba':'3g','Períodos':'3i','Cierre anual':'5e','Plan de cuentas':'5c',
 'Impuestos':'3m','Tarifas y vigencias':'3m','Retenciones y UVT':'7o','Retenciones':'7o','Factura electrónica':'7q','Documentos y estado DIAN':'3m','Rangos de numeración':'7q','Cola de contingencia':'7s',
 'Terceros':'4j','Clientes':'4j','Proveedores':'4j','Todos los terceros':'4j','Catálogo y vitrina':'6g','Publicación':'6g','Pedidos web':'6i',
 'Integraciones':'2g','Conectores':'2g','Migración de datos':'2i','Mapeos':'2i','Ejecuciones y errores':'5g','API Keys':'5i','Webhooks y entregas':'5k','Sincronización':'5m',
 'Configuración':'5o','Empresa':'3q','Empresa y multiempresa':'3q','Usuarios y roles':'7u','Numeración':'5o','Parámetros':'5o','Cuentas por defecto':'5o','Plantillas':'7w','Bitácora':'3o','Auditoría':'3o','Preferencias':'7ab'}
# botones y textos de contenido (coincidencia exacta o, en botones, por prefijo)
CONTENT = {'Buscar o ejecutar…':'1e','Nuevo comprobante':'3a','Ver borradores':'5a','Guardar borrador':'5a','Contabilizar':'3c',
 'Cierre anual…':'5e','Registrar recibo':'gap:G-03','Cerrar venta':'gap:G-02','Validar cupo':'gap:G-01','Convertir en pedido':'2c',
 'FV Factura de venta':'2c','CE Comprobante de egreso':'4g','FC Factura de proveedor':'4d','NC Nota crédito / débito':'4m','TE Nuevo tercero':'4j','BG Balance de prueba':'3g',
 'Nueva migración':'2i','9 Cierre':'7y','Cerrar migración':'7y','Crear órdenes de compra':'7e','Ver kardex':'2e','Generar ajuste':'7i',
 'Volver al inicio':'4a','Ver documentos y estado DIAN':'3m','Ir a Períodos':'3i','Ver AJ-3':'3c','Ver AJ-4':'3c','Nueva factura':'2c',
 'Emitir factura electrónica':'2l','¿La olvidaste?':'gap:m4','¿Olvidaste tu contraseña?':'gap:m4','Ajuste o traslado':'7i','Ver bitácora':'3o',
 'Configuración › Cuentas por defecto':'5o','Emitir nota':'4m'}
PER = {  # por pantalla (id claro)
 '2a': {'Ingresar':'4a'}, '2k': {'Ingresar':'6k'}, '6u': {'Ingresar':'6k'},
 '1g': {'3 ítems · 34 und':'2l','Emitir factura electrónica':'2l'}, '2l': {'‹':'1g','Confirmar pago y emitir':'6k'},
 '3s': {'Registrar abono':'3t','‹':'6l'}, '3t': {'Registrar recibo $':'3u','‹':'3s'}, '3u': {'Registrar abono':'3s','‹':'3t'},
 '6k': {'Cobrar':'3s','Nueva venta':'1g','Recibo':'3u','1 1 pedido web por confirmar':'6i','◌ 1 borrador bloquea':'3i','↓ Cinta de embalar':'7m'},
 '6l': {}, '6m': {'Ver cartera':'6l','Pedidos web':'6i','Ver pedido':'6i','Ver factura':'gap:G-02','DIAN':'7s','Inventario':'7m','Crédito':'gap:G-01'},
 '6n': {'Cerrar sesión':'6u'},
 '2m': {'Ver carrito':'2n'}, '2n': {'‹':'2m','Enviar pedido por WhatsApp':'6f'},
 '6c': {'Ver pedido ·':'6e','¿Qué estás buscando?':'6s','Mis pedidos':'6f'}, '6s': {'Ver pedido ·':'6e','resma':'6t','detergente':'6t'}, '6t': {'Ver pedido ·':'6e'},
 '6d': {'Agregar · $':'6e'}, '6e': {'Enviar pedido':'6f'}, '6f': {},
 '6a': {'Carrito 3':'6b','Ver todo el catálogo':'6c','Ver catálogo':'6c','Mis pedidos':'6f','Inicio':'6a'}, '6b': {'Enviar pedido':'6f','Inicio':'6a','Catálogo':'6a','Mis pedidos':'6f'},
 '6i': {'Confirmar y reservar':'gap:G-02'}, '7c': {}, '3k': {},
 '2i': {'8 Conciliación':'2j'}, '2j': {}, '3c': {}, '7a': {'Pedidos 3':'7a'},
}
TAB = {'Inicio':'6k','Cartera':'6l','Más':'6n','Alertas 7':'6m'}
VITRINA_NAV_FRAMES = {'6a','6b','2m','2q','6c','6s','6t','6d','6e','6f','2n','2r'}
APP_TAB_FRAMES = {'6k','6l','6m','6n','6o','6p','6q','6r'}

def match(table, t, btn):
    if t in table: return table[t]
    if btn:
        for k,v in table.items():
            if t.startswith(k): return v
    return None

frames = {}
for fid, f in F.items():
    scr = frame2screen[fid]; hs = []
    per = PER.get(scr, {})
    for t in f['texts']:
        tgt = None; rect = (t['x'], t['y'], t['w'], t['h'])
        txt = t['t']
        tgt = match(per, txt, True)
        if tgt is None and f['w'] == 1440 and scr not in VITRINA_NAV_FRAMES and t['x'] < 240 and t['y'] > 60:
            tgt = SIDE.get(txt)
            if tgt: rect = (8, t['y'] - 7, 224, t['h'] + 14)
        if tgt is None and fid in APP_TAB_FRAMES and t['y'] > f['h'] - 110:
            tgt = TAB.get(txt)
        if tgt is None and scr not in VITRINA_NAV_FRAMES and fid not in APP_TAB_FRAMES:
            tgt = match(CONTENT, txt, t['btn'])
        if not tgt or tgt == scr: continue
        x,y,w,h = rect
        if not t['btn'] and rect[2] == t['w']:  # agrandar textos sueltos para que sean cómodos de pulsar
            x, y, w, h = x - 6, y - 5, w + 12, h + 10
        if y + h > f['h'] or x + w > f['w'] or y < 0: continue
        def inside(a, b):  # a dentro de b (con holgura)
            return a[0] >= b['x']-4 and a[1] >= b['y']-4 and a[0]+a[2] <= b['x']+b['w']+4 and a[1]+a[3] <= b['y']+b['h']+4
        if any(o['to']==tgt and (inside((x,y,w,h),o) or inside((o['x'],o['y'],o['w'],o['h']),{'x':x,'y':y,'w':w,'h':h})) for o in hs): continue
        hs.append({'x':max(0,x),'y':max(0,y),'w':w,'h':h,'to':tgt,'label':txt})
    frames[fid] = {'w':f['w'],'h':f['h'],'label':f['label'].replace('\n',' '),'hs':hs}

FLOWS = [
 {'id':'venta','name':'Venta a crédito','steps':['7a','2c','gap:G-01','gap:G-02','2e','3c']},
 {'id':'comprobante','name':'Comprobante contable','steps':['5a','3a','3c','5q','3i','5e']},
 {'id':'migracion','name':'Migración desde Alegra','steps':['2g','2i','5g','7y']},
 {'id':'vitrina','name':'Pedido desde la vitrina','steps':['6c','6d','2n','6e','6f','6i']},
 {'id':'cobro','name':'Cobro exprés en la calle','steps':['6u','6k','3s','3t','3u']},
]
data = {'screens':[{'id':c,'slate':s,'title':t,'module':m,'platform':p} for c,s,t,m,p in S],
        'frames':frames,'gaps':{k:{'title':a,'text':b} for k,(a,b) in GAPS.items()},'flows':FLOWS}
json.dump(data, open(out,'w'), ensure_ascii=False, separators=(',',':'))
n = sum(len(v['hs']) for v in frames.values())
print(len(S),'pantallas,',n,'zonas clicables')
dead = [k for k,v in frames.items() if not v['hs']]
print('sin zonas:', dead)
