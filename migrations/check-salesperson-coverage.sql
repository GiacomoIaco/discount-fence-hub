-- Check salesperson coverage
SELECT
  COUNT(*) as total_opps,
  COUNT(salesperson) as with_salesperson,
  ROUND(COUNT(salesperson)::numeric / COUNT(*) * 100, 1) as coverage_pct
FROM jobber_api_opportunities;

-- Salesperson distribution
SELECT salesperson, COUNT(*) as opp_count
FROM jobber_api_opportunities
WHERE salesperson IS NOT NULL
GROUP BY salesperson
ORDER BY opp_count DESC
LIMIT 20;
