-- =====================================================================
-- UniónDev · funciones del panel de administrador
-- Ejecutar en Supabase → SQL Editor, después de esquema.sql y datos-iniciales.sql.
--
--   registrar_compra    entrada al inventario; recalcula el costo promedio ponderado
--   ajustar_inventario  ajuste por conteo físico, daño o pérdida (con motivo)
--   anular_factura      anula una factura y devuelve las unidades al inventario
-- =====================================================================

-- Tipos de movimiento del kardex: se agregan ajustes con dirección y devoluciones por anulación.
alter table kardex drop constraint if exists kardex_tipo_check;
alter table kardex add constraint kardex_tipo_check
  check (tipo in ('entrada', 'salida', 'ajuste', 'ajuste-entrada', 'ajuste-salida', 'devolucion'));

alter table facturas add column if not exists anulada_fecha  timestamptz;
alter table facturas add column if not exists anulada_motivo text not null default '';

-- ---------- compra: costo promedio ponderado ----------
create or replace function registrar_compra(p_cod text, p_cantidad integer, p_costo numeric, p_referencia text default '')
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  prod productos%rowtype;
  nuevo_costo numeric(12,2);
begin
  if p_cantidad is null or p_cantidad <= 0 then raise exception 'CANTIDAD_INVALIDA'; end if;
  if p_costo is null or p_costo < 0 then raise exception 'COSTO_INVALIDO'; end if;
  select * into prod from productos where cod = p_cod for update;
  if not found then raise exception 'PRODUCTO_NO_EXISTE:%', p_cod; end if;

  nuevo_costo := round((prod.existencia * prod.costo_unitario + p_cantidad * p_costo) / (prod.existencia + p_cantidad), 2);
  update productos set existencia = existencia + p_cantidad, costo_unitario = nuevo_costo, actualizado = now()
   where cod = p_cod returning * into prod;

  insert into kardex (cod, tipo, cantidad, costo_unitario, costo_total, existencia_resultante, referencia)
  values (p_cod, 'entrada', p_cantidad, round(p_costo, 2), round(p_cantidad * p_costo, 2), prod.existencia,
          coalesce(nullif(trim(p_referencia), ''), 'Compra a proveedor'));

  return jsonb_build_object('cod', p_cod, 'existencia', prod.existencia, 'costo_promedio', prod.costo_unitario);
end;
$$;

-- ---------- ajuste de inventario ----------
create or replace function ajustar_inventario(p_cod text, p_cantidad integer, p_motivo text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  prod productos%rowtype;
begin
  if p_cantidad is null or p_cantidad = 0 then raise exception 'CANTIDAD_INVALIDA'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'FALTA_MOTIVO'; end if;
  select * into prod from productos where cod = p_cod for update;
  if not found then raise exception 'PRODUCTO_NO_EXISTE:%', p_cod; end if;
  if prod.existencia + p_cantidad < 0 then raise exception 'SIN_EXISTENCIA:%:%', p_cod, prod.existencia; end if;

  update productos set existencia = existencia + p_cantidad, actualizado = now() where cod = p_cod returning * into prod;
  insert into kardex (cod, tipo, cantidad, costo_unitario, costo_total, existencia_resultante, referencia)
  values (p_cod, case when p_cantidad > 0 then 'ajuste-entrada' else 'ajuste-salida' end, abs(p_cantidad),
          prod.costo_unitario, round(abs(p_cantidad) * prod.costo_unitario, 2), prod.existencia, 'Ajuste · ' || trim(p_motivo));

  return jsonb_build_object('cod', p_cod, 'existencia', prod.existencia);
end;
$$;

-- ---------- anulación de factura ----------
create or replace function anular_factura(p_id bigint, p_motivo text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  fac facturas%rowtype;
  mov record;
  ex integer;
begin
  if coalesce(trim(p_motivo), '') = '' then raise exception 'FALTA_MOTIVO'; end if;
  select * into fac from facturas where id = p_id for update;
  if not found then raise exception 'FACTURA_NO_EXISTE'; end if;
  if fac.estado = 'anulada' then raise exception 'YA_ANULADA'; end if;

  -- Devuelve al inventario cada salida de esa factura, al mismo costo con que salió.
  for mov in select * from kardex where factura_id = p_id and tipo = 'salida' order by cod loop
    -- Las unidades vuelven a su costo de salida: el costo promedio se recalcula con ellas.
    update productos
       set costo_unitario = round((existencia * costo_unitario + mov.cantidad * mov.costo_unitario) / (existencia + mov.cantidad), 2),
           existencia = existencia + mov.cantidad, actualizado = now()
     where cod = mov.cod returning existencia into ex;
    insert into kardex (cod, tipo, cantidad, costo_unitario, costo_total, existencia_resultante, referencia, factura_id)
    values (mov.cod, 'devolucion', mov.cantidad, mov.costo_unitario, mov.costo_total, ex,
            'Anulación · factura ' || lpad(fac.correlativo::text, 6, '0'), p_id);
  end loop;

  update facturas set estado = 'anulada', anulada_fecha = now(), anulada_motivo = trim(p_motivo) where id = p_id;
  return jsonb_build_object('id', p_id, 'correlativo', fac.correlativo, 'estado', 'anulada');
end;
$$;

revoke all on function registrar_compra(text, integer, numeric, text) from public, anon, authenticated;
revoke all on function ajustar_inventario(text, integer, text) from public, anon, authenticated;
revoke all on function anular_factura(bigint, text) from public, anon, authenticated;
grant execute on function registrar_compra(text, integer, numeric, text) to service_role;
grant execute on function ajustar_inventario(text, integer, text) to service_role;
grant execute on function anular_factura(bigint, text) to service_role;
