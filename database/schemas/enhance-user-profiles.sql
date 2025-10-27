-- Enhanced User Profiles Schema
-- Adds profile picture, bio, voice sample, and additional fields

-- 1. Add new columns to user_profiles table
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS voice_sample_url TEXT,
ADD COLUMN IF NOT EXISTS territory TEXT,
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS certifications JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS goals JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{
  "notifications": {
    "email": true,
    "push": true,
    "messages": true,
    "surveys": true
  },
  "theme": "light",
  "language": "en"
}'::jsonb;

-- 2. Add constraints and comments
COMMENT ON COLUMN user_profiles.bio IS 'User bio/about me section (max 500 characters)';
COMMENT ON COLUMN user_profiles.voice_sample_url IS 'URL to voice baseline recording for AI coaching';
COMMENT ON COLUMN user_profiles.territory IS 'Geographic territory assignment';
COMMENT ON COLUMN user_profiles.start_date IS 'Employment start date';
COMMENT ON COLUMN user_profiles.certifications IS 'Array of completed training certifications';
COMMENT ON COLUMN user_profiles.goals IS 'User goals and targets (sales goals, personal development, etc)';
COMMENT ON COLUMN user_profiles.preferences IS 'User preferences (notifications, theme, language)';

-- 3. Create user_achievements table for badges/awards
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  achievement_type TEXT NOT NULL, -- 'badge', 'award', 'milestone'
  title TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  earned_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON public.user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_type ON public.user_achievements(achievement_type);

COMMENT ON TABLE public.user_achievements IS 'User achievements, badges, and awards';

-- 4. Create user_activity_stats table for tracking
CREATE TABLE IF NOT EXISTS public.user_activity_stats (
  user_id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  total_recordings INT DEFAULT 0,
  total_messages_sent INT DEFAULT 0,
  total_messages_received INT DEFAULT 0,
  total_surveys_completed INT DEFAULT 0,
  total_photos_uploaded INT DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  stats_updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.user_activity_stats IS 'Aggregated user activity statistics';

-- 5. Create storage buckets (run these separately in Supabase dashboard or via API)
-- Note: These are commented out as they need to be run via Supabase API/Dashboard
/*
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('user-avatars', 'user-avatars', true),
  ('voice-samples', 'voice-samples', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for user-avatars (public bucket)
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'user-avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'user-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'user-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for voice-samples (private bucket)
CREATE POLICY "Users can access their own voice sample"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'voice-samples'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can upload their own voice sample"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'voice-samples'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own voice sample"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'voice-samples'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admins can access all voice samples for AI training
CREATE POLICY "Admins can access all voice samples"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'voice-samples'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
*/

-- 6. Create function to update activity stats
CREATE OR REPLACE FUNCTION update_user_activity_stats(
  p_user_id UUID,
  p_activity_type TEXT
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.user_activity_stats (user_id, last_activity_at)
  VALUES (p_user_id, now())
  ON CONFLICT (user_id) DO UPDATE
  SET last_activity_at = now(),
      stats_updated_at = now();

  -- Update specific counters
  CASE p_activity_type
    WHEN 'recording' THEN
      UPDATE public.user_activity_stats
      SET total_recordings = total_recordings + 1
      WHERE user_id = p_user_id;
    WHEN 'message_sent' THEN
      UPDATE public.user_activity_stats
      SET total_messages_sent = total_messages_sent + 1
      WHERE user_id = p_user_id;
    WHEN 'message_received' THEN
      UPDATE public.user_activity_stats
      SET total_messages_received = total_messages_received + 1
      WHERE user_id = p_user_id;
    WHEN 'survey_completed' THEN
      UPDATE public.user_activity_stats
      SET total_surveys_completed = total_surveys_completed + 1
      WHERE user_id = p_user_id;
    WHEN 'photo_uploaded' THEN
      UPDATE public.user_activity_stats
      SET total_photos_uploaded = total_photos_uploaded + 1
      WHERE user_id = p_user_id;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Enable RLS on new tables
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_achievements
CREATE POLICY "Users can view their own achievements"
  ON public.user_achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all achievements"
  ON public.user_achievements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System can insert achievements"
  ON public.user_achievements FOR INSERT
  WITH CHECK (true);

-- RLS Policies for user_activity_stats
CREATE POLICY "Users can view their own stats"
  ON public.user_activity_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins and managers can view all stats"
  ON public.user_activity_stats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'sales-manager')
    )
  );

CREATE POLICY "System can insert stats"
  ON public.user_activity_stats FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update stats"
  ON public.user_activity_stats FOR UPDATE
  USING (true);

-- 8. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_territory ON public.user_profiles(territory);
CREATE INDEX IF NOT EXISTS idx_user_profiles_start_date ON public.user_profiles(start_date);

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Enhanced user profiles schema created successfully!';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Create storage buckets in Supabase Dashboard:';
  RAISE NOTICE '   - user-avatars (public)';
  RAISE NOTICE '   - voice-samples (private)';
  RAISE NOTICE '2. Apply storage policies (uncomment and run SQL in dashboard)';
  RAISE NOTICE '3. Build UI components for profile management';
END $$;
