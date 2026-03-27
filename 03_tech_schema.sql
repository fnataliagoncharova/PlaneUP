
create table routes (
    route_id     bigint generated always as identity primary key,
    route_code   varchar(64) not null,
    route_name   text not null,
    active       boolean not null default true,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    constraint uq_route_code unique (route_code),
    constraint chk_route_code_not_blank check (length(trim(route_code)) > 0),
    constraint chk_route_name_not_blank check (length(trim(route_name)) > 0)
);

create table route_steps (
    route_step_id bigint generated always as identity primary key,
    route_id      bigint not null references routes(route_id),
    step_no       integer not null,
    process_id    bigint not null references processes(process_id),
    notes         text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    constraint uq_route_step unique (route_id, step_no),
    constraint chk_route_step_no_positive check (step_no > 0)
);

-- Material flow per step: what semi-finished enters and leaves a step.
-- Degassing is captured as notes in route_steps, not as a separate step.
create table route_step_material_flow (
    material_flow_id       bigint generated always as identity primary key,
    route_id               bigint not null,
    step_no                integer not null,
    input_semi_finished_id bigint references semi_finished(semi_finished_id),
    output_semi_finished_id bigint not null references semi_finished(semi_finished_id),
    created_at             timestamptz not null default now(),
    updated_at             timestamptz not null default now(),
    constraint fk_flow_route_step foreign key (route_id, step_no)
        references route_steps(route_id, step_no),
    constraint uq_flow_per_step unique (route_id, step_no),
    constraint chk_flow_step_no_positive check (step_no > 0),
    constraint chk_flow_output_not_blank check (output_semi_finished_id is not null)
);

create table machine_process_capability (
    capability_id    bigint generated always as identity primary key,
    machine_id       bigint not null references machines(machine_id),
    process_id       bigint not null references processes(process_id),
    semi_finished_id bigint not null references semi_finished(semi_finished_id),
    role             text not null,
    productivity     numeric(12,3) not null,
    min_batch        numeric(12,3) not null,
    allowed          boolean not null default true,
    valid_from       date,
    valid_to         date,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    constraint chk_capability_role_not_blank check (length(trim(role)) > 0),
    constraint chk_capability_productivity_positive check (productivity > 0),
    constraint chk_capability_min_batch_nonnegative check (min_batch >= 0),
    constraint chk_capability_valid_range check (
        valid_from is null or valid_to is null or valid_to >= valid_from
    )
);

-- Uniqueness across machine+process+semi_finished with nullable valid_from.
-- Using coalesce to treat null as "open-ended" period.
create unique index uq_capability_key
    on machine_process_capability (
        machine_id,
        process_id,
        semi_finished_id,
        coalesce(valid_from, 'infinity'::date)
    );

create table product_semi_finished_components (
    component_id     bigint generated always as identity primary key,
    product_id       bigint not null references products(product_id),
    semi_finished_id bigint not null references semi_finished(semi_finished_id),
    route_id         bigint not null references routes(route_id),
    component_qty    numeric(12,3) not null,
    product_qty      numeric(12,3) not null,
    priority         integer not null default 1,
    valid_from       date,
    valid_to         date,
    active           boolean not null default true,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    constraint chk_component_qty_positive check (component_qty > 0),
    constraint chk_product_qty_positive check (product_qty > 0),
    constraint chk_priority_positive check (priority > 0),
    constraint chk_component_valid_range check (
        valid_from is null or valid_to is null or valid_to >= valid_from
    )
);
