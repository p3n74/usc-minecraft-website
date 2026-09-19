ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES posts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS posts_parent_idx ON posts(parent_id);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS mc_username TEXT,
  ADD COLUMN IF NOT EXISTS mc_uuid TEXT,
  ADD COLUMN IF NOT EXISTS banner_color TEXT NOT NULL DEFAULT '#2d641c',
  ADD COLUMN IF NOT EXISTS discord_handle TEXT;

CREATE TABLE IF NOT EXISTS votes (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'thread')),
  target_id UUID NOT NULL,
  value SMALLINT NOT NULL CHECK (value IN (-1, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS votes_target_idx ON votes(target_type, target_id);
