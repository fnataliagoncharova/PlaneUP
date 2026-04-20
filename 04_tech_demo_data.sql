-- Demo data for technological tables aligned with updated model

-- Routes
insert into routes (route_code, route_name, active) values
    ('R-MIX-GLUE', 'Adhesive mixing (with degas hold)', true),           -- простой маршрут: только выпуск ПФ
    ('R-LAM', 'Lamination route', true),                                -- маршрут с ламинацией
    ('R-LAM-REW', 'Lamination with rewinding', true),                   -- маршрут с ламинацией и перемоткой
    ('R-PRINT', 'Printing route', true),                                -- простой выпуск печатного слоя
    ('R-CORE-STD', 'Standard paper core route', true);                  -- простой выпуск сердечника

with routes_map as (
    select route_id, route_code from routes
), processes_map as (
    select process_id, process_code from processes
)
-- Route steps: только реальные переделы (дегазация в notes)
insert into route_steps (route_id, step_no, process_id, notes) values
    (
        (select route_id from routes_map where route_code = 'R-MIX-GLUE'),
        1,
        (select process_id from processes_map where process_code = 'semifinished_production'),
        'Includes 48h degas hold after production'
    ),
    (
        (select route_id from routes_map where route_code = 'R-LAM'),
        1,
        (select process_id from processes_map where process_code = 'lamination'),
        'Two-layer laminate'
    ),
    (
        (select route_id from routes_map where route_code = 'R-LAM-REW'),
        1,
        (select process_id from processes_map where process_code = 'lamination'),
        'Laminate sandwich'
    ),
    (
        (select route_id from routes_map where route_code = 'R-LAM-REW'),
        2,
        (select process_id from processes_map where process_code = 'rewinding'),
        'Trim to target width'
    ),
    (
        (select route_id from routes_map where route_code = 'R-PRINT'),
        1,
        (select process_id from processes_map where process_code = 'semifinished_production'),
        'Printing / coating'
    ),
    (
        (select route_id from routes_map where route_code = 'R-CORE-STD'),
        1,
        (select process_id from processes_map where process_code = 'semifinished_production'),
        'Paper core winding'
    );

-- Material flow per step: один выходной ПФ может иметь несколько входных строк
with routes_map as (
    select route_id, route_code from routes
), sf as (
    select semi_finished_id, semi_finished_code from semi_finished
)
insert into route_step_material_flow (
    route_id, step_no, input_semi_finished_id, output_semi_finished_id, input_qty, output_qty
) values
    -- простой выпуск клея: вход сырьё (null), выход SF-GLUE-PSA
    (
        (select route_id from routes_map where route_code = 'R-MIX-GLUE'),
        1,
        null,
        (select semi_finished_id from sf where semi_finished_code = 'SF-GLUE-PSA'),
        1.000,
        1.000
    ),
    -- ламинация: шаг 1 собирает один выходной ПФ из двух входных ПФ
    (
        (select route_id from routes_map where route_code = 'R-LAM'),
        1,
        (select semi_finished_id from sf where semi_finished_code = 'SF-FILM-PET12'),
        (select semi_finished_id from sf where semi_finished_code = 'SF-LAM-SANDW'),
        1.000,
        1.000
    ),
    (
        (select route_id from routes_map where route_code = 'R-LAM'),
        1,
        (select semi_finished_id from sf where semi_finished_code = 'SF-GLUE-PSA'),
        (select semi_finished_id from sf where semi_finished_code = 'SF-LAM-SANDW'),
        0.050,
        1.000
    ),
    -- ламинация + перемотка: шаг 1 делает сэндвич из плёнки и клея, шаг 2 даёт новый ПФ после перемотки
    (
        (select route_id from routes_map where route_code = 'R-LAM-REW'),
        1,
        (select semi_finished_id from sf where semi_finished_code = 'SF-FILM-PET12'),
        (select semi_finished_id from sf where semi_finished_code = 'SF-LAM-SANDW'),
        1.000,
        1.000
    ),
    (
        (select route_id from routes_map where route_code = 'R-LAM-REW'),
        1,
        (select semi_finished_id from sf where semi_finished_code = 'SF-GLUE-PSA'),
        (select semi_finished_id from sf where semi_finished_code = 'SF-LAM-SANDW'),
        0.050,
        1.000
    ),
    (
        (select route_id from routes_map where route_code = 'R-LAM-REW'),
        2,
        (select semi_finished_id from sf where semi_finished_code = 'SF-LAM-SANDW'),
        (select semi_finished_id from sf where semi_finished_code = 'SF-LAM-SANDW-TRIM'),
        1.000,
        1.000
    ),
    -- печать: выпуск печатного слоя
    (
        (select route_id from routes_map where route_code = 'R-PRINT'),
        1,
        null,
        (select semi_finished_id from sf where semi_finished_code = 'SF-PRINT-PR'),
        1.000,
        1.000
    ),
    -- сердечник: выпуск бумажного сердечника
    (
        (select route_id from routes_map where route_code = 'R-CORE-STD'),
        1,
        null,
        (select semi_finished_id from sf where semi_finished_code = 'SF-CORE-76'),
        1.000,
        1.000
    );

-- Machine process capability (примерные значения)
insert into machine_process_capability (
    machine_id, process_id, semi_finished_id, role,
    productivity, min_batch, allowed, valid_from, valid_to
) values
    (
        (select machine_id from machines where machine_code = 'MIX-01'),
        (select process_id from processes where process_code = 'semifinished_production'),
        (select semi_finished_id from semi_finished where semi_finished_code = 'SF-GLUE-PSA'),
        'mix', 220, 50, true, date '2026-04-01', null
    ),
    (
        (select machine_id from machines where machine_code = 'MIX-01'),
        (select process_id from processes where process_code = 'semifinished_production'),
        (select semi_finished_id from semi_finished where semi_finished_code = 'SF-GLUE-PSA'),
        'mix', 200, 40, true, null, date '2026-03-31'
    ),
    (
        (select machine_id from machines where machine_code = 'LAM-01'),
        (select process_id from processes where process_code = 'lamination'),
        (select semi_finished_id from semi_finished where semi_finished_code = 'SF-LAM-SANDW'),
        'laminate', 520, 100, true, null, null
    ),
    (
        (select machine_id from machines where machine_code = 'LAM-01'),
        (select process_id from processes where process_code = 'lamination'),
        (select semi_finished_id from semi_finished where semi_finished_code = 'SF-FILM-PET12'),
        'laminate', 480, 80, true, null, null
    ),
    (
        (select machine_id from machines where machine_code = 'SLIT-02'),
        (select process_id from processes where process_code = 'rewinding'),
        (select semi_finished_id from semi_finished where semi_finished_code = 'SF-LAM-SANDW'),
        'slit', 650, 80, true, null, null
    ),
    (
        (select machine_id from machines where machine_code = 'SLIT-02'),
        (select process_id from processes where process_code = 'rewinding'),
        (select semi_finished_id from semi_finished where semi_finished_code = 'SF-LAM-SANDW-TRIM'),
        'slit', 620, 60, true, null, null
    ),
    (
        (select machine_id from machines where machine_code = 'SLIT-02'),
        (select process_id from processes where process_code = 'rewinding'),
        (select semi_finished_id from semi_finished where semi_finished_code = 'SF-FILM-PET12'),
        'slit', 700, 50, true, null, null
    ),
    (
        (select machine_id from machines where machine_code = 'PKG-01'),
        (select process_id from processes where process_code = 'final_packaging'),
        (select semi_finished_id from semi_finished where semi_finished_code = 'SF-LAM-SANDW-TRIM'),
        'pack', 300, 10, true, null, null
    ),
    (
        (select machine_id from machines where machine_code = 'PKG-01'),
        (select process_id from processes where process_code = 'final_packaging'),
        (select semi_finished_id from semi_finished where semi_finished_code = 'SF-CORE-76'),
        'strap', 240, 20, true, null, null
    );

-- Product components
insert into product_semi_finished_components (
    product_id, semi_finished_id, route_id,
    component_qty, product_qty, priority,
    valid_from, valid_to, active
) values
    -- продукт с одним ПФ
    (
        (select product_id from products where product_code = 'P-CORE-SET'),
        (select semi_finished_id from semi_finished where semi_finished_code = 'SF-CORE-76'),
        (select route_id from routes where route_code = 'R-CORE-STD'),
        1.000, 1.000, 1, null, null, true
    ),
    -- продукт с несколькими ПФ (ламинат + клей)
    (
        (select product_id from products where product_code = 'P-LAM-ROLL'),
        (select semi_finished_id from semi_finished where semi_finished_code = 'SF-LAM-SANDW-TRIM'),
        (select route_id from routes where route_code = 'R-LAM-REW'),
        1.000, 1.000, 1, null, null, true
    ),
    (
        (select product_id from products where product_code = 'P-LAM-ROLL'),
        (select semi_finished_id from semi_finished where semi_finished_code = 'SF-GLUE-PSA'),
        (select route_id from routes where route_code = 'R-MIX-GLUE'),
        0.050, 1.000, 2, null, null, true
    ),
    -- другой продукт с одним ПФ (печатный слой)
    (
        (select product_id from products where product_code = 'P-BAG-ANTIST'),
        (select semi_finished_id from semi_finished where semi_finished_code = 'SF-PRINT-PR'),
        (select route_id from routes where route_code = 'R-PRINT'),
        0.800, 10.000, 1, null, null, true
    ),
    -- разные маршруты для разных ПФ в одном продукте
    (
        (select product_id from products where product_code = 'P-BOARD-A1'),
        (select semi_finished_id from semi_finished where semi_finished_code = 'SF-PRINT-PR'),
        (select route_id from routes where route_code = 'R-PRINT'),
        0.900, 50.000, 1, null, null, true
    ),
    (
        (select product_id from products where product_code = 'P-BOARD-A1'),
        (select semi_finished_id from semi_finished where semi_finished_code = 'SF-GLUE-PSA'),
        (select route_id from routes where route_code = 'R-MIX-GLUE'),
        0.030, 50.000, 2, null, null, true
    ),
    -- простой продукт с ламинацией без перемотки
    (
        (select product_id from products where product_code = 'P-LBL-PACK'),
        (select semi_finished_id from semi_finished where semi_finished_code = 'SF-LAM-SANDW'),
        (select route_id from routes where route_code = 'R-LAM'),
        1.200, 1000.000, 1, null, null, true
    );
