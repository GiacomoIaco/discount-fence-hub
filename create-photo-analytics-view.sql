-- Photo Analytics System
-- Run this in Supabase SQL Editor

-- Create a materialized view for photo analytics by uploader
CREATE OR REPLACE VIEW photo_analytics_by_uploader AS
SELECT
  p.uploaded_by as user_id,
  p.uploader_name,
  COUNT(DISTINCT CASE WHEN p.status = 'published' THEN p.id END) as photos_published,
  COALESCE(SUM(CASE WHEN p.status = 'published' THEN p.likes ELSE 0 END), 0) as total_likes,
  COUNT(DISTINCT CASE WHEN p.status = 'published' AND p.is_favorite = true THEN p.id END) as total_favorites,
  COUNT(DISTINCT cs.photo_id) as total_client_selections,
  ROUND(AVG(CASE WHEN p.status = 'published' AND p.quality_score IS NOT NULL THEN p.quality_score END), 2) as avg_quality_score,
  ROUND(AVG(CASE WHEN p.status = 'published' AND p.confidence_score IS NOT NULL THEN p.confidence_score END), 2) as avg_confidence_score,
  MIN(CASE WHEN p.status = 'published' THEN p.uploaded_at END) as first_published_at,
  MAX(CASE WHEN p.status = 'published' THEN p.uploaded_at END) as last_published_at
FROM photos p
LEFT JOIN LATERAL (
  SELECT DISTINCT photo_id, jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(client_selections) = 'array' THEN client_selections
      ELSE '[]'::jsonb
    END
  ) as selection
  FROM photos
  WHERE id = p.id
) cs ON true
GROUP BY p.uploaded_by, p.uploader_name;

-- Create view for overall photo stats
CREATE OR REPLACE VIEW photo_stats_summary AS
SELECT
  COUNT(DISTINCT id) as total_photos,
  COUNT(DISTINCT CASE WHEN status = 'published' THEN id END) as total_published,
  COUNT(DISTINCT CASE WHEN status = 'pending' THEN id END) as total_pending,
  COUNT(DISTINCT CASE WHEN status = 'saved' THEN id END) as total_saved,
  COUNT(DISTINCT CASE WHEN status = 'archived' THEN id END) as total_archived,
  COALESCE(SUM(likes), 0) as total_likes,
  COUNT(DISTINCT CASE WHEN is_favorite = true THEN id END) as total_favorites,
  ROUND(AVG(CASE WHEN quality_score IS NOT NULL THEN quality_score END), 2) as avg_quality_score,
  ROUND(AVG(CASE WHEN confidence_score IS NOT NULL THEN confidence_score END), 2) as avg_confidence_score
FROM photos;

-- Create view for photo upload trends (by day)
CREATE OR REPLACE VIEW photo_upload_trends AS
SELECT
  DATE(uploaded_at) as upload_date,
  COUNT(DISTINCT id) as photos_uploaded,
  COUNT(DISTINCT CASE WHEN status = 'published' THEN id END) as photos_published,
  COALESCE(SUM(likes), 0) as total_likes
FROM photos
WHERE uploaded_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE(uploaded_at)
ORDER BY upload_date DESC;

-- Create view for most popular tags
CREATE OR REPLACE VIEW popular_tags AS
SELECT
  tag,
  COUNT(*) as usage_count,
  COUNT(DISTINCT CASE WHEN status = 'published' THEN id END) as published_count
FROM photos,
LATERAL unnest(tags) as tag
GROUP BY tag
ORDER BY usage_count DESC
LIMIT 50;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully created photo analytics views!';
  RAISE NOTICE 'Views: photo_analytics_by_uploader, photo_stats_summary, photo_upload_trends, popular_tags';
END $$;
