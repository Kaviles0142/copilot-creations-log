-- Add missing search_query column to books table
ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS search_query TEXT;