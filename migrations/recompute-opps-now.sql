-- Recompute opportunities with extended timeout
SET statement_timeout = '120s';
SELECT compute_api_opportunities();
