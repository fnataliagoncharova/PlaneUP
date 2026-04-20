-- Migration helper: allow multiple input semi-finished flows for one route step.
-- Safe to run multiple times; preserves existing rows and backfills qty defaults.

do $$
declare
    v_constraint_name text;
    v_index_name text;
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

    alter table route_step_material_flow
        alter column input_qty set default 1.000,
        alter column output_qty set default 1.000,
        alter column input_qty set not null,
        alter column output_qty set not null,
        alter column input_semi_finished_id drop not null,
        alter column output_semi_finished_id set not null;

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

    for v_constraint_name in
        select c.conname
        from pg_constraint c
        where c.conrelid = 'route_step_material_flow'::regclass
          and c.contype = 'u'
          and (
              select array_agg(a.attname order by cols.ordinality)
              from unnest(c.conkey) with ordinality as cols(attnum, ordinality)
              join pg_attribute a
                on a.attrelid = c.conrelid
               and a.attnum = cols.attnum
          ) = array['route_id', 'step_no']
    loop
        execute format(
            'alter table route_step_material_flow drop constraint %I',
            v_constraint_name
        );
    end loop;

    for v_index_name in
        select i.oid::regclass::text
        from pg_index idx
        join pg_class i on i.oid = idx.indexrelid
        where idx.indrelid = 'route_step_material_flow'::regclass
          and idx.indisunique
          and not idx.indisprimary
          and (
              select array_agg(a.attname order by cols.ordinality)
              from unnest(idx.indkey) with ordinality as cols(attnum, ordinality)
              join pg_attribute a
                on a.attrelid = idx.indrelid
               and a.attnum = cols.attnum
          ) = array['route_id', 'step_no']
    loop
        execute 'drop index if exists ' || v_index_name;
    end loop;
end
$$;

create index if not exists idx_route_step_material_flow_route_step
    on route_step_material_flow (route_id, step_no);
