import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-[85vh] flex items-center justify-center px-6">
      {/* Subtle gradient orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />
      
      <div className="relative z-10 text-center max-w-3xl mx-auto">
        {/* Small label */}
        <p className="text-sm tracking-widest uppercase text-muted-foreground mb-6">
          AI-Powered Conversations
        </p>

        {/* Main headline */}
        <h1 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] mb-8">
          Speak with
          <span className="block text-primary">history's greatest</span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto mb-12 leading-relaxed">
          Real-time conversations with Einstein, Cleopatra, Da Vinci and more. 
          Experience the past like never before.
        </p>

        {/* Single strong CTA */}
        <Button 
          size="lg" 
          onClick={() => navigate('/join')}
          className="text-base px-10 py-7 gap-3 rounded-full shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all group"
        >
          Start a conversation
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </Button>

        {/* Trust line */}
        <p className="mt-8 text-sm text-muted-foreground/60">
          No signup required · Free to try
        </p>
      </div>
    </section>
  );
}
