-- Create rooms table for conversation sessions
CREATE TABLE public.rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(4), 'hex'),
  user_id UUID REFERENCES auth.users(id),
  guest_id TEXT,
  figure_id TEXT,
  figure_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Allow anyone to create rooms (guests included)
CREATE POLICY "Anyone can create rooms"
ON public.rooms
FOR INSERT
WITH CHECK (true);

-- Allow users to view their own rooms or rooms they created as guest
CREATE POLICY "Users can view own rooms"
ON public.rooms
FOR SELECT
USING (
  user_id = auth.uid() 
  OR (user_id IS NULL AND guest_id IS NOT NULL)
  OR auth.uid() IS NULL
);

-- Allow updates to own rooms
CREATE POLICY "Users can update own rooms"
ON public.rooms
FOR UPDATE
USING (user_id = auth.uid() OR (user_id IS NULL AND guest_id IS NOT NULL));

-- Create index for faster lookups
CREATE INDEX idx_rooms_room_code ON public.rooms(room_code);
CREATE INDEX idx_rooms_user_id ON public.rooms(user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_rooms_updated_at
BEFORE UPDATE ON public.rooms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();