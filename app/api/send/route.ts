export const runtime = "nodejs";

import { getResetPasswordEmailHtml } from "@/lib/email-templates";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return Response.json({ message: "Email is required." }, { status: 400 });
    }

    const API_BASE_URL =
      process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

    const backendRes = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      cache: "no-store",
    });

    const backendData = await backendRes.json().catch(() => null);

    if (!backendRes.ok) {
      return Response.json(
        { message: backendData?.message ?? "Failed to generate reset token." },
        { status: backendRes.status }
      );
    }

    const { token, expiresAt } = backendData;

    if (!token) {
      return Response.json(
        { message: "Backend did not return reset token." },
        { status: 500 }
      );
    }

    const origin = new URL(request.url).origin;
    const resetLink = `http://localhost:3000/reset-password?token=${encodeURIComponent(
      token
    )}`;

    const html = getResetPasswordEmailHtml(email, resetLink);

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return Response.json(
        { message: "RESEND_API_KEY missing." },
        { status: 500 }
      );
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: [email],
        subject: "Reset your Bill Pro password",
        html,
      }),
    });

    const resendData = await resendRes.json().catch(() => null);

    if (!resendRes.ok) {
      return Response.json(
        { message: resendData?.message ?? "Failed to send email." },
        { status: 500 }
      );
    }

    return Response.json({
      message: "Reset link sent. Please check your email.",
      expiresAt,
    });
  } catch (error) {
    console.error("SEND RESET ERROR:", error);
    return Response.json(
      { message: error instanceof Error ? error.message : "Unexpected error." },
      { status: 500 }
    );
  }
}
