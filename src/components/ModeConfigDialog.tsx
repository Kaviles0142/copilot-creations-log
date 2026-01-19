import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Radio, Swords, Play, X, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export interface ModeConfig {
  topic: string;
  scene: string;
}

interface ModeConfigDialogProps {
  mode: 'podcast' | 'debate' | null;
  figures: string[];
  onClose: () => void;
  onStart: (config: ModeConfig) => void;
}

// Podcast scene options - cozy, creative vibes
const PODCAST_SCENES = [
  { 
    id: 'studio', 
    label: 'Studio', 
    emoji: '🎙️',
    description: 'Classic podcast studio'
  },
  { 
    id: 'fireside', 
    label: 'Fireside', 
    emoji: '🔥',
    description: 'Cozy by the fireplace'
  },
  { 
    id: 'rooftop', 
    label: 'Rooftop', 
    emoji: '🌆',
    description: 'City skyline at dusk'
  },
  { 
    id: 'library', 
    label: 'Library', 
    emoji: '📚',
    description: 'Grand old library'
  },
];

// Debate scene options - dramatic, formal settings
const DEBATE_SCENES = [
  { 
    id: 'senate', 
    label: 'Senate', 
    emoji: '🏛️',
    description: 'Roman senate chamber'
  },
  { 
    id: 'colosseum', 
    label: 'Arena', 
    emoji: '⚔️',
    description: 'Gladiatorial arena'
  },
  { 
    id: 'courtroom', 
    label: 'Court', 
    emoji: '⚖️',
    description: 'Supreme court'
  },
  { 
    id: 'theatre', 
    label: 'Theatre', 
    emoji: '🎭',
    description: 'Greek amphitheatre'
  },
];

export default function ModeConfigDialog({ mode, figures, onClose, onStart }: ModeConfigDialogProps) {
  const [topic, setTopic] = useState('');
  const [selectedScene, setSelectedScene] = useState<string | null>(null);
  const [isFormatting, setIsFormatting] = useState(false);

  const isPodcast = mode === 'podcast';
  const scenes = isPodcast ? PODCAST_SCENES : DEBATE_SCENES;

  const handleStart = async () => {
    if (!topic.trim()) return;
    
    setIsFormatting(true);
    
    try {
      // Format the topic using AI
      const { data, error } = await supabase.functions.invoke('format-topic', {
        body: { topic: topic.trim(), mode }
      });
      
      const formattedTopic = error ? topic.trim() : (data?.formattedTopic || topic.trim());
      
      onStart({
        topic: formattedTopic,
        scene: selectedScene || scenes[0].id,
      });
    } catch (err) {
      // Fallback to original topic if formatting fails
      console.error('Topic formatting failed:', err);
      onStart({
        topic: topic.trim(),
        scene: selectedScene || scenes[0].id,
      });
    } finally {
      setIsFormatting(false);
    }
  };

  if (!mode) return null;

  return (
    <Dialog open={!!mode} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg bg-background border-border p-0 gap-0 overflow-hidden">
        {/* Minimal header */}
        <div className="relative px-6 pt-6 pb-4">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 h-8 w-8"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isPodcast ? 'bg-primary/10' : 'bg-orange-500/10'}`}>
              {isPodcast ? (
                <Radio className="w-5 h-5 text-primary" />
              ) : (
                <Swords className="w-5 h-5 text-orange-500" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {isPodcast ? 'New Podcast' : 'New Debate'}
              </h2>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {figures.slice(0, 3).map((figure, i) => (
                  <span key={i} className="text-xs text-muted-foreground">
                    {figure}{i < Math.min(figures.length, 3) - 1 && ', '}
                  </span>
                ))}
                {figures.length > 3 && (
                  <span className="text-xs text-muted-foreground">+{figures.length - 3} more</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Topic input */}
        <div className="px-6 pb-4">
          <Input
            placeholder={isPodcast 
              ? "What should they discuss?" 
              : "What should they debate?"
            }
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="text-base h-12"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && topic.trim() && handleStart()}
          />
        </div>

        {/* Scene selection - subtle grid */}
        <div className="px-6 pb-4">
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Scene
          </p>
          <div className="grid grid-cols-4 gap-2">
            {scenes.map((scene) => {
              const isSelected = selectedScene === scene.id || (!selectedScene && scene.id === scenes[0].id);
              return (
                <button
                  key={scene.id}
                  onClick={() => setSelectedScene(scene.id)}
                  className={`
                    flex flex-col items-center gap-1 p-3 rounded-lg border transition-all
                    ${isSelected 
                      ? isPodcast 
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20' 
                        : 'border-orange-500 bg-orange-500/5 ring-1 ring-orange-500/20'
                      : 'border-border hover:bg-muted/50'
                    }
                  `}
                >
                  <span className="text-xl">{scene.emoji}</span>
                  <span className="text-xs font-medium">{scene.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Start button */}
        <div className="px-6 py-4 bg-muted/30 border-t border-border">
          <Button 
            onClick={handleStart}
            disabled={!topic.trim() || isFormatting}
            className={`w-full h-11 ${isPodcast ? 'bg-primary hover:bg-primary/90' : 'bg-orange-500 hover:bg-orange-600 text-white'}`}
          >
            {isFormatting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Preparing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Start
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
