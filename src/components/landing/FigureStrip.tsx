import einstein from '@/assets/figures/einstein.jpg';
import cleopatra from '@/assets/figures/cleopatra.jpg';
import davinci from '@/assets/figures/davinci.jpg';
import napoleon from '@/assets/figures/napoleon.jpg';
import shakespeare from '@/assets/figures/shakespeare.jpg';
import curie from '@/assets/figures/curie.jpg';

const figures = [
  { name: 'Einstein', role: 'Physicist', image: einstein },
  { name: 'Cleopatra', role: 'Pharaoh', image: cleopatra },
  { name: 'Da Vinci', role: 'Polymath', image: davinci },
  { name: 'Napoleon', role: 'Emperor', image: napoleon },
  { name: 'Shakespeare', role: 'Playwright', image: shakespeare },
  { name: 'Curie', role: 'Scientist', image: curie },
];

export default function FigureStrip() {
  return (
    <section id="figures" className="py-24 px-6 border-t border-border/10">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs uppercase tracking-[0.2em] text-primary font-medium mb-3">Meet the minds</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
            50+ legendary figures, ready to talk
          </h2>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-6 md:gap-8">
          {figures.map((figure) => (
            <div key={figure.name} className="group flex flex-col items-center">
              <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden border border-border/30 group-hover:border-primary/40 transition-all duration-500 group-hover:scale-105 shadow-lg group-hover:shadow-xl group-hover:shadow-primary/10">
                <img
                  src={figure.image}
                  alt={figure.name}
                  className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent opacity-60 group-hover:opacity-0 transition-opacity duration-500" />
              </div>
              <p className="mt-3 text-xs font-semibold text-foreground/80 group-hover:text-foreground transition-colors">{figure.name}</p>
              <p className="text-[10px] text-muted-foreground">{figure.role}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground/50 mt-12 tracking-wide">
          Scientists · Artists · Leaders · Philosophers · Inventors · And many more
        </p>
      </div>
    </section>
  );
}
