\echo [bootstrap] Applying schema.sql
\i /bootstrap/schema.sql

\echo [bootstrap] Applying migration 20260302_admin_studio_phase_a.sql
\i /bootstrap/migrations/20260302_admin_studio_phase_a.sql

\echo [bootstrap] Applying migration 20260302_datasource_collection_phase_f.sql
\i /bootstrap/migrations/20260302_datasource_collection_phase_f.sql

\echo [bootstrap] Applying migration 20260302_datasource_collection_phase_f_prod_hardening.sql
\i /bootstrap/migrations/20260302_datasource_collection_phase_f_prod_hardening.sql

\echo [bootstrap] Applying migration 20260303_domain_pack_catalog_phase_g.sql
\i /bootstrap/migrations/20260303_domain_pack_catalog_phase_g.sql

\echo [bootstrap] Applying migration 20260311_match_source_context.sql
\i /bootstrap/migrations/20260311_match_source_context.sql
