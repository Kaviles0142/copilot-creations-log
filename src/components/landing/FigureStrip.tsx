import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import einstein from '@/assets/figures/einstein.jpg';
import cleopatra from '@/assets/figures/cleopatra.jpg';
import davinci from '@/assets/figures/davinci.jpg';
import napoleon from '@/assets/figures/napoleon.jpg';
import shakespeare from '@/assets/figures/shakespeare.jpg';
import curie from '@/assets/figures/curie.jpg';

const figures = [
  { name: 'Albert Einstein', era: '1879–1955', role: 'Theoretical Physicist', image: einstein },
  { name: 'Cleopatra VII', era: '69–30 BC', role: 'Pharaoh of Egypt', image: cleopatra },
  { name: 'Leonardo da Vinci', era: '1452–1519', role: 'Polymath & Artist', image: davinci },
  { name: 'Napoleon Bonaparte', era: '1769–1821', role: 'Military Strategist', image: napoleon },
  { name: 'William Shakespeare', era: '1564–1616', role: 'Playwright & Poet', image: shakespeare },
  { name: 'Marie Curie', era: '1867–1934', role: 'Physicist & Chemist', image: curie },
];

export default function FigureStrip() {
  const navigate = useNavigate();

  return (
    <section id="figures" className="py-20 sm:py-28 px-4 sm:px-6 border-t border-border/10">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 sm:mb-16">
          <p className="text-[11px] sm:text-xs uppercase tracking-[0.25em] text-primary font-semibold mb-3">
            The Collection
          </p>
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight max-w-md mx-auto">
            Over 50 figures spanning 3,000 years of history
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {figures.map((figure) => (
            <div
              key={figure.name}
              className="group relative rounded-2xl overflow-hidden border border-border/15 bg-card/30 hover:border-primary/20 transition-all duration-500 cursor-pointer"
              onClick={() => navigate('/join')}
            >
              <div className="aspect-[3/4] overflow-hidden">
                <img
                  src={figure.image}
                  alt={figure.name}
                  className="w-full h-full object-cover grayscale-[0.15] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
              </div>
              <div className="absolute bottom-0 inset-x-0 p-3 sm:p-4">
                <p className="text-xs sm:text-sm font-semibold text-foreground leading-tight">{figure.name}</p>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">{figure.role}</p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground/60 mt-0.5">{figure.era}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-10 sm:mt-12">
          <Button
            variant="outline"
            onClick={() => navigate('/join')}
            className="rounded-full px-6 gap-2 text-sm border-border/30 hover:bg-muted/40 group"
          >
            View all figures
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </div>
      </div>
    </section>
  );
}
