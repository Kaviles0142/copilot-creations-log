import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Video, Brain, Users, Zap, Shield, Globe } from 'lucide-react';
import HeroSection from '@/components/landing/HeroSection';
import FigureStrip from '@/components/landing/FigureStrip';
import LiveDemoPreview from '@/components/landing/LiveDemoPreview';
import Footer from '@/components/landing/Footer';

const features = [
  {
    icon: Video,
    title: 'Live Avatar Conversations',
    desc: 'Speak face-to-face with photorealistic AI avatars that lip-sync in real time. It feels like a video call — across centuries.',
  },
  {
    icon: Brain,
    title: 'Historically Grounded AI',
    desc: 'Every response is informed by real writings, speeches, and documented history. Not hallucinated — researched.',
  },
  {
    icon: Users,
    title: 'Multi-Figure Rooms',
    desc: 'Bring multiple figures into one room. Moderate debates between Einstein and Aristotle, or host a roundtable of inventors.',
  },
  {
    icon: Zap,
    title: 'Instant Voice Cloning',
    desc: 'AI-generated voice profiles for each figure, delivering authentic-sounding speech with natural cadence and tone.',
  },
  {
    icon: Shield,
    title: 'Built for Education',
    desc: 'Designed for students, educators, and the curious. Engage with history in a way that textbooks never could.',
  },
  {
    icon: Globe,
    title: 'No Setup Required',
    desc: 'Jump straight in — no downloads, no accounts, no configuration. Open a room and start talking in under 10 seconds.',
  },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ── Nav ── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-background/70 backdrop-blur-2xl border-b border-border/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-14 sm:h-16 px-4 sm:px-6">
          <span className="text-lg sm:text-xl font-bold tracking-tight font-display">
            NeverGone<span className="text-primary">.</span>
          </span>
          <nav className="hidden md:flex items-center gap-8 text-[13px] text-muted-foreground font-medium">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#figures" className="hover:text-foreground transition-colors">Figures</a>
            <a href="#demo" className="hover:text-foreground transition-colors">Demo</a>
          </nav>
          <Button
            onClick={() => navigate('/join')}
            size="sm"
            className="rounded-full px-5 sm:px-6 gap-1.5 text-xs sm:text-sm font-medium h-9"
          >
            Open App <ArrowRight className="w-3 h-3" />
          </Button>
        </div>
      </header>

      {/* ── Hero ── */}
      <HeroSection />

      {/* ── Features ── */}
      <section id="features" className="py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <p className="text-[11px] sm:text-xs uppercase tracking-[0.25em] text-primary font-semibold mb-3">
              Platform
            </p>
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight max-w-lg mx-auto">
              Everything you need to bring history to life
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="group relative p-6 sm:p-7 rounded-2xl border border-border/15 bg-card/30 hover:bg-card/60 hover:border-primary/15 transition-all duration-500"
              >
                <f.icon className="w-5 h-5 text-primary mb-4" strokeWidth={1.5} />
                <h3 className="text-[15px] sm:text-base font-semibold mb-2 tracking-tight">{f.title}</h3>
                <p className="text-[13px] text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Figures ── */}
      <FigureStrip />

      {/* ── Demo ── */}
      <LiveDemoPreview />

      {/* ── Final CTA ── */}
      <section className="py-20 sm:py-32 px-4 sm:px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/[0.03] to-transparent pointer-events-none" />
        <div className="max-w-2xl mx-auto text-center relative">
          <h2 className="font-display text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight mb-5 sm:mb-6">
            The past is waiting for you
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base md:text-lg mb-8 sm:mb-10 max-w-md mx-auto leading-relaxed">
            No account. No setup. Pick a historical figure and start a real conversation in seconds.
          </p>
          <Button
            size="lg"
            onClick={() => navigate('/join')}
            className="h-12 sm:h-14 px-8 sm:px-12 rounded-full text-sm sm:text-base gap-2.5 font-semibold shadow-2xl shadow-primary/20 hover:shadow-primary/35 hover:scale-[1.02] transition-all duration-300 group"
          >
            Get Started — It's Free
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
