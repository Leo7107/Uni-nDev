-- =====================================================================
-- UniónDev · base de datos (Supabase / PostgreSQL)
-- Ejecutar en Supabase → SQL Editor, antes de datos-iniciales.sql.
--
-- Tablas:   productos, facturas, factura_detalle, kardex
-- Función:  emitir_factura(jsonb)  → emite la factura y descuenta inventario en un solo paso
-- Vistas:   libro_ventas_cf, resumen_ventas_mensual, inventario_valorizado
-- Seguridad: RLS activado sin políticas públicas; solo el servidor (service_role) lee y escribe.
-- =====================================================================

-- ---------- productos ----------
create table if not exists productos (
  cod             text primary key check (cod ~ '^[A-Z]{3}-[0-9]{3}$'),
  categoria       text not null,
  descripcion     text not null,
  marca           text not null,
  existencia      integer not null check (existencia >= 0),
  costo_unitario  numeric(12,2) not null check (costo_unitario >= 0),  -- sin IVA
  precio_sin_iva  numeric(12,2) not null check (precio_sin_iva >= 0),
  precio          numeric(12,2) not null check (precio >= 0),          -- con IVA (precio al consumidor)
  actualizado     timestamptz not null default now()
);
comment on table productos is 'Catálogo e inventario. Costos y precios de la hoja Inventario del archivo de UNIONDEV.';

-- ---------- facturas (consumidor final) ----------
create sequence if not exists factura_correlativo start 1;

create table if not exists facturas (
  id                 bigint generated always as identity primary key,
  correlativo        bigint not null unique,
  control            text   not null unique,               -- DTE-01-UD01P001-000000000000001
  codigo_generacion  uuid   not null unique,
  fecha              timestamptz not null default now(),
  cliente_nombre     text not null,
  cliente_correo     text not null,
  cliente_tel        text not null default '',
  cliente_dui        text not null default '',
  entrega            text not null check (entrega in ('tienda', 'domicilio')),
  municipio          text not null default '',
  direccion          text not null default '',
  referencia         text not null default '',
  pago               text not null check (pago in ('efectivo', 'transferencia', 'tarjeta-prueba', 'paypal')),
  pago_detalle       jsonb not null default '{}'::jsonb,   -- marca/últimos 4/autorización o ids de PayPal
  ventas_gravadas    numeric(12,2) not null,               -- total con IVA (en la factura de consumidor final el IVA va incluido)
  ventas_netas       numeric(12,2) not null,               -- sin IVA
  iva_debito         numeric(12,2) not null,
  costo_ventas       numeric(12,2) not null default 0,
  correo_enviado     boolean not null default false,
  estado             text not null default 'emitida' check (estado in ('emitida', 'anulada'))
);
comment on table facturas is 'Facturas de consumidor final emitidas por la tienda en línea.';
create index if not exists facturas_fecha_idx on facturas (fecha);

create table if not exists factura_detalle (
  id               bigint generated always as identity primary key,
  factura_id       bigint not null references facturas (id) on delete cascade,
  linea            integer not null,
  cod              text not null,                          -- código de producto o SERV-ENV
  descripcion      text not null,
  version          text not null default '',
  por_encargo      boolean not null default false,
  cantidad         integer not null check (cantidad > 0),
  precio_unitario  numeric(12,2) not null,                 -- con IVA
  total            numeric(12,2) not null,                 -- con IVA
  ventas_netas     numeric(12,2) not null,                 -- sin IVA
  iva              numeric(12,2) not null,
  costo_unitario   numeric(12,2) not null default 0,
  costo_total      numeric(12,2) not null default 0,
  precio_normal    numeric(12,2),
  descuento        numeric(12,2) not null default 0,
  promocion        text not null default '',
  unique (factura_id, linea)
);
create index if not exists factura_detalle_cod_idx on factura_detalle (cod);

-- ---------- kardex ----------
create table if not exists kardex (
  id                     bigint generated always as identity primary key,
  fecha                  timestamptz not null default now(),
  cod                    text not null references productos (cod),
  tipo                   text not null check (tipo in ('entrada', 'salida', 'ajuste')),
  cantidad               integer not null check (cantidad > 0),
  costo_unitario         numeric(12,2) not null,
  costo_total            numeric(12,2) not null,
  existencia_resultante  integer not null check (existencia_resultante >= 0),
  referencia             text not null default '',
  factura_id             bigint references facturas (id)
);
comment on table kardex is 'Movimientos de inventario valorizados al costo (entradas, salidas por venta y ajustes).';
create index if not exists kardex_cod_fecha_idx on kardex (cod, fecha);

-- =====================================================================
-- emitir_factura: valida existencias, descuenta inventario, registra el kardex,
-- asigna el siguiente correlativo y guarda la factura. Todo o nada.
-- El servidor envía el pedido ya validado y con precios recalculados desde el catálogo.
-- Errores: 'SIN_EXISTENCIA:<cod>:<disponible>'  ·  'PRODUCTO_NO_EXISTE:<cod>'
-- =====================================================================
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

-- Existencias públicas para la tienda (solo código y cantidad).
create or replace function existencias()
returns table (cod text, existencia integer)
language sql stable security definer set search_path = public
as $$ select cod, existencia from productos order by cod $$;

-- =====================================================================
-- Vistas contables
-- =====================================================================

-- Libro de ventas a consumidor final: un renglón por día, del primer al último número emitido.
create or replace view libro_ventas_cf with (security_invoker = true) as
select
  (fecha at time zone 'America/El_Salvador')::date            as dia,
  lpad(min(correlativo)::text, 6, '0')                         as del_numero,
  lpad(max(correlativo)::text, 6, '0')                         as al_numero,
  count(*)                                                     as documentos,
  0::numeric(12,2)                                             as ventas_exentas,
  0::numeric(12,2)                                             as ventas_no_sujetas,
  sum(ventas_gravadas)::numeric(12,2)                          as ventas_gravadas,
  sum(ventas_gravadas)::numeric(12,2)                          as total_ventas_diarias,
  sum(ventas_netas)::numeric(12,2)                             as ventas_netas,
  sum(iva_debito)::numeric(12,2)                               as iva_debito_fiscal
from facturas
where estado = 'emitida'
group by 1
order by 1;

-- Resumen mensual para el libro diario: ventas, IVA débito, costo de ventas y utilidad bruta.
create or replace view resumen_ventas_mensual with (security_invoker = true) as
select
  to_char(date_trunc('month', fecha at time zone 'America/El_Salvador'), 'YYYY-MM')  as mes,
  count(*)                                                     as facturas,
  sum(ventas_gravadas)::numeric(12,2)                          as total_con_iva,
  sum(ventas_netas)::numeric(12,2)                             as ventas_netas,
  sum(iva_debito)::numeric(12,2)                               as iva_debito_fiscal,
  sum(costo_ventas)::numeric(12,2)                             as costo_ventas,
  (sum(ventas_netas) - sum(costo_ventas))::numeric(12,2)       as utilidad_bruta
from facturas
where estado = 'emitida'
group by 1
order by 1;

-- Inventario valorizado al costo.
create or replace view inventario_valorizado with (security_invoker = true) as
select cod, categoria, descripcion, marca, existencia, costo_unitario,
       (existencia * costo_unitario)::numeric(12,2) as valor_al_costo,
       precio, actualizado
from productos
order by cod;

-- =====================================================================
-- Seguridad: nadie entra con la clave pública (anon). Solo el servidor, con service_role.
-- =====================================================================
alter table productos       enable row level security;
alter table facturas        enable row level security;
alter table factura_detalle enable row level security;
alter table kardex          enable row level security;

revoke all on productos, facturas, factura_detalle, kardex from anon, authenticated;
revoke all on libro_ventas_cf, resumen_ventas_mensual, inventario_valorizado from anon, authenticated;
revoke all on function emitir_factura(jsonb) from public, anon, authenticated;
revoke all on function existencias() from public, anon, authenticated;
-- Permisos explícitos para el servidor (el proyecto se crea sin "conceder acceso API a nuevas tablas automáticamente").
grant usage on schema public to service_role;
grant select, insert, update, delete on productos, facturas, factura_detalle, kardex to service_role;
grant select on libro_ventas_cf, resumen_ventas_mensual, inventario_valorizado to service_role;
grant execute on function emitir_factura(jsonb) to service_role;
grant execute on function existencias() to service_role;
grant usage, select on sequence factura_correlativo to service_role;
