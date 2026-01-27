import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import HeroSection from '@/components/landing/HeroSection';
import FigureStrip from '@/components/landing/FigureStrip';
import LiveDemoPreview from '@/components/landing/LiveDemoPreview';
import Footer from '@/components/landing/Footer';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/20">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-lg font-semibold tracking-tight">
            Never Gone
          </span>
          <Button 
            onClick={() => navigate('/join')} 
            size="sm" 
            variant="ghost"
            className="gap-2 rounded-full"
          >
            Enter <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <HeroSection />

      {/* Figure strip */}
      <FigureStrip />

      {/* Live demo preview */}
      <LiveDemoPreview />

      {/* Footer */}
      <Footer />
    </div>
  );
}
