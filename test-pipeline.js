// Quick test script to verify pipeline functionality
// This file can be deleted after testing

import { supabase } from './src/integrations/supabase/client.js';

async function testPipeline() {
  console.log('Testing automated voice pipeline...');
  
  try {
    // Test with Martin Luther King Jr.
    const { data, error } = await supabase.functions.invoke('automated-voice-pipeline', {
      body: {
        figureId: 'martin-luther-king-jr',
        figureName: 'Martin Luther King Jr.',
        action: 'start_pipeline'
      }
    });

    if (error) {
      console.error('Pipeline error:', error);
      return;
    }

    console.log('Pipeline response:', data);
    
    if (data.success) {
      console.log('✅ Pipeline started successfully!');
      console.log('Pipeline ID:', data.pipelineId);
      
      // Wait a moment then check status
      setTimeout(async () => {
        const { data: statusData } = await supabase.functions.invoke('automated-voice-pipeline', {
          body: {
            figureId: 'martin-luther-king-jr',
            figureName: 'Martin Luther King Jr.',
            action: 'get_status'
          }
        });
        
        console.log('Pipeline status:', statusData);
      }, 2000);
    }
    
  } catch (err) {
    console.error('Test failed:', err);
  }
}

testPipeline();