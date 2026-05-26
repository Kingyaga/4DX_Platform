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
  loginUrl,
}: {
  to: string;
  name: string;
  email: string;
  temporaryPassword: string;
  orgName: string;
  teamName?: string;
  loginUrl?: string;
}): Promise<boolean> {
  const safeLoginUrl = loginUrl ? escapeHtml(loginUrl) : null;
  try {
    return await sendEmail({
      to,
      subject: `You've been added to ${orgName} — your login details`,
      html: `
        <div style="font-family:'Inter',Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;">
          <div style="background:#18181b;padding:28px 32px;">
            <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:0;letter-spacing:-0.01em;text-transform:uppercase;">STRATEGY</h1>
            <p style="color:#a1a1aa;font-size:12px;margin:4px 0 0 0;text-transform:uppercase;letter-spacing:0.05em;">Operational Discipline</p>
          </div>
          <div style="padding:32px;">
            <h2 style="font-size:22px;font-weight:700;color:#18181b;margin:0 0 8px 0;">Welcome, ${escapeHtml(name)}!</h2>
            <p style="color:#71717a;font-size:15px;margin:0 0 24px 0;">
              Your account has been created for <strong style="color:#18181b;">${escapeHtml(orgName)}</strong>.
              ${teamName ? `You've been assigned to the <strong style="color:#18181b;">${escapeHtml(teamName)}</strong> team.` : ""}
            </p>

            <div style="background:#f4f4f5;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
              <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#71717a;margin:0 0 12px 0;">Your Login Details</p>
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="font-size:13px;font-weight:600;color:#71717a;padding:4px 0;width:120px;">Email</td>
                  <td style="font-size:14px;color:#18181b;font-weight:600;padding:4px 0;">${escapeHtml(email)}</td>
                </tr>
                <tr>
                  <td style="font-size:13px;font-weight:600;color:#71717a;padding:4px 0;">Password</td>
                  <td style="font-size:14px;color:#18181b;font-weight:600;padding:4px 0;font-family:monospace;">${escapeHtml(temporaryPassword)}</td>
                </tr>
              </table>
            </div>

            <div style="background:#fef9c3;border:1px solid #fde047;border-radius:6px;padding:12px 16px;margin-bottom:24px;">
              <p style="font-size:13px;color:#713f12;margin:0;">
                <strong>⚠ You will be prompted to change your password after your first login.</strong>
                Choose a strong password you haven't used elsewhere.
              </p>
            </div>

            ${safeLoginUrl ? `
            <a href="${safeLoginUrl}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:700;letter-spacing:0.02em;margin-bottom:24px;">
              Sign In to 4DX Platform →
            </a>
            ` : ""}

            <p style="font-size:13px;color:#a1a1aa;margin:0;border-top:1px solid #e4e4e7;padding-top:16px;">
              If you weren't expecting this email, please contact your organization administrator.
            </p>
          </div>
        </div>
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
}: {
  to: string;
  name: string;
  leadMeasureName: string;
  value: number;
  unit: string;
}) {
  try {
    await sendEmail({
      to,
      subject: `Activity approved: ${leadMeasureName}`,
      html: `
        <h2>Hi ${escapeHtml(name)},</h2>
        <p>Your activity log for <strong>${escapeHtml(leadMeasureName)}</strong> has been approved.</p>
        <p>Value recorded: <strong>${value} ${escapeHtml(unit)}</strong></p>
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
}: {
  to: string;
  name: string;
  leadMeasureName: string;
  value: number;
}) {
  try {
    await sendEmail({
      to,
      subject: `Activity log declined: ${leadMeasureName}`,
      html: `
        <h2>Hi ${escapeHtml(name)},</h2>
        <p>Your activity log of <strong>${value}</strong> for <strong>${escapeHtml(leadMeasureName)}</strong> was declined by your team lead.</p>
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
