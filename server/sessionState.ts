export type SessionProgress = {
  accountDoneAt?: Date | string | null;
  reviewDoneAt?: Date | string | null;
  commitDoneAt?: Date | string | null;
};

export function getResumeStep(session: SessionProgress) {
  if (session.commitDoneAt) return 3;
  if (session.reviewDoneAt) return 2;
  if (session.accountDoneAt) return 1;
  return 0;
}

export function assertSessionStepAllowed(session: SessionProgress, nextStep: "review" | "commit") {
  if (nextStep === "review" && !session.accountDoneAt) {
    throw new Error("You must complete the Account step before reviewing the scoreboard.");
  }

  if (nextStep === "commit" && (!session.accountDoneAt || !session.reviewDoneAt)) {
    throw new Error("You must complete the Account and Review steps first.");
  }
}
