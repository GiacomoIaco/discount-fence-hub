-- Check quote statuses in the database
SELECT status, COUNT(*)
FROM jobber_api_quotes
WHERE sent_at IS NOT NULL
GROUP BY status
ORDER BY COUNT(*) DESC;
