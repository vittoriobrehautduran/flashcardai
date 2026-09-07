-- Per-user settings (run once on Neon if drizzle-kit push isn't used)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id text PRIMARY KEY,
  gemini_api_key_encrypted text,
  updated_at timestamptz NOT NULL
);
