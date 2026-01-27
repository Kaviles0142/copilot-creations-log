import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';

import einstein from '@/assets/figures/einstein.jpg';

const demoMessages = [
  { type: 'user', text: "What was the moment you knew you'd changed physics forever?" },
  { type: 'ai', text: "Ah, what a profound question! The moment came in November 1915, when I finally completed the field equations of general relativity. After years of struggle, sleepless nights, and countless failed attempts, the mathematics suddenly revealed something beautiful — space and time were not a fixed stage, but dynamic participants in the cosmic dance. I wept. Not from pride, but from the overwhelming sense that nature had trusted me with one of her deepest secrets." },
];

export default function LiveDemoPreview() {
  const navigate = useNavigate();
  const [visibleMessages, setVisibleMessages] = useState<typeof demoMessages>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentTypingText, setCurrentTypingText] = useState('');
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    const timer1 = setTimeout(() => {
      setVisibleMessages([demoMessages[0]]);
    }, 800);

    const timer2 = setTimeout(() => {
      setIsTyping(true);
    }, 1800);

    const timer3 = setTimeout(() => {
      const fullText = demoMessages[1].text;
      let index = 0;
      const typeInterval = setInterval(() => {
        if (index <= fullText.length) {
          setCurrentTypingText(fullText.slice(0, index));
          index++;
        } else {
          clearInterval(typeInterval);
          setIsTyping(false);
          setVisibleMessages([demoMessages[0], demoMessages[1]]);
        }
      }, 12);
      
      return () => clearInterval(typeInterval);
    }, 2200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return (
    <section className="py-28 px-6 relative">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent pointer-events-none" />
      
      <div className="container mx-auto max-w-3xl relative">
        {/* Section header with better hierarchy */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 text-primary mb-4">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">Live Preview</span>
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold mb-5">
            See it in action
          </h2>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Watch as Einstein responds to your questions in real-time
          </p>
        </div>

        {/* Demo card with refined styling */}
        <Card className="relative overflow-hidden border-border/40 bg-card/90 backdrop-blur-md shadow-2xl shadow-black/10">
          {/* Header bar */}
          <div className="flex items-center gap-4 px-6 py-5 border-b border-border/40 bg-muted/30">
            <div className="relative">
              <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-primary/30">
                <img 
                  src={einstein} 
                  alt="Einstein"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-primary rounded-full border-2 border-card" />
            </div>
            <div>
              <p className="font-semibold">Albert Einstein</p>
              <p className="text-sm text-muted-foreground">Theoretical Physicist · Nobel Laureate</p>
            </div>
          </div>

          {/* Chat area with more padding */}
          <div className="p-6 min-h-[320px] space-y-5">
            {visibleMessages.map((msg, i) => (
              <div 
                key={i}
                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                <div 
                  className={`max-w-[85%] px-5 py-4 rounded-2xl text-[15px] leading-relaxed ${
                    msg.type === 'user' 
                      ? 'bg-primary text-primary-foreground rounded-br-lg' 
                      : 'bg-muted/80 text-foreground rounded-bl-lg'
                  }`}
                >
                  {msg.type === 'ai' && visibleMessages.length === 1 ? currentTypingText : msg.text}
                </div>
              </div>
            ))}
            
            {isTyping && visibleMessages.length === 1 && (
              <div className="flex justify-start animate-fade-in">
                <div className="max-w-[85%] px-5 py-4 rounded-2xl rounded-bl-lg bg-muted/80 text-foreground text-[15px] leading-relaxed">
                  {currentTypingText}
                  <span className="inline-block w-0.5 h-5 bg-primary ml-1 animate-pulse" />
                </div>
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className="px-6 pb-6">
            <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-muted/50 border border-border/40">
              <span className="text-sm text-muted-foreground flex-1">Ask anything about physics, life, or creativity...</span>
            </div>
          </div>
        </Card>

        {/* CTA below demo with more emphasis */}
        <div className="text-center mt-12">
          <Button 
            size="lg"
            onClick={() => navigate('/join')}
            className="h-14 rounded-full px-10 gap-3 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 transition-all group"
          >
            Start your own conversation
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
          </Button>
        </div>
      </div>
    </section>
  );
}
