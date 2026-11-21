-- =====================================================================
-- UniónDev · catálogo administrable desde el panel
-- Ejecutar en Supabase → SQL Editor después de 02-panel.sql, y luego 04-catalogo-inicial.sql.
--
-- Agrega a productos los campos de la ficha (nombre, descripción, fotos, versiones…),
-- la función crear_producto y el almacenamiento público de fotos (bucket "productos").
-- =====================================================================

alter table productos add column if not exists nombre            text not null default '';
alter table productos add column if not exists specs_corto       text not null default '';   -- línea corta bajo el nombre
alter table productos add column if not exists resumen           text not null default '';   -- frase de la ficha
alter table productos add column if not exists descripcion_larga text not null default '';
alter table productos add column if not exists puntos            jsonb not null default '[]'::jsonb;  -- [[título, texto], …]
alter table productos add column if not exists especificaciones  jsonb not null default '[]'::jsonb;  -- [[nombre, valor], …]
alter table productos add column if not exists galeria           jsonb not null default '[]'::jsonb;  -- [url, …] (la primera es la principal)
alter table productos add column if not exists versiones         jsonb not null default '[]'::jsonb;  -- [{t, color, ops:[[nombre, diferencia, hex, fotos, ir]]}]
alter table productos add column if not exists activo            boolean not null default true;       -- false = oculto en la tienda
alter table productos add column if not exists orden             integer not null default 0;
alter table productos add column if not exists creado            timestamptz not null default now();

-- Crea un producto nuevo; si trae existencia inicial, la registra como compra en el kardex.
create or replace function crear_producto(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_cod text := upper(trim(p->>'cod'));
  v_exist integer := coalesce((p->>'existencia')::int, 0);
  v_costo numeric(12,2) := coalesce((p->>'costo_unitario')::numeric, 0);
begin
  if v_cod !~ '^[A-Z]{3}-[0-9]{3}$' then raise exception 'CODIGO_INVALIDO'; end if;
  if exists (select 1 from productos where cod = v_cod) then raise exception 'CODIGO_EXISTE:%', v_cod; end if;
  if v_exist < 0 or v_costo < 0 then raise exception 'CANTIDAD_INVALIDA'; end if;
  insert into productos (cod, categoria, descripcion, marca, existencia, costo_unitario, precio_sin_iva, precio,
                         nombre, specs_corto, resumen, descripcion_larga, puntos, especificaciones, galeria, versiones, activo, orden)
  values (v_cod, p->>'categoria', coalesce(nullif(p->>'descripcion', ''), p->>'nombre'), p->>'marca', v_exist, v_costo,
          round((p->>'precio')::numeric / 1.13, 2), (p->>'precio')::numeric,
          p->>'nombre', coalesce(p->>'specs_corto', ''), coalesce(p->>'resumen', ''), coalesce(p->>'descripcion_larga', ''),
          coalesce(p->'puntos', '[]'::jsonb), coalesce(p->'especificaciones', '[]'::jsonb), coalesce(p->'galeria', '[]'::jsonb),
          coalesce(p->'versiones', '[]'::jsonb), coalesce((p->>'activo')::boolean, true),
          coalesce((select max(orden) + 1 from productos), 1));
  if v_exist > 0 then
    insert into kardex (cod, tipo, cantidad, costo_unitario, costo_total, existencia_resultante, referencia)
    values (v_cod, 'entrada', v_exist, v_costo, round(v_exist * v_costo, 2), v_exist, 'Inventario inicial del producto');
  end if;
  return jsonb_build_object('cod', v_cod);
end;
$$;
revoke all on function crear_producto(jsonb) from public, anon, authenticated;
grant execute on function crear_producto(jsonb) to service_role;

-- Fotos de productos: bucket público (cualquiera puede verlas; solo el servidor sube o borra).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('productos', 'productos', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
