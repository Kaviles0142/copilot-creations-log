import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import einstein from '@/assets/figures/einstein.jpg';
import cleopatra from '@/assets/figures/cleopatra.jpg';
import davinci from '@/assets/figures/davinci.jpg';
import napoleon from '@/assets/figures/napoleon.jpg';
import shakespeare from '@/assets/figures/shakespeare.jpg';

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-[100svh] flex flex-col justify-center pt-14 sm:pt-16 pb-8 px-4 sm:px-6 overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[900px] h-[400px] sm:h-[600px] bg-primary/[0.05] rounded-full blur-[120px] sm:blur-[180px] pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto w-full">
        {/* Badge */}
        <div className="flex justify-center mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/20 bg-primary/[0.06]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
            </span>
            <span className="text-[11px] sm:text-xs font-medium text-primary/90 tracking-wide">AI-Powered Avatar Conversations</span>
          </div>
        </div>

        {/* Headline — centered */}
        <h1 className="text-center font-display text-[2.5rem] sm:text-5xl md:text-6xl lg:text-[4.5rem] font-extrabold tracking-tight leading-[1.08] mb-5 sm:mb-6">
          What would you ask
          <br className="hidden sm:block" />
          <span className="text-primary"> history's greatest minds</span>?
        </h1>

        {/* Sub */}
        <p className="text-center text-sm sm:text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed mb-8 sm:mb-10">
          NeverGone lets you have real-time video conversations with AI avatars of Einstein, Cleopatra, Da Vinci, and 50+ legendary figures — with voice, lip-sync, and historically grounded responses.
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-12 sm:mb-16">
          <Button
            size="lg"
            onClick={() => navigate('/join')}
            className="w-full sm:w-auto h-12 sm:h-14 px-8 sm:px-10 rounded-full text-sm sm:text-base gap-2.5 font-semibold shadow-2xl shadow-primary/20 hover:shadow-primary/35 hover:scale-[1.02] transition-all duration-300 group"
          >
            Start a Conversation
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
            className="w-full sm:w-auto h-12 sm:h-14 px-8 sm:px-10 rounded-full text-sm sm:text-base font-medium border-border/30 hover:bg-muted/40"
          >
            See How It Works
          </Button>
        </div>

        {/* Avatar row — responsive grid of portrait circles */}
        <div className="flex items-center justify-center">
          <div className="flex -space-x-3 sm:-space-x-4">
            {[
              { img: einstein, name: 'Einstein' },
              { img: cleopatra, name: 'Cleopatra' },
              { img: davinci, name: 'Da Vinci' },
              { img: napoleon, name: 'Napoleon' },
              { img: shakespeare, name: 'Shakespeare' },
            ].map((f, i) => (
              <div
                key={f.name}
                className="relative w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full overflow-hidden border-2 border-background ring-1 ring-border/20 shadow-lg"
                style={{ zIndex: 10 - i }}
              >
                <img
                  src={f.img}
                  alt={f.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
            <div className="relative w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full border-2 border-background ring-1 ring-border/20 shadow-lg bg-muted flex items-center justify-center" style={{ zIndex: 4 }}>
              <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground">50+</span>
            </div>
          </div>
        </div>

        {/* Trust line */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] sm:text-xs text-muted-foreground/70">
          <span>No account required</span>
          <span className="hidden sm:inline w-px h-3 bg-border/30" />
          <span>Voice & text</span>
          <span className="hidden sm:inline w-px h-3 bg-border/30" />
          <span>Free to use</span>
        </div>
      </div>
    </section>
  );
}
