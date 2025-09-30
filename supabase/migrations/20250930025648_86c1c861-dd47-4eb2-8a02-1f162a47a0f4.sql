-- Add missing relevance_score column to books table
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS relevance_score INTEGER DEFAULT 0;