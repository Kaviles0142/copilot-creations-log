import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Volume2, Settings, Mic } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface VoiceSettingsProps {
  selectedFigure: any;
  onVoiceGenerated: (audioUrl: string) => void;
  onVoiceSelected?: (voiceId: string) => void;
}

interface ClonedVoice {
  id: string;
  figure_id: string;
  figure_name: string;
  voice_id: string;
  voice_name: string;
  provider: string;
  audio_quality_score: number;
  is_active: boolean;
}

const historicalVoices = {
  "shakespeare": { 
    description: "Eloquent British accent, theatrical",
    elevenlabsVoice: "Roger",
    voiceId: "CwhRBWXzGAHq8TQ4Fs17"
  },
  "churchill": { 
    description: "Deep British authority, wartime gravitas",
    elevenlabsVoice: "George", 
    voiceId: "JBFqnCBsd6RMkjVDRZzb"
  },
  "einstein": { 
    description: "German-accented English, thoughtful",
    elevenlabsVoice: "Daniel",
    voiceId: "onwK4e9ZLuTAKqWW03F9"
  },
  "mozart": { 
    description: "Austrian accent, musical cadence",
    elevenlabsVoice: "Liam",
    voiceId: "TX3LPaxmHKxFdv7VOQHJ"
  },
  "napoleon": { 
    description: "French accent, commanding presence",
    elevenlabsVoice: "Charlie",
    voiceId: "IKne3meq5aSn9XLyUdCD"
  },
  "cleopatra": { 
    description: "Regal, ancient authority",
    elevenlabsVoice: "Charlotte",
    voiceId: "XB0fDUnXU5powFXDhCwa"
  },
  "leonardo": { 
    description: "Italian Renaissance, artistic",
    elevenlabsVoice: "Callum",
    voiceId: "N2lVS1w4EtoT3dr4eOWO"
  },
  "hendrix": { 
    description: "1960s American, laid-back musician",
    elevenlabsVoice: "Will",
    voiceId: "bIHbv24MWmeRgasZH58o"
  },
  "donald-trump": {
    description: "New York accent, bold and direct",
    resembleVoice: "Donald Trump",
    voiceId: "1d49f394",
    provider: "resemble"
  }
};

const VoiceSettings = ({ selectedFigure, onVoiceGenerated, onVoiceSelected }: VoiceSettingsProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [cloningStatus, setCloningStatus] = useState<string>("");
  const [selectedVoice, setSelectedVoice] = useState<string>("auto");
  const [clonedVoices, setClonedVoices] = useState<ClonedVoice[]>([]);
  const { toast } = useToast();

  // Load cloned voices for the current figure
  useEffect(() => {
    if (selectedFigure?.id) {
      loadClonedVoices();
    }
  }, [selectedFigure?.id]);

  // Auto-start voice cloning if no custom voice exists
  useEffect(() => {
    if (selectedFigure?.id && clonedVoices.length === 0) {
      console.log(`Auto-starting voice cloning for ${selectedFigure.name}`);
      startVoiceCloning();
    }
  }, [selectedFigure?.id, clonedVoices.length]);

  const loadClonedVoices = async () => {
    try {
      const { data, error } = await supabase
        .from('cloned_voices')
        .select('*')
        .eq('figure_id', selectedFigure.id)
        .eq('is_active', true)
        .order('audio_quality_score', { ascending: false });

      if (error) {
        console.error('Error loading cloned voices:', error);
        return;
      }

      setClonedVoices(data || []);
    } catch (error) {
      console.error('Error in loadClonedVoices:', error);
    }
  };

  const startVoiceCloning = async () => {
    setIsCloning(true);
    setCloningStatus("Starting voice cloning process...");
    
    try {
      const { data, error } = await supabase.functions.invoke('automated-voice-pipeline', {
        body: {
          figureId: selectedFigure.id,
          figureName: selectedFigure.name,
          action: 'start_pipeline'
        }
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        setCloningStatus("Pipeline started! Checking progress...");
        
        // Start monitoring progress
        monitorPipelineProgress(data.pipelineId);
      } else {
        throw new Error(data.message || 'Failed to start voice cloning');
      }
    } catch (error) {
      console.error('Error starting voice cloning:', error);
      setCloningStatus("");
      setIsCloning(false);
    }
  };

  const monitorPipelineProgress = async (pipelineId: string) => {
    const checkProgress = async () => {
      try {
        const { data } = await supabase.functions.invoke('automated-voice-pipeline', {
          body: {
            figureId: selectedFigure.id,
            figureName: selectedFigure.name,
            action: 'get_status'
          }
        });

        if (data?.success && data?.pipeline) {
          const pipeline = data.pipeline;
          
          // Update status based on current step
          switch (pipeline.status) {
            case 'extracting':
              setCloningStatus("Searching YouTube for audio...");
              break;
            case 'cleaning':
              const videoCount = pipeline.youtube_videos?.length || 0;
              setCloningStatus(`Found ${videoCount} videos, processing audio...`);
              break;
            case 'training':
              const audioCount = pipeline.raw_audio_files?.length || 0;
              setCloningStatus(`Training voice model with ${audioCount} audio files...`);
              break;
            case 'integrating':
              setCloningStatus("Finalizing voice clone...");
              break;
            case 'completed':
              setCloningStatus("Voice clone completed!");
              setIsCloning(false);
              loadClonedVoices();
              setTimeout(() => setCloningStatus(""), 3000);
              return;
            case 'failed':
              setCloningStatus("Voice cloning failed");
              setIsCloning(false);
              setTimeout(() => setCloningStatus(""), 3000);
              return;
          }
          
          // Continue monitoring if still in progress
          setTimeout(checkProgress, 3000);
        }
      } catch (error) {
        console.error('Error monitoring progress:', error);
        setIsCloning(false);
        setCloningStatus("");
      }
    };

    checkProgress();
  };

  const generateVoice = async (text: string) => {
    if (!selectedFigure || !text.trim()) return;

    setIsGenerating(true);
    try {
      // Check if we should use Resemble AI voice
      const figureVoiceConfig = historicalVoices[selectedFigure.id as keyof typeof historicalVoices];
      const shouldUseResemble = (figureVoiceConfig && 'provider' in figureVoiceConfig && figureVoiceConfig.provider === 'resemble') || selectedVoice.startsWith('resemble-');
      
      // Check if we have a real cloned voice from the pipeline
      const customVoice = clonedVoices.find(v => v.provider === 'resemble' && !v.voice_id.includes('fallback'));
      
      if ((customVoice && selectedVoice === "auto") || shouldUseResemble || selectedVoice.startsWith('resemble-')) {
        console.log('Using Resemble AI voice');
        
        // Determine which voice ID to use
        let resembleVoiceId = customVoice?.voice_id;
        if (selectedVoice.startsWith('resemble-')) {
          resembleVoiceId = selectedVoice.replace('resemble-', '');
        } else if (figureVoiceConfig && 'provider' in figureVoiceConfig && figureVoiceConfig.provider === 'resemble') {
          resembleVoiceId = figureVoiceConfig.voiceId;
        }
        
        // Use Resemble AI
        const { data, error } = await supabase.functions.invoke('resemble-text-to-speech', {
          body: {
            text: text,
            voice: resembleVoiceId,
            figure_name: selectedFigure.name
          }
        });

        if (error) throw new Error('Voice generation failed');
        if (!data?.audioContent) throw new Error('No audio content received');

        const audioBlob = new Blob([Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);
        onVoiceGenerated(audioUrl);
        
        toast({
          title: "Resemble AI Voice Generated!",
          description: `Generated speech with ${selectedFigure.name} voice`,
        });
        return;
      }

      // Use custom voice IDs directly for ElevenLabs
      const voiceMapping: Record<string, string> = {
        'martin-luther-king-jr': '2ts4Q14DjMa5I5EgteS4', // Custom MLK voice
        'jfk': '2vubyVoGjNJ5HPga4SkV',
        'john-f-kennedy': '2vubyVoGjNJ5HPga4SkV',
        'albert-einstein': 'nPczCjzI2devNBz1zQrb',
        'winston-churchill': 'JBFqnCBsd6RMkjVDRZzb',
        'abraham-lincoln': 'bIHbv24MWmeRgasZH58o',
        'shakespeare': 'N2lVS1w4EtoT3dr4eOWO',
        'napoleon': 'JBFqnCBsd6RMkjVDRZzb',
        'socrates': 'cjVigY5qzO86Huf0OWal',
        'marie-curie': 'EXAVITQu4vr4xnSDxMaL',
        'cleopatra': 'XB0fDUnXU5powFXDhCwa',
        'joan-of-arc': 'cgSgspJ2msm6clMCkdW9'
      };

      const voiceId = selectedVoice === "auto" 
        ? voiceMapping[selectedFigure.id] || "Brian"
        : selectedVoice;

      const { data, error } = await supabase.functions.invoke('elevenlabs-text-to-speech', {
        body: {
          text: text,
          voice: voiceId
        }
      });

      if (error) {
        throw new Error('Voice generation failed');
      }

      if (!data?.audioContent) {
        throw new Error('No audio content received');
      }

      // Convert base64 to blob
      const audioBytes = atob(data.audioContent);
      const audioArray = new Uint8Array(audioBytes.length);
      for (let i = 0; i < audioBytes.length; i++) {
        audioArray[i] = audioBytes.charCodeAt(i);
      }
      const audioBlob = new Blob([audioArray], { type: 'audio/wav' });

      const audioUrl = URL.createObjectURL(audioBlob);
      onVoiceGenerated(audioUrl);

      toast({
        title: "Voice Generated",
        description: `Generated authentic voice for ${selectedFigure.name}`,
      });

    } catch (error) {
      console.error('Voice generation error:', error);
      toast({
        title: "Voice Generation Failed",
        description: "Using default text-to-speech instead",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (!selectedFigure) return null;

  const figureVoice = historicalVoices[selectedFigure.id as keyof typeof historicalVoices];
  const hasCustomVoice = clonedVoices.some(v => v.provider === 'resemble' && !v.voice_id.includes('fallback'));

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Volume2 className="h-4 w-4" />
        <h3 className="font-semibold text-sm">Voice Settings</h3>
      </div>

      {hasCustomVoice && (
        <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded text-xs">
          <strong>🎯 Custom Trained Voice Available!</strong> Using AI-trained voice model for {selectedFigure.name}
        </div>
      )}

      {figureVoice && !hasCustomVoice && (
        <div className="mb-3 p-2 bg-secondary/50 rounded text-xs">
          <strong>Authentic Voice:</strong> {figureVoice.description}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium">Voice Style</label>
          <Select value={selectedVoice} onValueChange={(value) => {
            setSelectedVoice(value);
            onVoiceSelected?.(value);
          }}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">
                {hasCustomVoice ? "🤖 Auto (Custom Trained)" : "🎭 Auto (Historical Match)"}
              </SelectItem>
              
              {/* Resemble AI Voices */}
              <SelectItem value="resemble-1d49f394">
                🎙️ Donald Trump (Resemble AI)
              </SelectItem>
              
              {/* ElevenLabs Voices */}
              <SelectItem value="9BWtsMINqrJLrRacOk9x">
                👩 Aria (Female, Warm)
              </SelectItem>
              <SelectItem value="CwhRBWXzGAHq8TQ4Fs17">
                👨 Roger (Male, Authoritative)
              </SelectItem>
              <SelectItem value="EXAVITQu4vr4xnSDxMaL">
                👩 Sarah (Female, Clear)
              </SelectItem>
              <SelectItem value="JBFqnCBsd6RMkjVDRZzb">
                👨 George (Male, Deep)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button 
          onClick={() => generateVoice("Hello, I am " + selectedFigure.name)}
          disabled={isGenerating}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <Settings className="h-4 w-4 mr-2" />
          {isGenerating ? "Generating..." : "Test Voice"}
        </Button>

        {cloningStatus && (
          <div className="text-xs text-muted-foreground text-center p-2 bg-muted/50 rounded">
            {cloningStatus}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        {hasCustomVoice 
          ? `Using custom AI-trained voice model for ${selectedFigure.name}`
          : isCloning
            ? `Creating custom voice for ${selectedFigure.name}...`
            : figureVoice 
              ? `Using ${figureVoice && 'elevenlabsVoice' in figureVoice ? figureVoice.elevenlabsVoice : figureVoice && 'resembleVoice' in figureVoice ? figureVoice.resembleVoice : 'voice'} profile for authentic ${selectedFigure.name} speech`
              : "Custom voice profile not available, using standard TTS"
        }
      </p>
    </Card>
  );
};

export default VoiceSettings;