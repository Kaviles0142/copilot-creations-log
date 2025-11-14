-- Enable realtime for debate_messages table
ALTER TABLE public.debate_messages REPLICA IDENTITY FULL;

-- Add debate_messages to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.debate_messages;