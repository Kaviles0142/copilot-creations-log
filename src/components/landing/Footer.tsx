import { useNavigate } from 'react-router-dom';

export default function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="border-t border-border/10 py-12 px-6">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <span className="text-lg font-bold tracking-tight font-display">
          NeverGone<span className="text-primary">.</span>
        </span>

        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <button onClick={() => navigate('/admin')} className="hover:text-foreground transition-colors">
            Admin
          </button>
          <button onClick={() => navigate('/old')} className="hover:text-foreground transition-colors">
            Legacy
          </button>
        </div>

        <p className="text-xs text-muted-foreground/50">
          © {new Date().getFullYear()} NeverGone. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
