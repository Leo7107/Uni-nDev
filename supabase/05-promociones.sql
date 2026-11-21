-- =====================================================================
-- UniónDev · promociones y descuentos
-- Ejecutar en Supabase → SQL Editor después de 04-catalogo-inicial.sql.
--
--   promociones      descuento en % o en $ por producto, categoría o toda la tienda, con vigencia
--   factura_detalle  guarda el precio normal, el descuento y la promoción aplicada en cada línea
-- =====================================================================

create table if not exists promociones (
  id        bigint generated always as identity primary key,
  nombre    text not null,
  tipo      text not null check (tipo in ('porcentaje', 'monto')),
  valor     numeric(12,2) not null check (valor > 0),
  alcance   text not null check (alcance in ('producto', 'categoria', 'todo')),
  objetivo  text not null default '',          -- código de producto o nombre de categoría
  inicio    timestamptz not null default now(),
  fin       timestamptz not null,
  activa    boolean not null default true,
  creada    timestamptz not null default now(),
  check (fin > inicio),
  check (tipo <> 'porcentaje' or valor < 100)
);
comment on table promociones is 'Descuentos vigentes en la tienda. Si varias aplican a un producto, se usa la de mayor descuento.';
alter table promociones enable row level security;
revoke all on promociones from anon, authenticated;
grant select, insert, update on promociones to service_role;
grant usage, select on sequence promociones_id_seq to service_role;

alter table factura_detalle add column if not exists precio_normal numeric(12,2);
alter table factura_detalle add column if not exists descuento     numeric(12,2) not null default 0;   -- total de la línea, con IVA
alter table factura_detalle add column if not exists promocion     text not null default '';

-- emitir_factura: igual que antes, ahora guarda también precio normal, descuento y promoción de cada línea.
create or replace function emitir_factura(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_corr      bigint;
  v_control   text;
  v_id        bigint;
  v_costo     numeric(12,2) := 0;
  it          jsonb;
  n           integer := 0;
  prod        productos%rowtype;
  c_unit      numeric(12,2);
  existencias jsonb := '{}'::jsonb;
begin
  -- 1) Bloquea en orden los productos con existencia que se van a vender (evita ventas dobles de la última unidad).
  for it in select value from jsonb_array_elements(p->'items') order by value->>'cod' loop
    if (it->>'cod') <> 'SERV-ENV' and not coalesce((it->>'encargo')::boolean, false) then
      select * into prod from productos where cod = it->>'cod' for update;
      if not found then raise exception 'PRODUCTO_NO_EXISTE:%', it->>'cod'; end if;
      if prod.existencia < (it->>'q')::int then
        raise exception 'SIN_EXISTENCIA:%:%', prod.cod, prod.existencia;
      end if;
    end if;
  end loop;

  -- 2) Correlativo y encabezado.
  v_corr := nextval('factura_correlativo');
  v_control := 'DTE-01-UD01P001-' || lpad(v_corr::text, 15, '0');
  insert into facturas (correlativo, control, codigo_generacion, cliente_nombre, cliente_correo, cliente_tel, cliente_dui,
                        entrega, municipio, direccion, referencia, pago, pago_detalle, ventas_gravadas, ventas_netas, iva_debito)
  values (v_corr, v_control, coalesce((p->>'codigo')::uuid, gen_random_uuid()),
          p->'cliente'->>'nombre', p->'cliente'->>'correo', coalesce(p->'cliente'->>'tel', ''), coalesce(p->'cliente'->>'dui', ''),
          p->>'entrega', coalesce(p->>'municipio', ''), coalesce(p->>'dir', ''), coalesce(p->>'ref', ''),
          p->>'pago', coalesce(p->'pago_detalle', '{}'::jsonb),
          (p->>'total')::numeric, (p->>'gravadas')::numeric, (p->>'iva')::numeric)
  returning id into v_id;

  -- 3) Detalle, salida de inventario y costo de ventas.
  for it in select value from jsonb_array_elements(p->'items') loop
    n := n + 1;
    c_unit := 0;
    if (it->>'cod') <> 'SERV-ENV' then
      select * into prod from productos where cod = it->>'cod';
      if coalesce((it->>'encargo')::boolean, false) then
        -- Versión por encargo: no sale del inventario actual; costo estimado con el margen del 25 % (hoja de supuestos).
        c_unit := round(((it->>'sin')::numeric / (it->>'q')::int) * 0.75, 2);
      else
        c_unit := prod.costo_unitario;
        update productos set existencia = existencia - (it->>'q')::int, actualizado = now() where cod = prod.cod
          returning existencia into prod.existencia;
        insert into kardex (cod, tipo, cantidad, costo_unitario, costo_total, existencia_resultante, referencia, factura_id)
        values (prod.cod, 'salida', (it->>'q')::int, c_unit, round(c_unit * (it->>'q')::int, 2), prod.existencia,
                'Venta · factura ' || lpad(v_corr::text, 6, '0'), v_id);
        existencias := existencias || jsonb_build_object(prod.cod, prod.existencia);
      end if;
    end if;
    insert into factura_detalle (factura_id, linea, cod, descripcion, version, por_encargo, cantidad, precio_unitario, total, ventas_netas, iva, costo_unitario, costo_total, precio_normal, descuento, promocion)
    values (v_id, n, it->>'cod', it->>'desc', coalesce(it->>'ver', ''), coalesce((it->>'encargo')::boolean, false), (it->>'q')::int,
            (it->>'pu')::numeric, (it->>'tot')::numeric, (it->>'sin')::numeric, (it->>'iva')::numeric, c_unit, round(c_unit * (it->>'q')::int, 2),
            coalesce((it->>'normal')::numeric, (it->>'pu')::numeric), coalesce((it->>'descuento')::numeric, 0), coalesce(it->>'promo', ''));
    v_costo := v_costo + round(c_unit * (it->>'q')::int, 2);
  end loop;

  update facturas set costo_ventas = v_costo where id = v_id;
  return jsonb_build_object('id', v_id, 'correlativo', v_corr, 'control', v_control, 'costo_ventas', v_costo, 'existencias', existencias);
end;
$$;
