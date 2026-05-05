-- Push notification tokens
CREATE TABLE IF NOT EXISTS push_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'ios',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add onboarding_complete to user_settings if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'onboarding_complete'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN onboarding_complete BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add activity_level and goal columns to user_settings if not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'goal'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN goal TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'activity_level'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN activity_level TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'target_weight'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN target_weight NUMERIC;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'weight'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN weight NUMERIC;
  END IF;
END $$;

-- Add source column to step_entries for HealthKit sync
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'step_entries' AND column_name = 'source'
  ) THEN
    ALTER TABLE step_entries ADD COLUMN source TEXT DEFAULT 'manual';
  END IF;
END $$;

-- Add unique constraint for step_entries (for upsert)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'step_entries_user_date_unique'
  ) THEN
    ALTER TABLE step_entries ADD CONSTRAINT step_entries_user_date_unique UNIQUE (user_id, date);
  END IF;
END $$;

-- RLS policies for push_tokens
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own push tokens" ON push_tokens
  FOR ALL USING (auth.uid() = user_id);

-- Service role can read all tokens (for server-side push)
CREATE POLICY "Service role can read all push tokens" ON push_tokens
  FOR SELECT USING (auth.role() = 'service_role');
