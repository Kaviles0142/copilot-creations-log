import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import einstein from '@/assets/figures/einstein.jpg';

const demoMessages = [
  {
    type: 'user',
    text: "If you could give one piece of advice to a young scientist today, what would it be?",
  },
  {
    type: 'ai',
    text: "Never lose your sense of wonder. The most important thing is to never stop questioning. Curiosity has its own reason for existing. One cannot help but be in awe when contemplating the mysteries of eternity, of life, of the marvelous structure of reality. It is enough if one tries merely to comprehend a little of this mystery each day.",
  },
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
        setTimeout(() => setIsTyping(true), 1400);
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
          }, 12);
        }, 1800);
      },
      { threshold: 0.25 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="demo" ref={sectionRef} className="py-20 sm:py-28 px-4 sm:px-6 border-t border-border/10 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.015] to-transparent pointer-events-none" />

      <div className="max-w-2xl mx-auto relative">
        <div className="text-center mb-10 sm:mb-14">
          <p className="text-[11px] sm:text-xs uppercase tracking-[0.25em] text-primary font-semibold mb-3">
            Live Demo
          </p>
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-3 sm:mb-4">
            Experience a conversation
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-sm mx-auto">
            Watch how Einstein responds with nuance, context, and historical depth.
          </p>
        </div>

        {/* Chat simulation */}
        <div className="rounded-2xl border border-border/20 bg-card/40 backdrop-blur-xl shadow-2xl shadow-black/[0.08] overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-border/15 bg-muted/15">
            <div className="relative shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden ring-1 ring-primary/20">
                <img src={einstein} alt="Einstein" className="w-full h-full object-cover" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-primary rounded-full border-[1.5px] border-card" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">Albert Einstein</p>
              <p className="text-[11px] text-muted-foreground">Theoretical Physicist</p>
            </div>
            <div className="ml-auto flex gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-border/30" />
              <span className="w-2.5 h-2.5 rounded-full bg-border/30" />
              <span className="w-2.5 h-2.5 rounded-full bg-border/30" />
            </div>
          </div>

          {/* Messages */}
          <div className="p-4 sm:p-5 min-h-[220px] sm:min-h-[260px] space-y-3 sm:space-y-4">
            {visibleMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                <div
                  className={`max-w-[88%] px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl text-[13px] sm:text-sm leading-relaxed ${
                    msg.type === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted/50 text-foreground rounded-bl-md border border-border/15'
                  }`}
                >
                  {msg.type === 'ai' && visibleMessages.length === 1 ? currentTypingText : msg.text}
                </div>
              </div>
            ))}

            {isTyping && visibleMessages.length === 1 && (
              <div className="flex justify-start animate-fade-in">
                <div className="max-w-[88%] px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl rounded-bl-md bg-muted/50 text-foreground border border-border/15 text-[13px] sm:text-sm leading-relaxed">
                  {currentTypingText}
                  <span className="inline-block w-[2px] h-3.5 bg-primary ml-0.5 animate-pulse" />
                </div>
              </div>
            )}
          </div>

          {/* Input mock */}
          <div className="px-4 sm:px-5 pb-4 sm:pb-5">
            <div className="px-3.5 py-2.5 sm:py-3 rounded-xl bg-muted/20 border border-border/15">
              <span className="text-[11px] sm:text-xs text-muted-foreground/70">Type your message…</span>
            </div>
          </div>
        </div>

        <div className="text-center mt-8 sm:mt-10">
          <Button
            size="lg"
            onClick={() => navigate('/join')}
            className="h-11 sm:h-12 rounded-full px-7 sm:px-8 gap-2 text-sm font-medium shadow-lg shadow-primary/10 hover:shadow-xl hover:shadow-primary/20 transition-all group"
          >
            Try It Yourself
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </div>
      </div>
    </section>
  );
}
