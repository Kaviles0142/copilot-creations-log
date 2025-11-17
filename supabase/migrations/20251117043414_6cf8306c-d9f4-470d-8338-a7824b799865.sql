-- Drop existing policies on avatar_image_cache
DROP POLICY IF EXISTS "Anyone can view cached avatar images" ON avatar_image_cache;
DROP POLICY IF EXISTS "System can manage avatar image cache" ON avatar_image_cache;

-- Create new permissive policies
CREATE POLICY "Allow all to read avatar cache"
ON avatar_image_cache FOR SELECT
USING (true);

CREATE POLICY "Allow all to insert avatar cache"
ON avatar_image_cache FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow all to update avatar cache"
ON avatar_image_cache FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all to delete avatar cache"
ON avatar_image_cache FOR DELETE
USING (true);