/* UniónDev · catálogo compartido (navegador y servidor).
   Los precios, existencias y costos salen del archivo UNIONDEV_Archivo_Completo (hoja Inventario). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UDDatos = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  /* ---------- catálogo (del Excel: código, categoría, marca, nombre, características, existencia, precio sin IVA, precio con IVA) ---------- */
  var P = [
    ['LAP-001','Laptops','HP','Laptop HP 15','Ryzen 5 · 8 GB RAM · 512 GB SSD · Windows 11 Home',3,565.49,639],
    ['LAP-002','Laptops','HP','Laptop HP Victus 15','Gaming · Ryzen 7 · 8 GB RAM · 512 GB SSD',1,875.22,989],
    ['LAP-003','Laptops','Lenovo','Laptop Lenovo Core i3','Core i3 · 8 GB RAM · 512 GB SSD · Windows 11',4,530.09,599],
    ['LAP-004','Laptops','Lenovo','Laptop Lenovo Ryzen 5','Ryzen 5 · 16 GB RAM · 512 GB SSD · Windows 11 Home',1,751.33,849],
    ['LAP-005','Laptops','Acer','Laptop Acer Aspire Core i7','Core i7 · 16 GB RAM · 512 GB SSD · Windows 11',1,805.31,910],
    ['LAP-006','Laptops','Acer','Laptop Acer Nitro V 15','Gaming · Core i5 · 16 GB RAM · RTX 6 GB',1,973.45,1100],
    ['TAB-001','Tablets','Samsung','Galaxy Tab A9+','Tablet Samsung · Wi-Fi',2,255.75,289],
    ['MON-001','Monitores','Xiaomi','Monitor Xiaomi A24i','24 pulgadas · Full HD',3,101.77,115],
    ['MON-002','Monitores','Xiaomi','Monitor Xiaomi A27i','27 pulgadas · Full HD',2,128.32,145],
    ['TEC-001','Teclados','Logitech','Teclado Logitech K120','USB · Distribución en español',8,14.07,15.90],
    ['TEC-002','Teclados','Logitech','Combo teclado y mouse Logitech','Inalámbrico',3,61.94,69.99],
    ['TEC-003','Teclados','Logitech','Teclado mecánico Logitech G413 SE','Gaming · USB',2,79.56,89.90],
    ['TEC-004','Teclados','Razer','Razer BlackWidow V3 TKL','Gaming · Mecánico · Sin teclado numérico',1,88.41,99.90],
    ['MOU-001','Mouse','Logitech','Mouse inalámbrico Logitech M185','Inalámbrico · USB',8,21.24,24],
    ['MOU-002','Mouse','Logitech','Logitech G203 Lightsync','Gaming · Luz RGB',5,26.46,29.90],
    ['MOU-003','Mouse','Logitech','Logitech G502 Hero','Gaming · Alta precisión',2,57.43,64.90],
    ['AUD-001','Audio y video','JBL','Audífonos JBL Quantum 100M2','Gaming · Con micrófono',3,35.39,39.99],
    ['AUD-002','Audio y video','Razer','Cámara web Razer Kiyo X','USB · Full HD',1,84.07,95],
    ['IMP-001','Impresoras','Epson','Epson EcoTank L3250','Multifuncional · Wi-Fi · Tanque de tinta',2,182.18,205.86],
    ['IMP-002','Impresoras','Canon','Canon G1110','Impresora de tanque de tinta',1,140.71,159],
    ['ALM-001','Almacenamiento','Kingston','SSD Kingston NV3 1 TB','M.2 NVMe',2,199.15,225.04],
    ['ALM-002','Almacenamiento','ADATA','Disco externo ADATA HD650 1 TB','USB 3.2',2,87.61,99],
    ['ALM-003','Almacenamiento','Kingston','USB Kingston DataTraveler 64 GB','Memoria USB',15,8.76,9.90],
    ['COM-001','Componentes','Kingston','RAM Kingston Fury Beast 8 GB','DDR4 · 3200 MHz',2,116.86,132.05],
    ['RED-001','Redes','TP-Link','Router TP-Link Archer AX53','Wi-Fi 6 · AX3000',1,79.56,89.90],
    ['RED-002','Redes','TP-Link','Router TP-Link Archer C50','AC1200 · Doble banda',3,30.88,34.90],
    ['ENE-001','Energía','Forza','UPS Forza NT-751','750 VA · 6 salidas',3,49.47,55.90],
    ['ENE-002','Energía','Centra','UPS Centra Plus 1000VA','Pantalla LCD · 8 salidas',2,60.18,68]
  ].map(function (r) { return { cod: r[0], cat: r[1], marca: r[2], nombre: r[3], sp: r[4], stock: r[5], sin: r[6], precio: r[7], gaming: /Gaming/.test(r[4]) }; });

  /* ---------- fichas: descripción, puntos clave, especificaciones, galería y versiones ----------
     La primera opción de cada grupo es la que hay en inventario. Las demás son versiones por encargo con su diferencia de precio (IVA incluido). */
  function g(cod, ids) { return ids.map(function (i) { return '/img/g/' + cod + '-' + i + '.webp'; }); }
  var ALM = 'Almacenamiento', RAM = 'Memoria RAM';
  var D = {
    'LAP-001': { res: 'Una laptop rápida y ligera para estudiar, trabajar y ver series.', gal: g('LAP-001', [1, 2, 3, 4]),
      desc: 'La HP 15 combina un procesador AMD Ryzen 5 con disco de estado sólido de 512 GB, así que enciende en segundos y abre tus programas sin esperas. Su pantalla de 15.6 pulgadas Full HD es cómoda para trabajar con varias ventanas, y trae Windows 11 Home listo para usar.',
      puntos: [['Rendimiento diario', 'Ryzen 5 7520U de 4 núcleos para clases en línea, ofimática y navegación.'], ['Arranque rápido', 'SSD de 512 GB: el sistema y tus archivos abren en segundos.'], ['Pantalla amplia', '15.6" Full HD con bordes delgados para ver más en menos espacio.']],
      specs: [['Procesador', 'AMD Ryzen 5 7520U'], ['Memoria', '8 GB LPDDR5'], ['Almacenamiento', 'SSD de 512 GB'], ['Pantalla', '15.6" Full HD (1920 × 1080)'], ['Gráficos', 'AMD Radeon integrados'], ['Sistema operativo', 'Windows 11 Home'], ['Conectividad', 'Wi-Fi 6 y Bluetooth']],
      vars: [{ t: ALM, ops: [['512 GB SSD', 0], ['1 TB SSD', 70]] }, { t: RAM, ops: [['8 GB', 0], ['16 GB', 60]] }] },
    'LAP-002': { res: 'Potencia para jugar y crear, con gráficos dedicados NVIDIA.', gal: g('LAP-002', [1, 2, 3, 4]),
      desc: 'La HP Victus 15 está hecha para jugar: procesador AMD Ryzen 7 con tarjeta gráfica NVIDIA GeForce RTX 3050 y pantalla Full HD de 144 Hz para movimientos fluidos. También rinde en edición de video y diseño, con un sistema de enfriamiento pensado para sesiones largas.',
      puntos: [['Gráficos dedicados', 'NVIDIA GeForce RTX 3050 para juegos actuales y edición.'], ['Pantalla de 144 Hz', 'Imagen más fluida en juegos rápidos.'], ['Ryzen 7', 'Ocho núcleos para jugar, transmitir y trabajar a la vez.']],
      specs: [['Procesador', 'AMD Ryzen 7 7445HS'], ['Gráficos', 'NVIDIA GeForce RTX 3050'], ['Memoria', '8 GB DDR5'], ['Almacenamiento', 'SSD de 512 GB'], ['Pantalla', '15.6" Full HD, 144 Hz'], ['Sistema operativo', 'Windows 11 Home']],
      vars: [{ t: ALM, ops: [['512 GB SSD', 0], ['1 TB SSD', 80]] }, { t: RAM, ops: [['8 GB', 0], ['16 GB', 70]] }] },
    'LAP-003': { res: 'La opción más accesible para estudiar y trabajar todos los días.', gal: g('LAP-003', [1, 2, 3, 4, 5]),
      desc: 'La Lenovo IdeaPad Slim 3 es delgada, liviana y confiable. Su procesador Intel Core i3 y su SSD de 512 GB cubren tareas de oficina, clases y entretenimiento, y su teclado cómodo y pantalla Full HD de 15.6 pulgadas la hacen ideal para jornadas largas.',
      puntos: [['Delgada y liviana', 'Fácil de llevar a clases o a la oficina.'], ['Intel Core i3', 'Suficiente para ofimática, navegación y videollamadas.'], ['Wi-Fi 6', 'Conexión más estable y rápida a internet.']],
      specs: [['Procesador', 'Intel Core i3-1315U'], ['Memoria', '8 GB LPDDR5'], ['Almacenamiento', 'SSD de 512 GB'], ['Pantalla', '15.6" Full HD'], ['Conectividad', 'Wi-Fi 6 y Bluetooth'], ['Sistema operativo', 'Windows 11']],
      vars: [{ t: 'Color', color: true, ops: [['Azul', 0, '#9fb7cf', null], ['Gris', 0, '#a7abb1', g('LAP-004', [1, 2, 3, 4, 5])]] }, { t: ALM, ops: [['512 GB SSD', 0], ['1 TB SSD', 70]] }] },
    'LAP-004': { res: '16 GB de memoria para trabajar con muchas pestañas y programas.', gal: g('LAP-004', [1, 2, 3, 4, 5]),
      desc: 'Esta IdeaPad Slim 3 lleva un procesador AMD Ryzen 5 con 16 GB de memoria, el doble de lo habitual en su rango de precio. Es ideal si trabajas con muchas pestañas abiertas, hojas de cálculo grandes o programas de diseño básico.',
      puntos: [['16 GB de memoria', 'Más programas abiertos al mismo tiempo sin que se ponga lenta.'], ['Ryzen 5', 'Rendimiento equilibrado con buena duración de batería.'], ['Diseño delgado', 'Cuerpo liviano con acabado gris.']],
      specs: [['Procesador', 'AMD Ryzen 5 7520U'], ['Memoria', '16 GB LPDDR5'], ['Almacenamiento', 'SSD de 512 GB'], ['Pantalla', '15.6" Full HD'], ['Gráficos', 'AMD Radeon 610M'], ['Sistema operativo', 'Windows 11 Home']],
      vars: [{ t: 'Color', color: true, ops: [['Gris', 0, '#a7abb1', null], ['Azul', 0, '#9fb7cf', g('LAP-003', [1, 2, 3, 4, 5])]] }, { t: ALM, ops: [['512 GB SSD', 0], ['1 TB SSD', 70]] }] },
    'LAP-005': { res: 'Core i7 y 16 GB para quien necesita más potencia en su trabajo.', gal: g('LAP-005', [1, 2, 3, 4, 5]),
      desc: 'La Acer Aspire con procesador Intel Core i7 y 16 GB de memoria está pensada para profesionales y estudiantes exigentes: hojas de cálculo pesadas, programación, edición de fotos y multitarea intensa. Su cuerpo metálico le da una sensación sólida.',
      puntos: [['Intel Core i7', 'Para programas exigentes y multitarea intensa.'], ['16 GB de memoria', 'Trabaja con muchas aplicaciones a la vez.'], ['Pantalla Full HD', '15.6 pulgadas con buena nitidez para trabajar.']],
      specs: [['Procesador', 'Intel Core i7'], ['Memoria', '16 GB'], ['Almacenamiento', 'SSD de 512 GB'], ['Pantalla', '15.6" Full HD'], ['Sistema operativo', 'Windows 11']],
      vars: [{ t: ALM, ops: [['512 GB SSD', 0], ['1 TB SSD', 70]] }, { t: RAM, ops: [['16 GB', 0], ['32 GB', 110]] }] },
    'LAP-006': { res: 'Nuestra laptop gaming más potente, con RTX de 6 GB.', gal: g('LAP-006', [1, 2, 3, 4, 5]),
      desc: 'La Acer Nitro V 15 está lista para jugar títulos actuales con buena calidad: procesador Intel Core i5 de alto rendimiento, tarjeta NVIDIA GeForce RTX de 6 GB y 16 GB de memoria. Su pantalla Full HD de alta frecuencia y su teclado retroiluminado completan la experiencia.',
      puntos: [['RTX de 6 GB', 'Gráficos NVIDIA para jugar y renderizar.'], ['16 GB de memoria', 'Juegos y programas abiertos sin trabas.'], ['Teclado retroiluminado', 'Para jugar o trabajar de noche.']],
      specs: [['Procesador', 'Intel Core i5 serie H'], ['Gráficos', 'NVIDIA GeForce RTX 4050, 6 GB'], ['Memoria', '16 GB'], ['Almacenamiento', 'SSD de 512 GB'], ['Pantalla', '15.6" Full HD, 144 Hz'], ['Sistema operativo', 'Windows 11']],
      vars: [{ t: ALM, ops: [['512 GB SSD', 0], ['1 TB SSD', 80]] }, { t: RAM, ops: [['16 GB', 0], ['32 GB', 110]] }] },
    'TAB-001': { res: 'Pantalla de 11" para ver, leer y estudiar donde quieras.', gal: g('TAB-001', [1, 2, 3, 4, 5]),
      desc: 'La Galaxy Tab A9+ tiene una pantalla de 11 pulgadas con 90 Hz que hace todo más fluido, cuatro bocinas para películas y videollamadas, y un cuerpo metálico delgado. Perfecta para clases, lectura y entretenimiento en familia.',
      puntos: [['Pantalla de 11"', 'Amplia y fluida a 90 Hz.'], ['Sonido envolvente', 'Cuatro bocinas con Dolby Atmos.'], ['Para toda la familia', 'Modo niños y control parental de Samsung.']],
      specs: [['Pantalla', '11", 90 Hz'], ['Procesador', 'Qualcomm Snapdragon'], ['Memoria', '4 GB'], ['Almacenamiento', '64 GB, ampliable con microSD'], ['Conectividad', 'Wi-Fi'], ['Sistema operativo', 'Android']],
      vars: [{ t: 'Color', color: true, ops: [['Grafito', 0, '#4b4e55', null], ['Plata', 0, '#d9d9db', g('TAB-001', ['plata-1'])]] }, { t: ALM, ops: [['64 GB', 0], ['128 GB', 40]] }] },
    'MON-001': { res: 'Monitor IPS de 24" para trabajar o jugar con colores fieles.', gal: ['/img/MON-001.webp'],
      desc: 'El Xiaomi A24i tiene un panel IPS de 23.8 pulgadas con resolución Full HD y 100 Hz, que se ve bien desde cualquier ángulo. Sus bordes delgados lo hacen ideal para escritorios con dos pantallas, y conecta por HDMI o DisplayPort.',
      puntos: [['Panel IPS', 'Colores consistentes desde cualquier ángulo.'], ['100 Hz', 'Movimiento más suave que un monitor común de 60 Hz.'], ['Bordes delgados', 'Ideal para usar dos monitores lado a lado.']],
      specs: [['Tamaño', '23.8"'], ['Resolución', '1920 × 1080 (Full HD)'], ['Panel', 'IPS'], ['Frecuencia', '100 Hz'], ['Conexiones', 'HDMI y DisplayPort 1.4']],
      vars: [{ t: 'Tamaño', ops: [['24 pulgadas', 0], ['27 pulgadas', null, null, null, 'MON-002']] }] },
    'MON-002': { res: 'Más pantalla para ver tus documentos y juegos en grande.', gal: ['/img/MON-002.webp'],
      desc: 'El Xiaomi A27i ofrece 27 pulgadas con panel IPS Full HD a 100 Hz. Su tamaño facilita trabajar con dos documentos lado a lado o disfrutar películas y juegos con más inmersión.',
      puntos: [['27 pulgadas', 'Espacio de sobra para trabajar con dos ventanas.'], ['Panel IPS', 'Buen color y amplio ángulo de visión.'], ['100 Hz', 'Imagen fluida al jugar o desplazarte.']],
      specs: [['Tamaño', '27"'], ['Resolución', '1920 × 1080 (Full HD)'], ['Panel', 'IPS'], ['Frecuencia', '100 Hz'], ['Conexiones', 'HDMI y DisplayPort']],
      vars: [{ t: 'Tamaño', ops: [['27 pulgadas', 0], ['24 pulgadas', null, null, null, 'MON-001']] }] },
    'TEC-001': { res: 'El teclado de siempre: cómodo, silencioso y resistente.', gal: g('TEC-001', [1, 2, 3]),
      desc: 'El Logitech K120 es un teclado de tamaño completo con teclas silenciosas de perfil bajo, distribución en español y conexión USB: lo conectas y funciona. Resiste derrames accidentales, así que es ideal para casa, oficina o centros de estudio.',
      puntos: [['Conectar y usar', 'USB sin instalar programas.'], ['Resiste derrames', 'Diseñado para soportar líquidos derramados.'], ['Teclas silenciosas', 'Escribe sin molestar a los demás.']],
      specs: [['Conexión', 'USB con cable'], ['Distribución', 'Español'], ['Tipo', 'Tamaño completo con teclado numérico'], ['Compatibilidad', 'Windows, Linux y ChromeOS']] },
    'TEC-002': { res: 'Teclado y mouse inalámbricos con un solo receptor USB.', gal: g('TEC-002', [1, 2, 3, 4]),
      desc: 'El combo Logitech MK235 trae teclado y mouse inalámbricos que funcionan con un solo receptor USB. Libera tu escritorio de cables, y olvídate de las baterías: el teclado dura hasta 36 meses y el mouse hasta 12.',
      puntos: [['Sin cables', 'Conexión inalámbrica de 2.4 GHz.'], ['Baterías de larga duración', 'Hasta 36 meses el teclado y 12 el mouse.'], ['Un solo receptor', 'Ocupa un único puerto USB.']],
      specs: [['Conexión', 'Inalámbrica 2.4 GHz, receptor USB'], ['Batería teclado', 'Hasta 36 meses'], ['Batería mouse', 'Hasta 12 meses'], ['Incluye', 'Teclado, mouse y receptor USB']] },
    'TEC-003': { res: 'Teclas mecánicas táctiles y cubierta de aluminio.', gal: g('TEC-003', [1, 2, 3, 4]),
      desc: 'El Logitech G413 SE es un teclado mecánico de tamaño completo con interruptores táctiles, retroiluminación blanca y una cubierta superior de aluminio. Cada pulsación se siente precisa, tanto para jugar como para escribir durante horas.',
      puntos: [['Switches mecánicos', 'Respuesta táctil y duradera.'], ['Aluminio', 'Cubierta superior metálica resistente.'], ['Anti-ghosting', 'Reconoce varias teclas a la vez al jugar.']],
      specs: [['Tipo', 'Mecánico, tamaño completo'], ['Interruptores', 'Táctiles'], ['Iluminación', 'LED blanca'], ['Conexión', 'USB con cable'], ['Rollover', '6 teclas con anti-ghosting']] },
    'TEC-004': { res: 'Mecánico, compacto y con iluminación Razer Chroma RGB.', gal: ['/img/TEC-004.webp'],
      desc: 'El Razer BlackWidow V3 Tenkeyless quita el teclado numérico para darte más espacio para mover el mouse. Sus interruptores mecánicos Razer y su iluminación Chroma RGB personalizable lo convierten en un favorito de los jugadores.',
      puntos: [['Formato compacto', 'Sin teclado numérico: más espacio para el mouse.'], ['Switches Razer', 'Mecánicos, con 80 millones de pulsaciones de vida útil.'], ['Chroma RGB', 'Iluminación personalizable por tecla.']],
      specs: [['Tipo', 'Mecánico, sin teclado numérico (TKL)'], ['Iluminación', 'Razer Chroma RGB'], ['Conexión', 'USB con cable'], ['Vida útil', '80 millones de pulsaciones']],
      vars: [{ t: 'Interruptores', ops: [['Verde · táctil y audible', 0], ['Amarillo · lineal y silencioso', 0]] }] },
    'MOU-001': { res: 'Pequeño, inalámbrico y con un año de batería.', gal: g('MOU-001', [1, 2, 3, 4]),
      desc: 'El Logitech M185 es un mouse inalámbrico compacto, ideal para llevar con tu laptop. Su receptor nano USB se guarda dentro del mouse y su batería dura hasta 12 meses.',
      puntos: [['Inalámbrico', 'Receptor nano USB que se guarda dentro del mouse.'], ['12 meses de batería', 'Con una sola pila AA.'], ['Compacto', 'Cabe en cualquier mochila o estuche.']],
      specs: [['Conexión', 'Inalámbrica 2.4 GHz'], ['Batería', '1 pila AA, hasta 12 meses'], ['Compatibilidad', 'Windows, macOS, ChromeOS y Linux']] },
    'MOU-002': { res: 'Mouse gaming con luz RGB y precisión para competir.', gal: g('MOU-002', ['negro', 2]),
      desc: 'El Logitech G203 Lightsync tiene un sensor de hasta 8,000 DPI, seis botones programables y una franja de luz RGB que puedes personalizar. Su forma simétrica clásica se adapta a cualquier agarre.',
      puntos: [['Sensor preciso', 'Hasta 8,000 DPI ajustables.'], ['6 botones', 'Programables con el software de Logitech G.'], ['Luz RGB', 'Personaliza colores y efectos.']],
      specs: [['Sensor', 'Hasta 8,000 DPI'], ['Botones', '6 programables'], ['Iluminación', 'LIGHTSYNC RGB'], ['Conexión', 'USB con cable']],
      vars: [{ t: 'Color', color: true, ops: [['Negro', 0, '#1d1f24', null], ['Azul', 0, '#2f7fe0', g('MOU-002', ['azul', 2])], ['Lila', 0, '#c9b8f0', g('MOU-002', ['lila'])]] }] },
    'MOU-003': { res: 'El mouse gaming más vendido del mundo, con pesos ajustables.', gal: g('MOU-003', [1, 2, 3, 4]),
      desc: 'El Logitech G502 Hero tiene un sensor HERO de hasta 25,600 DPI, 11 botones programables y cinco pesas de 3.6 g para ajustar el balance a tu gusto. Precisión y control para juegos competitivos.',
      puntos: [['Sensor HERO 25K', 'De 100 a 25,600 DPI.'], ['11 botones', 'Asigna comandos y macros.'], ['Pesas ajustables', 'Cinco pesas de 3.6 g incluidas.']],
      specs: [['Sensor', 'HERO, 100 – 25,600 DPI'], ['Botones', '11 programables'], ['Peso', '121 g (sin pesas)'], ['Iluminación', 'LIGHTSYNC RGB'], ['Conexión', 'USB con cable']] },
    'AUD-001': { res: 'Audífonos gaming livianos con micrófono desmontable.', gal: g('AUD-001', [1, 2, 3, 4, 5]),
      desc: 'Los JBL Quantum 100M2 tienen sonido JBL Quantum para escuchar cada paso en tus juegos, almohadillas cómodas para sesiones largas y un micrófono desmontable. Se conectan con cable de 3.5 mm a PC, consola o celular.',
      puntos: [['Sonido JBL Quantum', 'Escucha con claridad efectos y voces.'], ['Micrófono desmontable', 'Quítalo cuando solo quieres escuchar.'], ['Livianos', 'Cómodos durante horas.']],
      specs: [['Conexión', 'Cable de 3.5 mm'], ['Micrófono', 'Desmontable'], ['Compatibilidad', 'PC, consolas y celulares']],
      vars: [{ t: 'Color', color: true, ops: [['Negro', 0, '#1d1f24', null], ['Blanco', 0, '#f2f2f2', g('AUD-001', ['blanco-1'])]] }] },
    'AUD-002': { res: 'Cámara Full HD para clases, reuniones y transmisiones.', gal: ['/img/AUD-002.webp'],
      desc: 'La Razer Kiyo X graba en Full HD con enfoque automático, para que te veas nítido en clases, reuniones o transmisiones. Se monta fácilmente sobre tu monitor o laptop y se conecta por USB.',
      puntos: [['Full HD', '1080p a 30 fps o 720p a 60 fps.'], ['Enfoque automático', 'Siempre nítido aunque te muevas.'], ['Conectar y usar', 'USB, sin instalar nada.']],
      specs: [['Resolución', '1080p a 30 fps · 720p a 60 fps'], ['Enfoque', 'Automático'], ['Conexión', 'USB'], ['Montaje', 'Clip para monitor o laptop']] },
    'IMP-001': { res: 'Imprime, escanea y copia por Wi-Fi con tinta de bajo costo.', gal: g('IMP-001', [1, 2, 3, 4, 5]),
      desc: 'La Epson EcoTank L3250 imprime, escanea y copia, y se conecta por Wi-Fi para imprimir desde tu celular. Su sistema de tanques recargables reduce mucho el costo por página frente a los cartuchos.',
      puntos: [['3 en 1', 'Imprime, escanea y copia.'], ['Wi-Fi', 'Imprime desde tu celular o laptop.'], ['Tanques recargables', 'Tinta de bajo costo por página.']],
      specs: [['Funciones', 'Impresión, escaneo y copia'], ['Conexión', 'Wi-Fi y USB'], ['Resolución', 'Hasta 5760 × 1440 dpi'], ['Sistema de tinta', 'Tanques recargables EcoTank'], ['Tamaño de papel', 'Hasta A4 / carta']] },
    'IMP-002': { res: 'Impresora de tanque sencilla y económica para casa.', gal: g('IMP-002', [1, 2]),
      desc: 'La Canon PIXMA G1110 es una impresora de tanques de tinta recargables, ideal para tareas escolares y documentos del hogar. Imprime muchas páginas a bajo costo y se conecta por USB.',
      puntos: [['Bajo costo por página', 'Tanques de tinta recargables.'], ['Fácil de usar', 'Conexión USB directa.'], ['Compacta', 'Cabe en cualquier escritorio.']],
      specs: [['Funciones', 'Impresión'], ['Conexión', 'USB'], ['Resolución', 'Hasta 4800 × 1200 dpi'], ['Sistema de tinta', 'Tanques recargables']] },
    'ALM-001': { res: 'Hasta 6,000 MB/s: tu computadora arrancará en segundos.', gal: g('ALM-001', [1, 2, 3]),
      desc: 'El Kingston NV3 es un SSD M.2 NVMe PCIe 4.0 que alcanza hasta 6,000 MB/s de lectura. Es la mejora más notable que puedes hacerle a una computadora: el sistema, los juegos y los programas cargan muchísimo más rápido.',
      puntos: [['PCIe 4.0 NVMe', 'Hasta 6,000 MB/s de lectura y 4,000 MB/s de escritura.'], ['Formato M.2 2280', 'Compatible con la mayoría de laptops y PC modernas.'], ['5 años de garantía', 'Respaldo de Kingston.']],
      specs: [['Interfaz', 'PCIe 4.0 x4 NVMe'], ['Formato', 'M.2 2280'], ['Lectura', 'Hasta 6,000 MB/s'], ['Escritura', 'Hasta 4,000 MB/s'], ['Garantía', '5 años']],
      vars: [{ t: 'Capacidad', ops: [['1 TB', 0], ['500 GB', -70], ['2 TB', 150]] }] },
    'ALM-002': { res: 'Respalda tus fotos y documentos en un disco resistente.', gal: g('ALM-002', [1, 2, 3, 4, 5]),
      desc: 'El ADATA HD650 es un disco duro externo de 1 TB con carcasa resistente a golpes y conexión USB 3.2 para copiar archivos rápido. Ideal para respaldar fotos, trabajos y documentos importantes.',
      puntos: [['1 TB de espacio', 'Miles de fotos, documentos y videos.'], ['Resistente', 'Carcasa con protección contra golpes.'], ['USB 3.2', 'Copias rápidas y compatibilidad amplia.']],
      specs: [['Capacidad', '1 TB'], ['Conexión', 'USB 3.2 Gen 1'], ['Formato', '2.5", portátil'], ['Alimentación', 'Por el mismo cable USB']],
      vars: [{ t: 'Color', color: true, ops: [['Negro', 0, '#1d1f24', null], ['Rojo', 0, '#d9302c', g('ALM-002', ['rojo-1'])], ['Azul', 0, '#2f7fe0', g('ALM-002', ['azul-1'])]] }, { t: 'Capacidad', ops: [['1 TB', 0], ['2 TB', 45]] }] },
    'ALM-003': { res: 'Memoria USB práctica con tapa y llavero de color.', gal: g('ALM-003', [1, 2, 3, 4, 5]),
      desc: 'La Kingston DataTraveler Exodia es una memoria USB 3.2 con tapa protectora y un aro para llavero cuyo color indica la capacidad. Lleva tus archivos a todas partes.',
      puntos: [['USB 3.2', 'Transfiere archivos rápidamente.'], ['Tapa protectora', 'Protege el conector.'], ['Color por capacidad', 'Identifica cada memoria de un vistazo.']],
      specs: [['Capacidad', '64 GB'], ['Conexión', 'USB 3.2 Gen 1'], ['Peso', '11 g'], ['Garantía', '5 años']],
      vars: [{ t: 'Capacidad', ops: [['64 GB', 0], ['128 GB', 6, null, g('ALM-003', ['128-1'])], ['256 GB', 18, null, g('ALM-003', ['256-1'])]] }] },
    'COM-001': { res: 'Más memoria para que tu PC vaya más fluida.', gal: g('COM-001', [1, 2, 3, 4, 5]),
      desc: 'La Kingston FURY Beast DDR4 de 3200 MHz es una mejora sencilla para PC de escritorio: más memoria significa más programas abiertos y juegos más estables. Su disipador de perfil bajo se ve bien en cualquier equipo.',
      puntos: [['DDR4 a 3200 MHz', 'Velocidad adecuada para juegos y trabajo.'], ['Overclock automático', 'Compatible con Intel XMP y AMD Ryzen.'], ['Garantía de por vida', 'Respaldo de Kingston.']],
      specs: [['Tipo', 'DDR4 DIMM (PC de escritorio)'], ['Velocidad', '3200 MHz'], ['Latencia', 'CL16'], ['Garantía', 'De por vida']],
      vars: [{ t: 'Capacidad', ops: [['8 GB', 0], ['16 GB', 60]] }] },
    'RED-001': { res: 'Wi-Fi 6 para toda la casa, con cuatro antenas.', gal: g('RED-001', [1, 2, 3, 5]),
      desc: 'El TP-Link Archer AX53 usa Wi-Fi 6 (AX3000) para dar internet más rápido y estable a más dispositivos a la vez. Sus cuatro antenas amplían la cobertura y sus puertos Gigabit aprovechan al máximo tu plan de internet.',
      puntos: [['Wi-Fi 6 AX3000', 'Más velocidad con muchos dispositivos conectados.'], ['4 antenas', 'Mejor cobertura en toda la casa.'], ['Puertos Gigabit', '1 WAN y 4 LAN para conexiones por cable.']],
      specs: [['Estándar', 'Wi-Fi 6 (802.11ax), AX3000'], ['Bandas', '2.4 GHz y 5 GHz'], ['Puertos', '1 WAN + 4 LAN Gigabit'], ['Seguridad', 'WPA3']],
      vars: [{ t: 'Modelo', ops: [['Archer AX53 · Wi-Fi 6', 0], ['Archer C50 · Wi-Fi 5', null, null, null, 'RED-002']] }] },
    'RED-002': { res: 'Router doble banda económico para casa u oficina pequeña.', gal: g('RED-002', [1, 2]),
      desc: 'El TP-Link Archer C50 ofrece Wi-Fi doble banda AC1200: usa 5 GHz para videos y videollamadas y 2.4 GHz para mayor alcance. Una opción económica y confiable para hogares y oficinas pequeñas.',
      puntos: [['Doble banda', '2.4 GHz y 5 GHz.'], ['AC1200', 'Hasta 1200 Mbps combinados.'], ['Fácil de instalar', 'Configuración desde la app Tether.']],
      specs: [['Estándar', 'Wi-Fi 5 (802.11ac), AC1200'], ['Bandas', '2.4 GHz (300 Mbps) y 5 GHz (867 Mbps)'], ['Puertos', '1 WAN + 4 LAN 10/100']],
      vars: [{ t: 'Modelo', ops: [['Archer C50 · Wi-Fi 5', 0], ['Archer AX53 · Wi-Fi 6', null, null, null, 'RED-001']] }] },
    'ENE-001': { res: 'Protege tu computadora de apagones y variaciones de voltaje.', gal: g('ENE-001', [1, 2, 3]),
      desc: 'El UPS Forza NT-751 te da tiempo para guardar tu trabajo y apagar tu equipo cuando se va la luz. Su regulador de voltaje protege tu computadora de subidas y bajadas de tensión, comunes en tormentas.',
      puntos: [['750 VA / 375 W', 'Para una computadora con su monitor.'], ['6 tomas', 'Conecta tu equipo y periféricos.'], ['Regulación de voltaje', 'Protege contra variaciones eléctricas.']],
      specs: [['Capacidad', '750 VA / 375 W'], ['Tomas', '6 NEMA 5-15R'], ['Batería', '12 V / 7 Ah'], ['Protección', 'Regulación de voltaje y línea RJ11']],
      vars: [{ t: 'Capacidad', ops: [['750 VA', 0], ['1000 VA', null, null, null, 'ENE-002']] }] },
    'ENE-002': { res: 'Más respaldo y pantalla LCD para ver el estado de la batería.', gal: [],
      desc: 'El UPS Centra Plus de 1000 VA ofrece más capacidad para equipos con monitor grande o varios dispositivos. Su pantalla LCD muestra el nivel de batería y la carga conectada.',
      puntos: [['1000 VA', 'Más tiempo de respaldo.'], ['8 tomas', 'Para tu computadora, monitor, módem y más.'], ['Pantalla LCD', 'Estado de batería y carga a la vista.']],
      specs: [['Capacidad', '1000 VA'], ['Tomas', '8'], ['Pantalla', 'LCD']],
      vars: [{ t: 'Capacidad', ops: [['1000 VA', 0], ['750 VA', null, null, null, 'ENE-001']] }] }
  };

  /* Relacionados por categoría: qué combina con lo que el cliente está viendo. */
  var COMBINA = {
    'Laptops': ['Mouse', 'Almacenamiento', 'Audio y video', 'Energía'],
    'Tablets': ['Audio y video', 'Almacenamiento', 'Teclados'],
    'Monitores': ['Teclados', 'Mouse', 'Energía', 'Audio y video'],
    'Teclados': ['Mouse', 'Monitores', 'Audio y video'],
    'Mouse': ['Teclados', 'Audio y video', 'Monitores'],
    'Audio y video': ['Mouse', 'Teclados', 'Monitores'],
    'Impresoras': ['Energía', 'Redes', 'Almacenamiento'],
    'Almacenamiento': ['Componentes', 'Laptops', 'Almacenamiento'],
    'Componentes': ['Almacenamiento', 'Energía', 'Monitores'],
    'Redes': ['Energía', 'Laptops', 'Impresoras'],
    'Energía': ['Monitores', 'Redes', 'Impresoras']
  };

  var ESTANTES = {
    laptops: { cats: ['Laptops', 'Tablets'], promo: { pos: 0, cls: 'p-gaming', sub: 'Zona gaming', t: 'Juega en serio.', p: 'Laptops con RTX, teclados mecánicos y mouse de alta precisión.', ir: 'escritorio', foto: 'LAP-006' } },
    escritorio: { cats: ['Monitores', 'Teclados', 'Mouse', 'Audio y video'], promo: { pos: 0, cls: 'p-escritorio', sub: 'Escritorio completo', t: 'Monitor, teclado y mouse desde $154.90.', p: 'Monitor Xiaomi de 24", teclado K120 y mouse M185, todo con IVA incluido.', foto: 'MON-001' } },
    conecta: { cats: ['Impresoras', 'Almacenamiento', 'Componentes', 'Redes', 'Energía'], promo: { pos: 0, cls: 'p-energia', sub: 'Protege tu equipo', t: 'Cortes de luz sin sustos.', p: 'Un UPS mantiene encendida tu computadora para que guardes tu trabajo.', ver: 'ENE-001', foto: 'ENE-001' } }
  };
  var RAZONES = [
    ['El precio que ves es el que pagas', 'Todos los precios incluyen el IVA del 13 %. No hay cargos extra al pagar.', '<path d="M4 7h16v10H4z"/><path d="M8 12h.01M16 12h.01"/><circle cx="12" cy="12" r="2.2"/>', '#1f4fd8'],
    ['Factura electrónica en tu correo', 'Cada compra genera su factura de consumidor final y te llega al momento.', '<path d="M6 3h9l3 3v15H6z"/><path d="M9 9h6M9 13h6M9 17h3"/>', '#d9531a'],
    ['Garantía de fábrica', 'Marcas como HP, Lenovo, Acer, Logitech, Epson y Kingston, con su garantía oficial.', '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="m9 12 2 2 4-4"/>', '#17803d'],
    ['Recoge o recibe en casa', 'Pasa por la tienda en San Salvador o pide entrega a domicilio.', '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/>', '#7b3cff'],
    ['Te asesoramos', 'Nuestros vendedores técnicos te ayudan a elegir según tu uso y presupuesto.', '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M9 10.5h6M9 13.5h4"/>', '#0f7d71']
  ];
  var CATS = [['Laptops', 'laptops'], ['Tablets', 'laptops'], ['Monitores', 'escritorio'], ['Teclados', 'escritorio'], ['Mouse', 'escritorio'], ['Audio y video', 'escritorio'], ['Impresoras', 'conecta'], ['Almacenamiento', 'conecta'], ['Componentes', 'conecta'], ['Redes', 'conecta'], ['Energía', 'conecta']];


  function r2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

  /* Arma el catálogo (productos P y fichas D) con sus ayudantes de precio y versiones. */
  function crear(P, D, PROMOS) {
    PROMOS = PROMOS || [];
    function by(c) { for (var i = 0; i < P.length; i++) if (P[i].cod === c) return P[i]; return null; }
    function grupos(p) { return (D[p.cod] && D[p.cod].vars) || []; }
    function opcion(gr, i) { var o = gr.ops[i]; return { n: o[0], d: o[1] || 0, hex: o[2], gal: o[3], ir: o[4] }; }
    function esBase(sel) { return sel.every(function (i) { return i === 0; }); }
    /* Selección válida: un índice por grupo, sin opciones que llevan a otro producto. */
    function selValida(p, sel) {
      var gs = grupos(p);
      if (!Array.isArray(sel) || sel.length !== gs.length) return false;
      return sel.every(function (i, k) { return Number.isInteger(i) && i >= 0 && i < gs[k].ops.length && !opcion(gs[k], i).ir; });
    }
    /* Promoción vigente con mayor descuento para el producto (o null). */
    function promoDe(p, ahora) {
      var t = ahora || Date.now(), mejor = null, mejorV = 0;
      PROMOS.forEach(function (pr) {
        if (pr.activa === false || new Date(pr.inicio).getTime() > t || new Date(pr.fin).getTime() <= t) return;
        if (pr.alcance === 'producto' && pr.objetivo !== p.cod) return;
        if (pr.alcance === 'categoria' && pr.objetivo !== p.cat) return;
        var v = pr.tipo === 'porcentaje' ? p.precio * pr.valor / 100 : Math.min(Number(pr.valor), p.precio);
        if (v > mejorV) { mejor = pr; mejorV = v; }
      });
      return mejor;
    }
    /* Precio de una versión (con IVA): normal, descuento y final. El descuento se aplica al precio de la versión. */
    function precioDe(p, sel, ahora) {
      var extra = 0; grupos(p).forEach(function (gr, k) { extra += opcion(gr, sel[k] || 0).d; });
      var normal = r2(p.precio + extra), pr = promoDe(p, ahora), desc = 0;
      if (pr) desc = r2(pr.tipo === 'porcentaje' ? normal * pr.valor / 100 : Math.min(Number(pr.valor), normal - 0.01));
      var tot = r2(normal - desc);
      var sin = desc ? r2(tot / 1.13) : r2(p.sin + extra / 1.13);
      return { tot: tot, sin: sin, iva: r2(tot - sin), normal: normal, desc: desc,
        promo: pr ? { id: pr.id, nombre: pr.nombre, tipo: pr.tipo, valor: Number(pr.valor), fin: pr.fin } : null };
    }
    function nombreVar(p, sel) {
      var gs = grupos(p); if (!gs.length) return '';
      return gs.map(function (gr, k) { return opcion(gr, sel[k] || 0).n; }).join(' · ');
    }
    return { P: P, D: D, COMBINA: COMBINA, ESTANTES: ESTANTES, RAZONES: RAZONES, CATS: CATS, ALM: ALM, RAM: RAM,
      r2: r2, by: by, promoDe: promoDe, PROMOS: PROMOS, grupos: grupos, opcion: opcion, esBase: esBase, selValida: selValida, precioDe: precioDe, nombreVar: nombreVar,
      desdeFilas: desdeFilas };
  }

  /* Catálogo a partir de las filas de la tabla productos (Supabase). */
  function desdeFilas(filas, promos) {
    var P2 = [], D2 = {};
    filas.forEach(function (f) {
      P2.push({ cod: f.cod, cat: f.categoria, marca: f.marca, nombre: f.nombre || f.descripcion, sp: f.specs_corto || '', stock: f.existencia,
        sin: Number(f.precio_sin_iva), precio: Number(f.precio), gaming: /gaming/i.test((f.specs_corto || '') + ' ' + f.descripcion),
        foto: (f.galeria && f.galeria[0]) || '', activo: f.activo !== false });
      D2[f.cod] = { res: f.resumen || '', desc: f.descripcion_larga || '', puntos: f.puntos || [], specs: f.especificaciones || [],
        gal: f.galeria || [], vars: f.versiones || [] };
    });
    return crear(P2, D2, promos || []);
  }

  /* Catálogo de respaldo (el del archivo), usado cuando no hay base de datos. */
  P.forEach(function (p) { p.foto = p.cod === 'ENE-002' ? '' : '/img/' + p.cod + '.webp'; p.activo = true; });
  return crear(P, D);
});
