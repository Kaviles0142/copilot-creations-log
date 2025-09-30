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
    console.log('🔍 Data Health Monitor - Starting health check...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all active historical figures
    const { data: conversations } = await supabase
      .from('conversations')
      .select('figure_id, figure_name')
      .neq('figure_id', null);

    if (!conversations) {
      console.log('No conversations found');
      return new Response(JSON.stringify({ status: 'no_data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get unique figures
    const uniqueFigures = Array.from(
      new Map(conversations.map(c => [c.figure_id, c])).values()
    );

    console.log(`Found ${uniqueFigures.length} unique figures to monitor`);

    const healthResults = [];

    for (const figure of uniqueFigures) {
      console.log(`📊 Checking data health for ${figure.figure_name}...`);
      
      // Check books
      const { data: books, count: bookCount } = await supabase
        .from('books')
        .select('*', { count: 'exact' })
        .eq('figure_id', figure.figure_id);

      // Check if books are recent (within last 7 days)
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentBooks = books?.filter(book => 
        new Date(book.created_at) > oneWeekAgo
      ).length || 0;

      const figureHealth = {
        figure_id: figure.figure_id,
        figure_name: figure.figure_name,
        books: {
          total: bookCount || 0,
          recent: recentBooks,
          needs_refresh: (bookCount || 0) < 5 || recentBooks === 0,
          refresh_triggered: false,
          refresh_error: null as string | null
        },
        timestamp: new Date().toISOString()
      };

      healthResults.push(figureHealth);

      // Auto-fix if needed
      if (figureHealth.books.needs_refresh) {
        console.log(`🔄 Auto-refreshing books for ${figure.figure_name}...`);
        
        try {
          // Trigger book discovery in background
          supabase.functions.invoke('discover-books', {
            body: {
              figureName: figure.figure_name,
              figureId: figure.figure_id,
              forceRefresh: true
            }
          });
          
          figureHealth.books.refresh_triggered = true;
        } catch (error) {
          console.error(`Failed to refresh books for ${figure.figure_name}:`, error);
          figureHealth.books.refresh_error = error instanceof Error ? error.message : 'Unknown error';
        }
      }
    }

    // Store health check results
    await supabase
      .from('data_health_logs')
      .insert({
        check_timestamp: new Date().toISOString(),
        figures_checked: uniqueFigures.length,
        health_results: healthResults,
        auto_fixes_applied: healthResults.filter(r => r.books.refresh_triggered).length
      })
      .select()
      .single();

    console.log('✅ Data health check completed');

    return new Response(JSON.stringify({
      status: 'completed',
      figures_checked: uniqueFigures.length,
      health_results: healthResults,
      auto_fixes: healthResults.filter(r => r.books.refresh_triggered).length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Data health monitor error:', error);
    
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 'error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});