// Import figure images
import einsteinImg from "@/assets/figures/einstein.jpg";
import cleopatraImg from "@/assets/figures/cleopatra.jpg";
import shakespeareImg from "@/assets/figures/shakespeare.jpg";
import davinciImg from "@/assets/figures/davinci.jpg";
import curieImg from "@/assets/figures/curie.jpg";
import napoleonImg from "@/assets/figures/napoleon.jpg";

interface HistoricalFigure {
  id: string;
  name: string;
  title: string;
  era: string;
  image: string;
}

const figures: HistoricalFigure[] = [
  {
    id: "einstein",
    name: "Albert Einstein",
    title: "Theoretical Physicist",
    era: "1879–1955",
    image: einsteinImg,
  },
  {
    id: "cleopatra",
    name: "Cleopatra",
    title: "Queen of Egypt",
    era: "69–30 BC",
    image: cleopatraImg,
  },
  {
    id: "shakespeare",
    name: "William Shakespeare",
    title: "Playwright & Poet",
    era: "1564–1616",
    image: shakespeareImg,
  },
  {
    id: "davinci",
    name: "Leonardo da Vinci",
    title: "Renaissance Polymath",
    era: "1452–1519",
    image: davinciImg,
  },
  {
    id: "curie",
    name: "Marie Curie",
    title: "Pioneering Scientist",
    era: "1867–1934",
    image: curieImg,
  },
  {
    id: "napoleon",
    name: "Napoleon Bonaparte",
    title: "French Emperor",
    era: "1769–1821",
    image: napoleonImg,
  },
];

export function FiguresGrid() {
  return (
    <section id="figures" className="py-24 px-6 bg-subtle-gradient">
      <div className="container mx-auto">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4 opacity-0 animate-fade-in-up">
            Meet History's <span className="text-gradient">Greatest Minds</span>
          </h2>
          <p className="text-lg text-muted-foreground opacity-0 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            Choose from renowned historical figures and engage in conversations that transcend time.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {figures.map((figure, index) => (
            <div
              key={figure.id}
              className="group relative aspect-[3/4] rounded-2xl overflow-hidden figure-card-hover cursor-pointer opacity-0 animate-fade-in-up"
              style={{ animationDelay: `${0.1 + index * 0.08}s` }}
            >
              {/* Image */}
              <img
                src={figure.image}
                alt={figure.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />
              
              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
                <p className="text-xs uppercase tracking-wider text-primary mb-1 font-medium">
                  {figure.era}
                </p>
                <h3 className="font-display text-lg md:text-xl font-semibold text-foreground mb-1">
                  {figure.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {figure.title}
                </p>
              </div>

              {/* Hover Border */}
              <div className="absolute inset-0 rounded-2xl ring-1 ring-border/50 group-hover:ring-primary/50 transition-all duration-300" />
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-12 opacity-0 animate-fade-in" style={{ animationDelay: "0.6s" }}>
          <p className="text-muted-foreground">
            And many more historical figures to discover...
          </p>
        </div>
      </div>
    </section>
  );
}