import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧪 Testing Cloudinary connection...');

    const CLOUDINARY_CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME')?.trim();
    const CLOUDINARY_API_KEY = Deno.env.get('CLOUDINARY_API_KEY')?.trim();
    const CLOUDINARY_API_SECRET = Deno.env.get('CLOUDINARY_API_SECRET')?.trim();

    // Check if credentials exist
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      const missing = [];
      if (!CLOUDINARY_CLOUD_NAME) missing.push('CLOUDINARY_CLOUD_NAME');
      if (!CLOUDINARY_API_KEY) missing.push('CLOUDINARY_API_KEY');
      if (!CLOUDINARY_API_SECRET) missing.push('CLOUDINARY_API_SECRET');
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Missing credentials: ${missing.join(', ')}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ All credentials found');
    console.log('Cloud name:', CLOUDINARY_CLOUD_NAME);

    // Create a simple 1x1 pixel test image (red pixel PNG)
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    const testImageBuffer = Uint8Array.from(atob(testImageBase64), c => c.charCodeAt(0));

    // Create Cloudinary signature
    const timestamp = Math.round(Date.now() / 1000);
    const publicId = `test/connection-test-${timestamp}`;
    
    const signatureString = `public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
    
    const encoder = new TextEncoder();
    const data = encoder.encode(signatureString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    console.log('📤 Attempting upload to Cloudinary...');

    // Prepare form data
    const formData = new FormData();
    formData.append('file', new Blob([testImageBuffer], { type: 'image/png' }));
    formData.append('api_key', CLOUDINARY_API_KEY);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);
    formData.append('public_id', publicId);

    const cloudinaryUploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
    const cloudinaryResponse = await fetch(cloudinaryUploadUrl, {
      method: 'POST',
      body: formData
    });

    if (!cloudinaryResponse.ok) {
      const errorText = await cloudinaryResponse.text();
      console.error('❌ Cloudinary upload failed:', errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Upload failed: ${errorText}`,
          status: cloudinaryResponse.status
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cloudinaryData = await cloudinaryResponse.json();
    console.log('✅ Upload successful!');
    console.log('Image URL:', cloudinaryData.secure_url);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cloudinary connection successful!',
        cloudName: CLOUDINARY_CLOUD_NAME,
        testImageUrl: cloudinaryData.secure_url,
        publicId: cloudinaryData.public_id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Test failed:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
