import { useNavigate } from 'react-router-dom';

export default function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="py-16 px-6 border-t border-border/20 bg-muted/20">
      <div className="container mx-auto max-w-4xl">
        <div className="flex flex-col items-center text-center gap-6">
          <span className="text-2xl font-semibold text-foreground">Never Gone</span>
          
          <p className="text-muted-foreground max-w-md">
            Bridging centuries through conversation. 
            Experience history like never before.
          </p>
          
          <div className="flex items-center gap-8 text-sm text-muted-foreground">
            <button 
              onClick={() => navigate('/admin')} 
              className="hover:text-foreground transition-colors"
            >
              Admin
            </button>
            <button 
              onClick={() => navigate('/old')} 
              className="hover:text-foreground transition-colors"
            >
              Legacy App
            </button>
          </div>

          <div className="w-full h-px bg-border/30 my-4" />
          
          <p className="text-xs text-muted-foreground/60">
            © 2024 Never Gone. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
