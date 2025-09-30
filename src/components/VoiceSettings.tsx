import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Volume2, Settings } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface VoiceSettingsProps {
  selectedFigure: any;
  onVoiceGenerated: (audioUrl: string) => void;
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
  }
};

const VoiceSettings = ({ selectedFigure, onVoiceGenerated }: VoiceSettingsProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string>("auto");
  const { toast } = useToast();

  const generateVoice = async (text: string) => {
    if (!selectedFigure || !text.trim()) return;

    setIsGenerating(true);
    try {
      // Get voice configuration for the figure - use ElevenLabs voices
      const voiceMapping: Record<string, string> = {
        'jfk': 'Daniel',
        'john-f-kennedy': 'Daniel',
        'albert-einstein': 'Brian',
        'winston-churchill': 'George',
        'abraham-lincoln': 'Will',
        'shakespeare': 'Callum',
        'napoleon': 'George',
        'socrates': 'Eric',
        'marie-curie': 'Sarah',
        'cleopatra': 'Charlotte',
        'joan-of-arc': 'Jessica'
      };

      const voiceId = selectedVoice === "auto" 
        ? voiceMapping[selectedFigure.id] || "Brian" // Default to Brian
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

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Volume2 className="h-4 w-4" />
        <h3 className="font-semibold text-sm">Voice Settings</h3>
      </div>

      {figureVoice && (
        <div className="mb-3 p-2 bg-secondary/50 rounded text-xs">
          <strong>Authentic Voice:</strong> {figureVoice.description}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium">Voice Style</label>
          <Select value={selectedVoice} onValueChange={setSelectedVoice}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">
                🎭 Auto (Historical Match)
              </SelectItem>
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
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        {figureVoice 
          ? `Using ${figureVoice.elevenlabsVoice} voice profile for authentic ${selectedFigure.name} speech`
          : "Custom voice profile not available, using standard TTS"
        }
      </p>
    </Card>
  );
};

export default VoiceSettings;