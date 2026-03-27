-- Demo data for execution and tracking tables

-- Helper maps
with routes_map as (
    select route_id, route_code from routes
), processes_map as (
    select process_id, process_code from processes
), machines_map as (
    select machine_id, machine_code from machines
), sf_map as (
    select semi_finished_id, semi_finished_code from semi_finished
), need_map as (
    select semi_finished_need_id, semi_finished_id, source_product_id
    from semi_finished_need
)
-- Production orders: show first step with null input, and multi-step with changing PF
insert into production_orders (
    process_id, route_id, step_no, input_semi_finished_id, output_semi_finished_id,
    planned_qty, planned_start, planned_finish, machine_id, status, source_need_id, notes
) values
    -- Step 1 (mixing glue): input null, output glue
    (
        (select process_id from processes_map where process_code = 'semifinished_production'),
        (select route_id from routes_map where route_code = 'R-MIX-GLUE'),
        1,
        null,
        (select semi_finished_id from sf_map where semi_finished_code = 'SF-GLUE-PSA'),
        500.000,
        timestamptz '2026-04-01 08:00+07',
        timestamptz '2026-04-02 08:00+07',
        (select machine_id from machines_map where machine_code = 'MIX-01'),
        'planned',
        (select semi_finished_need_id from need_map where semi_finished_id = (select semi_finished_id from sf_map where semi_finished_code = 'SF-GLUE-PSA') limit 1),
        'Batch with degas hold'
    ),
    -- Step 1 lamination: input PET, output laminate
    (
        (select process_id from processes_map where process_code = 'lamination'),
        (select route_id from routes_map where route_code = 'R-LAM-REW'),
        1,
        (select semi_finished_id from sf_map where semi_finished_code = 'SF-FILM-PET12'),
        (select semi_finished_id from sf_map where semi_finished_code = 'SF-LAM-SANDW'),
        1000.000,
        timestamptz '2026-04-04 09:00+07',
        timestamptz '2026-04-04 18:00+07',
        (select machine_id from machines_map where machine_code = 'LAM-01'),
        'planned',
        (select semi_finished_need_id from need_map where semi_finished_id = (select semi_finished_id from sf_map where semi_finished_code = 'SF-LAM-SANDW') limit 1),
        'Laminate base roll'
    ),
    -- Step 2 rewinding: input laminate, output trimmed laminate
    (
        (select process_id from processes_map where process_code = 'rewinding'),
        (select route_id from routes_map where route_code = 'R-LAM-REW'),
        2,
        (select semi_finished_id from sf_map where semi_finished_code = 'SF-LAM-SANDW'),
        (select semi_finished_id from sf_map where semi_finished_code = 'SF-LAM-SANDW-TRIM'),
        980.000,
        timestamptz '2026-04-05 09:00+07',
        timestamptz '2026-04-05 13:00+07',
        (select machine_id from machines_map where machine_code = 'SLIT-02'),
        'planned',
        (select semi_finished_need_id from need_map where semi_finished_id = (select semi_finished_id from sf_map where semi_finished_code = 'SF-LAM-SANDW') limit 1),
        'Trim to final width'
    );

-- Production actuals with scrap
insert into production_actuals (
    order_id, fact_qty, scrap_qty, fact_start, fact_finish, machine_id, comment
) values
    (
        (select order_id from production_orders where route_id = (select route_id from routes_map where route_code = 'R-LAM-REW') and step_no = 1),
        990.000,
        10.000,
        timestamptz '2026-04-04 09:05+07',
        timestamptz '2026-04-04 18:10+07',
        (select machine_id from machines_map where machine_code = 'LAM-01'),
        'Minor edge scrap'
    ),
    (
        (select order_id from production_orders where route_id = (select route_id from routes_map where route_code = 'R-LAM-REW') and step_no = 2),
        970.000,
        10.000,
        timestamptz '2026-04-05 09:10+07',
        timestamptz '2026-04-05 13:05+07',
        (select machine_id from machines_map where machine_code = 'SLIT-02'),
        'Trim scrap'
    );

-- Semi-finished inventory: degassing and available stock
insert into semi_finished_inventory (
    semi_finished_id, process_stage, qty_available, release_date, updated_at
) values
    (
        (select semi_finished_id from sf_map where semi_finished_code = 'SF-GLUE-PSA'),
        'degassing',
        500.000,
        date '2026-04-04',
        now()
    ),
    (
        (select semi_finished_id from sf_map where semi_finished_code = 'SF-LAM-SANDW'),
        'available_for_next_step',
        980.000,
        null,
        now()
    );

-- Equipment downtime: planned maintenance and unplanned stop
insert into equipment_downtime (
    machine_id, downtime_type, start_time, end_time, reason_code, reason_name, comment
) values
    (
        (select machine_id from machines_map where machine_code = 'LAM-01'),
        'maintenance',
        timestamptz '2026-04-03 06:00+07',
        timestamptz '2026-04-03 10:00+07',
        'PM',
        'Planned maintenance',
        'Monthly check'
    ),
    (
        (select machine_id from machines_map where machine_code = 'SLIT-02'),
        'unplanned_stop',
        timestamptz '2026-04-05 14:00+07',
        timestamptz '2026-04-05 16:30+07',
        'WEB_BREAK',
        'Web break',
        'Splice failure'
    );
