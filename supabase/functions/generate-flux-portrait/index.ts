import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Replicate from "https://esm.sh/replicate@0.25.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { figureName, figureId } = await req.json();

    if (!figureName) {
      throw new Error('figureName is required');
    }

    console.log('🎨 Generating FLUX environmental portrait for:', figureName);

    // Check if we have a cached image
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Check cache first (v2 = environmental scenes, v1 = old portraits)
    const CACHE_VERSION = 'v2';
    const cacheResponse = await fetch(`${SUPABASE_URL}/rest/v1/avatar_image_cache?figure_id=eq.${figureId}&select=*`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    if (cacheResponse.ok) {
      const cached = await cacheResponse.json();
      // Only use cache if it has v2 (environmental) version
      if (cached && cached.length > 0 && cached[0].cloudinary_url && cached[0].cache_version === CACHE_VERSION) {
        console.log('✅ Using cached FLUX portrait:', cached[0].cloudinary_url);
        return new Response(JSON.stringify({
          imageUrl: cached[0].cloudinary_url,
          cached: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else if (cached && cached.length > 0) {
        console.log('🔄 Old cache version found, regenerating...');
      }
    }

    // Generate new environmental scene using Replicate FLUX
    const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY');
    if (!REPLICATE_API_KEY) {
      throw new Error('REPLICATE_API_KEY not configured');
    }

    const replicate = new Replicate({
      auth: REPLICATE_API_KEY,
    });

    const prompt = await generateEnvironmentalPrompt(figureName);
    console.log('📝 Environmental prompt:', prompt);

    console.log('🚀 Starting FLUX generation...');
    const output = await replicate.run(
      "black-forest-labs/flux-schnell",
      {
        input: {
          prompt: prompt,
          go_fast: true,
          megapixels: "1",
          num_outputs: 1,
          aspect_ratio: "1:1",
          output_format: "webp",
          output_quality: 90,
          num_inference_steps: 4
        }
      }
    ) as string[];

    if (!output || output.length === 0) {
      throw new Error('No image generated from FLUX');
    }

    const imageUrl = output[0];
    console.log('✅ FLUX environmental portrait generated:', imageUrl);

    // Cache the image
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/avatar_image_cache`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          figure_id: figureId,
          figure_name: figureName,
          cloudinary_url: imageUrl,
          visual_prompt: prompt,
          cache_version: 'v2', // Mark as environmental scene version
        }),
      });
      console.log('💾 FLUX portrait cached successfully');
    } catch (cacheError) {
      console.error('Cache save failed:', cacheError);
      // Continue anyway - cache failure isn't critical
    }

    return new Response(JSON.stringify({
      imageUrl,
      cached: false,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in FLUX generation:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateEnvironmentalPrompt(figureName: string): Promise<string> {
  // Map historical figures to their characteristic environments
  const environments: Record<string, string> = {
    'Albert Einstein': 'in his Princeton office, 1940s, sitting at a wooden desk covered with physics papers and equations, chalkboards with E=mc² and relativity formulas visible in the background, warm afternoon sunlight streaming through tall windows, period-accurate dark suit, messy gray hair, thoughtful expression',
    'Marie Curie': 'in her laboratory at the Radium Institute, Paris, early 1900s, surrounded by glass beakers and scientific equipment, wearing a dark Victorian-era dress with a white lab coat, soft natural lighting from large windows, determined expression',
    'Leonardo da Vinci': 'in his Renaissance workshop studio, Florence, 1490s, surrounded by anatomical sketches and engineering drawings, wooden work tables with brushes and sketches, warm candlelight, wearing period-accurate Renaissance clothing',
    'Cleopatra': 'in the royal palace of Alexandria, ancient Egypt, adorned with gold jewelry and royal headdress, ornate Egyptian columns and hieroglyphs in the background, warm golden lighting, regal posture',
    'Winston Churchill': 'in the Cabinet War Rooms, London, 1940s, sitting at a desk with maps and documents, cigar in hand, wearing a dark suit, dramatic wartime lighting, determined expression',
    'Abraham Lincoln': 'in the White House office, 1860s, sitting at a wooden desk with documents and quill pen, period-accurate dark suit with bow tie, warm candlelight, thoughtful expression',
    'Mahatma Gandhi': 'sitting cross-legged in a simple room with white walls, wearing traditional dhoti and glasses, spinning wheel visible in the background, soft natural daylight, peaceful expression',
    'Nelson Mandela': 'in his office during the 1990s, wearing a colorful traditional shirt, South African flag visible, warm professional lighting, confident and dignified expression',
    'Martin Luther King Jr.': 'at his desk preparing a speech, 1960s, wearing a dark suit and tie, American flag in the background, warm office lighting, inspired expression',
    'Rosa Parks': 'sitting with dignity, 1950s, wearing period-accurate modest dress, soft portrait lighting, determined and peaceful expression',
    'Nikola Tesla': 'in his laboratory workshop, 1890s, surrounded by electrical coils and scientific equipment, dramatic lighting with electrical sparks visible in the background, period-accurate dark suit, intense focused expression',
    'Charles Darwin': 'in his study at Down House, 1870s, surrounded by specimen jars and botanical samples, writing desk covered with notes, warm natural lighting, white beard, contemplative expression',
    'Jane Austen': 'in her writing room, early 1800s England, sitting at a small wooden writing desk with quill and papers, wearing a Regency-era dress, soft natural window lighting, thoughtful expression',
    'Galileo Galilei': 'in his observatory tower, 1630s Italy, with telescope and astronomical charts, wearing Renaissance-era clothing, dramatic lighting from candles and the night sky visible through windows',
    'Shakespeare': 'in his writing chamber at the Globe Theatre, 1600s, wooden desk covered with manuscripts and quill pens, Tudor-era clothing, warm candlelight, creative expression',
    'Socrates': 'in an ancient Greek courtyard, 5th century BC Athens, wearing traditional toga, stone columns and Mediterranean sunlight, surrounded by scrolls, engaged in thought',
    'Confucius': 'in a traditional Chinese study, ancient China, wearing traditional scholar robes, bamboo scrolls and calligraphy visible, soft natural lighting, wise expression',
    'Buddha': 'meditating under the Bodhi tree, ancient India, wearing simple robes, peaceful garden setting with soft dappled sunlight, serene expression',
    'Mozart': 'at his harpsichord in 18th century Vienna, wearing period-accurate powdered wig and ornate coat, sheet music scattered around, warm candlelit room, passionate expression',
    'Beethoven': 'in his chaotic music studio, early 1800s Vienna, at the piano surrounded by scattered sheet music, wearing disheveled period clothing, dramatic lighting, intense expression',
    'Frida Kahlo': 'in her Casa Azul studio, 1940s Mexico, surrounded by colorful paintings and Mexican folk art, wearing traditional Tehuana dress with flowers in her hair, vibrant natural lighting',
    'Van Gogh': 'in his artist studio, 1880s France, surrounded by canvases and paint tubes, wearing paint-stained clothes, dramatic sunlight through windows, passionate expression',
    'Pablo Picasso': 'in his Montmartre studio, 1920s Paris, surrounded by cubist paintings and sculptures, wearing a striped shirt, dramatic artistic lighting, creative intensity',
    'Ernest Hemingway': 'at his writing desk in Key West, 1930s, wearing a simple shirt, typewriter and papers visible, fishing trophies on the wall, warm Florida sunlight',
    'Virginia Woolf': 'in her Bloomsbury study, 1920s London, at her writing desk surrounded by books, wearing period-accurate dress, soft natural window lighting, contemplative expression',
    'Mark Twain': 'in his Hartford study, 1880s, at his desk with pen and papers, wearing white suit, smoking a cigar, warm lamp lighting, humorous expression',
    'Harriet Tubman': 'portrait with determined expression, 1860s, wearing period-accurate clothing, soft natural lighting, background suggesting the Underground Railroad era',
    'Frederick Douglass': 'in his study, 1870s, at a desk with books and papers, wearing formal Victorian suit, dramatic portrait lighting, powerful dignified expression',
    'Susan B. Anthony': 'in her office, 1890s, surrounded by suffrage pamphlets and documents, wearing Victorian-era dress, determined expression, natural window lighting',
    'Amelia Earhart': 'standing by her aircraft, 1930s, wearing flight jacket and goggles, airplane propeller visible in background, golden hour lighting, adventurous expression',
    'Neil Armstrong': 'in the NASA control room, 1960s, wearing astronaut suit, mission control equipment visible, professional lighting, focused determined expression',
    'Steve Jobs': 'in a minimalist modern office, 1990s, wearing black turtleneck and jeans, clean design aesthetic, Apple products visible, natural diffused lighting, visionary expression',
    'Elon Musk': 'in a futuristic workspace, modern era, surrounded by rockets and technology, wearing casual modern clothing, dramatic industrial lighting, innovative expression',
    'John F. Kennedy': 'in the Oval Office, early 1960s, sitting at the Resolute Desk with American flag and presidential seal visible, wearing a sharp dark navy suit with thin tie, warm professional lighting through the windows, confident and charismatic expression, iconic Kennedy profile',
  };

  // If we have a predefined environment, use it
  if (environments[figureName]) {
    const environmentDetail = environments[figureName];
    return `Photorealistic scene of ${figureName} ${environmentDetail}. Ultra high resolution, 8K quality, cinematic composition, historically accurate, masterpiece quality, photo-realistic environmental photography. The subject should be naturally positioned within their environment, with clear facial features visible for animation. Professional lighting and composition.`;
  }

  // Otherwise, use Lovable AI to generate a detailed environmental prompt
  console.log(`🤖 Generating AI prompt for ${figureName}...`);
  
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.warn('⚠️ LOVABLE_API_KEY not found, using generic fallback');
    const environmentDetail = `in their characteristic historical setting, period-accurate clothing and environment, warm professional lighting, determined expression`;
    return `Photorealistic scene of ${figureName} ${environmentDetail}. Ultra high resolution, 8K quality, cinematic composition, historically accurate, masterpiece quality, photo-realistic environmental photography. The subject should be naturally positioned within their environment, with clear facial features visible for animation. Professional lighting and composition.`;
  }

  try {
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{
          role: 'user',
          content: `Generate a detailed, vivid environmental scene description for a photorealistic portrait of ${figureName}. Include:
1. Their most iconic location/setting (e.g., office, lab, studio, battlefield)
2. Specific time period and era details
3. Period-accurate clothing description
4. Characteristic objects, tools, or props associated with them
5. Lighting style appropriate to the era
6. Their typical expression or demeanor

Format: Write a single flowing description starting with "in [location], [time period]..." Do NOT include the person's name. Just describe the environment, clothing, and scene. Maximum 60 words.

Example format: "in his Princeton office, 1940s, sitting at a wooden desk covered with physics papers and equations, chalkboards with formulas visible in the background, warm afternoon sunlight streaming through tall windows, period-accurate dark suit, messy gray hair, thoughtful expression"`
        }]
      })
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiGeneratedDetail = aiData.choices?.[0]?.message?.content?.trim();
    
    if (!aiGeneratedDetail) {
      throw new Error('No content in AI response');
    }

    console.log(`✅ AI-generated detail: ${aiGeneratedDetail}`);
    
    return `Photorealistic scene of ${figureName} ${aiGeneratedDetail}. Ultra high resolution, 8K quality, cinematic composition, historically accurate, masterpiece quality, photo-realistic environmental photography. The subject should be naturally positioned within their environment, with clear facial features visible for animation. Professional lighting and composition.`;
  } catch (error) {
    console.error('❌ AI prompt generation failed:', error);
    // Fallback to generic prompt
    const environmentDetail = `in their characteristic historical setting, period-accurate clothing and environment, warm professional lighting, determined expression`;
    return `Photorealistic scene of ${figureName} ${environmentDetail}. Ultra high resolution, 8K quality, cinematic composition, historically accurate, masterpiece quality, photo-realistic environmental photography. The subject should be naturally positioned within their environment, with clear facial features visible for animation. Professional lighting and composition.`;
  }
}
