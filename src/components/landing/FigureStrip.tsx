import einstein from '@/assets/figures/einstein.jpg';
import cleopatra from '@/assets/figures/cleopatra.jpg';
import davinci from '@/assets/figures/davinci.jpg';
import napoleon from '@/assets/figures/napoleon.jpg';
import shakespeare from '@/assets/figures/shakespeare.jpg';
import curie from '@/assets/figures/curie.jpg';

const figures = [
  { name: 'Albert Einstein', role: 'Physicist', image: einstein },
  { name: 'Cleopatra', role: 'Pharaoh', image: cleopatra },
  { name: 'Leonardo da Vinci', role: 'Polymath', image: davinci },
  { name: 'Napoleon Bonaparte', role: 'Emperor', image: napoleon },
  { name: 'William Shakespeare', role: 'Playwright', image: shakespeare },
  { name: 'Marie Curie', role: 'Scientist', image: curie },
];

export default function FigureStrip() {
  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-6">
        <p className="text-center text-sm text-muted-foreground mb-10 tracking-wide">
          Choose from 50+ historical figures
        </p>
        
        <div className="flex items-center justify-center gap-6 md:gap-10 flex-wrap">
          {figures.map((figure) => (
            <div 
              key={figure.name}
              className="group relative flex flex-col items-center"
            >
              <div className="relative">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden ring-2 ring-border/40 group-hover:ring-primary/60 transition-all duration-500 group-hover:scale-110 shadow-lg group-hover:shadow-xl group-hover:shadow-primary/10">
                  <img 
                    src={figure.image} 
                    alt={figure.name}
                    className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-500"
                  />
                </div>
                {/* Glow effect on hover */}
                <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
              </div>
              
              {/* Name and role below avatar */}
              <div className="mt-3 text-center opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                <p className="text-xs font-medium text-foreground">{figure.name.split(' ')[0]}</p>
                <p className="text-[10px] text-muted-foreground">{figure.role}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Additional context */}
        <p className="text-center text-xs text-muted-foreground/60 mt-10">
          Scientists · Artists · Leaders · Philosophers · Inventors
        </p>
      </div>
    </section>
  );
}
