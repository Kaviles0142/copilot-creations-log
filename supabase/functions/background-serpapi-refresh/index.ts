import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Popular historical figures to keep cached
const POPULAR_FIGURES = [
  { id: 'donald-trump', name: 'Donald Trump' },
  { id: 'john-f-kennedy', name: 'John F. Kennedy' },
  { id: 'abraham-lincoln', name: 'Abraham Lincoln' },
  { id: 'winston-churchill', name: 'Winston Churchill' },
  { id: 'albert-einstein', name: 'Albert Einstein' },
  { id: 'martin-luther-king', name: 'Martin Luther King Jr.' },
  { id: 'shakespeare', name: 'William Shakespeare' },
  { id: 'leonardo-da-vinci', name: 'Leonardo da Vinci' },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Background SerpAPI refresh started');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get figures that have been used recently
    const { data: recentConversations } = await supabase
      .from('conversations')
      .select('figure_id, figure_name')
      .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .limit(20);

    // Combine popular + recently used figures (unique)
    const figuresMap = new Map();
    POPULAR_FIGURES.forEach(fig => figuresMap.set(fig.id, fig));
    recentConversations?.forEach((conv: any) => {
      if (!figuresMap.has(conv.figure_id)) {
        figuresMap.set(conv.figure_id, { id: conv.figure_id, name: conv.figure_name });
      }
    });

    const figuresToRefresh = Array.from(figuresMap.values());
    console.log(`📊 Refreshing cache for ${figuresToRefresh.length} figures`);

    let successCount = 0;
    let errorCount = 0;

    // Refresh cache for each figure
    for (const figure of figuresToRefresh) {
      try {
        console.log(`🔍 Refreshing: ${figure.name}`);
        
        // Run all three SerpAPI searches in parallel
        const searchPromises = [
          // 1. Current Events/News
          supabase.functions.invoke('serpapi-search', {
            body: { 
              query: `${figure.name} news 2024 2025`,
              type: 'news',
              num: 5
            }
          }),
          // 2. Historical Context
          supabase.functions.invoke('serpapi-search', {
            body: { 
              query: `${figure.name} biography history`,
              type: 'web',
              num: 5
            }
          }),
          // 3. Web Articles
          supabase.functions.invoke('serpapi-search', {
            body: { 
              query: `${figure.name} analysis profile`,
              type: 'web',
              num: 5
            }
          }),
        ];

        const results = await Promise.allSettled(searchPromises);
        
        // Store successful results in cache
        const searchTypes = ['news', 'context', 'articles'];
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          if (result.status === 'fulfilled' && result.value.data?.results) {
            // Delete old cache entries for this figure/type
            await supabase
              .from('serpapi_cache')
              .delete()
              .eq('figure_id', figure.id)
              .eq('search_type', searchTypes[i]);

            // Insert new cache entry
            await supabase
              .from('serpapi_cache')
              .insert({
                figure_id: figure.id,
                figure_name: figure.name,
                search_type: searchTypes[i],
                query: result.value.data.query,
                results: result.value.data.results,
                expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString() // 6 hours
              });
          }
        }

        successCount++;
        console.log(`✅ Refreshed: ${figure.name}`);
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`❌ Error refreshing ${figure.name}:`, error);
        errorCount++;
      }
    }

    console.log(`🎯 Refresh complete: ${successCount} success, ${errorCount} errors`);

    return new Response(JSON.stringify({ 
      success: true,
      refreshed: successCount,
      errors: errorCount,
      figures: figuresToRefresh.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Background refresh error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
