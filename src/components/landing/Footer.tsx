import { useNavigate } from 'react-router-dom';

export default function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="py-12 px-6 border-t border-border/30">
      <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Never Gone</span>
        
        <p className="text-center md:text-left">
          Where history lives on
        </p>
        
        <div className="flex items-center gap-6">
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
            Legacy
          </button>
        </div>
      </div>
    </footer>
  );
}
