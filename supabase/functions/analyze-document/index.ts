import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const figureName = formData.get('figureName') as string;
    const figureId = formData.get('figureId') as string;
    const userPrompt = formData.get('prompt') as string || 'Please review this document and provide your feedback.';

    if (!file) {
      throw new Error('No file provided');
    }
    if (!figureName) {
      throw new Error('Figure name is required');
    }

    console.log(`📄 Analyzing document for ${figureName}: ${file.name} (${file.size} bytes)`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const base64Content = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // For PDFs, we'll extract text summary and analyze
    const systemPrompt = `You are ${figureName}, a renowned historical figure. A user has shared a document with you for feedback.

Your role:
- Provide thoughtful, constructive feedback from your unique perspective
- Draw on your historical expertise and achievements
- Be encouraging but also offer specific suggestions for improvement
- Reference your own work or experiences when relevant
- Keep your response conversational but substantive (3-5 paragraphs)

Document filename: ${file.name}
Document type: ${file.type}

The user's request: ${userPrompt}`;

    // Call Lovable AI with document context
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: [
              { type: 'text', text: `Please review this document and provide your feedback as ${figureName}. The document is "${file.name}".` },
              ...(file.type === 'application/pdf' ? [{
                type: 'file',
                file: {
                  filename: file.name,
                  file_data: `data:${file.type};base64,${base64Content}`
                }
              }] : [])
            ]
          }
        ],
      })
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited, please try again' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI error: ${errorText}`);
    }

    const data = await response.json();
    const feedback = data.choices?.[0]?.message?.content || 'I apologize, but I was unable to analyze the document.';

    console.log(`✅ ${figureName} provided feedback`);

    return new Response(JSON.stringify({
      speakerName: figureName,
      figureId,
      content: feedback,
      documentName: file.name,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
