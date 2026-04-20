-- Migration helper: add material flow conversion quantities without breaking existing data.
-- Safe to run multiple times; backfills legacy rows with temporary 1.000 -> 1.000 values.

do $$
begin
    if not exists (
        select 1
        from information_schema.columns
        where table_name = 'route_step_material_flow' and column_name = 'input_qty'
    ) then
        alter table route_step_material_flow add column input_qty numeric(12,3);
    end if;

    if not exists (
        select 1
        from information_schema.columns
        where table_name = 'route_step_material_flow' and column_name = 'output_qty'
    ) then
        alter table route_step_material_flow add column output_qty numeric(12,3);
    end if;

    update route_step_material_flow
    set
        input_qty = coalesce(input_qty, 1.000),
        output_qty = coalesce(output_qty, 1.000)
    where input_qty is null or output_qty is null;

    alter table route_step_material_flow alter column input_qty set not null;
    alter table route_step_material_flow alter column output_qty set not null;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'chk_flow_input_qty_positive'
          and conrelid = 'route_step_material_flow'::regclass
    ) then
        alter table route_step_material_flow
            add constraint chk_flow_input_qty_positive check (input_qty > 0);
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'chk_flow_output_qty_positive'
          and conrelid = 'route_step_material_flow'::regclass
    ) then
        alter table route_step_material_flow
            add constraint chk_flow_output_qty_positive check (output_qty > 0);
    end if;
end
$$;
