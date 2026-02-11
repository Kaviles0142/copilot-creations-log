import { useState, useEffect, useRef } from 'react';
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
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (hasAnimated.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || hasAnimated.current) return;
        hasAnimated.current = true;

        setTimeout(() => setVisibleMessages([demoMessages[0]]), 400);
        setTimeout(() => setIsTyping(true), 1200);
        setTimeout(() => {
          const fullText = demoMessages[1].text;
          let i = 0;
          const iv = setInterval(() => {
            if (i <= fullText.length) {
              setCurrentTypingText(fullText.slice(0, i));
              i++;
            } else {
              clearInterval(iv);
              setIsTyping(false);
              setVisibleMessages([demoMessages[0], demoMessages[1]]);
            }
          }, 10);
        }, 1600);
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="demo" ref={sectionRef} className="py-28 px-6 border-t border-border/10 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent pointer-events-none" />

      <div className="max-w-3xl mx-auto relative">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 text-primary mb-4">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-widest">Live Preview</span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">
            See it in action
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Watch Einstein respond in real-time with historically grounded answers.
          </p>
        </div>

        {/* Demo chat card */}
        <div className="rounded-2xl border border-border/30 bg-card/60 backdrop-blur-xl shadow-2xl shadow-black/10 overflow-hidden">
          {/* Chat header */}
          <div className="flex items-center gap-4 px-6 py-4 border-b border-border/20 bg-muted/20">
            <div className="relative">
              <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-primary/30">
                <img src={einstein} alt="Einstein" className="w-full h-full object-cover" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-primary rounded-full border-2 border-card" />
            </div>
            <div>
              <p className="font-semibold text-sm">Albert Einstein</p>
              <p className="text-xs text-muted-foreground">Physicist · Speaking now</p>
            </div>
            <div className="ml-auto flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-border/40" />
              <span className="w-3 h-3 rounded-full bg-border/40" />
              <span className="w-3 h-3 rounded-full bg-border/40" />
            </div>
          </div>

          {/* Messages */}
          <div className="p-6 min-h-[280px] space-y-4">
            {visibleMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.type === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted/60 text-foreground rounded-bl-md border border-border/20'
                  }`}
                >
                  {msg.type === 'ai' && visibleMessages.length === 1 ? currentTypingText : msg.text}
                </div>
              </div>
            ))}

            {isTyping && visibleMessages.length === 1 && (
              <div className="flex justify-start animate-fade-in">
                <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-bl-md bg-muted/60 text-foreground border border-border/20 text-sm leading-relaxed">
                  {currentTypingText}
                  <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-6 pb-5">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/30 border border-border/20">
              <span className="text-xs text-muted-foreground flex-1">Ask anything about physics, life, or creativity…</span>
            </div>
          </div>
        </div>

        <div className="text-center mt-12">
          <Button
            size="lg"
            onClick={() => navigate('/join')}
            className="h-13 rounded-full px-10 gap-3 font-medium shadow-lg shadow-primary/15 hover:shadow-xl hover:shadow-primary/25 transition-all group"
          >
            Try it yourself
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>
    </section>
  );
}
