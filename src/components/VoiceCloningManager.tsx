import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Search, Play, Mic, Download, Loader2, CheckCircle, AlertCircle, Youtube, Globe } from 'lucide-react';

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

interface AudioSource {
  title: string;
  url: string;
  duration?: string;
  description?: string;
  source: 'youtube' | 'web';
  thumbnail?: string;
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
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<AudioSource[]>([]);
  const [selectedAudioUrl, setSelectedAudioUrl] = useState<string>('');
  const [testText, setTestText] = useState<string>("Hello, I am speaking with my cloned voice. This is a test of the voice cloning technology.");
  const [clonedVoices, setClonedVoices] = useState<ClonedVoice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [generatedAudio, setGeneratedAudio] = useState<string>('');

  useEffect(() => {
    loadClonedVoices();
    searchForHistoricalAudio();
  }, [figureId]);

  const loadClonedVoices = async () => {
    // Option B: Don't load from database - cloned voices are not stored
    // Only fresh API searches + 4 fallbacks are used
    setClonedVoices([]);
  };

  const searchForHistoricalAudio = async () => {
    setIsSearching(true);
    try {
      // Search YouTube for historical speeches
      const youtubeResults = await searchYouTube();
      
      // Search web for historical audio files
      const webResults = await searchWeb();
      
      setSearchResults([...youtubeResults, ...webResults]);
      
    } catch (error) {
      console.error('Error searching for audio:', error);
      toast({
        title: "Search Error",
        description: "Failed to find historical audio sources",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const searchYouTube = async (): Promise<AudioSource[]> => {
    try {
      const { data, error } = await supabase.functions.invoke('youtube-search', {
        body: {
          query: `${figureName} speech original recording historical`
        }
      });

      if (error) throw error;

      return (data?.videos || []).map((video: any) => ({
        title: video.title,
        url: video.url,
        duration: video.duration,
        description: video.description,
        source: 'youtube' as const,
        thumbnail: video.thumbnail
      }));
    } catch (error) {
      console.error('YouTube search error:', error);
      return [];
    }
  };

  const searchWeb = async (): Promise<AudioSource[]> => {
    // Web search for audio removed (SerpAPI dependency removed)
    // Users can manually upload audio files instead
    console.log('Web search for audio is no longer available - use manual upload instead');
    return [];
  };

  const extractYouTubeAudio = async (videoUrl: string): Promise<string> => {
    const { data, error } = await supabase.functions.invoke('extract-youtube-audio', {
      body: { videoUrl }
    });

    if (error) throw error;
    if (data.error) throw new Error(data.error);

    return data.audioUrl;
  };

  const cloneVoiceFromSource = async (audioSource: AudioSource) => {
    setIsCloning(true);
    try {
      let audioUrl = audioSource.url;

      // If it's a YouTube video, extract audio first
      if (audioSource.source === 'youtube') {
        toast({
          title: "Extracting Audio",
          description: "Extracting audio from YouTube video...",
        });
        audioUrl = await extractYouTubeAudio(audioSource.url);
      }

      setSelectedAudioUrl(audioUrl);

      // Clone with Resemble AI
      const { data, error } = await supabase.functions.invoke('resemble-voice-clone', {
        body: {
          figureName: figureName,
          figureId: figureId,
          audioUrl: audioUrl
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Voice Cloned Successfully!",
        description: `Created voice: ${data.voice_name} from ${audioSource.title}`,
      });

      // Refresh the voices list
      await loadClonedVoices();

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
      // Use ElevenLabs for reliable TTS
      const { data, error } = await supabase.functions.invoke('elevenlabs-text-to-speech', {
        body: {
          text: testText,
          voice: selectedVoiceId || 'Brian' // Default to Brian if no voice selected
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
      {/* Auto-Discovery Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Discover Historical Audio for {figureName}
          </CardTitle>
          <CardDescription>
            Automatically searching YouTube and the web for authentic recordings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button
              onClick={searchForHistoricalAudio}
              disabled={isSearching}
              variant="outline"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Refresh Search
            </Button>
          </div>

          {isSearching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Searching for historical recordings...</span>
            </div>
          ) : searchResults.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No audio sources found. Try adjusting the search terms.
            </p>
          ) : (
            <div className="grid gap-4">
              {searchResults.map((source, index) => (
                <div
                  key={index}
                  className="p-4 border rounded-lg hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {source.source === 'youtube' ? (
                          <Youtube className="h-4 w-4 text-red-500" />
                        ) : (
                          <Globe className="h-4 w-4 text-blue-500" />
                        )}
                        <h4 className="font-medium">{source.title}</h4>
                      </div>
                      {source.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {source.description.slice(0, 150)}...
                        </p>
                      )}
                      {source.duration && (
                        <Badge variant="outline" className="text-xs">
                          {source.duration}
                        </Badge>
                      )}
                    </div>
                    <Button
                      onClick={() => cloneVoiceFromSource(source)}
                      disabled={isCloning}
                      size="sm"
                    >
                      {isCloning ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Clone Voice"
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
              No cloned voices yet. Use the discovery section above to create one.
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
                      {voice.audio_quality_score && (
                        <Badge variant="outline">
                          Quality: {voice.audio_quality_score}%
                        </Badge>
                      )}
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
