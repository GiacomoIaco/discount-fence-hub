-- Migration 278: Add jobber_salesperson_names to fsm_team_profiles
-- Phase 3 of User Identity Consolidation
--
-- Consolidates user_salesperson_mapping into fsm_team_profiles
-- Uses array because a person may have different names across multiple Jobber accounts

ALTER TABLE fsm_team_profiles
  ADD COLUMN IF NOT EXISTS jobber_salesperson_names TEXT[] DEFAULT '{}';

-- Backfill from existing mapping table
UPDATE fsm_team_profiles ftp
SET jobber_salesperson_names = sub.names
FROM (
  SELECT user_id, array_agg(DISTINCT salesperson_name) AS names
  FROM user_salesperson_mapping
  WHERE salesperson_name IS NOT NULL
  GROUP BY user_id
) sub
WHERE ftp.user_id = sub.user_id
  AND (ftp.jobber_salesperson_names IS NULL OR ftp.jobber_salesperson_names = '{}');
