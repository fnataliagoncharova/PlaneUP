-- Execution and tracking tables
-- Depends on: processes, routes, route_steps, route_step_material_flow,
--             semi_finished, machines, semi_finished_need

create table production_orders (
    order_id                bigint generated always as identity primary key,
    process_id              bigint not null references processes(process_id),
    route_id                bigint not null references routes(route_id),
    step_no                 integer not null,
    input_semi_finished_id  bigint references semi_finished(semi_finished_id),
    output_semi_finished_id bigint not null references semi_finished(semi_finished_id),
    planned_qty             numeric(12,3) not null,
    planned_start           timestamptz,
    planned_finish          timestamptz,
    machine_id              bigint not null references machines(machine_id),
    status                  text not null default 'planned',
    source_need_id          bigint not null references semi_finished_need(semi_finished_need_id),
    notes                   text,
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now(),
    constraint chk_po_planned_qty_positive check (planned_qty > 0),
    constraint chk_po_step_no_positive check (step_no > 0),
    constraint chk_po_planned_finish_after_start check (
        planned_finish is null or planned_start is null or planned_finish >= planned_start
    ),
    -- Allow null input only for first step; keeps data clean without overconstraining routing logic.
    constraint chk_po_input_null_only_first_step check (
        input_semi_finished_id is not null or step_no = 1
    )
);

create table production_actuals (
    actual_id    bigint generated always as identity primary key,
    order_id     bigint not null references production_orders(order_id),
    fact_qty     numeric(12,3) not null default 0,
    scrap_qty    numeric(12,3) not null default 0,
    fact_start   timestamptz,
    fact_finish  timestamptz,
    machine_id   bigint not null references machines(machine_id),
    comment      text,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    constraint chk_pa_fact_qty_nonnegative check (fact_qty >= 0),
    constraint chk_pa_scrap_qty_nonnegative check (scrap_qty >= 0),
    constraint chk_pa_finish_after_start check (
        fact_finish is null or fact_start is null or fact_finish >= fact_start
    )
);

create table semi_finished_inventory (
    inventory_id  bigint generated always as identity primary key,
    semi_finished_id bigint not null references semi_finished(semi_finished_id),
    process_stage text not null,
    qty_available numeric(12,3) not null default 0,
    release_date  date,
    updated_at    timestamptz not null default now(),
    constraint chk_sfi_qty_nonnegative check (qty_available >= 0),
    constraint chk_sfi_stage_not_blank check (length(trim(process_stage)) > 0)
);

create table equipment_downtime (
    downtime_id  bigint generated always as identity primary key,
    machine_id   bigint not null references machines(machine_id),
    downtime_type text not null,
    start_time   timestamptz,
    end_time     timestamptz,
    reason_code  text,
    reason_name  text,
    comment      text,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    constraint chk_dt_finish_after_start check (
        end_time is null or start_time is null or end_time >= start_time
    ),
    constraint chk_dt_type_not_blank check (length(trim(downtime_type)) > 0)
);
