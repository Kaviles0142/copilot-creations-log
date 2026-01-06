import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function LandingHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-effect">
      <div className="container mx-auto px-6 py-4">
        <nav className="flex items-center justify-between">
          {/* Logo Section */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-hero-gradient flex items-center justify-center">
              <span className="text-primary-foreground font-display font-bold text-lg">N</span>
            </div>
            <span className="font-display text-xl font-semibold text-foreground">Never Gone</span>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
              <span>Built with</span>
              <a 
                href="https://lovable.dev" 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-semibold text-primary hover:underline"
              >
                Lovable
              </a>
            </div>
            <Button asChild className="bg-hero-gradient hover:opacity-90 transition-opacity">
              <Link to="/auth">Get Started</Link>
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}
