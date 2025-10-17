-- Add cache_version column to track portrait vs environmental scene versions
ALTER TABLE avatar_image_cache 
ADD COLUMN IF NOT EXISTS cache_version text DEFAULT 'v1';

-- Clear all existing cached images so they regenerate with new environmental prompts
DELETE FROM avatar_image_cache;

-- Add comment for clarity
COMMENT ON COLUMN avatar_image_cache.cache_version IS 'Version tracker: v1=portrait style, v2=environmental scenes';