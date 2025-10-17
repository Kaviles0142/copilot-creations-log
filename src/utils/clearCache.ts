import { supabase } from '@/integrations/supabase/client';

export async function clearAvatarCache() {
  try {
    const { data, error } = await supabase.functions.invoke('clear-avatar-cache');
    
    if (error) {
      console.error('Failed to clear cache:', error);
      return false;
    }
    
    console.log('✅ Cache cleared:', data);
    return true;
  } catch (error) {
    console.error('Error clearing cache:', error);
    return false;
  }
}
