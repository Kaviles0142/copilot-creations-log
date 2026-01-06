import { MessageSquare, Clock, BookOpen } from "lucide-react";

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: <MessageSquare className="w-8 h-8" />,
    title: "AI-Powered Conversations",
    description: "Engage in realistic dialogues powered by advanced AI that captures the essence of historical personalities.",
  },
  {
    icon: <Clock className="w-8 h-8" />,
    title: "Time Travel Experience",
    description: "Immerse yourself in different eras through authentic voice interactions and period-accurate responses.",
  },
  {
    icon: <BookOpen className="w-8 h-8" />,
    title: "Personal Journal",
    description: "Save your favorite conversations and build a collection of wisdom from history's greatest minds.",
  },
];

export function FeaturesSection() {
  return (
    <section className="py-20 px-6">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Why Never Gone?
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Experience history like never before with our cutting-edge features.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group p-8 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-lg opacity-0 animate-fade-in-up"
              style={{ animationDelay: `${0.15 * index}s` }}
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                {feature.icon}
              </div>
              <h3 className="font-display text-xl font-semibold mb-3">
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
