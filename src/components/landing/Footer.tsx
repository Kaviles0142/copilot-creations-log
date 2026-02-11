import { useNavigate } from 'react-router-dom';

export default function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="border-t border-border/10 py-10 sm:py-12 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
          <span className="text-base sm:text-lg font-bold tracking-tight font-display">
            NeverGone<span className="text-primary">.</span>
          </span>

          <div className="flex items-center gap-5 sm:gap-6 text-xs sm:text-sm text-muted-foreground">
            <button onClick={() => navigate('/admin')} className="hover:text-foreground transition-colors">
              Admin
            </button>
            <button onClick={() => navigate('/old')} className="hover:text-foreground transition-colors">
              Legacy App
            </button>
          </div>

          <p className="text-[10px] sm:text-xs text-muted-foreground/40">
            © {new Date().getFullYear()} NeverGone
          </p>
        </div>
      </div>
    </footer>
  );
}
