import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Search, Play, Loader2, Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface FakeYouVoice {
  voiceToken: string;
  title: string;
  creator: string;
  botCommand: string | null;
  categories: string[];
  language: string;
}

interface FakeYouVoiceSelectorProps {
  onVoiceSelected?: (voiceToken: string, voiceTitle: string) => void;
}

export const FakeYouVoiceSelector: React.FC<FakeYouVoiceSelectorProps> = ({ 
  onVoiceSelected 
}) => {
  const [voices, setVoices] = useState<FakeYouVoice[]>([]);
  const [filteredVoices, setFilteredVoices] = useState<FakeYouVoice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<FakeYouVoice | null>(null);
  const [testText, setTestText] = useState('Hello, this is a test of my voice.');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [jobToken, setJobToken] = useState<string | null>(null);

  // Load voices on mount
  useEffect(() => {
    loadVoices();
  }, []);

  // Filter voices based on search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredVoices(voices);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredVoices(
        voices.filter(v => 
          v.title.toLowerCase().includes(term) ||
          v.creator.toLowerCase().includes(term)
        )
      );
    }
  }, [searchTerm, voices]);

  const loadVoices = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fakeyou-tts', {
        body: { action: 'list_voices' },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to load voices');

      setVoices(data.voices);
      console.log(`Loaded ${data.voices.length} FakeYou voices`);
    } catch (error) {
      console.error('Failed to load voices:', error);
      toast.error('Failed to load voices from FakeYou');
    } finally {
      setIsLoading(false);
    }
  };

  const syncVoicesToDatabase = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('fakeyou-tts', {
        body: { action: 'sync_voices' },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to sync voices');

      toast.success(`Synced ${data.syncedCount} voices to database`);
      console.log(`Synced ${data.syncedCount}/${data.totalVoices} voices`);
    } catch (error) {
      console.error('Failed to sync voices:', error);
      toast.error('Failed to sync voices to database');
    } finally {
      setIsSyncing(false);
    }
  };

  const selectVoice = (voice: FakeYouVoice) => {
    setSelectedVoice(voice);
    setGeneratedAudioUrl(null);
    if (onVoiceSelected) {
      onVoiceSelected(voice.voiceToken, voice.title);
    }
  };

  const generateTTS = async () => {
    if (!selectedVoice || !testText.trim()) {
      toast.error('Please select a voice and enter text');
      return;
    }

    setIsGenerating(true);
    setGeneratedAudioUrl(null);

    try {
      // Start TTS generation
      const { data, error } = await supabase.functions.invoke('fakeyou-tts', {
        body: {
          action: 'generate_tts',
          text: testText,
          voiceToken: selectedVoice.voiceToken,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to start TTS');

      const jobTokenValue = data.jobToken;
      setJobToken(jobTokenValue);
      toast.info('Generating audio... This may take 10-30 seconds');

      // Poll for completion
      await pollJobStatus(jobTokenValue);
    } catch (error) {
      console.error('TTS generation failed:', error);
      toast.error(error instanceof Error ? error.message : 'TTS generation failed');
      setIsGenerating(false);
    }
  };

  const pollJobStatus = async (jobTokenValue: string, attempts = 0) => {
    const maxAttempts = 60; // 60 attempts = 60 seconds max
    
    try {
      const { data, error } = await supabase.functions.invoke('fakeyou-tts', {
        body: {
          action: 'check_status',
          jobToken: jobTokenValue,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to check status');

      console.log(`Job status (attempt ${attempts + 1}): ${data.status}`);

      if (data.isComplete && data.audioUrl) {
        // Success!
        setGeneratedAudioUrl(data.audioUrl);
        setIsGenerating(false);
        toast.success('Audio generated successfully!');
        return;
      }

      if (data.isFailed) {
        throw new Error('TTS generation failed on FakeYou servers');
      }

      // Still processing, poll again
      if (attempts < maxAttempts) {
        setTimeout(() => {
          pollJobStatus(jobTokenValue, attempts + 1);
        }, 1000);
      } else {
        throw new Error('TTS generation timeout');
      }
    } catch (error) {
      console.error('Status polling failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to check status');
      setIsGenerating(false);
    }
  };

  const playAudio = () => {
    if (!generatedAudioUrl) return;
    const audio = new Audio(generatedAudioUrl);
    audio.play().catch(err => {
      console.error('Failed to play audio:', err);
      toast.error('Failed to play audio');
    });
  };

  const downloadAudio = () => {
    if (!generatedAudioUrl) return;
    const link = document.createElement('a');
    link.href = generatedAudioUrl;
    link.download = `${selectedVoice?.title || 'audio'}.wav`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Voice Search and List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>FakeYou Voice Library</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadVoices}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={syncVoicesToDatabase}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  'Sync to DB'
                )}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for historical figures, celebrities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Voice List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : filteredVoices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? 'No voices found matching your search' : 'No voices loaded'}
              </div>
            ) : (
              filteredVoices.slice(0, 50).map((voice) => (
                <button
                  key={voice.voiceToken}
                  onClick={() => selectVoice(voice)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedVoice?.voiceToken === voice.voiceToken
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  <div className="font-medium">{voice.title}</div>
                  <div className="text-sm text-muted-foreground">
                    by {voice.creator}
                  </div>
                  {voice.botCommand && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      /{voice.botCommand}
                    </Badge>
                  )}
                </button>
              ))
            )}
          </div>

          {filteredVoices.length > 50 && (
            <p className="text-sm text-muted-foreground text-center">
              Showing first 50 results. Refine your search to see more.
            </p>
          )}
        </CardContent>
      </Card>

      {/* TTS Test */}
      {selectedVoice && (
        <Card>
          <CardHeader>
            <CardTitle>Test Voice: {selectedVoice.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Enter text to generate speech..."
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              rows={4}
            />

            <div className="flex gap-2">
              <Button
                onClick={generateTTS}
                disabled={isGenerating || !testText.trim()}
                className="flex-1"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Speech'
                )}
              </Button>

              {generatedAudioUrl && (
                <>
                  <Button onClick={playAudio} variant="outline">
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button onClick={downloadAudio} variant="outline">
                    <Download className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>

            {isGenerating && jobToken && (
              <p className="text-sm text-muted-foreground">
                Job Token: {jobToken}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
