import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Background Data Sync - Starting automated sync...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get figures that have been active in the last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const { data: recentConversations } = await supabase
      .from('conversations')
      .select('figure_id, figure_name')
      .gte('updated_at', yesterday.toISOString())
      .neq('figure_id', null);

    if (!recentConversations || recentConversations.length === 0) {
      console.log('No recent conversations found');
      return new Response(JSON.stringify({ status: 'no_recent_activity' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get unique active figures
    const activeFigures = Array.from(
      new Map(recentConversations.map(c => [c.figure_id, c])).values()
    );

    console.log(`Found ${activeFigures.length} active figures to sync`);

    const syncResults = [];

    for (const figure of activeFigures) {
      console.log(`🔄 Syncing data for ${figure.figure_name}...`);
      
      const figureResult = {
        figure_id: figure.figure_id,
        figure_name: figure.figure_name,
        books_synced: false,
        current_events_synced: false,
        historical_context_synced: false,
        youtube_synced: false,
        errors: [] as string[]
      };

      // 1. Ensure fresh books data
      try {
        const { data: existingBooks } = await supabase
          .from('books')
          .select('id')
          .eq('figure_id', figure.figure_id)
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        if (!existingBooks || existingBooks.length < 3) {
          console.log(`📚 Refreshing books for ${figure.figure_name}...`);
          
          await supabase.functions.invoke('discover-books', {
            body: {
              figureName: figure.figure_name,
              figureId: figure.figure_id,
              forceRefresh: false
            }
          });
          
          figureResult.books_synced = true;
        }
      } catch (error) {
        console.error(`Failed to sync books for ${figure.figure_name}:`, error);
        figureResult.errors.push(`Books sync: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // SerpAPI removed - using Wikipedia and books for context

      // 4. Ensure YouTube content is cached
      try {
        console.log(`🎥 Syncing YouTube content for ${figure.figure_name}...`);
        
        await supabase.functions.invoke('youtube-search', {
          body: {
            query: `"${figure.figure_name}" original speech documentary interview historical`,
            maxResults: 5
          }
        });
        
        figureResult.youtube_synced = true;
      } catch (error) {
        console.error(`Failed to sync YouTube for ${figure.figure_name}:`, error);
        figureResult.errors.push(`YouTube sync: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      syncResults.push(figureResult);
    }

    // Log sync completion
    const successfulSyncs = syncResults.filter(r => r.errors.length === 0).length;
    const totalSyncs = syncResults.length;

    console.log(`✅ Background sync completed: ${successfulSyncs}/${totalSyncs} figures synced successfully`);

    return new Response(JSON.stringify({
      status: 'completed',
      figures_synced: totalSyncs,
      successful_syncs: successfulSyncs,
      sync_results: syncResults,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Background sync error:', error);
    
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 'error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});