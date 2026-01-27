import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Send } from 'lucide-react';

import einstein from '@/assets/figures/einstein.jpg';

const demoMessages = [
  { type: 'user', text: "What inspired your theory of relativity?" },
  { type: 'ai', text: "Ah, a wonderful question! It began with a simple thought experiment when I was sixteen — imagining chasing a beam of light. If I could travel alongside it at the same speed, what would I see? This paradox haunted me for years until the pieces finally came together in 1905." },
];

export default function LiveDemoPreview() {
  const navigate = useNavigate();
  const [visibleMessages, setVisibleMessages] = useState<typeof demoMessages>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentTypingText, setCurrentTypingText] = useState('');

  useEffect(() => {
    // Show user message after 1s
    const timer1 = setTimeout(() => {
      setVisibleMessages([demoMessages[0]]);
    }, 1000);

    // Show typing indicator after 2s
    const timer2 = setTimeout(() => {
      setIsTyping(true);
    }, 2000);

    // Start typing effect after 2.5s
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
      }, 15);
      
      return () => clearInterval(typeInterval);
    }, 2500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return (
    <section className="py-24 px-6">
      <div className="container mx-auto max-w-4xl">
        {/* Section header */}
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            See it in action
          </h2>
          <p className="text-muted-foreground">
            Watch a live conversation unfold
          </p>
        </div>

        {/* Demo card */}
        <Card className="relative overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm">
          {/* Header bar */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50">
            <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-border">
              <img 
                src={einstein} 
                alt="Einstein"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="font-medium text-sm">Albert Einstein</p>
              <p className="text-xs text-muted-foreground">Physicist · 1879-1955</p>
            </div>
          </div>

          {/* Chat area */}
          <div className="p-5 min-h-[280px] space-y-4">
            {visibleMessages.map((msg, i) => (
              <div 
                key={i}
                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.type === 'user' 
                      ? 'bg-primary text-primary-foreground rounded-br-md' 
                      : 'bg-muted text-foreground rounded-bl-md'
                  }`}
                >
                  {msg.type === 'ai' && visibleMessages.length === 1 ? currentTypingText : msg.text}
                </div>
              </div>
            ))}
            
            {isTyping && visibleMessages.length === 1 && (
              <div className="flex justify-start">
                <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-bl-md bg-muted text-foreground text-sm leading-relaxed">
                  {currentTypingText}
                  <span className="inline-block w-0.5 h-4 bg-foreground/60 ml-0.5 animate-pulse" />
                </div>
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className="px-5 pb-5">
            <div className="flex items-center gap-2 px-4 py-3 rounded-full bg-muted/50 border border-border/50">
              <span className="text-sm text-muted-foreground flex-1">Ask Einstein anything...</span>
              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* CTA below demo */}
        <div className="text-center mt-10">
          <Button 
            variant="outline"
            onClick={() => navigate('/join')}
            className="rounded-full px-8 py-6 gap-2 group"
          >
            Try it yourself
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </div>
      </div>
    </section>
  );
}
