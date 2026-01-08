-- Photo infrastructure: summit photo metadata table
-- NOTE: Existing summit IDs are VARCHAR, so foreign keys match those types.

-- gen_random_uuid() requires pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS summit_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to summit (one of these must be non-null)
  activities_peaks_id VARCHAR(1000) REFERENCES activities_peaks(id) ON DELETE CASCADE,
  user_peak_manual_id VARCHAR(1000) REFERENCES user_peak_manual(id) ON DELETE CASCADE,

  -- Owner
  user_id VARCHAR(256) REFERENCES users(id) NOT NULL,

  -- Storage info
  storage_path TEXT NOT NULL,        -- GCS path: photos/{user_id}/{uuid}.jpg
  thumbnail_path TEXT,              -- GCS path: photos/{user_id}/{uuid}_thumb.jpg

  -- Metadata
  original_filename VARCHAR(255),
  mime_type VARCHAR(50),
  size_bytes INTEGER,
  width INTEGER,
  height INTEGER,
  caption TEXT,
  taken_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint: must belong to either activity summit or manual summit
  CONSTRAINT photo_parent_check CHECK (
    (activities_peaks_id IS NOT NULL AND user_peak_manual_id IS NULL) OR
    (activities_peaks_id IS NULL AND user_peak_manual_id IS NOT NULL)
  )
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_summit_photos_user ON summit_photos(user_id);
CREATE INDEX IF NOT EXISTS idx_summit_photos_activities_peaks ON summit_photos(activities_peaks_id);
CREATE INDEX IF NOT EXISTS idx_summit_photos_manual ON summit_photos(user_peak_manual_id);


