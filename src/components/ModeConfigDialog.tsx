import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Radio, Swords, Play, X, Mic, Globe } from 'lucide-react';

type DebateFormat = 'round-robin' | 'free-for-all' | 'moderated';
type PodcastStyle = 'interview' | 'conversational' | 'storytelling';

const LANGUAGES = [
  { code: 'en-US', name: 'English' },
  { code: 'es-ES', name: 'Spanish' },
  { code: 'fr-FR', name: 'French' },
  { code: 'de-DE', name: 'German' },
  { code: 'it-IT', name: 'Italian' },
  { code: 'pt-BR', name: 'Portuguese' },
  { code: 'ja-JP', name: 'Japanese' },
  { code: 'ko-KR', name: 'Korean' },
  { code: 'zh-CN', name: 'Chinese' },
];

interface ModeConfigDialogProps {
  mode: 'podcast' | 'debate' | null;
  figures: string[];
  onClose: () => void;
  onStart: (config: ModeConfig) => void;
}

export interface ModeConfig {
  topic: string;
  language: string;
  // Podcast specific
  podcastStyle?: PodcastStyle;
  // Debate specific
  debateFormat?: DebateFormat;
  rounds?: number;
}

export default function ModeConfigDialog({ mode, figures, onClose, onStart }: ModeConfigDialogProps) {
  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState('en-US');
  
  // Podcast options
  const [podcastStyle, setPodcastStyle] = useState<PodcastStyle>('conversational');
  
  // Debate options
  const [debateFormat, setDebateFormat] = useState<DebateFormat>('round-robin');
  const [rounds, setRounds] = useState(3);

  const handleStart = () => {
    if (!topic.trim()) return;
    
    const config: ModeConfig = {
      topic: topic.trim(),
      language,
      ...(mode === 'podcast' && { podcastStyle }),
      ...(mode === 'debate' && { debateFormat, rounds }),
    };
    
    onStart(config);
  };

  if (!mode) return null;

  const isPodcast = mode === 'podcast';

  return (
    <Dialog open={!!mode} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl bg-background border-border p-0 gap-0 overflow-hidden">
        {/* Header with gradient */}
        <div className={`relative px-6 py-8 ${isPodcast ? 'bg-gradient-to-br from-primary/20 via-primary/10 to-background' : 'bg-gradient-to-br from-orange-500/20 via-orange-500/10 to-background'}`}>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 h-8 w-8"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isPodcast ? 'bg-primary/20' : 'bg-orange-500/20'}`}>
              {isPodcast ? (
                <Radio className={`w-8 h-8 ${isPodcast ? 'text-primary' : 'text-orange-500'}`} />
              ) : (
                <Swords className="w-8 h-8 text-orange-500" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {isPodcast ? 'Start Podcast' : 'Start Debate'}
              </h2>
              <p className="text-muted-foreground">
                {isPodcast 
                  ? 'Configure your podcast session with your guests'
                  : 'Set up a debate between historical figures'
                }
              </p>
            </div>
          </div>
          
          {/* Participants */}
          <div className="flex flex-wrap gap-2 mt-4">
            {figures.map((figure, i) => (
              <Badge key={i} variant="secondary" className="text-sm py-1">
                {figure}
              </Badge>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Topic */}
          <div className="space-y-2">
            <Label htmlFor="topic" className="text-base font-medium">
              {isPodcast ? 'Discussion Topic' : 'Debate Topic'}
            </Label>
            <Textarea
              id="topic"
              placeholder={isPodcast 
                ? "What should your guests discuss? e.g., 'The future of artificial intelligence'"
                : "What should they debate? e.g., 'Is technological progress always beneficial?'"
              }
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>

          {/* Language */}
          <div className="space-y-2">
            <Label className="text-base font-medium flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Language
            </Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mode-specific options */}
          {isPodcast ? (
            <div className="space-y-3">
              <Label className="text-base font-medium">Podcast Style</Label>
              <RadioGroup value={podcastStyle} onValueChange={(v) => setPodcastStyle(v as PodcastStyle)} className="grid grid-cols-3 gap-3">
                <label className={`relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 cursor-pointer transition-colors ${podcastStyle === 'interview' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                  <RadioGroupItem value="interview" className="sr-only" />
                  <Mic className="w-5 h-5" />
                  <span className="text-sm font-medium">Interview</span>
                  <span className="text-xs text-muted-foreground text-center">Q&A format</span>
                </label>
                <label className={`relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 cursor-pointer transition-colors ${podcastStyle === 'conversational' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                  <RadioGroupItem value="conversational" className="sr-only" />
                  <Radio className="w-5 h-5" />
                  <span className="text-sm font-medium">Conversational</span>
                  <span className="text-xs text-muted-foreground text-center">Natural flow</span>
                </label>
                <label className={`relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 cursor-pointer transition-colors ${podcastStyle === 'storytelling' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                  <RadioGroupItem value="storytelling" className="sr-only" />
                  <span className="text-lg">📖</span>
                  <span className="text-sm font-medium">Storytelling</span>
                  <span className="text-xs text-muted-foreground text-center">Narrative style</span>
                </label>
              </RadioGroup>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <Label className="text-base font-medium">Debate Format</Label>
                <RadioGroup value={debateFormat} onValueChange={(v) => setDebateFormat(v as DebateFormat)} className="grid grid-cols-3 gap-3">
                  <label className={`relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 cursor-pointer transition-colors ${debateFormat === 'round-robin' ? 'border-orange-500 bg-orange-500/5' : 'border-border hover:bg-muted/50'}`}>
                    <RadioGroupItem value="round-robin" className="sr-only" />
                    <span className="text-lg">🔄</span>
                    <span className="text-sm font-medium">Round Robin</span>
                    <span className="text-xs text-muted-foreground text-center">Take turns</span>
                  </label>
                  <label className={`relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 cursor-pointer transition-colors ${debateFormat === 'free-for-all' ? 'border-orange-500 bg-orange-500/5' : 'border-border hover:bg-muted/50'}`}>
                    <RadioGroupItem value="free-for-all" className="sr-only" />
                    <span className="text-lg">⚡</span>
                    <span className="text-sm font-medium">Free-for-All</span>
                    <span className="text-xs text-muted-foreground text-center">Open debate</span>
                  </label>
                  <label className={`relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 cursor-pointer transition-colors ${debateFormat === 'moderated' ? 'border-orange-500 bg-orange-500/5' : 'border-border hover:bg-muted/50'}`}>
                    <RadioGroupItem value="moderated" className="sr-only" />
                    <span className="text-lg">👨‍⚖️</span>
                    <span className="text-sm font-medium">Moderated</span>
                    <span className="text-xs text-muted-foreground text-center">You moderate</span>
                  </label>
                </RadioGroup>
              </div>
              
              <div className="space-y-2">
                <Label className="text-base font-medium">Number of Rounds</Label>
                <Select value={rounds.toString()} onValueChange={(v) => setRounds(parseInt(v))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={n.toString()}>
                        {n} {n === 1 ? 'round' : 'rounds'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-muted/30 border-t border-border flex items-center justify-between">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleStart}
            disabled={!topic.trim()}
            className={isPodcast ? 'bg-primary hover:bg-primary/90' : 'bg-orange-500 hover:bg-orange-600 text-white'}
          >
            <Play className="w-4 h-4 mr-2" />
            Start {isPodcast ? 'Podcast' : 'Debate'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
