-- Orchestrator: create all tables in the correct dependency order
-- Run with psql: \i 00_run_all_schema.sql

\i 01_catalogs_schema.sql
\i 03_tech_schema.sql
\i 05_calc_schema.sql
\i 07_exec_schema.sql
