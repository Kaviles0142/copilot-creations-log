import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  MessageSquare, 
  Users, 
  Sparkles, 
  Clock, 
  Globe, 
  Mic, 
  Video,
  ArrowRight,
  Play,
  Star
} from 'lucide-react';

// Import figure images
import einstein from '@/assets/figures/einstein.jpg';
import cleopatra from '@/assets/figures/cleopatra.jpg';
import davinci from '@/assets/figures/davinci.jpg';
import napoleon from '@/assets/figures/napoleon.jpg';
import shakespeare from '@/assets/figures/shakespeare.jpg';
import curie from '@/assets/figures/curie.jpg';

const figures = [
  { name: 'Einstein', image: einstein, era: '1879-1955' },
  { name: 'Cleopatra', image: cleopatra, era: '69-30 BC' },
  { name: 'Da Vinci', image: davinci, era: '1452-1519' },
  { name: 'Napoleon', image: napoleon, era: '1769-1821' },
  { name: 'Shakespeare', image: shakespeare, era: '1564-1616' },
  { name: 'Marie Curie', image: curie, era: '1867-1934' },
];

const features = [
  {
    icon: MessageSquare,
    title: 'Real-Time Conversations',
    description: 'Chat with historical figures as if they were alive today. AI-powered responses in their authentic voice and perspective.'
  },
  {
    icon: Users,
    title: 'Multi-Person Rooms',
    description: 'Invite friends to join conversations. Watch debates unfold between Einstein and Da Vinci in real-time.'
  },
  {
    icon: Mic,
    title: 'Voice Cloning',
    description: 'Hear historical figures speak with AI-reconstructed voices based on historical records and recordings.'
  },
  {
    icon: Video,
    title: 'Animated Avatars',
    description: 'Watch portraits come alive with lip-sync animation as figures respond to your questions.'
  },
  {
    icon: Globe,
    title: 'Historical Context',
    description: 'Responses draw from Wikipedia, books, and historical documents for authentic perspectives.'
  },
  {
    icon: Sparkles,
    title: 'Debate & Podcast Modes',
    description: 'Set up debates between figures or create podcast-style interviews on any topic.'
  },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Animated background gradient */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/10" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/60 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Never Gone
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>
              Admin
            </Button>
            <Button onClick={() => navigate('/join')} className="gap-2">
              Start Chatting <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 animate-fade-in">
            <Sparkles className="w-4 h-4" />
            AI-Powered Historical Conversations
          </div>

          {/* Main headline */}
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 animate-fade-in">
            <span className="bg-gradient-to-r from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent">
              Talk to History's
            </span>
            <br />
            <span className="bg-gradient-to-r from-primary via-primary to-primary/60 bg-clip-text text-transparent">
              Greatest Minds
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in delay-100">
            Have real-time conversations with Einstein, Cleopatra, Da Vinci, and more. 
            Experience history like never before.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16 animate-fade-in delay-200">
            <Button 
              size="lg" 
              onClick={() => navigate('/join')}
              className="text-lg px-8 py-6 gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25"
            >
              <Play className="w-5 h-5" />
              Start Free Conversation
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-lg px-8 py-6 gap-2"
            >
              Learn More
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>

          {/* Floating Figure Avatars */}
          <div className="relative max-w-4xl mx-auto h-32 animate-fade-in delay-300">
            <div className="absolute inset-0 flex items-center justify-center">
              {figures.map((figure, index) => (
                <div 
                  key={figure.name}
                  className="absolute transition-all duration-500 hover:scale-110 hover:z-10 cursor-pointer group"
                  style={{
                    left: `${15 + index * 14}%`,
                    transform: `translateX(-50%) rotate(${(index - 2.5) * 5}deg)`,
                    zIndex: figures.length - Math.abs(index - 2.5),
                  }}
                >
                  <div className="relative">
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-4 border-background shadow-xl group-hover:border-primary/50 transition-colors">
                      <img 
                        src={figure.image} 
                        alt={figure.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      <span className="text-sm font-medium">{figure.name}</span>
                      <span className="text-xs text-muted-foreground block">{figure.era}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-12 border-y border-border/50 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-center justify-center gap-8 text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/60 to-primary/30 border-2 border-background" />
                ))}
              </div>
              <span className="text-sm">1,000+ conversations daily</span>
            </div>
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(i => (
                <Star key={i} className="w-4 h-4 fill-primary text-primary" />
              ))}
              <span className="text-sm ml-2">Loved by history enthusiasts</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Experience History <span className="text-primary">Like Never Before</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Cutting-edge AI technology brings historical figures to life with authentic personalities and knowledge.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card 
                key={feature.title}
                className="group hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1 border-border/50 bg-card/50 backdrop-blur-sm animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Start in <span className="text-primary">3 Simple Steps</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: '01', title: 'Create a Room', description: 'Start a new conversation room or join an existing one with a room code.' },
              { step: '02', title: 'Choose Your Figures', description: 'Select which historical figures you want to talk to. Mix eras and personalities.' },
              { step: '03', title: 'Start Talking', description: 'Type or speak your questions. Watch as history comes alive with AI-powered responses.' },
            ].map((item, index) => (
              <div key={item.step} className="text-center animate-fade-in" style={{ animationDelay: `${index * 150}ms` }}>
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-primary">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4">
        <div className="container mx-auto">
          <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-secondary/5">
            <div className="absolute inset-0 bg-grid-pattern opacity-5" />
            <CardContent className="p-12 md:p-16 text-center relative">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                Ready to Meet History?
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
                Join thousands of curious minds exploring the past through conversation. No signup required.
              </p>
              <Button 
                size="lg" 
                onClick={() => navigate('/join')}
                className="text-lg px-10 py-6 gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25"
              >
                <MessageSquare className="w-5 h-5" />
                Start Your First Conversation
                <ArrowRight className="w-5 h-5" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border/50">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>Never Gone — Where History Lives On</span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/admin')} className="hover:text-foreground transition-colors">
              Admin
            </button>
            <button onClick={() => navigate('/old')} className="hover:text-foreground transition-colors">
              Legacy App
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
