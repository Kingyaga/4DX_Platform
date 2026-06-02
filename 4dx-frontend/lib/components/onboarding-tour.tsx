"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type TourStep = {
  selector: string;
  icon: string;
  title: string;
  body: string;
  placement: "right" | "left" | "bottom" | "center";
};

type HighlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const TOUR_STEPS: TourStep[] = [
  {
    selector: "[data-tour='brand']",
    icon: "flag",
    title: "Welcome to 4DX",
    body: "This workspace keeps the team focused on wildly important goals, lead measures, weekly commitments, and a visible scoreboard.",
    placement: "right",
  },
  {
    selector: "[data-tour='team-switcher']",
    icon: "groups",
    title: "Choose the active team",
    body: "If you belong to more than one team, switch here before viewing WIGs, logging activity, or running weekly sessions.",
    placement: "right",
  },
  {
    selector: "[data-tour='notifications']",
    icon: "notifications",
    title: "Watch important updates",
    body: "Notifications show approvals, session reminders, ownership changes, WIG risks, and deadline alerts so nothing important gets missed.",
    placement: "bottom",
  },
  {
    selector: "[data-tour='navigation']",
    icon: "near_me",
    title: "Move through the workflow",
    body: "Use the sidebar to open the Scoreboard, WIG setup, Activity Log, Weekly Session, Members, reports, and admin tools available for your role.",
    placement: "right",
  },
  {
    selector: "[data-tour='main-content']",
    icon: "dashboard",
    title: "Work from the main area",
    body: "This area changes based on the page: review goals, log activity, approve requests, inspect reports, or complete the weekly cadence.",
    placement: "center",
  },
];

function getStorageKey(userId?: string | null) {
  return `4dx:onboarding-tour:${userId || "workspace"}`;
}

function getHighlightRect(selector: string): HighlightRect | null {
  const element = document.querySelector(selector);
  if (!element) return null;

  const rect = element.getBoundingClientRect();
  return {
    top: Math.max(12, rect.top - 8),
    left: Math.max(12, rect.left - 8),
    width: rect.width + 16,
    height: rect.height + 16,
  };
}

export function OnboardingTour({ userId }: { userId?: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);
  const storageKey = useMemo(() => getStorageKey(userId), [userId]);
  const currentStep = TOUR_STEPS[stepIndex];

  const finishTour = useCallback(() => {
    window.localStorage.setItem(storageKey, "complete");
    setIsOpen(false);
  }, [storageKey]);

  const goBack = useCallback(() => {
    setStepIndex((current) => Math.max(0, current - 1));
  }, []);

  const goNext = useCallback(() => {
    setStepIndex((current) => {
      if (current === TOUR_STEPS.length - 1) {
        window.localStorage.setItem(storageKey, "complete");
        setIsOpen(false);
        return current;
      }

      return Math.min(TOUR_STEPS.length - 1, current + 1);
    });
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasCompletedTour = window.localStorage.getItem(storageKey) === "complete";
    if (!hasCompletedTour) {
      const timer = window.setTimeout(() => setIsOpen(true), 450);
      return () => window.clearTimeout(timer);
    }
  }, [storageKey]);

  useEffect(() => {
    const openTour = () => {
      setStepIndex(0);
      setIsOpen(true);
    };

    window.addEventListener("4dx:start-onboarding-tour", openTour);
    return () => window.removeEventListener("4dx:start-onboarding-tour", openTour);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const updateHighlight = () => {
      setHighlightRect(getHighlightRect(currentStep.selector));
    };

    updateHighlight();
    window.addEventListener("resize", updateHighlight);
    window.addEventListener("scroll", updateHighlight, true);
    return () => {
      window.removeEventListener("resize", updateHighlight);
      window.removeEventListener("scroll", updateHighlight, true);
    };
  }, [currentStep, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        finishTour();
      }
      if (event.key === "ArrowRight") {
        goNext();
      }
      if (event.key === "ArrowLeft") {
        goBack();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [finishTour, goBack, goNext, isOpen]);

  const panelStyle = (() => {
    if (!highlightRect || currentStep.placement === "center") {
      return {
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    if (currentStep.placement === "bottom") {
      return {
        left: `${Math.min(window.innerWidth - 390, Math.max(16, highlightRect.left - 260))}px`,
        top: `${Math.min(window.innerHeight - 280, highlightRect.top + highlightRect.height + 16)}px`,
      };
    }

    if (currentStep.placement === "left") {
      return {
        left: `${Math.max(16, highlightRect.left - 386)}px`,
        top: `${Math.min(window.innerHeight - 280, Math.max(16, highlightRect.top))}px`,
      };
    }

    return {
      left: `${Math.min(window.innerWidth - 390, highlightRect.left + highlightRect.width + 16)}px`,
      top: `${Math.min(window.innerHeight - 280, Math.max(16, highlightRect.top))}px`,
    };
  })();

  if (!isOpen) return null;

  return (
    <div className="tour-root" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="tour-scrim" />
      {highlightRect && (
        <div
          className="tour-highlight"
          style={{
            top: highlightRect.top,
            left: highlightRect.left,
            width: highlightRect.width,
            height: highlightRect.height,
          }}
        />
      )}
      <section className="tour-panel" style={panelStyle}>
        <div className="tour-progress" aria-hidden="true">
          {TOUR_STEPS.map((step, index) => (
            <span key={step.title} className={index <= stepIndex ? "active" : ""} />
          ))}
        </div>

        <div className="tour-header">
          <span className="material-symbols-outlined">{currentStep.icon}</span>
          <div>
            <p>Step {stepIndex + 1} of {TOUR_STEPS.length}</p>
            <h2 id="tour-title">{currentStep.title}</h2>
          </div>
        </div>

        <p className="tour-body">{currentStep.body}</p>

        <div className="tour-actions">
          <button type="button" className="tour-text-button" onClick={finishTour}>
            Skip
          </button>
          <div>
            <button type="button" className="tour-secondary-button" onClick={goBack} disabled={stepIndex === 0}>
              Back
            </button>
            <button type="button" className="tour-primary-button" onClick={goNext}>
              {stepIndex === TOUR_STEPS.length - 1 ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </section>

      <style jsx>{`
        .tour-root {
          position: fixed;
          inset: 0;
          z-index: 1200;
          pointer-events: none;
        }

        .tour-scrim {
          position: absolute;
          inset: 0;
          background: rgba(10, 15, 28, 0.58);
          backdrop-filter: blur(2px);
          pointer-events: auto;
        }

        .tour-highlight {
          position: absolute;
          border: 2px solid #ffffff;
          border-radius: 8px;
          box-shadow: 0 0 0 9999px rgba(10, 15, 28, 0.28), 0 18px 48px rgba(0, 0, 0, 0.22);
          pointer-events: none;
          animation: tourPulse 1.8s ease-in-out infinite;
        }

        .tour-panel {
          position: absolute;
          width: min(360px, calc(100vw - 32px));
          background: #ffffff;
          border: 1px solid #dbe1ea;
          border-radius: 8px;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.28);
          padding: 20px;
          pointer-events: auto;
          animation: tourPanelIn 180ms ease-out;
        }

        .tour-progress {
          display: grid;
          grid-template-columns: repeat(${TOUR_STEPS.length}, 1fr);
          gap: 6px;
          margin-bottom: 18px;
        }

        .tour-progress span {
          height: 4px;
          border-radius: 999px;
          background: #e4e4e7;
          overflow: hidden;
        }

        .tour-progress span.active {
          background: #18181b;
        }

        .tour-header {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .tour-header > span {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #f0f5ff;
          color: #1f4f99;
          flex: 0 0 auto;
          font-size: 22px;
        }

        .tour-header p {
          margin: 1px 0 4px 0;
          color: #71717a;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .tour-header h2 {
          margin: 0;
          color: #18181b;
          font-size: 20px;
          line-height: 1.25;
          font-weight: 750;
        }

        .tour-body {
          color: #4b5563;
          font-size: 14px;
          line-height: 1.65;
          margin: 16px 0 20px 0;
        }

        .tour-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .tour-actions > div {
          display: flex;
          gap: 8px;
        }

        .tour-text-button,
        .tour-secondary-button,
        .tour-primary-button {
          border-radius: 6px;
          min-height: 36px;
          padding: 0 13px;
          border: 1px solid transparent;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .tour-text-button {
          background: transparent;
          color: #71717a;
        }

        .tour-secondary-button {
          background: #ffffff;
          border-color: #d4d4d8;
          color: #18181b;
        }

        .tour-secondary-button:disabled {
          opacity: 0.42;
          cursor: not-allowed;
        }

        .tour-primary-button {
          background: #18181b;
          color: #ffffff;
        }

        @keyframes tourPulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.015);
          }
        }

        @keyframes tourPanelIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 760px) {
          .tour-panel {
            left: 16px !important;
            right: 16px;
            top: auto !important;
            bottom: 16px;
            transform: none !important;
            width: auto;
          }
        }
      `}</style>
    </div>
  );
}
