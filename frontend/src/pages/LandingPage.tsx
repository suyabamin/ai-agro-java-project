import React from 'react';
import { useActiveSection } from '../hooks/useScrollReveal';
import { LandingNavbar } from '../components/landing/LandingNavbar';
import { LandingHero } from '../components/landing/LandingHero';
import { AiIntelligenceShowcase } from '../components/landing/AiIntelligenceShowcase';
import {
  FeaturesSection,
  FinalCtaSection,
  HowItWorksSection,
  LandingFooter,
  RoleExperienceSection,
} from '../components/landing/LandingSections';

const SECTION_IDS = ['hero', 'ai-intelligence', 'how-it-works', 'features', 'about'];

export const LandingPage: React.FC = () => {
  const activeSection = useActiveSection(SECTION_IDS, 'hero');

  return (
    <div className="min-h-screen flex flex-col bg-surface text-on-surface font-sans overflow-x-hidden selection:bg-secondary-container selection:text-on-secondary-container">
      <LandingNavbar activeSection={activeSection} />
      <main className="flex-1 w-full">
        <LandingHero />
        <AiIntelligenceShowcase />
        <HowItWorksSection />
        <FeaturesSection />
        <RoleExperienceSection />
        <FinalCtaSection />
      </main>
      <LandingFooter />
    </div>
  );
};
