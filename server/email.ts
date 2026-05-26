import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const hasResendApiKey = Boolean(resendApiKey && resendApiKey !== "undefined");
const resend = hasResendApiKey ? new Resend(resendApiKey as string) : null;
const emailFrom = process.env.EMAIL_FROM || "4DX Platform <onboarding@resend.dev>";

function getEmailClient() {
  if (!resend) {
    console.warn("Resend API key not configured. Email sends are disabled.");
  }
  return resend;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const client = getEmailClient();
  if (!client) return false;

  await client.emails.send({
    from: emailFrom,
    to,
    subject,
    html,
  });
  return true;
}

export async function sendSessionReadyEmail({
  to,
  name,
  teamName,
}: {
  to: string;
  name: string;
  teamName: string;
}) {
  try {
    const client = getEmailClient();
    if (!client) return;

    await client.emails.send({
      from: emailFrom,
      to,
      subject: "Your weekly session is ready",
      html: `
        <h2>Hi ${name},</h2>
        <p>Your weekly 4DX session for <strong>${teamName}</strong> is ready.</p>
        <p>Complete your Account, Review, and Commit steps before the end of the week.</p>
      `,
    });
  } catch (error) {
    // Don't block the request if email fails
    console.error("Email send failed:", error);
  }
}

export async function sendSessionOverdueEmail({
  to,
  name,
  teamName,
}: {
  to: string;
  name: string;
  teamName: string;
}) {
  try {
    const client = getEmailClient();
    if (!client) return;

    await client.emails.send({
      from: emailFrom,
      to,
      subject: "You have an overdue session",
      html: `
        <h2>Hi ${name},</h2>
        <p>Your weekly 4DX session for <strong>${teamName}</strong> is overdue.</p>
        <p>Please complete it as soon as possible.</p>
      `,
    });
  } catch (error) {
    console.error("Email send failed:", error);
  }
}

export async function sendWigClosedEmail({
  to,
  name,
  wigTitle,
  status,
}: {
  to: string;
  name: string;
  wigTitle: string;
  status: string;
}) {
  try {
    const client = getEmailClient();
    if (!client) return;

    await client.emails.send({
      from: emailFrom,
      to,
      subject: `WIG "${wigTitle}" has been closed`,
      html: `
        <h2>Hi ${name},</h2>
        <p>The WIG <strong>"${wigTitle}"</strong> has been marked as <strong>${status}</strong>.</p>
      `,
    });
  } catch (error) {
    console.error("Email send failed:", error);
  }
}

export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
}: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<boolean> {
  try {
    return await sendEmail({
      to,
      subject: "Reset your 4DX password",
      html: `
        <h2>Hi ${escapeHtml(name)},</h2>
        <p>We received a request to reset your 4DX Platform password.</p>
        <p><a href="${escapeHtml(resetUrl)}">Reset your password</a></p>
        <p>This link expires in 30 minutes. If you did not request it, you can ignore this email.</p>
      `,
    });
  } catch (error) {
    console.error("Password reset email failed:", error);
    return false;
  }
}

export async function sendNewUserDetailsEmail({
  to,
  name,
  email,
  temporaryPassword,
  orgName,
  teamName,
}: {
  to: string;
  name: string;
  email: string;
  temporaryPassword: string;
  orgName: string;
  teamName?: string;
}): Promise<boolean> {
  try {
    return await sendEmail({
      to,
      subject: `Welcome to ${orgName} on 4DX Platform`,
      html: `
        <h2>Hi ${escapeHtml(name)},</h2>
        <p>Your 4DX Platform account has been created for <strong>${escapeHtml(orgName)}</strong>.</p>
        ${teamName ? `<p>Team: <strong>${escapeHtml(teamName)}</strong></p>` : ""}
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Temporary password:</strong> ${escapeHtml(temporaryPassword)}</p>
        <p>Please sign in and change your password from Settings.</p>
      `,
    });
  } catch (error) {
    console.error("New user details email failed:", error);
    return false;
  }
}

export async function sendTeamMembershipEmail({
  to,
  name,
  teamName,
  action,
}: {
  to: string;
  name: string;
  teamName: string;
  action: "added" | "removed";
}) {
  try {
    await sendEmail({
      to,
      subject: action === "added" ? `You were added to ${teamName}` : `You were removed from ${teamName}`,
      html: `
        <h2>Hi ${escapeHtml(name)},</h2>
        <p>You were ${action} ${action === "added" ? "to" : "from"} <strong>${escapeHtml(teamName)}</strong>.</p>
        <p>Sign in to 4DX Platform to view your current teams and role-specific actions.</p>
      `,
    });
  } catch (error) {
    console.error("Team membership email failed:", error);
  }
}

export async function sendWigAtRiskEmail({
  to,
  name,
  teamName,
  wigTitle,
}: {
  to: string;
  name: string;
  teamName: string;
  wigTitle: string;
}) {
  try {
    await sendEmail({
      to,
      subject: `WIG at risk: ${wigTitle}`,
      html: `
        <h2>Hi ${escapeHtml(name)},</h2>
        <p>The WIG <strong>${escapeHtml(wigTitle)}</strong> for <strong>${escapeHtml(teamName)}</strong> appears to be at risk.</p>
        <p>Please review progress and activity logs in 4DX Platform.</p>
      `,
    });
  } catch (error) {
    console.error("WIG at-risk email failed:", error);
  }
}

export async function sendActivityApprovedEmail({
  to,
  name,
  leadMeasureName,
  value,
  unit,
  progressStatus,
}: {
  to: string;
  name: string;
  leadMeasureName: string;
  value?: number | null;
  unit?: string | null;
  progressStatus?: string | null;
}) {
  try {
    const recorded = progressStatus
      ? progressStatus.replace(/_/g, " ").toLowerCase()
      : `${value ?? 0} ${unit ? escapeHtml(unit) : ""}`.trim();

    await sendEmail({
      to,
      subject: `Activity approved: ${leadMeasureName}`,
      html: `
        <h2>Hi ${escapeHtml(name)},</h2>
        <p>Your activity log for <strong>${escapeHtml(leadMeasureName)}</strong> has been approved.</p>
        <p>Progress recorded: <strong>${recorded}</strong></p>
        <p>This contribution is now reflected on your team's scoreboard.</p>
      `,
    });
  } catch (error) {
    console.error("Activity approved email failed:", error);
  }
}

export async function sendActivityDeclinedEmail({
  to,
  name,
  leadMeasureName,
  value,
  progressStatus,
}: {
  to: string;
  name: string;
  leadMeasureName: string;
  value?: number | null;
  progressStatus?: string | null;
}) {
  try {
    const recorded = progressStatus
      ? progressStatus.replace(/_/g, " ").toLowerCase()
      : String(value ?? 0);

    await sendEmail({
      to,
      subject: `Activity log declined: ${leadMeasureName}`,
      html: `
        <h2>Hi ${escapeHtml(name)},</h2>
        <p>Your activity log of <strong>${recorded}</strong> for <strong>${escapeHtml(leadMeasureName)}</strong> was declined by your team lead.</p>
        <p>If you believe this is an error, please speak with your team lead directly.</p>
      `,
    });
  } catch (error) {
    console.error("Activity declined email failed:", error);
  }
}

export async function sendWigDeadlinePassedEmail({
  to,
  name,
  wigTitle,
  teamName,
}: {
  to: string;
  name: string;
  wigTitle: string;
  teamName: string;
}) {
  try {
    await sendEmail({
      to,
      subject: `WIG deadline passed: ${wigTitle}`,
      html: `
        <h2>Hi ${escapeHtml(name)},</h2>
        <p>The WIG <strong>${escapeHtml(wigTitle)}</strong> for <strong>${escapeHtml(teamName)}</strong> has passed its deadline and has not been closed.</p>
        <p>Please review the WIG and close it as ACHIEVED, MISSED, or ABANDONED in 4DX Platform.</p>
      `,
    });
  } catch (error) {
    console.error("WIG deadline passed email failed:", error);
  }
}

export async function sendLeadMeasureOwnersChangedEmail({
  to,
  name,
  leadMeasureName,
  wigTitle,
  action,
}: {
  to: string;
  name: string;
  leadMeasureName: string;
  wigTitle: string;
  action: "added" | "removed";
}) {
  try {
    await sendEmail({
      to,
      subject: `Lead measure ownership ${action}: ${leadMeasureName}`,
      html: `
        <h2>Hi ${escapeHtml(name)},</h2>
        <p>You have been ${action} as an owner of <strong>${escapeHtml(leadMeasureName)}</strong> under WIG <strong>${escapeHtml(wigTitle)}</strong>.</p>
        <p>Sign in to 4DX Platform to view your updated responsibilities.</p>
      `,
    });
  } catch (error) {
    console.error("Lead measure owners changed email failed:", error);
  }
}

export async function sendReportSharedEmail({
  to,
  name,
  teamName,
  reportTitle,
  sharedByName,
  csv,
}: {
  to: string;
  name: string;
  teamName: string;
  reportTitle: string;
  sharedByName: string;
  csv: string;
}): Promise<boolean> {
  try {
    const rows = csv
      .split("\n")
      .slice(0, 8)
      .map((row) => `<tr>${row.split(",").map((cell) => `<td style="padding:6px 8px;border:1px solid #e5e7eb;">${escapeHtml(cell.replace(/^"|"$/g, "").replace(/""/g, '"'))}</td>`).join("")}</tr>`)
      .join("");

    return await sendEmail({
      to,
      subject: `${reportTitle} for ${teamName}`,
      html: `
        <h2>Hi ${escapeHtml(name)},</h2>
        <p>${escapeHtml(sharedByName)} shared the <strong>${escapeHtml(reportTitle)}</strong> for <strong>${escapeHtml(teamName)}</strong>.</p>
        <table style="border-collapse:collapse;font-size:14px;">${rows}</table>
        <p>Sign in to 4DX Platform to review the full report.</p>
      `,
    });
  } catch (error) {
    console.error("Report shared email failed:", error);
    return false;
  }
}
