# Tienda UniónDev

Tienda en línea de **UNIONDEV, S.A. de C.V.**, proyecto académico de Técnicas Contables.

La documentación completa del proyecto se escribirá al final, cuando estén terminadas todas las partes.

## Avance

### Hecho

- **Catálogo y tienda:** 28 productos con fotos, versiones por encargo, carrito y pago (PayPal Sandbox, tarjeta de prueba, efectivo y transferencia).
- **Factura de consumidor final:** en PDF para descargar, enviada por correo, con correlativo.
- **Base de datos (Supabase):** inventario con kardex a costo promedio, libro de ventas y vistas contables.
- **Panel de administración (`/admin`):** resumen, productos, promociones, inventario (compras y ajustes), ventas (anular) y libro de ventas.
- **Promociones:**
  - se crean en el panel (porcentaje o monto; por producto, por categoría o para toda la tienda; con fecha de inicio y fin);
  - en la tienda salen el precio tachado y la etiqueta de oferta;
  - la factura muestra el precio normal y el descuento por línea.
- **Portada:**
  - banner de ofertas a todo el ancho, estilo Uniqlo, que se llena con las promociones activas;
  - menú transparente sobre el banner;
  - el producto del banner sobre un pedestal blanco.
- **Tienda:**
  - más ancha;
  - tarjetas destacadas primeras en cada fila, en color vivo con degradado y con fotos que se turnan;
  - títulos de sección en un azul más profundo.

### Pendiente

1. Botón **"Descargar Excel actualizado"** en el panel: genera el libro con la misma estructura del Excel del proyecto, conserva las hojas manuales y actualiza las que dependen de la tienda.
2. Crear una promoción de prueba en el panel y comprobar que aparece en el sitio real: en el banner, con el precio tachado y en la factura.
3. Inicio de sesión para clientes (por decidir).
4. Documentación completa de este README.

## Scripts de base de datos

Se corren en orden en el **SQL Editor** de Supabase, con el traductor del navegador apagado:

1. `supabase/esquema.sql`
2. `supabase/datos-iniciales.sql`
3. `supabase/02-panel.sql`
4. `supabase/03-productos.sql`
5. `supabase/04-catalogo-inicial.sql`
6. `supabase/05-promociones.sql`

## Referencias de diseño (inspo)

Las referencias visuales se buscan con el servidor MCP de inspo: `https://inspomcp.dev/api/mcp`.

En las sesiones de Claude en la nube, para que aparezca en la lista de `/mcp`, se agrega como conector personalizado en claude.ai/customize/connectors con esa dirección, y luego se abre una sesión nueva.
