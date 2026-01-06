import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LogOut, Search, MessageSquare, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
}

const suggestedFigures = [
  { id: "einstein", name: "Albert Einstein", era: "Physicist" },
  { id: "cleopatra", name: "Cleopatra", era: "Egyptian Queen" },
  { id: "shakespeare", name: "William Shakespeare", era: "Playwright" },
  { id: "davinci", name: "Leonardo da Vinci", era: "Renaissance Polymath" },
  { id: "curie", name: "Marie Curie", era: "Scientist" },
  { id: "napoleon", name: "Napoleon Bonaparte", era: "Emperor" },
];

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFigures, setSelectedFigures] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      // Query the profiles table - type will be updated after migration sync
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
  const displayName = profile?.display_name || user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Guest";

  const toggleFigure = (id: string) => {
    setSelectedFigures(prev => 
      prev.includes(id) 
        ? prev.filter(f => f !== id)
        : [...prev, id]
    );
  };

  const handleStartConversation = () => {
    // Navigate to conversation with selected figures
    console.log("Starting conversation with:", selectedFigures);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-hero-gradient flex items-center justify-center">
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
                  <Button variant="ghost" size="sm" onClick={signOut}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </Button>
                </>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link to="/auth">Sign In</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
            {isGuest ? (
              <>Welcome, <span className="text-gradient">Time Traveler</span></>
            ) : (
              <>Welcome back, <span className="text-gradient">{displayName}</span></>
            )}
          </h1>
          <p className="text-lg text-muted-foreground">
            {isGuest 
              ? "You're exploring as a guest. Sign in to save your conversations."
              : "Ready to explore history? Choose the minds you'd like to converse with."}
          </p>
        </div>

        {/* Start Conversation Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-semibold">Start a Conversation</h2>
              <p className="text-muted-foreground">Search for historical figures or choose from suggestions</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search for a historical figure..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 py-6 text-lg"
            />
          </div>

          {/* Suggested Figures */}
          <div className="mb-6">
            <p className="text-sm text-muted-foreground mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Suggested figures
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestedFigures.map((figure) => (
                <Badge
                  key={figure.id}
                  variant={selectedFigures.includes(figure.id) ? "default" : "outline"}
                  className={`cursor-pointer py-2 px-4 text-sm transition-all ${
                    selectedFigures.includes(figure.id)
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-secondary"
                  }`}
                  onClick={() => toggleFigure(figure.id)}
                >
                  {figure.name}
                  <span className="ml-1 opacity-60">· {figure.era}</span>
                </Badge>
              ))}
            </div>
          </div>

          {/* Selected */}
          {selectedFigures.length > 0 && (
            <div className="mb-6 p-4 bg-secondary/50 rounded-xl">
              <p className="text-sm font-medium mb-2">
                Selected ({selectedFigures.length}):
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedFigures.map(id => {
                  const figure = suggestedFigures.find(f => f.id === id);
                  return (
                    <Badge key={id} className="bg-primary text-primary-foreground">
                      {figure?.name}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* Start Button */}
          <Button 
            className="w-full bg-hero-gradient hover:opacity-90 py-6 text-lg"
            disabled={selectedFigures.length === 0}
            onClick={handleStartConversation}
          >
            <MessageSquare className="w-5 h-5 mr-2" />
            Start Conversation
          </Button>
        </div>

        {/* Quick Link to Legacy */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Looking for the original experience?{" "}
            <Link to="/old" className="text-primary hover:underline">
              Try the legacy app
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
