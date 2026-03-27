-- Orchestrator: load demo data in the correct dependency order
-- Run with psql after schemas are created: \i 00_run_all_demo_data.sql

\i 02_catalogs_demo_data.sql
\i 04_tech_demo_data.sql
\i 06_calc_demo_data.sql
\i 08_exec_demo_data.sql
