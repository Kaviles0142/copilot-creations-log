import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function LandingHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-dark">
      <div className="container mx-auto px-6 py-4">
        <nav className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-full bg-hero-gradient flex items-center justify-center transition-transform group-hover:scale-105">
              <span className="text-primary-foreground font-display font-bold text-lg">N</span>
            </div>
            <span className="font-display text-xl font-semibold text-foreground">Never Gone</span>
          </Link>

          {/* Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#figures" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Figures
            </a>
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
          </div>

          {/* CTA */}
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" className="hidden sm:inline-flex text-muted-foreground hover:text-foreground">
              <Link to="/auth">Sign In</Link>
            </Button>
            <Button asChild className="bg-hero-gradient hover:opacity-90 transition-opacity">
              <Link to="/dashboard">Start Free</Link>
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}