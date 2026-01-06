import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut, Search, ArrowRight, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

// Import figure images
import einsteinImg from "@/assets/figures/einstein.jpg";
import cleopatraImg from "@/assets/figures/cleopatra.jpg";
import shakespeareImg from "@/assets/figures/shakespeare.jpg";
import davinciImg from "@/assets/figures/davinci.jpg";
import curieImg from "@/assets/figures/curie.jpg";
import napoleonImg from "@/assets/figures/napoleon.jpg";

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
}

const suggestedFigures = [
  { id: "einstein", name: "Albert Einstein", title: "Physicist", image: einsteinImg },
  { id: "cleopatra", name: "Cleopatra", title: "Queen of Egypt", image: cleopatraImg },
  { id: "shakespeare", name: "William Shakespeare", title: "Playwright", image: shakespeareImg },
  { id: "davinci", name: "Leonardo da Vinci", title: "Polymath", image: davinciImg },
  { id: "curie", name: "Marie Curie", title: "Scientist", image: curieImg },
  { id: "napoleon", name: "Napoleon Bonaparte", title: "Emperor", image: napoleonImg },
];

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFigure, setSelectedFigure] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles" as any)
        .select("display_name, avatar_url")
        .eq("user_id", user?.id)
        .single();
      
      if (!error && data) {
        setProfile({
          display_name: (data as any).display_name,
          avatar_url: (data as any).avatar_url,
        });
      }
    } catch (err) {
      console.log("Profile not found, using defaults");
    }
  };

  const isGuest = !user;
  const displayName = profile?.display_name || user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Explorer";

  const handleStartConversation = () => {
    navigate('/join');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass-dark sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-full bg-hero-gradient flex items-center justify-center transition-transform group-hover:scale-105">
                <span className="text-primary-foreground font-display font-bold text-lg">N</span>
              </div>
              <span className="font-display text-xl font-semibold text-foreground">Never Gone</span>
            </Link>

            <div className="flex items-center gap-4">
              {user ? (
                <>
                  <span className="text-sm text-muted-foreground hidden sm:block">
                    {user.email}
                  </span>
                  <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </Button>
                </>
              ) : (
                <Button asChild variant="outline" size="sm" className="border-border hover:bg-card">
                  <Link to="/auth">Sign In</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        {/* Welcome */}
        <div className="max-w-3xl mb-12">
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
            {isGuest ? (
              <>Welcome, <span className="text-gradient">Explorer</span></>
            ) : (
              <>Welcome back, <span className="text-gradient">{displayName}</span></>
            )}
          </h1>
          <p className="text-lg text-muted-foreground">
            Choose a historical figure to start your conversation.
          </p>
        </div>

        {/* Search */}
        <div className="max-w-xl mb-10">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search historical figures..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-14 text-base bg-card border-border"
            />
          </div>
        </div>

        {/* Figures Grid */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Sparkles className="w-4 h-4" />
            <span>Available Figures</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {suggestedFigures.map((figure) => (
              <button
                key={figure.id}
                onClick={() => setSelectedFigure(selectedFigure === figure.id ? null : figure.id)}
                className={`group relative aspect-[3/4] rounded-xl overflow-hidden transition-all duration-300 ${
                  selectedFigure === figure.id 
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-[1.02]' 
                    : 'hover:scale-[1.02]'
                }`}
              >
                <img
                  src={figure.image}
                  alt={figure.name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <h3 className="font-display text-sm font-semibold text-foreground truncate">
                    {figure.name}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {figure.title}
                  </p>
                </div>
                {selectedFigure === figure.id && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-primary-foreground text-xs">✓</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Start Button */}
        <div className="max-w-xl">
          <Button 
            className="w-full h-14 bg-hero-gradient hover:opacity-90 text-lg glow-sm"
            disabled={!selectedFigure}
            onClick={handleStartConversation}
          >
            Start Conversation
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          {isGuest && (
            <p className="text-center text-sm text-muted-foreground mt-4">
              <Link to="/auth" className="text-primary hover:underline">Sign in</Link> to save your conversations
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;