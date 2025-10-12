-- Add greeting video URL to avatar cache
ALTER TABLE public.avatar_image_cache
ADD COLUMN IF NOT EXISTS greeting_video_url TEXT;