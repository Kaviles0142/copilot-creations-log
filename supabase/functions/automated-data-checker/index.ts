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
    console.log('🤖 Automated Data Checker - Starting check and sync...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // First run health monitor
    console.log('Running health monitor...');
    const healthResponse = await supabase.functions.invoke('data-health-monitor');
    
    if (!healthResponse.data || healthResponse.error) {
      console.error('Health monitor failed:', healthResponse.error);
    } else {
      console.log('Health monitor completed successfully');
    }

    // Then run background sync for active figures
    console.log('Running background data sync...');
    const syncResponse = await supabase.functions.invoke('background-data-sync');
    
    if (!syncResponse.data || syncResponse.error) {
      console.error('Background sync failed:', syncResponse.error);
    } else {
      console.log('Background sync completed successfully');
    }

    // Check for any figures that need immediate attention
    const { data: conversations } = await supabase
      .from('conversations')
      .select('figure_id, figure_name')
      .neq('figure_id', null)
      .order('updated_at', { ascending: false })
      .limit(10);

    const recentFigures = Array.from(
      new Map(conversations?.map(c => [c.figure_id, c]) || []).values()
    );

    console.log(`Checked ${recentFigures.length} recent figures for data completeness`);

    return new Response(JSON.stringify({
      status: 'completed',
      health_check: healthResponse.data ? 'success' : 'failed',
      background_sync: syncResponse.data ? 'success' : 'failed',
      figures_monitored: recentFigures.length,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Automated data checker error:', error);
    
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 'error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});