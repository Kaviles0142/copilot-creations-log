import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center px-6 pt-24 pb-12">
      {/* Multiple layered gradient orbs for depth */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/8 rounded-full blur-[180px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="relative z-10 text-center max-w-4xl mx-auto">
        {/* Refined label with dot separator */}
        <div className="inline-flex items-center gap-2 mb-8">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground font-medium">
            AI-Powered Historical Conversations
          </p>
        </div>

        {/* Main headline */}
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] mb-6">
          <span className="text-foreground">Talk to</span>
          <br />
          <span className="text-primary">history's greatest</span>
        </h1>

        {/* Subheadline */}
        <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
          Have real conversations with Einstein, Cleopatra, Da Vinci, and 50+ legendary figures. 
          Ask questions, debate ideas, and learn from the minds that shaped our world.
        </p>

        {/* Larger, more prominent CTA */}
        <Button 
          size="lg" 
          onClick={() => navigate('/join')}
          className="text-base h-14 px-12 gap-3 rounded-full shadow-2xl shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.02] transition-all duration-300 group"
        >
          Start your first conversation
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
        </Button>

        {/* Trust indicators with better spacing */}
        <div className="mt-10 flex items-center justify-center gap-6 text-sm text-muted-foreground/70">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/80" />
            Free to start
          </span>
          <span className="w-px h-4 bg-border" />
          <span>No signup needed</span>
          <span className="w-px h-4 bg-border" />
          <span>Voice & text</span>
        </div>
      </div>
    </section>
  );
}
