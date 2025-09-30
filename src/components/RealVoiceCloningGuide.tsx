import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExternalLink, Download, Server, Cpu, HardDrive } from 'lucide-react';

interface RealVoiceCloningGuideProps {
  figure: {
    id: string;
    name: string;
  };
}

export const RealVoiceCloningGuide: React.FC<RealVoiceCloningGuideProps> = ({ figure }) => {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          Real Voice Cloning Setup Guide
          <Badge variant="outline">External Infrastructure Required</Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <Alert>
          <ExternalLink className="h-4 w-4" />
          <AlertDescription>
            Real voice cloning requires external infrastructure. Here's how to set it up for {figure.name}.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              Step 1: Server Setup
            </h3>
            <div className="text-sm space-y-2">
              <p><strong>Requirements:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>GPU server (AWS/GCP/Azure with NVIDIA GPU)</li>
                <li>CUDA 11.8+ and PyTorch GPU support</li>
                <li>16GB+ VRAM for high-quality training</li>
                <li>Python 3.9+ environment</li>
              </ul>
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Download className="h-4 w-4" />
              Step 2: Install RVC Framework
            </h3>
            <div className="text-sm space-y-2">
              <div className="bg-gray-50 p-3 rounded font-mono text-xs">
                <div>git clone https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI.git</div>
                <div>cd Retrieval-based-Voice-Conversion-WebUI</div>
                <div>pip install -r requirements.txt</div>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Step 3: Prepare Training Data for {figure.name}
            </h3>
            <div className="text-sm space-y-2">
              <p><strong>Audio Requirements:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>30+ minutes of clean speech audio</li>
                <li>Single speaker only (no background voices)</li>
                <li>44.1kHz or 48kHz sample rate</li>
                <li>Segments of 2-10 seconds each</li>
              </ul>
              
              <p className="mt-3"><strong>Recommended Sources for {figure.name}:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Historical speech recordings from Archive.org</li>
                <li>Documentary audio tracks</li>
                <li>Radio broadcast archives</li>
                <li>Press conference recordings</li>
              </ul>
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Step 4: Training Process</h3>
            <div className="text-sm space-y-2">
              <p><strong>RVC Training Steps:</strong></p>
              <ol className="list-decimal list-inside ml-4 space-y-1">
                <li>Process audio through RVC preprocessing</li>
                <li>Extract features using HuBERT/ContentVec</li>
                <li>Train the voice model (4-8 hours on GPU)</li>
                <li>Generate index file for voice similarity</li>
                <li>Test with sample text</li>
              </ol>
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Step 5: API Integration</h3>
            <div className="text-sm space-y-2">
              <p>Create a FastAPI endpoint to serve your trained model:</p>
              <div className="bg-gray-50 p-3 rounded font-mono text-xs">
                <div>@app.post("/synthesize/{figure.id}")</div>
                <div>async def synthesize_voice(text: str):</div>
                <div>    # Load trained {figure.name} model</div>
                <div>    # Generate audio with RVC</div>
                <div>    return audio_response</div>
              </div>
            </div>
          </div>
        </div>

        <Alert>
          <AlertDescription>
            <strong>Alternative:</strong> For immediate results, consider using ElevenLabs Professional plan ($99/month) 
            which includes voice cloning capabilities, or Resemble AI Business plan for programmatic access.
          </AlertDescription>
        </Alert>

        <div className="pt-4 border-t">
          <Button variant="outline" className="w-full" asChild>
            <a href="https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              View RVC Documentation
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};