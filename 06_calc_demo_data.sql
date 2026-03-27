-- Demo data for input and calculation tables

-- Sales plan (period April 2026)
insert into sales_plan (period, product_id, qty, due_date, version, source, comment) values
    ('2026-04', (select product_id from products where product_code = 'P-CORE-SET'), 100.000, date '2026-04-15', 1, 'xlsx', 'Coverage by stock'),
    ('2026-04', (select product_id from products where product_code = 'P-LBL-PACK'), 2000.000, date '2026-04-20', 1, 'xlsx', 'Label packs spring run'),
    ('2026-04', (select product_id from products where product_code = 'P-BOARD-A1'), 50.000, date '2026-04-25', 1, 'xlsx', 'Boards for pilot batch');

-- Product inventory snapshot
insert into product_inventory (product_id, qty_available, updated_at) values
    ((select product_id from products where product_code = 'P-CORE-SET'), 120.000, now()),
    ((select product_id from products where product_code = 'P-LBL-PACK'), 300.000, now()),
    ((select product_id from products where product_code = 'P-BOARD-A1'), 0.000, now());

-- Safety stock
insert into safety_stock (product_id, qty, updated_at, comment) values
    ((select product_id from products where product_code = 'P-CORE-SET'), 0.000, now(), 'No buffer'),
    ((select product_id from products where product_code = 'P-LBL-PACK'), 100.000, now(), 'One day buffer'),
    ((select product_id from products where product_code = 'P-BOARD-A1'), 0.000, now(), 'Pilot run');

-- Production need (precalculated)
insert into production_need (
    period, product_id, sales_plan_qty, safety_stock_qty, stock_qty, required_qty, version, comment
) values
    -- Stock fully covers demand -> required 0
    ('2026-04',
     (select product_id from products where product_code = 'P-CORE-SET'),
     100.000, 0.000, 120.000, 0.000, 1, 'Covered by inventory'),
    -- Positive need
    ('2026-04',
     (select product_id from products where product_code = 'P-LBL-PACK'),
     2000.000, 100.000, 300.000, 1800.000, 1, 'Need to produce'),
    -- Product with multiple PF components
    ('2026-04',
     (select product_id from products where product_code = 'P-BOARD-A1'),
     50.000, 0.000, 0.000, 50.000, 1, 'Pilot boards');

-- Semi-finished need (mapped from production_need and components)
with prod as (
    select product_id, product_code from products
), comp as (
    select c.component_id, c.product_id, c.semi_finished_id
    from product_semi_finished_components c
)
insert into semi_finished_need (
    period, semi_finished_id, source_product_id, source_component_id,
    required_product_qty, required_semi_finished_qty, comment
) values
    -- P-BOARD-A1 has two PF components -> two rows
    (
        '2026-04',
        (select semi_finished_id from semi_finished where semi_finished_code = 'SF-PRINT-PR'),
        (select product_id from prod where product_code = 'P-BOARD-A1'),
        (select component_id from comp where product_id = (select product_id from prod where product_code = 'P-BOARD-A1')
            and semi_finished_id = (select semi_finished_id from semi_finished where semi_finished_code = 'SF-PRINT-PR')),
        50.000,
        0.900,
        'Printed layer for boards'
    ),
    (
        '2026-04',
        (select semi_finished_id from semi_finished where semi_finished_code = 'SF-GLUE-PSA'),
        (select product_id from prod where product_code = 'P-BOARD-A1'),
        (select component_id from comp where product_id = (select product_id from prod where product_code = 'P-BOARD-A1')
            and semi_finished_id = (select semi_finished_id from semi_finished where semi_finished_code = 'SF-GLUE-PSA')),
        50.000,
        1.800,
        'Adhesive for boards'
    ),
    -- Single-component mapping with positive need
    (
        '2026-04',
        (select semi_finished_id from semi_finished where semi_finished_code = 'SF-LAM-SANDW'),
        (select product_id from prod where product_code = 'P-LBL-PACK'),
        (select component_id from comp where product_id = (select product_id from prod where product_code = 'P-LBL-PACK')
            and semi_finished_id = (select semi_finished_id from semi_finished where semi_finished_code = 'SF-LAM-SANDW')),
        1800.000,
        2.160,
        'Laminate for label packs'
    );
