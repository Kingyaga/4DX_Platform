import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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
    await resend.emails.send({
      from: "4DX Platform <onboarding@resend.dev>",
      to,
      subject: "Your weekly session is ready",
      html: `
        <h2>Hi ${name},</h2>
        <p>Your weekly 4DX session for <strong>${teamName}</strong> is ready.</p>
        <p>Complete your Account → Review → Commit steps before the end of the week.</p>
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
    await resend.emails.send({
      from: "4DX Platform <onboarding@resend.dev>",
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
    await resend.emails.send({
      from: "4DX Platform <onboarding@resend.dev>",
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

export async function sendWigAtRiskEmail({
  to,
  name,
  wigTitle,
}: {
  to: string;
  name: string;
  wigTitle: string;
}) {
  try {
    await resend.emails.send({
      from: "4DX Platform <onboarding@resend.dev>",
      to,
      subject: `WIG "${wigTitle}" is at risk`,
      html: `
        <h2>Hi ${name},</h2>
        <p>The WIG <strong>"${wigTitle}"</strong> is currently at risk.</p>
        <p>Please review and take necessary actions to get it back on track.</p>
      `,
    });
  } catch (error) {
    console.error("Email send failed:", error);
  }
}
