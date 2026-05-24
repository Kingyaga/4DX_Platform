import { NextResponse } from "next/server";
import { db } from "@/server/db";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { email, name, password, token } = await req.json();

    if (!email || !name || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required." },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 },
      );
    }

    // Validate invite token — required for invite-only signup
    if (!token) {
      return NextResponse.json(
        { error: "An invite link is required to sign up." },
        { status: 403 },
      );
    }

    const invite = await db.inviteToken.findUnique({
      where: { token },
      include: { org: true },
    });

    if (!invite) {
      return NextResponse.json(
        { error: "Invalid invite link." },
        { status: 403 },
      );
    }

    if (invite.usedAt) {
      return NextResponse.json(
        { error: "This invite link has already been used." },
        { status: 403 },
      );
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This invite link has expired." },
        { status: 403 },
      );
    }

    // If invite was for a specific email, enforce it
    if (invite.email && invite.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { error: "This invite was sent to a different email address." },
        { status: 403 },
      );
    }

    // Check if email already registered
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create user + org membership + optional team membership in one transaction
    const user = await db.$transaction(async (tx) => {
      // Create the user
      const newUser = await tx.user.create({
        data: { email, name, passwordHash },
      });

      // Auto-assign MEMBER role in the org
      await tx.orgMembership.create({
        data: {
          userId: newUser.id,
          orgId: invite.orgId,
          role: "MEMBER",
        },
      });

      // If invite includes a team, add them to it
      if (invite.teamId) {
        await tx.teamMembership.create({
          data: {
            userId: newUser.id,
            teamId: invite.teamId,
            role: "MEMBER",
          },
        });
      }

      // Mark invite as used
      await tx.inviteToken.update({
        where: { token },
        data: { usedAt: new Date() },
      });

      return newUser;
    });

    return NextResponse.json(
      { id: user.id, email: user.email },
      { status: 201 },
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
