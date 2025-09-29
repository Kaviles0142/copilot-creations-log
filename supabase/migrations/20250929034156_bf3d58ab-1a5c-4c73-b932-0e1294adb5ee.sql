-- Create books table for storing book information about historical figures
CREATE TABLE public.books (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  figure_id TEXT NOT NULL,
  figure_name TEXT NOT NULL,
  title TEXT NOT NULL,
  authors TEXT[] NOT NULL,
  description TEXT,
  published_date TEXT,
  page_count INTEGER,
  categories TEXT[],
  thumbnail_url TEXT,
  preview_link TEXT,
  info_link TEXT,
  book_type TEXT NOT NULL CHECK (book_type IN ('by_figure', 'about_figure', 'related')),
  google_books_id TEXT,
  isbn_10 TEXT,
  isbn_13 TEXT,
  language TEXT DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_books_figure_id ON public.books(figure_id);
CREATE INDEX idx_books_type ON public.books(book_type);
CREATE INDEX idx_books_figure_type ON public.books(figure_id, book_type);

-- Enable Row Level Security
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

-- Create policies for books (public access for demo)
CREATE POLICY "Anyone can view books" 
ON public.books 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create books" 
ON public.books 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update books" 
ON public.books 
FOR UPDATE 
USING (true);

-- Create function to update book timestamps
CREATE OR REPLACE FUNCTION public.update_books_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_books_updated_at
BEFORE UPDATE ON public.books
FOR EACH ROW
EXECUTE FUNCTION public.update_books_updated_at();