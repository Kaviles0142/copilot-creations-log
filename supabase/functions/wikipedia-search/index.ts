import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Use a compliant User-Agent as per Wikipedia's API etiquette
// https://meta.wikimedia.org/wiki/User-Agent_policy
const WIKIPEDIA_HEADERS = {
  'User-Agent': 'HistoricalChatBot/1.0 (https://lovable.dev; contact@lovable.dev) Deno/1.0',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, limit = 5 } = await req.json();

    if (!query) {
      throw new Error('Search query is required');
    }

    console.log(`Searching Wikipedia for: "${query}"`);

    // Try REST API first (different rate limiting than MediaWiki API)
    const restApiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query.replace(/ /g, '_'))}`;
    console.log(`[DEBUG] Trying REST API first: ${restApiUrl}`);
    
    const restResponse = await fetch(restApiUrl, { headers: WIKIPEDIA_HEADERS });
    console.log(`[DEBUG] REST API status: ${restResponse.status}`);
    
    if (restResponse.ok) {
      const data = await restResponse.json();
      console.log(`Found Wikipedia article via REST API: ${data.title}`);
      
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            title: data.title,
            extract: data.extract,
            url: data.content_urls?.desktop?.page,
            thumbnail: data.thumbnail?.source,
            description: data.description
          },
          searchResults: [{
            title: data.title,
            snippet: data.description || '',
            url: data.content_urls?.desktop?.page
          }]
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // If Wikipedia is blocked (403), try Wikidata, then DuckDuckGo (non-Wikimedia) as final fallback.
    if (restResponse.status === 403) {
      console.log(`[DEBUG] Wikipedia blocked (403), trying Wikidata API...`);

      // --- Wikidata fallback (may also be blocked by Wikimedia) ---
      const wikidataSearchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&limit=1&format=json&origin=*`;
      const wikidataSearchResponse = await fetch(wikidataSearchUrl, { headers: WIKIPEDIA_HEADERS });
      console.log(`[DEBUG] Wikidata search status: ${wikidataSearchResponse.status}`);

      if (wikidataSearchResponse.ok) {
        const wikidataSearch = await wikidataSearchResponse.json();

        if (wikidataSearch.search && wikidataSearch.search.length > 0) {
          const entityId = wikidataSearch.search[0].id;
          const entityLabel = wikidataSearch.search[0].label;
          const entityDescription = wikidataSearch.search[0].description;

          console.log(`[DEBUG] Found Wikidata entity: ${entityId} - ${entityLabel}`);

          const wikidataEntityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityId}&props=sitelinks|descriptions|claims&languages=en&format=json&origin=*`;
          const wikidataEntityResponse = await fetch(wikidataEntityUrl, { headers: WIKIPEDIA_HEADERS });
          console.log(`[DEBUG] Wikidata entity status: ${wikidataEntityResponse.status}`);

          if (wikidataEntityResponse.ok) {
            const entityData = await wikidataEntityResponse.json();
            const entity = entityData.entities?.[entityId];

            const wikipediaTitle = entity?.sitelinks?.enwiki?.title;
            const wikipediaUrl = wikipediaTitle
              ? `https://en.wikipedia.org/wiki/${encodeURIComponent(wikipediaTitle.replace(/ /g, '_'))}`
              : null;

            let thumbnail = null;
            const imageClaimP18 = entity?.claims?.P18;
            if (imageClaimP18 && imageClaimP18[0]?.mainsnak?.datavalue?.value) {
              const imageName = imageClaimP18[0].mainsnak.datavalue.value;
              thumbnail = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageName)}?width=300`;
            }

            console.log(`Found via Wikidata: ${entityLabel}`);

            return new Response(
              JSON.stringify({
                success: true,
                data: {
                  title: entityLabel,
                  extract: entityDescription || `Historical figure: ${entityLabel}`,
                  url: wikipediaUrl,
                  thumbnail,
                  description: entityDescription,
                },
                searchResults: [{
                  title: entityLabel,
                  snippet: entityDescription || '',
                  url: wikipediaUrl,
                }],
                source: 'wikidata',
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
          }
        }
      }

      // --- DuckDuckGo Instant Answer fallback (non-Wikimedia; no API key) ---
      console.log(`[DEBUG] Wikidata unavailable/blocked; trying DuckDuckGo Instant Answer API...`);
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;
      const ddgResp = await fetch(ddgUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': WIKIPEDIA_HEADERS['User-Agent'],
        },
      });
      console.log(`[DEBUG] DuckDuckGo Instant Answer status: ${ddgResp.status}`);

      if (ddgResp.ok) {
        const ddg = await ddgResp.json();

        const title = ddg.Heading || query;
        const baseExtract = ddg.AbstractText || ddg.Abstract || '';
        const baseUrl = ddg.AbstractURL || ddg.Redirect || null;
        const thumbnail = ddg.Image ? `https://duckduckgo.com${ddg.Image}` : null;

        let finalExtract = baseExtract;
        let finalUrl = baseUrl;

        if ((!finalExtract || finalExtract.trim().length === 0) && Array.isArray(ddg.RelatedTopics)) {
          const firstTopic = ddg.RelatedTopics.find((t: any) => t && typeof t.Text === 'string');
          if (firstTopic) {
            finalExtract = firstTopic.Text;
            finalUrl = firstTopic.FirstURL || finalUrl;
          }
        }

        if (finalExtract && finalExtract.trim().length > 0) {
          console.log(`[DEBUG] Found via DuckDuckGo Instant Answer: ${title}`);
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                title,
                extract: finalExtract,
                url: finalUrl,
                thumbnail,
                description: ddg.AbstractSource || 'DuckDuckGo',
              },
              searchResults: [{
                title,
                snippet: finalExtract,
                url: finalUrl,
              }],
              source: 'duckduckgo_instant_answer',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        console.log(`[DEBUG] DuckDuckGo Instant Answer returned no usable abstract for: ${query}`);
      }
    }
    
    // If REST API fails for other reasons, try OpenSearch API as fallback
    const opensearchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&format=json&search=${encodeURIComponent(query)}&limit=${limit}&origin=*`;
    console.log(`[DEBUG] REST API failed (${restResponse.status}), trying OpenSearch: ${opensearchUrl}`);
    
    const opensearchResponse = await fetch(opensearchUrl, { headers: WIKIPEDIA_HEADERS });

    console.log(`[DEBUG] OpenSearch response status: ${opensearchResponse.status}`);
    
    if (opensearchResponse.ok) {
      const opensearchText = await opensearchResponse.text();
      console.log(`[DEBUG] OpenSearch raw response (first 500 chars): ${opensearchText.substring(0, 500)}`);
      
      let opensearchData;
      try {
        opensearchData = JSON.parse(opensearchText);
      } catch (parseError) {
        console.error(`[DEBUG] OpenSearch JSON parse error: ${parseError}`);
        // Continue to fallback
      }
      
      if (opensearchData && opensearchData[1]?.length > 0) {
        const firstTitle = opensearchData[1][0];
        console.log(`OpenSearch suggested: ${firstTitle}`);
        
        // Get detailed info for the best match
        const detailUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstTitle)}`;
        console.log(`[DEBUG] Detail URL: ${detailUrl}`);
        
        const detailResponse = await fetch(detailUrl, { headers: WIKIPEDIA_HEADERS });

        console.log(`[DEBUG] Detail response status: ${detailResponse.status}`);

        if (detailResponse.ok) {
          const detailData = await detailResponse.json();
          console.log(`Found Wikipedia article: ${detailData.title}`);
          
          // Build search results from opensearch data
          const searchResults = opensearchData[1].map((title: string, index: number) => ({
            title: title,
            snippet: opensearchData[2][index] || '',
            url: opensearchData[3][index] || `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
          }));
          
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                title: detailData.title,
                extract: detailData.extract,
                url: detailData.content_urls?.desktop?.page,
                thumbnail: detailData.thumbnail?.source,
                description: detailData.description
              },
              searchResults: searchResults
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        } else {
          const detailErrorText = await detailResponse.text();
          console.error(`[DEBUG] Detail API failed: ${detailResponse.status} - ${detailErrorText.substring(0, 300)}`);
        }
      } else {
        console.log(`[DEBUG] OpenSearch returned no results. Data structure: ${JSON.stringify(opensearchData)}`);
      }
    } else {
      const errorText = await opensearchResponse.text();
      console.error(`[DEBUG] OpenSearch API failed: ${opensearchResponse.status} - ${errorText.substring(0, 300)}`);
    }

    // Fallback to direct page lookup if opensearch doesn't work
    const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    
    const searchResponse = await fetch(searchUrl, { headers: WIKIPEDIA_HEADERS });

    if (!searchResponse.ok) {

      // No results found - return success with empty data instead of error
      console.log(`No Wikipedia articles found for: "${query}"`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: null,
          message: 'No Wikipedia articles found for this query'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await searchResponse.json();
    console.log(`Found Wikipedia article: ${data.title}`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          title: data.title,
          extract: data.extract,
          url: data.content_urls?.desktop?.page,
          thumbnail: data.thumbnail?.source,
          description: data.description
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error searching Wikipedia:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: true,  // Changed to true to avoid breaking the UI
        data: null,
        error: errorMessage 
      }),
      {
        status: 200,  // Changed to 200 to avoid throwing errors in UI
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});