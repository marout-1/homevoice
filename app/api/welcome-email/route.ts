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

function buildWelcomeEmail(_email: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to HomeVoice</title>
</head>
<body style="margin:0;padding:0;background-color:#EEEAE3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EEEAE3;padding:48px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:580px;">

          <!-- HEADER -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background-color:#1A7A6E;border-radius:14px;padding:11px 18px;">
                    <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.4px;">🏠 HomeVoice</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- HERO CARD -->
          <tr>
            <td style="background-color:#ffffff;border-radius:24px 24px 0 0;padding:52px 48px 40px;box-shadow:0 2px 8px rgba(0,0,0,0.07);">
              <p style="margin:0 0 6px 0;font-size:13px;font-weight:600;color:#1A7A6E;text-transform:uppercase;letter-spacing:1px;">You're in 🎉</p>
              <h1 style="margin:0 0 16px 0;font-size:32px;font-weight:800;color:#111827;line-height:1.15;letter-spacing:-0.5px;">
                Your clients are about<br/>to <em style="font-style:italic;color:#1A7A6E;">actually</em> read your<br/>market reports.
              </h1>
              <p style="margin:0 0 36px 0;font-size:16px;color:#6B7280;line-height:1.6;">
                HomeVoice turns any property address into a professional AI-narrated podcast in about 90 seconds. Here's everything you need to hit the ground running.
              </p>
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="border-radius:12px;background-color:#1A7A6E;">
                    <a href="https://mattarout.vercel.app/dashboard"
                       style="display:inline-block;padding:16px 36px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:-0.2px;border-radius:12px;">
                      Generate your first report →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- DIVIDER BAND -->
          <tr>
            <td style="background-color:#1A7A6E;padding:18px 48px;">
              <p style="margin:0;font-size:14px;font-weight:600;color:#ffffff;letter-spacing:0.2px;">
                ⚡ From address to audio in &lt;90 seconds &nbsp;·&nbsp; 🎙️ 10 free reports/month &nbsp;·&nbsp; 🔗 Instant shareable link
              </p>
            </td>
          </tr>

          <!-- TIPS CARD -->
          <tr>
            <td style="background-color:#F9F8F6;padding:40px 48px 8px;">
              <p style="margin:0 0 24px 0;font-size:19px;font-weight:700;color:#111827;letter-spacing:-0.3px;">Tips &amp; tricks to get started</p>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
                <tr>
                  <td width="48" valign="top">
                    <div style="width:40px;height:40px;border-radius:10px;background-color:#E6F3F1;text-align:center;line-height:40px;font-size:20px;">🔍</div>
                  </td>
                  <td style="padding-left:16px;" valign="top">
                    <p style="margin:0 0 4px 0;font-size:15px;font-weight:700;color:#111827;">Use the address autocomplete</p>
                    <p style="margin:0;font-size:14px;color:#6B7280;line-height:1.55;">Start typing any US property address — Google Maps autocomplete kicks in after 2 characters. Select the exact address from the dropdown for the best results.</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
                <tr>
                  <td width="48" valign="top">
                    <div style="width:40px;height:40px;border-radius:10px;background-color:#E6F3F1;text-align:center;line-height:40px;font-size:20px;">🏷️</div>
                  </td>
                  <td style="padding-left:16px;" valign="top">
                    <p style="margin:0 0 4px 0;font-size:15px;font-weight:700;color:#111827;">Add your brokerage name</p>
                    <p style="margin:0;font-size:14px;color:#6B7280;line-height:1.55;">Hit "Personalize" before generating — your brokerage name plays in the podcast outro so every report sounds like it came directly from your brand.</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
                <tr>
                  <td width="48" valign="top">
                    <div style="width:40px;height:40px;border-radius:10px;background-color:#E6F3F1;text-align:center;line-height:40px;font-size:20px;">📤</div>
                  </td>
                  <td style="padding-left:16px;" valign="top">
                    <p style="margin:0 0 4px 0;font-size:15px;font-weight:700;color:#111827;">Share the link — no app needed</p>
                    <p style="margin:0;font-size:14px;color:#6B7280;line-height:1.55;">Once generated, copy the shareable link and text or email it to your client. They click, it plays — no downloads, no logins, no friction.</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
                <tr>
                  <td width="48" valign="top">
                    <div style="width:40px;height:40px;border-radius:10px;background-color:#E6F3F1;text-align:center;line-height:40px;font-size:20px;">📊</div>
                  </td>
                  <td style="padding-left:16px;" valign="top">
                    <p style="margin:0 0 4px 0;font-size:15px;font-weight:700;color:#111827;">Send it before a showing</p>
                    <p style="margin:0;font-size:14px;color:#6B7280;line-height:1.55;">The report covers nearby comps, price trends, and neighborhood stats. Drop it in your pre-showing text so buyers walk in already informed — and impressed.</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:8px;">
                <tr>
                  <td width="48" valign="top">
                    <div style="width:40px;height:40px;border-radius:10px;background-color:#E6F3F1;text-align:center;line-height:40px;font-size:20px;">🔄</div>
                  </td>
                  <td style="padding-left:16px;" valign="top">
                    <p style="margin:0 0 4px 0;font-size:15px;font-weight:700;color:#111827;">Your 10 credits reset every month</p>
                    <p style="margin:0;font-size:14px;color:#6B7280;line-height:1.55;">Free plan gives you 10 reports per month — plenty to test with real listings. Need more? Upgrade anytime from your dashboard for unlimited access.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- WHAT'S INSIDE -->
          <tr>
            <td style="background-color:#F9F8F6;padding:32px 48px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#111827;border-radius:16px;padding:28px 32px;">
                <tr>
                  <td>
                    <p style="margin:0 0 16px 0;font-size:13px;font-weight:600;color:#1A7A6E;text-transform:uppercase;letter-spacing:1px;">What's inside every report</p>
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td width="50%" valign="top" style="padding-right:8px;">
                          <p style="margin:0 0 10px 0;font-size:14px;color:#D1FAE5;">✓ &nbsp;Recent comparable sales</p>
                          <p style="margin:0 0 10px 0;font-size:14px;color:#D1FAE5;">✓ &nbsp;Days on market trends</p>
                          <p style="margin:0;font-size:14px;color:#D1FAE5;">✓ &nbsp;Price per sq ft analysis</p>
                        </td>
                        <td width="50%" valign="top" style="padding-left:8px;">
                          <p style="margin:0 0 10px 0;font-size:14px;color:#D1FAE5;">✓ &nbsp;Neighborhood overview</p>
                          <p style="margin:0 0 10px 0;font-size:14px;color:#D1FAE5;">✓ &nbsp;List-to-sale price ratio</p>
                          <p style="margin:0;font-size:14px;color:#D1FAE5;">✓ &nbsp;Your branded outro</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BOTTOM CTA -->
          <tr>
            <td style="background-color:#ffffff;border-radius:0 0 24px 24px;padding:36px 48px 44px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.07);">
              <p style="margin:0 0 20px 0;font-size:18px;font-weight:700;color:#111827;">Ready to impress your first client?</p>
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
                <tr>
                  <td style="border-radius:12px;background-color:#1A7A6E;">
                    <a href="https://mattarout.vercel.app/dashboard"
                       style="display:inline-block;padding:15px 40px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:-0.2px;border-radius:12px;">
                      Open my dashboard →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="padding-top:32px;padding-bottom:8px;">
              <p style="margin:0 0 6px 0;font-size:13px;color:#9CA3AF;line-height:1.7;">
                You're receiving this because you signed up at
                <a href="https://mattarout.vercel.app" style="color:#1A7A6E;text-decoration:none;">HomeVoice</a>.
              </p>
              <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.7;">
                Questions or feedback? Reply directly — Matt reads every one.
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
