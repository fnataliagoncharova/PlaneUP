-- Input and calculation tables (sales, inventory, safety stock, needs)
-- Depends on catalogs: products, semi_finished, product_semi_finished_components

create table sales_plan (
    sales_plan_id bigint generated always as identity primary key,
    period        varchar(16) not null,
    product_id    bigint not null references products(product_id),
    qty           numeric(12,3) not null,
    due_date      date,
    version       integer not null default 1,
    source        text,
    comment       text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    constraint chk_sales_plan_qty_nonnegative check (qty >= 0),
    constraint chk_sales_plan_period_not_blank check (length(trim(period)) > 0)
);

create table product_inventory (
    inventory_id  bigint generated always as identity primary key,
    product_id    bigint not null references products(product_id),
    qty_available numeric(12,3) not null default 0,
    updated_at    timestamptz not null default now(),
    constraint chk_inventory_qty_nonnegative check (qty_available >= 0)
);

create table safety_stock (
    safety_stock_id bigint generated always as identity primary key,
    product_id      bigint not null references products(product_id),
    qty             numeric(12,3) not null default 0,
    updated_at      timestamptz not null default now(),
    comment         text,
    constraint chk_safety_stock_qty_nonnegative check (qty >= 0)
);

create table production_need (
    production_need_id bigint generated always as identity primary key,
    period             varchar(16) not null,
    product_id         bigint not null references products(product_id),
    sales_plan_qty     numeric(12,3) not null default 0,
    safety_stock_qty   numeric(12,3) not null default 0,
    stock_qty          numeric(12,3) not null default 0,
    required_qty       numeric(12,3) not null default 0,
    calc_date          timestamptz not null default now(),
    version            integer not null default 1,
    comment            text,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now(),
    constraint chk_prod_need_sales_plan_nonnegative check (sales_plan_qty >= 0),
    constraint chk_prod_need_safety_stock_nonnegative check (safety_stock_qty >= 0),
    constraint chk_prod_need_stock_nonnegative check (stock_qty >= 0),
    constraint chk_prod_need_required_nonnegative check (required_qty >= 0),
    constraint chk_prod_need_period_not_blank check (length(trim(period)) > 0)
);

create table semi_finished_need (
    semi_finished_need_id     bigint generated always as identity primary key,
    period                    varchar(16) not null,
    semi_finished_id          bigint not null references semi_finished(semi_finished_id),
    source_product_id         bigint not null references products(product_id),
    source_component_id       bigint not null references product_semi_finished_components(component_id),
    required_product_qty      numeric(12,3) not null,
    required_semi_finished_qty numeric(12,3) not null,
    calc_date                 timestamptz not null default now(),
    comment                   text,
    created_at                timestamptz not null default now(),
    updated_at                timestamptz not null default now(),
    constraint chk_sf_need_prod_qty_nonnegative check (required_product_qty >= 0),
    constraint chk_sf_need_sf_qty_nonnegative check (required_semi_finished_qty >= 0),
    constraint chk_sf_need_period_not_blank check (length(trim(period)) > 0)
);
