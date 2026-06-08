"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { UserRole } from "@/lib/types";

type TourStep = {
  selector: string;
  href?: string;
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

const sharedOpeningSteps: TourStep[] = [
  {
    selector: "[data-tour='brand']",
    icon: "flag",
    title: "Your 4DX workspace",
    body: "This is where the team turns strategy into weekly execution: WIGs, lead measures, scoreboards, activity logs, commitments, and alerts.",
    placement: "right",
  },
  {
    selector: "[data-tour='team-switcher']",
    icon: "groups",
    title: "Active team",
    body: "When you belong to more than one team, this switcher controls which WIGs, members, sessions, and activity data you are viewing.",
    placement: "right",
  },
  {
    selector: "[data-tour='notifications']",
    icon: "notifications",
    title: "Notification center",
    body: "Use this bell for approvals, declined logs, weekly session reminders, WIG risks, owner changes, and deadline alerts.",
    placement: "bottom",
  },
  {
    selector: "[data-tour='navigation']",
    icon: "near_me",
    title: "Role-based navigation",
    body: "The sidebar only shows the tools available to your current role. The tutorial follows the same role rules.",
    placement: "right",
  },
];

const memberSteps: TourStep[] = [
  ...sharedOpeningSteps,
  {
    href: "/dashboard/scoreboard",
    selector: "[data-tour='nav-scoreboard']",
    icon: "scoreboard",
    title: "Start with the scoreboard",
    body: "Members use the scoreboard to see whether the team is winning, which lead measures are moving, and how much time remains.",
    placement: "right",
  },
  {
    href: "/dashboard/scoreboard",
    selector: "[data-tour='main-content']",
    icon: "monitoring",
    title: "Read the current WIG",
    body: "The main area shows active WIG progress, lead measure completion, owner contributions, and recent trends based on approved work.",
    placement: "center",
  },
  {
    href: "/dashboard/activity",
    selector: "[data-tour='activity-form']",
    icon: "edit_note",
    title: "Log lead measure activity",
    body: "Choose the WIG, choose the lead measure you own, enter the result, add the date and optional context, then submit it for approval.",
    placement: "center",
  },
  {
    href: "/dashboard/activity",
    selector: "[data-tour='activity-submit']",
    icon: "pending_actions",
    title: "Submit for confirmation",
    body: "Submitted activity waits for the team lead. It updates the scoreboard only after approval, which keeps the score trusted.",
    placement: "bottom",
  },
  {
    href: "/dashboard/activity",
    selector: "[data-tour='activity-pending']",
    icon: "hourglass_top",
    title: "Track pending logs",
    body: "Recently submitted work appears here while it waits for approval. Editable pending logs can be corrected within the allowed window.",
    placement: "center",
  },
  {
    href: "/dashboard/activity",
    selector: "[data-tour='activity-recent']",
    icon: "history",
    title: "Review your history",
    body: "Recent logs help you confirm what you submitted, what was approved, and the notes attached to your execution work.",
    placement: "center",
  },
  {
    href: "/dashboard/session",
    selector: "[data-tour='session-overview']",
    icon: "event",
    title: "Weekly execution session",
    body: "This page supports the weekly execution rhythm: review progress, capture commitments, note blockers, and complete the session.",
    placement: "center",
  },
  {
    href: "/dashboard/members",
    selector: "[data-tour='members-list']",
    icon: "groups",
    title: "Know the team",
    body: "Members shows who belongs to the active team and who owns team responsibilities.",
    placement: "center",
  },
  {
    href: "/dashboard/settings",
    selector: "[data-tour='main-content']",
    icon: "settings",
    title: "Manage your account",
    body: "Settings is where you maintain your profile and password while staying inside the same execution workspace.",
    placement: "center",
  },
];

const teamLeadSteps: TourStep[] = [
  ...sharedOpeningSteps,
  {
    href: "/dashboard/team-lead",
    selector: "[data-tour='main-content']",
    icon: "leaderboard",
    title: "Team lead command center",
    body: "This dashboard summarizes execution health, pending work, sessions, and risks for the team you are leading.",
    placement: "center",
  },
  {
    href: "/dashboard/wigs",
    selector: "[data-tour='wigs-header']",
    icon: "emoji_events",
    title: "Manage WIGs",
    body: "The WIGs page is where team leads create, review, activate, and close the team's wildly important goals.",
    placement: "center",
  },
  {
    href: "/dashboard/wigs",
    selector: "[data-tour='create-wig-button']",
    icon: "add_circle",
    title: "Create a WIG",
    body: "Use Create WIG to define the goal statement, tracking style, baseline, target, unit, deadline, and context.",
    placement: "left",
  },
  {
    href: "/dashboard/wigs",
    selector: "[data-tour='wigs-tabs']",
    icon: "inventory_2",
    title: "Current and closed goals",
    body: "Current WIGs show draft or active goals. Closed History keeps achieved, missed, and abandoned goals separated from active execution.",
    placement: "bottom",
  },
  {
    href: "/dashboard/wigs",
    selector: "[data-tour='wigs-list']",
    icon: "list_alt",
    title: "Open a WIG to configure it",
    body: "Click a WIG card to edit the goal, add lead measures, assign owners, activate the goal, or close it when the outcome is settled.",
    placement: "center",
  },
  {
    href: "/dashboard/activity",
    selector: "[data-tour='activity-form']",
    icon: "edit_note",
    title: "Team leads can also log activity",
    body: "If you own a lead measure, log your contribution here just like a member. It still follows the approval workflow.",
    placement: "center",
  },
  {
    href: "/dashboard/team-lead/requests",
    selector: "[data-tour='requests-header']",
    icon: "fact_check",
    title: "Approve activity requests",
    body: "Pending member submissions arrive here. Approving verified activity is what moves the scoreboard.",
    placement: "center",
  },
  {
    href: "/dashboard/team-lead/requests",
    selector: "[data-tour='approve-all']",
    icon: "done_all",
    title: "Bulk approval",
    body: "When all visible requests are valid, approve them together. Otherwise review each request before approving or declining.",
    placement: "left",
  },
  {
    href: "/dashboard/session",
    selector: "[data-tour='session-overview']",
    icon: "event_available",
    title: "Run weekly sessions",
    body: "Use weekly sessions to review execution, capture notes, add commitments, record blockers, and complete the session.",
    placement: "center",
  },
  {
    href: "/dashboard/members",
    selector: "[data-tour='members-add-button']",
    icon: "person_add",
    title: "Manage team members",
    body: "Team leads can view the roster and add existing organization users to the selected team when allowed.",
    placement: "left",
  },
  {
    href: "/dashboard/team-lead/reports",
    selector: "[data-tour='main-content']",
    icon: "bar_chart",
    title: "Review reports",
    body: "Reports help you inspect activity, session consistency, lead measure movement, and execution trends.",
    placement: "center",
  },
];

const adminSteps: TourStep[] = [
  ...sharedOpeningSteps.filter((step) => step.selector !== "[data-tour='team-switcher']"),
  {
    href: "/dashboard/admin",
    selector: "[data-tour='main-content']",
    icon: "admin_panel_settings",
    title: "Admin dashboard",
    body: "Admins monitor organization execution health, risk areas, overdue sessions, WIG performance, and activity patterns.",
    placement: "center",
  },
  {
    href: "/dashboard/admin/teams",
    selector: "[data-tour='admin-teams-header']",
    icon: "groups",
    title: "Team management",
    body: "Create teams, assign team leads, expand a team, add members, and maintain the structure used across 4DX execution.",
    placement: "center",
  },
  {
    href: "/dashboard/admin/teams",
    selector: "[data-tour='admin-create-team']",
    icon: "add_circle",
    title: "Create teams",
    body: "Use Create Team when a new unit needs its own WIGs, members, scoreboard, and execution rhythm.",
    placement: "left",
  },
  {
    href: "/dashboard/admin/teams",
    selector: "[data-tour='admin-teams-grid']",
    icon: "account_tree",
    title: "Inspect team structure",
    body: "Each team card exposes leads, members, assignments, and member-management actions.",
    placement: "center",
  },
  {
    href: "/dashboard/admin/users",
    selector: "[data-tour='admin-users-header']",
    icon: "people",
    title: "Organization users",
    body: "Admins can search users, check roles and team assignments, create accounts, and remove users when needed.",
    placement: "center",
  },
  {
    href: "/dashboard/admin/users",
    selector: "[data-tour='admin-create-user']",
    icon: "person_add",
    title: "Create a user",
    body: "Create User is for direct account creation when an admin wants to provision someone without the invite flow.",
    placement: "left",
  },
  {
    href: "/dashboard/admin/invites",
    selector: "[data-tour='invite-form']",
    icon: "mail",
    title: "Generate invite links",
    body: "Invites can be open or locked to an email, optionally assigned to a team, and configured with an expiry window.",
    placement: "center",
  },
  {
    href: "/dashboard/admin/invites",
    selector: "[data-tour='invite-submit']",
    icon: "link",
    title: "Share controlled access",
    body: "Generate the link, copy it, and share it with the person joining the organization.",
    placement: "bottom",
  },
  {
    href: "/dashboard/admin/invites",
    selector: "[data-tour='active-invites']",
    icon: "mark_email_unread",
    title: "Track active invites",
    body: "Active invites show who has access outstanding, when links expire, and which links should be revoked.",
    placement: "center",
  },
  {
    href: "/dashboard/admin/activity",
    selector: "[data-tour='main-content']",
    icon: "insights",
    title: "Audit organization activity",
    body: "Org Activity gives admins a history view for execution events, user actions, and operational traceability.",
    placement: "center",
  },
];

const roleTours: Record<UserRole, TourStep[]> = {
  ADMIN: adminSteps,
  TEAM_LEAD: teamLeadSteps,
  MEMBER: memberSteps,
};

function getStorageKey(userId?: string | null, role?: UserRole | null) {
  return `4dx:onboarding-tour:${role || "role"}:${userId || "workspace"}`;
}

function getHighlightRect(selector: string): HighlightRect | null {
  const element = document.querySelector(selector);
  if (!element) return null;

  const rect = element.getBoundingClientRect();
  return {
    top: Math.max(10, rect.top - 8),
    left: Math.max(10, rect.left - 8),
    width: Math.min(window.innerWidth - 20, rect.width + 16),
    height: Math.min(window.innerHeight - 20, rect.height + 16),
  };
}

export function OnboardingTour({
  userId,
  role,
}: {
  userId?: string | null;
  role?: UserRole | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const steps = useMemo(() => (role ? roleTours[role] : memberSteps), [role]);
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);
  const [isWaitingForTarget, setIsWaitingForTarget] = useState(false);
  const storageKey = useMemo(() => getStorageKey(userId, role), [role, userId]);
  const currentStep = steps[stepIndex] || steps[0];

  const finishTour = useCallback(() => {
    window.localStorage.setItem(storageKey, "complete");
    setIsOpen(false);
  }, [storageKey]);

  const goBack = useCallback(() => {
    setStepIndex((current) => Math.max(0, current - 1));
  }, []);

  const goNext = useCallback(() => {
    setStepIndex((current) => {
      if (current === steps.length - 1) {
        window.localStorage.setItem(storageKey, "complete");
        setIsOpen(false);
        return current;
      }

      return Math.min(steps.length - 1, current + 1);
    });
  }, [steps.length, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !role) return;
    const hasCompletedTour = window.localStorage.getItem(storageKey) === "complete";
    if (!hasCompletedTour) {
      const timer = window.setTimeout(() => setIsOpen(true), 500);
      return () => window.clearTimeout(timer);
    }
  }, [role, storageKey]);

  useEffect(() => {
    const openTour = () => {
      setStepIndex(0);
      setIsOpen(true);
    };

    window.addEventListener("4dx:start-onboarding-tour", openTour);
    return () => window.removeEventListener("4dx:start-onboarding-tour", openTour);
  }, []);

  useEffect(() => {
    if (!isOpen || !currentStep?.href || pathname === currentStep.href) return;
    router.push(currentStep.href);
  }, [currentStep?.href, isOpen, pathname, router]);

  useEffect(() => {
    if (!isOpen || !currentStep) return;

    let attempts = 0;
    let timeoutId: number | undefined;

    const updateHighlight = () => {
      const nextRect = getHighlightRect(currentStep.selector);
      if (nextRect) {
        setHighlightRect(nextRect);
        setIsWaitingForTarget(false);
        return;
      }

      setIsWaitingForTarget(true);
      setHighlightRect(null);
      attempts += 1;
      if (attempts < 20) {
        timeoutId = window.setTimeout(updateHighlight, 120);
      }
    };

    updateHighlight();
    window.addEventListener("resize", updateHighlight);
    window.addEventListener("scroll", updateHighlight, true);
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      window.removeEventListener("resize", updateHighlight);
      window.removeEventListener("scroll", updateHighlight, true);
    };
  }, [currentStep, isOpen, pathname]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finishTour();
      if (event.key === "ArrowRight") goNext();
      if (event.key === "ArrowLeft") goBack();
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
        left: `${Math.min(window.innerWidth - 410, Math.max(16, highlightRect.left - 260))}px`,
        top: `${Math.min(window.innerHeight - 290, highlightRect.top + highlightRect.height + 16)}px`,
      };
    }

    if (currentStep.placement === "left") {
      return {
        left: `${Math.max(16, highlightRect.left - 406)}px`,
        top: `${Math.min(window.innerHeight - 290, Math.max(16, highlightRect.top))}px`,
      };
    }

    return {
      left: `${Math.min(window.innerWidth - 410, highlightRect.left + highlightRect.width + 16)}px`,
      top: `${Math.min(window.innerHeight - 290, Math.max(16, highlightRect.top))}px`,
    };
  })();

  if (!isOpen || !currentStep) return null;

  const roleLabel = role === "ADMIN" ? "Admin" : role === "TEAM_LEAD" ? "Team Lead" : "Member";

  return (
    <div className="tour-root" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {highlightRect ? (
        <>
          <div className="tour-shade top" style={{ height: highlightRect.top }} />
          <div className="tour-shade left" style={{ top: highlightRect.top, width: highlightRect.left, height: highlightRect.height }} />
          <div className="tour-shade right" style={{ top: highlightRect.top, left: highlightRect.left + highlightRect.width, height: highlightRect.height }} />
          <div className="tour-shade bottom" style={{ top: highlightRect.top + highlightRect.height }} />
          <div
            className="tour-highlight"
            style={{
              top: highlightRect.top,
              left: highlightRect.left,
              width: highlightRect.width,
              height: highlightRect.height,
            }}
          />
        </>
      ) : (
        <div className="tour-shade full" />
      )}

      <section className="tour-panel" style={panelStyle}>
        <div className="tour-progress" aria-hidden="true">
          {steps.map((step, index) => (
            <span key={`${step.title}-${index}`} className={index <= stepIndex ? "active" : ""} />
          ))}
        </div>

        <div className="tour-role-row">
          <span>{roleLabel} tutorial</span>
          <span>{stepIndex + 1} / {steps.length}</span>
        </div>

        <div className="tour-header">
          <span className="material-symbols-outlined">{currentStep.icon}</span>
          <div>
            <h2 id="tour-title">{currentStep.title}</h2>
          </div>
        </div>

        <p className="tour-body">
          {isWaitingForTarget ? "Moving to the right part of the platform..." : currentStep.body}
        </p>

        <div className="tour-actions">
          <button type="button" className="tour-text-button" onClick={finishTour}>
            Skip tutorial
          </button>
          <div>
            <button type="button" className="tour-secondary-button" onClick={goBack} disabled={stepIndex === 0}>
              Back
            </button>
            <button type="button" className="tour-primary-button" onClick={goNext}>
              {stepIndex === steps.length - 1 ? "Finish" : "Next"}
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

        .tour-shade {
          position: absolute;
          background: rgba(10, 15, 28, 0.58);
          pointer-events: auto;
        }

        .tour-shade.top {
          top: 0;
          left: 0;
          right: 0;
        }

        .tour-shade.left {
          left: 0;
        }

        .tour-shade.right {
          right: 0;
        }

        .tour-shade.bottom {
          left: 0;
          right: 0;
          bottom: 0;
        }

        .tour-shade.full {
          inset: 0;
        }

        .tour-highlight {
          position: absolute;
          border: 2px solid #ffffff;
          border-radius: 8px;
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.22), 0 0 0 4px rgba(37, 99, 235, 0.22);
          pointer-events: none;
          animation: tourPulse 1.8s ease-in-out infinite;
        }

        .tour-panel {
          position: absolute;
          width: min(390px, calc(100vw - 32px));
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
          grid-template-columns: repeat(${steps.length}, minmax(4px, 1fr));
          gap: 4px;
          margin-bottom: 14px;
        }

        .tour-progress span {
          height: 4px;
          border-radius: 999px;
          background: #e4e4e7;
        }

        .tour-progress span.active {
          background: #18181b;
        }

        .tour-role-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          color: #71717a;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .tour-header {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .tour-header > span {
          width: 42px;
          height: 42px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #eff6ff;
          color: #1d4ed8;
          flex: 0 0 auto;
          font-size: 23px;
        }

        .tour-header h2 {
          margin: 0;
          color: #18181b;
          font-size: 20px;
          line-height: 1.25;
          font-weight: 800;
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
          font-weight: 800;
          cursor: pointer;
        }

        .tour-text-button {
          background: transparent;
          color: #71717a;
          padding-left: 0;
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
            transform: scale(1.01);
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
