import einstein from '@/assets/figures/einstein.jpg';
import cleopatra from '@/assets/figures/cleopatra.jpg';
import davinci from '@/assets/figures/davinci.jpg';
import napoleon from '@/assets/figures/napoleon.jpg';
import shakespeare from '@/assets/figures/shakespeare.jpg';
import curie from '@/assets/figures/curie.jpg';

const figures = [
  { name: 'Einstein', image: einstein },
  { name: 'Cleopatra', image: cleopatra },
  { name: 'Da Vinci', image: davinci },
  { name: 'Napoleon', image: napoleon },
  { name: 'Shakespeare', image: shakespeare },
  { name: 'Marie Curie', image: curie },
];

export default function FigureStrip() {
  return (
    <section className="py-16 border-y border-border/30">
      <div className="container mx-auto px-6">
        <p className="text-center text-sm text-muted-foreground mb-8">
          Converse with legends across eras
        </p>
        
        <div className="flex items-center justify-center gap-4 md:gap-6 flex-wrap">
          {figures.map((figure) => (
            <div 
              key={figure.name}
              className="group relative"
            >
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden ring-2 ring-border/50 group-hover:ring-primary/50 transition-all duration-300 group-hover:scale-105">
                <img 
                  src={figure.image} 
                  alt={figure.name}
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-300"
                />
              </div>
              
              {/* Tooltip */}
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                <span className="text-xs text-muted-foreground whitespace-nowrap">{figure.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
