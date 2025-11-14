-- Add cache_version column to figure_metadata table for automatic cache invalidation
ALTER TABLE public.figure_metadata 
ADD COLUMN IF NOT EXISTS cache_version text DEFAULT 'v1';