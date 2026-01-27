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
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Minimal floating navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div className="mx-4 mt-4">
          <div className="container mx-auto max-w-6xl bg-background/70 backdrop-blur-2xl border border-border/30 rounded-2xl px-6 py-3 flex items-center justify-between shadow-lg shadow-black/5">
            <span className="text-lg font-semibold tracking-tight">
              Never Gone
            </span>
            <Button 
              onClick={() => navigate('/join')} 
              size="sm" 
              className="gap-2 rounded-full h-9 px-5"
            >
              Get started <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
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
