-- Make audio-files bucket public so D-ID can access avatar images
UPDATE storage.buckets 
SET public = true 
WHERE id = 'audio-files';