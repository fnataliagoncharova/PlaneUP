-- Migration helper: add new product attributes without breaking existing data
-- Safe to run multiple times; backfills from legacy columns.

do $$
begin
    if not exists (
        select 1 from information_schema.columns
        where table_name = 'products' and column_name = 'unit_of_measure'
    ) then
        alter table products add column unit_of_measure text;
        update products set unit_of_measure = unit;
        alter table products alter column unit_of_measure set default 'pcs';
        alter table products alter column unit_of_measure set not null;
        alter table products add constraint chk_products_unit_of_measure_not_blank check (length(trim(unit_of_measure)) > 0);
    end if;

    if not exists (
        select 1 from information_schema.columns
        where table_name = 'products' and column_name = 'is_active'
    ) then
        alter table products add column is_active boolean;
        update products set is_active = active;
        alter table products alter column is_active set default true;
        alter table products alter column is_active set not null;
    end if;
end
$$;
