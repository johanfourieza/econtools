import { useEffect, useState, useRef } from 'react';
import { X, ChevronRight, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OnboardingStep, ONBOARDING_STEPS } from '@/hooks/useOnboarding';
import { cn } from '@/lib/utils';

interface OnboardingTooltipProps {
  step: OnboardingStep | null;
  currentIndex: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
  onDismiss: () => void;
}

export function OnboardingTooltip({
  step,
  currentIndex,
  totalSteps,
  onNext,
  onSkip,
  onDismiss,
}: OnboardingTooltipProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!step?.targetSelector) {
      setIsVisible(false);
      return;
    }

    const updatePosition = () => {
      const target = document.querySelector(step.targetSelector!);
      if (!target || !tooltipRef.current) {
        setIsVisible(false);
        return;
      }

      const rect = target.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      
      let top = 0;
      let left = 0;

      switch (step.position) {
        case 'bottom':
          top = rect.bottom + 8;
          left = rect.left + rect.width / 2 - tooltipRect.width / 2;
          break;
        case 'top':
          top = rect.top - tooltipRect.height - 8;
          left = rect.left + rect.width / 2 - tooltipRect.width / 2;
          break;
        case 'left':
          top = rect.top + rect.height / 2 - tooltipRect.height / 2;
          left = rect.left - tooltipRect.width - 8;
          break;
        case 'right':
          top = rect.top + rect.height / 2 - tooltipRect.height / 2;
          left = rect.right + 8;
          break;
        default:
          top = rect.bottom + 8;
          left = rect.left;
      }

      // Keep tooltip within viewport
      left = Math.max(16, Math.min(left, window.innerWidth - tooltipRect.width - 16));
      top = Math.max(16, Math.min(top, window.innerHeight - tooltipRect.height - 16));

      setPosition({ top, left });
      setIsVisible(true);
    };

    // Initial positioning
    const timer = setTimeout(updatePosition, 100);
    
    // Update on resize
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [step]);

  if (!step) return null;

  const isLastStep = currentIndex === totalSteps - 1;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-foreground/10 z-[100] animate-fade-in"
        onClick={onDismiss}
      />
      
      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={cn(
          "fixed z-[101] w-72 bg-card border border-border rounded-lg shadow-lg p-4 animate-fade-in",
          !isVisible && "opacity-0"
        )}
        style={{ top: position.top, left: position.left }}
      >
        {/* Close button */}
        <button 
          onClick={onDismiss}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Progress indicator */}
        <div className="flex gap-1 mb-3">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= currentIndex ? "bg-accent" : "bg-secondary"
              )}
            />
          ))}
        </div>

        {/* Content */}
        <h4 className="font-display font-semibold text-sm mb-1">{step.title}</h4>
        <p className="text-xs text-muted-foreground mb-4">{step.description}</p>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={onSkip}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <SkipForward className="w-3 h-3" />
            Skip all
          </button>
          <Button size="sm" onClick={onNext} className="gap-1">
            {isLastStep ? 'Done' : 'Next'}
            {!isLastStep && <ChevronRight className="w-3 h-3" />}
          </Button>
        </div>
      </div>
    </>
  );
}
