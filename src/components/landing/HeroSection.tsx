import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 pb-16 px-6 overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-primary/5 blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-accent/5 blur-3xl animate-float" style={{ animationDelay: "3s" }} />
      </div>

      <div className="container mx-auto text-center relative z-10">
        {/* Main Heading */}
        <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6 opacity-0 animate-fade-in-up">
          Talk to the Past,
          <br />
          <span className="text-gradient">Learn for the Future</span>
        </h1>

        {/* Subheading */}
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 opacity-0 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          Chat with historical figures like Einstein, Cleopatra, or Shakespeare using AI. 
          Experience history through immersive voice conversations and build your personal journal of wisdom.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6 opacity-0 animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
          <Button 
            asChild 
            size="lg" 
            className="bg-hero-gradient hover:opacity-90 transition-all text-lg px-8 py-6 shadow-lg hover:shadow-xl"
          >
            <Link to="/auth" className="flex items-center gap-2">
              Begin Your Journey
              <ArrowRight className="w-5 h-5" />
            </Link>
          </Button>
        </div>

        <p className="text-sm text-muted-foreground opacity-0 animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
          Join thousands of time travelers
        </p>
      </div>
    </section>
  );
}
