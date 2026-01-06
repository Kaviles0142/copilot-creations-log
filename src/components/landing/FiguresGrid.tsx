interface HistoricalFigure {
  id: string;
  name: string;
  era: string;
  imageUrl: string;
}

const figures: HistoricalFigure[] = [
  {
    id: "einstein",
    name: "Albert Einstein",
    era: "1879-1955",
    imageUrl: "https://images.unsplash.com/photo-1621155346337-1d19476ba7d6?w=400&h=500&fit=crop&crop=face",
  },
  {
    id: "cleopatra",
    name: "Cleopatra",
    era: "69-30 BC",
    imageUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=500&fit=crop",
  },
  {
    id: "shakespeare",
    name: "William Shakespeare",
    era: "1564-1616",
    imageUrl: "https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?w=400&h=500&fit=crop",
  },
  {
    id: "davinci",
    name: "Leonardo da Vinci",
    era: "1452-1519",
    imageUrl: "https://images.unsplash.com/photo-1578926375605-eaf7559b1458?w=400&h=500&fit=crop",
  },
  {
    id: "curie",
    name: "Marie Curie",
    era: "1867-1934",
    imageUrl: "https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=400&h=500&fit=crop",
  },
  {
    id: "napoleon",
    name: "Napoleon Bonaparte",
    era: "1769-1821",
    imageUrl: "https://images.unsplash.com/photo-1580130775562-0ef92da028de?w=400&h=500&fit=crop",
  },
  {
    id: "queen-elizabeth",
    name: "Queen Elizabeth I",
    era: "1533-1603",
    imageUrl: "https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?w=400&h=500&fit=crop",
  },
  {
    id: "aristotle",
    name: "Aristotle",
    era: "384-322 BC",
    imageUrl: "https://images.unsplash.com/photo-1589308078059-be1415eab4c3?w=400&h=500&fit=crop",
  },
];

export function FiguresGrid() {
  return (
    <section className="py-20 px-6 bg-secondary/30">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Meet the Minds of History
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Choose from renowned historical figures and engage in conversations that transcend time.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {figures.map((figure, index) => (
            <div
              key={figure.id}
              className="group relative aspect-[4/5] rounded-xl overflow-hidden figure-card-hover cursor-pointer opacity-0 animate-fade-in-up"
              style={{ animationDelay: `${0.1 * index}s` }}
            >
              {/* Image */}
              <img
                src={figure.imageUrl}
                alt={figure.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/90 via-foreground/20 to-transparent" />
              
              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className="font-display text-lg font-semibold text-primary-foreground mb-1">
                  {figure.name}
                </h3>
                <p className="text-sm text-primary-foreground/70">
                  {figure.era}
                </p>
              </div>

              {/* Hover Ring */}
              <div className="absolute inset-0 ring-2 ring-primary/0 group-hover:ring-primary/50 rounded-xl transition-all duration-300" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
