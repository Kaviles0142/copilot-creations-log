import { Link } from "react-router-dom";

export function LandingFooter() {
  return (
    <footer className="py-16 px-6 border-t border-border">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-hero-gradient flex items-center justify-center">
              <span className="text-primary-foreground font-display font-bold">N</span>
            </div>
            <span className="font-display text-lg font-semibold text-foreground">Never Gone</span>
          </Link>

          {/* Links */}
          <div className="flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#figures" className="hover:text-foreground transition-colors">Figures</a>
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <Link to="/auth" className="hover:text-foreground transition-colors">Sign In</Link>
          </div>

          {/* Copyright */}
          <p className="text-sm text-muted-foreground">
            © 2026 Never Gone. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
