import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  MessageSquare, 
  Users, 
  Sparkles, 
  Globe, 
  Mic, 
  Video,
  ArrowRight,
  Play,
  Zap
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
    description: 'Chat with historical figures as if they were alive today with AI-powered authentic responses.'
  },
  {
    icon: Users,
    title: 'Multi-Person Rooms',
    description: 'Invite friends to join conversations. Watch debates unfold between great minds.'
  },
  {
    icon: Mic,
    title: 'Voice Cloning',
    description: 'Hear historical figures speak with AI-reconstructed voices based on records.'
  },
  {
    icon: Video,
    title: 'Animated Avatars',
    description: 'Watch portraits come alive with lip-sync animation as figures respond.'
  },
  {
    icon: Globe,
    title: 'Historical Context',
    description: 'Responses draw from Wikipedia, books, and documents for authenticity.'
  },
  {
    icon: Sparkles,
    title: 'Special Modes',
    description: 'Set up debates between figures or create podcast-style interviews.'
  },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-muted/20" />
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-accent/5 rounded-full blur-[100px]" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-xl border-b border-border/30">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-display font-semibold tracking-tight">
            Never Gone
          </span>
          <Button onClick={() => navigate('/join')} size="sm" className="gap-2 rounded-full px-5">
            Start Chatting <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-24 px-6">
        <div className="container mx-auto text-center max-w-4xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8">
            <Zap className="w-3.5 h-3.5" />
            AI-Powered Historical Conversations
          </div>

          {/* Main headline */}
          <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
            Talk to History's
            <span className="block text-primary">Greatest Minds</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed">
            Have real-time conversations with Einstein, Cleopatra, Da Vinci, and more. 
            Experience history like never before.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
            <Button 
              size="lg" 
              onClick={() => navigate('/join')}
              className="text-base px-8 py-6 gap-2.5 rounded-full shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 transition-all"
            >
              <Play className="w-4 h-4" />
              Start Free Conversation
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-base px-8 py-6 gap-2 rounded-full"
            >
              Learn More
            </Button>
          </div>

          {/* Floating Figure Avatars */}
          <div className="relative h-36 sm:h-40">
            <div className="absolute inset-0 flex items-center justify-center">
              {figures.map((figure, index) => {
                const offset = (index - 2.5) * 15;
                const scale = 1 - Math.abs(index - 2.5) * 0.05;
                return (
                  <div 
                    key={figure.name}
                    className="absolute transition-all duration-500 ease-out hover:scale-110 hover:z-20 cursor-pointer group"
                    style={{
                      left: `${18 + index * 13}%`,
                      transform: `translateX(-50%) rotate(${offset * 0.3}deg) scale(${scale})`,
                      zIndex: 10 - Math.abs(index - 2.5),
                    }}
                  >
                    <div className="relative">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden ring-4 ring-background shadow-2xl group-hover:ring-primary/30 transition-all duration-300">
                        <img 
                          src={figure.image} 
                          alt={figure.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:-translate-y-1">
                        <div className="bg-popover border border-border px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                          <span className="text-sm font-medium block">{figure.name}</span>
                          <span className="text-xs text-muted-foreground">{figure.era}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="py-8 border-y border-border/30 bg-muted/20">
        <div className="container mx-auto px-6">
          <div className="flex flex-wrap items-center justify-center gap-12 text-muted-foreground">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">50+</div>
              <div className="text-sm">Historical Figures</div>
            </div>
            <div className="h-8 w-px bg-border hidden sm:block" />
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">1,000+</div>
              <div className="text-sm">Daily Conversations</div>
            </div>
            <div className="h-8 w-px bg-border hidden sm:block" />
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">Real-time</div>
              <div className="text-sm">Voice & Video</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Experience History Like Never Before
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Cutting-edge AI brings historical figures to life with authentic personalities.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature) => (
              <Card 
                key={feature.title}
                className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 border-border/50 bg-card/50 backdrop-blur-sm"
              >
                <CardContent className="p-6">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                    <feature.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-6 bg-muted/20">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Start in 3 Simple Steps
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Create a Room', description: 'Start a new conversation room or join with a code.' },
              { step: '2', title: 'Choose Figures', description: 'Select which historical figures you want to talk to.' },
              { step: '3', title: 'Start Talking', description: 'Type or speak. Watch history come alive.' },
            ].map((item, index) => (
              <div key={item.step} className="text-center relative">
                {index < 2 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px bg-border" />
                )}
                <div className="w-16 h-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-5 text-xl font-bold shadow-lg shadow-primary/20">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="container mx-auto max-w-3xl">
          <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-primary/5 via-card to-accent/5">
            <CardContent className="p-10 md:p-14 text-center">
              <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
                Ready to Meet History?
              </h2>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
                Join thousands exploring the past through conversation. No signup required.
              </p>
              <Button 
                size="lg" 
                onClick={() => navigate('/join')}
                className="text-base px-10 py-6 gap-2.5 rounded-full shadow-lg shadow-primary/20"
              >
                <MessageSquare className="w-4 h-4" />
                Start Your First Conversation
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border/30">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span className="font-medium">Never Gone — Where History Lives On</span>
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
