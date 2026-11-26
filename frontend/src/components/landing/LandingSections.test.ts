import { describe, it, expect } from 'vitest';
import { LANDING_NAV_ITEMS } from './LandingNavbar';

describe('Landing Page navigation & section integrity', () => {
  it('defines all required primary navigation anchors', () => {
    const ids = LANDING_NAV_ITEMS.map((item) => item.id);
    expect(ids).toEqual(['hero', 'features', 'how-it-works', 'ai-intelligence', 'about']);

    const labels = LANDING_NAV_ITEMS.map((item) => item.label);
    expect(labels).toEqual(['Home', 'Features', 'How It Works', 'AI Intelligence', 'About']);
  });
});
