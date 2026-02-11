import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Mic, MessageSquare, Users } from 'lucide-react';
import HeroSection from '@/components/landing/HeroSection';
import FigureStrip from '@/components/landing/FigureStrip';
import LiveDemoPreview from '@/components/landing/LiveDemoPreview';
import Footer from '@/components/landing/Footer';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Top bar */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-border/10 bg-background/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-6">
          <span className="text-xl font-bold tracking-tight font-display">
            NeverGone<span className="text-primary">.</span>
          </span>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#demo" className="hover:text-foreground transition-colors">Demo</a>
            <a href="#figures" className="hover:text-foreground transition-colors">Figures</a>
          </div>
          <Button
            onClick={() => navigate('/join')}
            size="sm"
            className="rounded-full px-6 gap-2 font-medium"
          >
            Launch App <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </header>

      {/* Hero */}
      <HeroSection />

      {/* Features row */}
      <section id="features" className="py-24 px-6 border-t border-border/10">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
          {[
            {
              icon: MessageSquare,
              title: 'Real-time Chat',
              desc: 'Text conversations with historically accurate AI personas trained on primary sources.',
            },
            {
              icon: Mic,
              title: 'Voice & Lip-Sync',
              desc: 'Cloned voices with live avatar animation — like a video call across centuries.',
            },
            {
              icon: Users,
              title: 'Multi-Figure Rooms',
              desc: 'Host debates between Einstein and Da Vinci, or a roundtable with five legends.',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="group p-8 rounded-2xl border border-border/20 bg-card/40 hover:bg-card/70 hover:border-primary/20 transition-all duration-500"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Figures */}
      <FigureStrip />

      {/* Demo */}
      <LiveDemoPreview />

      {/* CTA banner */}
      <section className="py-28 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-5xl font-bold mb-6 tracking-tight">
            Ready to talk to history?
          </h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-lg mx-auto">
            Jump in — no account needed. Pick a figure and start your first conversation in seconds.
          </p>
          <Button
            size="lg"
            onClick={() => navigate('/join')}
            className="h-14 px-12 rounded-full text-base gap-3 font-medium shadow-2xl shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] transition-all duration-300 group"
          >
            Get Started Free
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
