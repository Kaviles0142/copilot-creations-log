import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Phone, Sparkles, Users, BookOpen, ArrowRight } from 'lucide-react';

// Import figure images
import einstein from '@/assets/figures/einstein.jpg';
import cleopatra from '@/assets/figures/cleopatra.jpg';
import davinci from '@/assets/figures/davinci.jpg';
import napoleon from '@/assets/figures/napoleon.jpg';
import shakespeare from '@/assets/figures/shakespeare.jpg';
import curie from '@/assets/figures/curie.jpg';

const figures = [
  { name: 'Einstein', image: einstein, subject: 'Physics', color: 'from-blue-500 to-cyan-400' },
  { name: 'Cleopatra', image: cleopatra, subject: 'History', color: 'from-amber-500 to-yellow-400' },
  { name: 'Da Vinci', image: davinci, subject: 'Art & Science', color: 'from-purple-500 to-pink-400' },
  { name: 'Napoleon', image: napoleon, subject: 'Strategy', color: 'from-red-500 to-orange-400' },
  { name: 'Shakespeare', image: shakespeare, subject: 'Literature', color: 'from-emerald-500 to-teal-400' },
  { name: 'Marie Curie', image: curie, subject: 'Chemistry', color: 'from-violet-500 to-indigo-400' },
];

const benefits = [
  {
    icon: Phone,
    title: 'Voice & Video Calls',
    description: 'Talk face-to-face with AI-powered historical figures',
  },
  {
    icon: BookOpen,
    title: 'Learn Any Subject',
    description: 'Get explanations from the experts who shaped history',
  },
  {
    icon: Users,
    title: 'Study Together',
    description: 'Invite friends to group calls with historical minds',
  },
  {
    icon: Sparkles,
    title: 'AI-Powered',
    description: 'Authentic personalities backed by real research',
  },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {/* Animated gradient background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-[#0a0a0f] to-[#0a0a0f]" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Phone className="w-4 h-4" />
            </div>
            <span className="text-xl font-bold tracking-tight">Never Gone</span>
          </div>
          <Button 
            onClick={() => navigate('/join')} 
            className="bg-white text-black hover:bg-white/90 rounded-full px-6 font-medium"
          >
            Start Calling
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-6 pt-16 pb-24">
        <div className="max-w-7xl mx-auto">
          {/* Badge */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-white/70">AI-powered learning for students</span>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-center text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] mb-6">
            <span className="block">Call History's</span>
            <span className="block bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
              Greatest Minds
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-center text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-12">
            Video call Einstein about physics. Chat with Shakespeare about literature. 
            Learn from the legends who shaped our world.
          </p>

          {/* CTA */}
          <div className="flex justify-center mb-20">
            <Button 
              size="lg"
              onClick={() => navigate('/join')}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-full px-10 py-7 text-lg font-semibold shadow-lg shadow-purple-500/25 transition-all hover:shadow-xl hover:shadow-purple-500/30 hover:scale-105"
            >
              Start Your First Call
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>

          {/* Figure Gallery */}
          <div className="relative">
            <div className="text-center mb-8">
              <p className="text-sm uppercase tracking-widest text-white/40 font-medium">Choose who to call</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-5xl mx-auto">
              {figures.map((figure, index) => (
                <button
                  key={figure.name}
                  onClick={() => navigate('/join')}
                  className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/30 transition-all duration-300 hover:scale-105 hover:-translate-y-1"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Image */}
                  <img 
                    src={figure.image} 
                    alt={figure.name}
                    className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500"
                  />
                  
                  {/* Gradient overlay */}
                  <div className={`absolute inset-0 bg-gradient-to-t ${figure.color} opacity-0 group-hover:opacity-30 transition-opacity duration-300`} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                  
                  {/* Call indicator */}
                  <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-green-500/20 border border-green-500/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 scale-75 group-hover:scale-100">
                    <Phone className="w-3.5 h-3.5 text-green-400" />
                  </div>
                  
                  {/* Info */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="font-bold text-lg leading-tight mb-0.5">{figure.name}</h3>
                    <p className="text-xs text-white/50">{figure.subject}</p>
                  </div>
                </button>
              ))}
            </div>
            
            <p className="text-center text-white/30 text-sm mt-6">
              + 50 more historical figures available
            </p>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="relative px-6 py-24 bg-white/[0.02] border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit) => (
              <div 
                key={benefit.title}
                className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-4">
                  <benefit.icon className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{benefit.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative px-6 py-24">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to learn from the greats?
          </h2>
          <p className="text-white/50 mb-8">
            No signup required. Start a call in seconds.
          </p>
          <Button 
            size="lg"
            onClick={() => navigate('/join')}
            className="bg-white text-black hover:bg-white/90 rounded-full px-10 py-6 text-lg font-semibold"
          >
            Start Free Call
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/30">
          <span>Never Gone — Where History Lives On</span>
          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/admin')} className="hover:text-white/60 transition-colors">
              Admin
            </button>
            <button onClick={() => navigate('/old')} className="hover:text-white/60 transition-colors">
              Legacy
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
