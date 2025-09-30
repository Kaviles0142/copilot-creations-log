import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Play, Mic, Download, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface ClonedVoice {
  id: string;
  figure_name: string;
  voice_id: string;
  voice_name: string;
  source_description: string | null;
  audio_quality_score: number | null;
  provider?: string | null;
  is_active: boolean | null;
  created_at: string;
  source_url?: string | null;
  updated_at?: string;
  figure_id: string;
}

interface VoiceCloningManagerProps {
  figureName?: string;
  figureId?: string;
}

const VoiceCloningManager: React.FC<VoiceCloningManagerProps> = ({ 
  figureName = "Historical Figure", 
  figureId = "default-figure" 
}) => {
  const { toast } = useToast();
  const [isCloning, setIsCloning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [voiceName, setVoiceName] = useState<string>('');
  const [testText, setTestText] = useState<string>("Hello, I am speaking with my cloned voice. This is a test of the voice cloning technology.");
  const [clonedVoices, setClonedVoices] = useState<ClonedVoice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [generatedAudio, setGeneratedAudio] = useState<string>('');

  useEffect(() => {
    loadClonedVoices();
  }, [figureId]);

  const loadClonedVoices = async () => {
    try {
      const { data, error } = await supabase
        .from('cloned_voices')
        .select('*')
        .eq('figure_id', figureId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClonedVoices(data || []);
    } catch (error) {
      console.error('Error loading cloned voices:', error);
      toast({
        title: "Error",
        description: "Failed to load cloned voices",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('audio/')) {
        setAudioFile(file);
        setAudioUrl(''); // Clear URL when file is selected
        setVoiceName(file.name.replace(/\.[^/.]+$/, '') + '_clone');
      } else {
        toast({
          title: "Invalid File",
          description: "Please select an audio file",
          variant: "destructive",
        });
      }
    }
  };

  const uploadAudioFile = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `voice-samples/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data: urlData } = await supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  };

  const cloneVoiceWithResemble = async () => {
    if (!audioFile && !audioUrl) {
      toast({
        title: "Missing Audio",
        description: "Please provide an audio file or URL",
        variant: "destructive",
      });
      return;
    }

    setIsCloning(true);
    try {
      let finalAudioUrl = audioUrl;
      
      // Upload file if provided instead of URL
      if (audioFile) {
        finalAudioUrl = await uploadAudioFile(audioFile);
      }

      const { data, error } = await supabase.functions.invoke('resemble-voice-clone', {
        body: {
          figureName: voiceName || figureName,
          figureId: figureId,
          audioUrl: finalAudioUrl
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Voice Cloned Successfully!",
        description: `Created voice: ${data.voice_name}`,
      });

      // Refresh the voices list
      await loadClonedVoices();
      
      // Clear form
      setAudioFile(null);
      setAudioUrl('');
      setVoiceName('');

    } catch (error) {
      console.error('Voice cloning error:', error);
      toast({
        title: "Cloning Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsCloning(false);
    }
  };

  const cloneVoiceWithElevenLabs = async () => {
    if (!audioFile && !audioUrl) {
      toast({
        title: "Missing Audio",
        description: "Please provide an audio file or URL",
        variant: "destructive",
      });
      return;
    }

    setIsCloning(true);
    try {
      let finalAudioUrl = audioUrl;
      
      if (audioFile) {
        finalAudioUrl = await uploadAudioFile(audioFile);
      }

      const { data, error } = await supabase.functions.invoke('create-voice-clone', {
        body: {
          audioUrl: finalAudioUrl,
          voiceName: voiceName || `${figureName}_clone`,
          description: `Cloned voice for ${figureName}`
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      // Store in historical_voices table
      const { error: insertError } = await supabase
        .from('historical_voices')
        .insert({
          voice_id: data.voiceId,
          voice_name: voiceName || `${figureName}_clone`,
          description: `ElevenLabs cloned voice for ${figureName}`,
          is_cloned: true,
          figure_id: figureId
        });

      if (insertError) {
        console.error('Error storing voice data:', insertError);
      }

      toast({
        title: "Voice Cloned with ElevenLabs!",
        description: `Created voice ID: ${data.voiceId}`,
      });

      await loadClonedVoices();
      setAudioFile(null);
      setAudioUrl('');
      setVoiceName('');

    } catch (error) {
      console.error('ElevenLabs cloning error:', error);
      toast({
        title: "ElevenLabs Cloning Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsCloning(false);
    }
  };

  const generateSpeech = async () => {
    if (!selectedVoiceId || !testText.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select a voice and enter text",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('resemble-text-to-speech', {
        body: {
          text: testText,
          voice: selectedVoiceId
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setGeneratedAudio(data.audioContent);
      
      toast({
        title: "Speech Generated!",
        description: data.fallback ? "Generated with fallback method" : "Generated successfully",
      });

    } catch (error) {
      console.error('Speech generation error:', error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const playGeneratedAudio = () => {
    if (generatedAudio) {
      const audio = new Audio(`data:audio/mp3;base64,${generatedAudio}`);
      audio.play().catch(error => {
        console.error('Audio play error:', error);
        toast({
          title: "Playback Error",
          description: "Failed to play audio",
          variant: "destructive",
        });
      });
    }
  };

  const downloadGeneratedAudio = () => {
    if (generatedAudio) {
      const link = document.createElement('a');
      link.href = `data:audio/mp3;base64,${generatedAudio}`;
      link.download = `${figureName}_generated_speech.mp3`;
      link.click();
    }
  };

  return (
    <div className="space-y-6">
      {/* Voice Cloning Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Clone Voice for {figureName}
          </CardTitle>
          <CardDescription>
            Upload an audio sample or provide a URL to clone this historical figure's voice
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="voice-name">Voice Name</Label>
              <Input
                id="voice-name"
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                placeholder={`${figureName} Clone`}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audio-file">Audio File</Label>
              <Input
                id="audio-file"
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="audio-url">Or Audio URL</Label>
            <Input
              id="audio-url"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              placeholder="https://example.com/audio.mp3"
              disabled={!!audioFile}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={cloneVoiceWithResemble}
              disabled={isCloning || (!audioFile && !audioUrl)}
              className="flex-1"
            >
              {isCloning ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Clone with Resemble AI
            </Button>
            <Button
              onClick={cloneVoiceWithElevenLabs}
              disabled={isCloning || (!audioFile && !audioUrl)}
              variant="outline"
              className="flex-1"
            >
              {isCloning ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Clone with ElevenLabs
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing Voices Section */}
      <Card>
        <CardHeader>
          <CardTitle>Cloned Voices</CardTitle>
          <CardDescription>
            Available voice clones for {figureName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clonedVoices.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No cloned voices yet. Create one using the form above.
            </p>
          ) : (
            <div className="grid gap-3">
              {clonedVoices.map((voice) => (
                <div
                  key={voice.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedVoiceId === voice.voice_id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedVoiceId(voice.voice_id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{voice.voice_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {voice.source_description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={voice.provider === 'resemble' ? 'default' : 'secondary'}>
                        {voice.provider}
                      </Badge>
                      <Badge variant="outline">
                        Quality: {voice.audio_quality_score}%
                      </Badge>
                      {voice.is_active ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Speech Generation Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Test Voice Generation
          </CardTitle>
          <CardDescription>
            Generate speech using the selected cloned voice
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-text">Text to Speak</Label>
            <Textarea
              id="test-text"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Enter text to generate speech..."
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={generateSpeech}
              disabled={isGenerating || !selectedVoiceId || !testText.trim()}
              className="flex-1"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Mic className="h-4 w-4 mr-2" />
              )}
              Generate Speech
            </Button>
            
            {generatedAudio && (
              <>
                <Button
                  onClick={playGeneratedAudio}
                  variant="outline"
                  size="icon"
                >
                  <Play className="h-4 w-4" />
                </Button>
                <Button
                  onClick={downloadGeneratedAudio}
                  variant="outline"
                  size="icon"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>

          {selectedVoiceId && (
            <p className="text-sm text-muted-foreground">
              Selected Voice: {clonedVoices.find(v => v.voice_id === selectedVoiceId)?.voice_name}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VoiceCloningManager;
