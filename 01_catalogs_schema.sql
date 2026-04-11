-- Catalog reference tables
-- PostgreSQL DDL

create table products (
    product_id      bigint generated always as identity primary key,
    product_code    varchar(64) not null,
    product_name    text not null,
    unit_of_measure text not null default 'pcs',
    is_active       boolean not null default true,
    unit            text not null,
    active          boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    constraint uq_products_code unique (product_code),
    constraint chk_products_code_not_blank check (length(trim(product_code)) > 0),
    constraint chk_products_name_not_blank check (length(trim(product_name)) > 0),
    constraint chk_products_unit_of_measure_not_blank check (length(trim(unit_of_measure)) > 0),
    constraint chk_products_unit_not_blank check (length(trim(unit)) > 0)
);

create table semi_finished (
    semi_finished_id    bigint generated always as identity primary key,
    semi_finished_code  varchar(64) not null,
    semi_finished_name  text not null,
    unit                text not null,
    degas_days          integer not null,
    active              boolean not null default true,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    constraint uq_semi_finished_code unique (semi_finished_code),
    constraint chk_semi_finished_code_not_blank check (length(trim(semi_finished_code)) > 0),
    constraint chk_semi_finished_name_not_blank check (length(trim(semi_finished_name)) > 0),
    constraint chk_semi_finished_unit_not_blank check (length(trim(unit)) > 0),
    constraint chk_semi_finished_degas_nonnegative check (degas_days >= 0)
);

create table processes (
    process_id      bigint generated always as identity primary key,
    process_code    varchar(64) not null,
    process_name    text not null,
    active          boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    constraint uq_process_code unique (process_code),
    constraint chk_process_code_not_blank check (length(trim(process_code)) > 0),
    constraint chk_process_name_not_blank check (length(trim(process_name)) > 0)
);

create table machines (
    machine_id      bigint generated always as identity primary key,
    machine_code    varchar(64) not null,
    machine_name    text not null,
    active          boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    constraint uq_machine_code unique (machine_code),
    constraint chk_machine_code_not_blank check (length(trim(machine_code)) > 0),
    constraint chk_machine_name_not_blank check (length(trim(machine_name)) > 0)
);
