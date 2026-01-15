-- Check roadmap items with audio URLs
SELECT code,
  LEFT(title, 40) as title,
  CASE WHEN audio_url IS NOT NULL THEN 'YES' ELSE 'NO' END as has_audio,
  CASE WHEN voice_transcript IS NOT NULL THEN 'YES' ELSE 'NO' END as has_transcript,
  LEFT(audio_url, 100) as audio_url_preview
FROM roadmap_items
WHERE audio_url IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
