-- Create table to cache book content excerpts
CREATE TABLE IF NOT EXISTS public.book_content_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id TEXT NOT NULL,
  figure_id TEXT NOT NULL,
  figure_name TEXT NOT NULL,
  book_title TEXT NOT NULL,
  content_excerpt TEXT NOT NULL,
  full_content TEXT,
  source TEXT NOT NULL DEFAULT 'openlibrary',
  relevance_score INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '7 days')
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_book_content_figure ON public.book_content_cache(figure_id);
CREATE INDEX IF NOT EXISTS idx_book_content_book ON public.book_content_cache(book_id);
CREATE INDEX IF NOT EXISTS idx_book_content_expires ON public.book_content_cache(expires_at);

-- Enable RLS
ALTER TABLE public.book_content_cache ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read cached book content
CREATE POLICY "Anyone can view book content"
  ON public.book_content_cache
  FOR SELECT
  USING (true);

-- Allow system to manage cache
CREATE POLICY "System can manage book content cache"
  ON public.book_content_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger to update updated_at
CREATE TRIGGER update_book_content_cache_updated_at
  BEFORE UPDATE ON public.book_content_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();