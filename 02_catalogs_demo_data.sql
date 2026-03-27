-- Demo seed data for catalog tables

insert into products (product_code, product_name, unit, active) values
    ('P-BOARD-A1', 'Printed circuit board A1', 'pcs', true),
    ('P-LAM-ROLL', 'Laminated film roll 500mm', 'roll', true),
    ('P-LBL-PACK', 'Adhesive label pack 1000 pcs', 'pack', true),
    ('P-CORE-SET', 'Paper core set 3 sizes', 'set', true),
    ('P-BAG-ANTIST', 'Antistatic bag 30x40 cm', 'pcs', true);

insert into semi_finished (semi_finished_code, semi_finished_name, unit, degas_days, active) values
    ('SF-FILM-PET12', 'PET film 12um pretreated', 'kg', 0, true),
    ('SF-GLUE-PSA', 'Pressure-sensitive adhesive mix', 'kg', 2, true),
    ('SF-CORE-76', 'Cardboard core 76mm', 'pcs', 0, true),
    ('SF-LAM-SANDW', 'Laminated sandwich 2-layer', 'sqm', 1, true),
    ('SF-LAM-SANDW-TRIM', 'Laminated sandwich trimmed roll', 'sqm', 0, true),
    ('SF-PRINT-PR', 'Preprinted top layer', 'sqm', 0, true);

insert into processes (process_code, process_name, active) values
    ('semifinished_production', 'Semi-finished production', true),
    ('lamination', 'Lamination', true),
    ('rewinding', 'Rewinding / slitting', true),
    ('final_packaging', 'Final packaging', true);

insert into machines (machine_code, machine_name, active) values
    ('LAM-01', 'NordTech 1400 wide laminator', true),
    ('SLIT-02', 'Rewinder-slitter 800 compact', true),
    ('MIX-01', 'Adhesive mixing reactor 500L', true),
    ('PKG-01', 'Automatic flow-pack line', true);
