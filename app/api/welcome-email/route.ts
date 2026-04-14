import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createServiceClient } from "@/app/lib/supabase/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { userId, email } = await req.json();
    if (!userId || !email) {
      return NextResponse.json({ error: "Missing userId or email" }, { status: 400 });
    }

    // Check if we already sent a welcome email for this user (idempotency)
    const supabase = createServiceClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("welcome_email_sent")
      .eq("id", userId)
      .single();

    if (profile?.welcome_email_sent) {
      return NextResponse.json({ skipped: true });
    }

    // Send the welcome email
    const { error } = await resend.emails.send({
      from: "Matt from HomeVoice <matt@homevoice.app>",
      to: email,
      subject: "Welcome to HomeVoice 🎙️",
      html: buildWelcomeEmail(email),
    });

    if (error) {
      console.error("[welcome-email] Resend error:", error);
      return NextResponse.json({ error: "Failed to send" }, { status: 500 });
    }

    // Mark welcome email as sent so we never send it twice
    await supabase
      .from("profiles")
      .update({ welcome_email_sent: true })
      .eq("id", userId);

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error("[welcome-email] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

function buildWelcomeEmail(email: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to HomeVoice</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F3EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F3EF;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#1A7A6E;border-radius:12px;padding:10px 14px;">
                    <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">🏠 HomeVoice</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:20px;padding:48px 44px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">

              <p style="margin:0 0 8px 0;font-size:28px;font-weight:700;color:#1B2B4B;line-height:1.2;">
                Welcome aboard 👋
              </p>
              <p style="margin:0 0 32px 0;font-size:16px;color:#6B7280;line-height:1.5;">
                You're all set to start creating AI-narrated market reports your clients will actually listen to.
              </p>

              <!-- What you get -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F9F8;border-radius:12px;padding:24px;margin-bottom:32px;">
                <tr>
                  <td>
                    <p style="margin:0 0 16px 0;font-size:13px;font-weight:600;color:#1A7A6E;text-transform:uppercase;letter-spacing:0.5px;">What you get for free</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;">
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding-right:12px;font-size:18px;">🎙️</td>
                              <td style="font-size:15px;color:#1B2B4B;"><strong>10 podcasts/month</strong> — reset every month</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;">
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding-right:12px;font-size:18px;">📊</td>
                              <td style="font-size:15px;color:#1B2B4B;"><strong>Live market data</strong> — comps, trends, valuations</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;">
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding-right:12px;font-size:18px;">🔗</td>
                              <td style="font-size:15px;color:#1B2B4B;"><strong>Shareable links</strong> — send directly to clients</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;">
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding-right:12px;font-size:18px;">⚡</td>
                              <td style="font-size:15px;color:#1B2B4B;"><strong>90 seconds</strong> — from address to audio</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td align="center">
                    <a href="https://mattarout.vercel.app/dashboard"
                       style="display:inline-block;background-color:#1A7A6E;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:16px 40px;border-radius:12px;letter-spacing:-0.2px;">
                      Generate your first podcast →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Tips -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #F0EDE8;padding-top:28px;">
                <tr>
                  <td>
                    <p style="margin:0 0 12px 0;font-size:14px;font-weight:600;color:#1B2B4B;">Quick tips to get started:</p>
                    <p style="margin:0 0 8px 0;font-size:14px;color:#6B7280;line-height:1.5;">
                      <strong style="color:#1B2B4B;">1.</strong> Type any US property address — Google autocomplete kicks in fast.
                    </p>
                    <p style="margin:0 0 8px 0;font-size:14px;color:#6B7280;line-height:1.5;">
                      <strong style="color:#1B2B4B;">2.</strong> Add your brokerage name under "Personalize" — it plays in the outro.
                    </p>
                    <p style="margin:0;font-size:14px;color:#6B7280;line-height:1.5;">
                      <strong style="color:#1B2B4B;">3.</strong> Share the link — clients can listen without downloading anything.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:28px;">
              <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.6;">
                You're receiving this because you signed up at <a href="https://mattarout.vercel.app" style="color:#1A7A6E;text-decoration:none;">HomeVoice</a>.<br/>
                Questions? Reply to this email — I read every one.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
