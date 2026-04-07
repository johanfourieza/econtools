import { useState, useEffect, useCallback } from 'react';

const ONBOARDING_STORAGE_KEY = 'kabbo_onboarding_completed';
const TOOLTIPS_DISMISSED_KEY = 'kabbo_tooltips_dismissed';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'new-bubble',
    title: 'Create Publications',
    description: 'Click "New Bubble" or press N to create a new research idea',
    targetSelector: '[data-onboarding="new-bubble"]',
    position: 'bottom',
  },
  {
    id: 'pipeline',
    title: 'Pipeline Stages',
    description: 'Drag cards between stages as your research progresses',
    targetSelector: '[data-onboarding="pipeline"]',
    position: 'bottom',
  },
  {
    id: 'published',
    title: 'Published Works',
    description: 'Toggle the Published view to see your completed publications by year',
    targetSelector: '[data-onboarding="published"]',
    position: 'bottom',
  },
  {
    id: 'collaboration',
    title: 'Collaborate',
    description: 'Invite co-authors to view or edit your publications together',
    targetSelector: '[data-onboarding="collaboration"]',
    position: 'bottom',
  },
];

export function useOnboarding() {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(() => {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
  });
  
  const [tooltipsDismissed, setTooltipsDismissed] = useState(() => {
    return localStorage.getItem(TOOLTIPS_DISMISSED_KEY) === 'true';
  });
  
  const [showQuickStart, setShowQuickStart] = useState(false);
  const [currentTooltipIndex, setCurrentTooltipIndex] = useState(0);

  // Check if this is the first visit
  useEffect(() => {
    if (!hasCompletedOnboarding && !tooltipsDismissed) {
      // Show quick start guide on first visit
      const timer = setTimeout(() => {
        setShowQuickStart(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [hasCompletedOnboarding, tooltipsDismissed]);

  const completeOnboarding = useCallback(() => {
    setHasCompletedOnboarding(true);
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
  }, []);

  const dismissTooltips = useCallback(() => {
    setTooltipsDismissed(true);
    localStorage.setItem(TOOLTIPS_DISMISSED_KEY, 'true');
  }, []);

  const resetOnboarding = useCallback(() => {
    setHasCompletedOnboarding(false);
    setTooltipsDismissed(false);
    setCurrentTooltipIndex(0);
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    localStorage.removeItem(TOOLTIPS_DISMISSED_KEY);
  }, []);

  const nextTooltip = useCallback(() => {
    if (currentTooltipIndex < ONBOARDING_STEPS.length - 1) {
      setCurrentTooltipIndex(prev => prev + 1);
    } else {
      completeOnboarding();
    }
  }, [currentTooltipIndex, completeOnboarding]);

  const skipTooltips = useCallback(() => {
    dismissTooltips();
    completeOnboarding();
  }, [dismissTooltips, completeOnboarding]);

  const openQuickStart = useCallback(() => {
    setShowQuickStart(true);
  }, []);

  const closeQuickStart = useCallback(() => {
    setShowQuickStart(false);
    if (!hasCompletedOnboarding) {
      // Start showing tooltips after closing quick start
      setCurrentTooltipIndex(0);
    }
  }, [hasCompletedOnboarding]);

  return {
    hasCompletedOnboarding,
    tooltipsDismissed,
    showQuickStart,
    currentTooltipIndex,
    currentStep: tooltipsDismissed ? null : ONBOARDING_STEPS[currentTooltipIndex],
    completeOnboarding,
    dismissTooltips,
    resetOnboarding,
    nextTooltip,
    skipTooltips,
    openQuickStart,
    closeQuickStart,
  };
}
