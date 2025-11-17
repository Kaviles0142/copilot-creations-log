-- Create a function to get cached avatar (bypasses any client-side issues)
CREATE OR REPLACE FUNCTION public.get_cached_avatar(p_figure_id TEXT)
RETURNS TABLE (
  id UUID,
  figure_id TEXT,
  figure_name TEXT,
  cloudinary_url TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.figure_id,
    a.figure_name,
    a.cloudinary_url,
    a.created_at
  FROM avatar_image_cache a
  WHERE a.figure_id = p_figure_id
    AND a.expires_at > NOW()
  ORDER BY a.created_at DESC
  LIMIT 1;
END;
$$;