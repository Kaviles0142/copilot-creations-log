-- Add unique constraint for avatar image caching
ALTER TABLE avatar_image_cache 
ADD CONSTRAINT avatar_image_cache_figure_version_unique 
UNIQUE (figure_id, cache_version);