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

export async function clearFigureMetadata(figureId: string) {
  try {
    const { data, error } = await supabase.functions.invoke('clear-figure-metadata', {
      body: { figure_id: figureId }
    });
    
    if (error) {
      console.error('Failed to clear figure metadata:', error);
      return false;
    }
    
    console.log('✅ Figure metadata cleared:', data);
    return true;
  } catch (error) {
    console.error('Error clearing figure metadata:', error);
    return false;
  }
}
