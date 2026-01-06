import { MessageSquare, Mic, BookOpen, Sparkles } from "lucide-react";

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: <Mic className="w-6 h-6" />,
    title: "Voice Conversations",
    description: "Speak naturally with historical figures using advanced voice AI that captures their unique personalities and knowledge.",
  },
  {
    icon: <Sparkles className="w-6 h-6" />,
    title: "AI-Powered Authenticity",
    description: "Each figure is crafted with deep historical research, ensuring accurate and engaging dialogues across any topic.",
  },
  {
    icon: <MessageSquare className="w-6 h-6" />,
    title: "Real-Time Chat",
    description: "Engage in seamless text conversations when you prefer typing, with instant responses from history's greatest minds.",
  },
  {
    icon: <BookOpen className="w-6 h-6" />,
    title: "Learn & Discover",
    description: "Save conversations, explore different perspectives, and build your personal archive of historical wisdom.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="container mx-auto">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4 opacity-0 animate-fade-in-up">
            Built for <span className="text-gradient">Immersive Learning</span>
          </h2>
          <p className="text-lg text-muted-foreground opacity-0 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            Experience history like never before with cutting-edge AI technology.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group p-8 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all duration-300 opacity-0 animate-fade-in-up"
              style={{ animationDelay: `${0.15 + index * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                {feature.icon}
              </div>
              <h3 className="font-display text-xl font-semibold mb-3 text-foreground">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}