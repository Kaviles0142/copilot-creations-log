import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

// Import figure images
import einsteinImg from "@/assets/figures/einstein.jpg";
import cleopatraImg from "@/assets/figures/cleopatra.jpg";
import shakespeareImg from "@/assets/figures/shakespeare.jpg";

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center pt-24 pb-20 px-6 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-primary/3 blur-[100px]" />
      </div>

      <div className="container mx-auto relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Content */}
          <div className="max-w-xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8 opacity-0 animate-fade-in">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">AI-Powered Historical Conversations</span>
            </div>

            {/* Headline */}
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] mb-6 opacity-0 animate-fade-in-up">
              Converse with
              <br />
              <span className="text-gradient">History's Greatest</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-10 opacity-0 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
              Engage in voice conversations with Einstein, Cleopatra, Shakespeare, and more. 
              Experience wisdom across millennia through immersive AI dialogue.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 opacity-0 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
              <Button 
                asChild 
                size="lg" 
                className="bg-hero-gradient hover:opacity-90 text-lg px-8 h-14 glow-sm"
              >
                <Link to="/dashboard" className="flex items-center gap-2">
                  Start Exploring
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button 
                asChild 
                variant="outline" 
                size="lg"
                className="text-lg px-8 h-14 border-border/50 hover:bg-card"
              >
                <Link to="/auth">Sign In</Link>
              </Button>
            </div>

            {/* Social Proof */}
            <div className="flex items-center gap-6 mt-12 opacity-0 animate-fade-in" style={{ animationDelay: "0.5s" }}>
              <div className="flex -space-x-3">
                {[einsteinImg, cleopatraImg, shakespeareImg].map((img, i) => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-background overflow-hidden">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="text-foreground font-semibold">50+ figures</span> ready to converse
              </p>
            </div>
          </div>

          {/* Right - Featured Figure Cards */}
          <div className="relative hidden lg:block">
            <div className="relative h-[600px]">
              {/* Main Card */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 opacity-0 animate-scale-in" style={{ animationDelay: "0.3s" }}>
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden glow-gold">
                  <img src={einsteinImg} alt="Albert Einstein" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <h3 className="font-display text-xl font-semibold text-foreground">Albert Einstein</h3>
                    <p className="text-sm text-muted-foreground">Theoretical Physicist</p>
                  </div>
                </div>
              </div>

              {/* Side Card 1 */}
              <div className="absolute top-8 left-0 w-48 opacity-0 animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
                <div className="relative aspect-[3/4] rounded-xl overflow-hidden border border-border/50">
                  <img src={cleopatraImg} alt="Cleopatra" className="w-full h-full object-cover opacity-80" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <h3 className="font-display text-sm font-semibold text-foreground">Cleopatra</h3>
                  </div>
                </div>
              </div>

              {/* Side Card 2 */}
              <div className="absolute bottom-8 right-0 w-48 opacity-0 animate-fade-in-up" style={{ animationDelay: "0.6s" }}>
                <div className="relative aspect-[3/4] rounded-xl overflow-hidden border border-border/50">
                  <img src={shakespeareImg} alt="Shakespeare" className="w-full h-full object-cover opacity-80" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <h3 className="font-display text-sm font-semibold text-foreground">Shakespeare</h3>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}