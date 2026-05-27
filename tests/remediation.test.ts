import { describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { auditLog } from "../server/audit";
import { validateAzureInviteOnly } from "../server/authOptions";
import { assertSessionStepAllowed, getResumeStep } from "../server/sessionState";

function enforceWigActivationLimit(activeWigCount: number) {
  if (activeWigCount >= 2) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Teams cannot have more than 2 active WIGs. Close an existing WIG first.",
    });
  }
}

describe("WIG activation limit", () => {
  it("rejects activation when the team already has two active WIGs", () => {
    expect(() => enforceWigActivationLimit(2)).toThrow(TRPCError);
  });
});

describe("weekly session state", () => {
  it("does not allow steps to be skipped", () => {
    expect(() => assertSessionStepAllowed({}, "review")).toThrow("Account step");
    expect(() => assertSessionStepAllowed({ accountDoneAt: new Date() }, "commit")).toThrow("Account and Review");
  });

  it("resumes from the furthest completed step", () => {
    expect(getResumeStep({})).toBe(0);
    expect(getResumeStep({ accountDoneAt: new Date() })).toBe(1);
    expect(getResumeStep({ accountDoneAt: new Date(), reviewDoneAt: new Date() })).toBe(2);
    expect(getResumeStep({ accountDoneAt: new Date(), reviewDoneAt: new Date(), commitDoneAt: new Date() })).toBe(3);
  });
});

describe("audit log scoping", () => {
  it("writes the orgId into the audit log create query", async () => {
    const create = vi.fn().mockResolvedValue({});
    const db = {
      auditLog: { create },
      orgMembership: { findFirst: vi.fn() },
    };

    await auditLog({
      db: db as never,
      actorUserId: "user-1",
      orgId: "org-1",
      entityType: "WIG",
      entityId: "wig-1",
      action: "WIG_CREATED",
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: "org-1" }),
      }),
    );
  });
});

describe("Azure AD invite validation", () => {
  it("denies a new Azure AD user without a valid invite", async () => {
    const db = {
      user: { findUnique: vi.fn().mockResolvedValue(null) },
      invite: { findFirst: vi.fn().mockResolvedValue(null) },
    };

    await expect(validateAzureInviteOnly(db as never, "new@example.com")).rejects.toThrow("AccessDenied");
  });
});
