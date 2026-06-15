create or replace function public.adjust_inventory_item_quantity(
  p_item_id uuid,
  p_organization_id uuid,
  p_delta numeric
)
returns table (
  id uuid,
  quantity numeric
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_current_quantity numeric;
  v_next_quantity numeric;
begin
  select inventory_items.quantity
    into v_current_quantity
  from public.inventory_items
  where inventory_items.id = p_item_id
    and inventory_items.organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Inventory item not found for this organization.'
      using errcode = 'P0002';
  end if;

  v_next_quantity := coalesce(v_current_quantity, 0) + p_delta;

  if v_next_quantity < 0 then
    raise exception 'Insufficient inventory quantity.'
      using errcode = '22003';
  end if;

  update public.inventory_items
  set
    quantity = v_next_quantity,
    updated_at = now()
  where inventory_items.id = p_item_id
    and inventory_items.organization_id = p_organization_id
  returning inventory_items.id, inventory_items.quantity
    into id, quantity;

  return next;
end;
$$;
