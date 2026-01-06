import { LandingHeader } from "@/components/landing/LandingHeader";
import { HeroSection } from "@/components/landing/HeroSection";
import { FiguresGrid } from "@/components/landing/FiguresGrid";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { LandingFooter } from "@/components/landing/LandingFooter";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      <main>
        <HeroSection />
        <FiguresGrid />
        <FeaturesSection />
      </main>
      <LandingFooter />
    </div>
  );
};

export default Landing;
