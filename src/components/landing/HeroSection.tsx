import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Play } from 'lucide-react';
import einstein from '@/assets/figures/einstein.jpg';
import cleopatra from '@/assets/figures/cleopatra.jpg';
import davinci from '@/assets/figures/davinci.jpg';

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen flex items-center pt-16">
      {/* Background grain + gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] bg-primary/[0.06] rounded-full blur-[150px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto w-full px-6 grid lg:grid-cols-2 gap-16 items-center">
        {/* Left — copy */}
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-xs font-medium text-primary tracking-wide uppercase">AI Avatar Platform</span>
          </div>

          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6">
            Conversations
            <br />
            with <span className="text-primary">legends</span>
          </h1>

          <p className="text-lg text-muted-foreground leading-relaxed mb-10 max-w-md">
            Talk face-to-face with Einstein, Cleopatra, Da Vinci and 50+ historical figures.
            Real-time voice, lip-synced avatars, and historically grounded AI.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Button
              size="lg"
              onClick={() => navigate('/join')}
              className="h-14 px-10 rounded-full text-base gap-3 font-semibold shadow-2xl shadow-primary/20 hover:shadow-primary/35 hover:scale-[1.02] transition-all duration-300 group"
            >
              Start Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => {
                document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="h-14 px-8 rounded-full text-base gap-2 text-muted-foreground hover:text-foreground"
            >
              <Play className="w-4 h-4" /> Watch Demo
            </Button>
          </div>

          <div className="mt-10 flex items-center gap-5 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-primary" />
              No signup required
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-primary" />
              Voice & text
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-primary" />
              50+ figures
            </span>
          </div>
        </div>

        {/* Right — stacked avatar cards */}
        <div className="relative hidden lg:flex items-center justify-center h-[520px]">
          {/* Glow behind cards */}
          <div className="absolute inset-0 bg-primary/[0.04] rounded-3xl blur-3xl" />

          {/* Card stack */}
          {[
            { img: einstein, name: 'Albert Einstein', role: 'Theoretical Physicist', rotate: '-6deg', x: '-20px', y: '0px', z: 1 },
            { img: cleopatra, name: 'Cleopatra VII', role: 'Pharaoh of Egypt', rotate: '3deg', x: '30px', y: '-30px', z: 2 },
            { img: davinci, name: 'Leonardo da Vinci', role: 'Renaissance Polymath', rotate: '-1deg', x: '10px', y: '20px', z: 3 },
          ].map((card, i) => (
            <div
              key={card.name}
              className="absolute w-64 rounded-2xl overflow-hidden border border-border/30 bg-card/80 backdrop-blur-md shadow-2xl shadow-black/20 transition-transform duration-700 hover:scale-105 hover:rotate-0"
              style={{
                transform: `rotate(${card.rotate}) translate(${card.x}, ${card.y})`,
                zIndex: card.z,
                top: `${60 + i * 40}px`,
                left: `${40 + i * 60}px`,
              }}
            >
              <div className="aspect-[3/4] overflow-hidden">
                <img
                  src={card.img}
                  alt={card.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4 bg-card/90 backdrop-blur-sm">
                <p className="font-semibold text-sm">{card.name}</p>
                <p className="text-xs text-muted-foreground">{card.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
