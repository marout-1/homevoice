/**
 * Supabase Edge Function: send-clone-activation-email
 *
 * Triggered on a cron schedule (every hour via pg_cron or Supabase scheduled functions).
 * Finds users who:
 *   - Generated their first podcast 24+ hours ago (podcasts_count >= 1)
 *   - Have NOT yet cloned their voice (cloned_voice_id IS NULL)
 *   - Have NOT already received this email (clone_email_sent = false)
 *
 * Sends a single personalised email via Resend, then marks clone_email_sent = true.
 *
 * Deploy:
 *   supabase functions deploy send-clone-activation-email
 *
 * Schedule (add to Supabase dashboard → Database → Extensions → pg_cron):
 *   select cron.schedule('clone-activation-email', '0 * * * *',
 *     $$select net.http_post(
 *       url := 'https://<project>.supabase.co/functions/v1/send-clone-activation-email',
 *       headers := '{"Authorization": "Bearer <anon-key>"}'::jsonb
 *     )$$
 *   );
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY  = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL         = Deno.env.get("NEXT_PUBLIC_APP_URL") ?? "https://homevoice.app";

const DEEP_LINK = `${APP_URL}/dashboard?tab=profile&section=voice-clone`;

function buildEmailHtml(firstName: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Your podcasts are missing one thing — your voice.</title>
</head>
<body style="margin:0;padding:0;background:#F5F3EE;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F3EE;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E0DCD4;">

        <!-- Header -->
        <tr>
          <td style="background:#1B2B4B;padding:20px 32px;text-align:center;">
            <span style="color:#ffffff;font-size:16px;font-weight:700;letter-spacing:0.5px;">HomeVoice</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 32px 32px;">
            <p style="font-size:14px;color:#7A90AD;margin:0 0 8px;">Hi ${firstName},</p>
            <h1 style="font-size:24px;font-weight:700;color:#1B2B4B;margin:0 0 20px;line-height:1.3;font-family:Georgia,serif;">
              Your podcasts are missing<br/>one thing &mdash; your voice.
            </h1>
            <p style="font-size:15px;color:#4A5568;line-height:1.6;margin:0 0 24px;">
              You&rsquo;ve already created a podcast. Imagine that same podcast narrated
              in your own voice &mdash; your clients instantly know it&rsquo;s you.
            </p>
            <p style="font-size:15px;color:#4A5568;line-height:1.6;margin:0 0 32px;">
              It takes <strong>60 seconds</strong> to clone your voice, and every future
              podcast will automatically use it.
            </p>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
              <tr>
                <td style="background:#1A7A6E;border-radius:10px;padding:14px 32px;text-align:center;">
                  <a href="${DEEP_LINK}" style="color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;display:block;">
                    Clone My Voice Now &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <p style="font-size:12px;color:#9AA5B4;text-align:center;margin:0;">
              Takes 60 seconds &middot; No extra setup required
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F5F3EE;padding:20px 32px;border-top:1px solid #E0DCD4;">
            <p style="font-size:11px;color:#9AA5B4;margin:0;text-align:center;line-height:1.5;">
              You&rsquo;re receiving this because you created a podcast on HomeVoice.<br/>
              <a href="${APP_URL}/unsubscribe" style="color:#1A7A6E;text-decoration:none;">Unsubscribe</a>
              &nbsp;&middot;&nbsp;
              <a href="${APP_URL}" style="color:#1A7A6E;text-decoration:none;">HomeVoice</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildEmailText(firstName: string): string {
  return `Hi ${firstName},

Your podcasts are missing one thing — your voice.

You've already created a podcast. Imagine that same podcast narrated in your own voice — your clients instantly know it's you.

It takes 60 seconds to clone your voice, and every future podcast will automatically use it.

Clone My Voice Now: ${DEEP_LINK}

Takes 60 seconds · No extra setup required

---
You're receiving this because you created a podcast on HomeVoice.
Unsubscribe: ${APP_URL}/unsubscribe
`;
}

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find eligible users: first podcast created 24h+ ago, no clone, email not sent yet
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: users, error: fetchErr } = await supabase
      .from("profiles")
      .select("id, email:id, podcasts_count, cloned_voice_id, clone_email_sent")
      .gte("podcasts_count", 1)
      .is("cloned_voice_id", null)
      .eq("clone_email_sent", false)
      .lt("updated_at", cutoff) // profiles updated_at acts as proxy; use created_at of first podcast ideally
      .limit(50); // process in batches

    if (fetchErr) {
      console.error("[activation-email] fetch error:", fetchErr);
      return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
    }

    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    // Get auth emails from auth.users for each profile id
    let sent = 0;
    const errors: string[] = [];

    for (const profile of users) {
      try {
        // Get email from auth.users
        const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
        const email = authUser?.user?.email;
        if (!email) continue;

        const firstName = email.split("@")[0].split(".")[0];
        const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

        // Send via Resend
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "HomeVoice <hello@homevoice.app>",
            to: [email],
            subject: "Your podcasts are missing one thing — your voice.",
            html: buildEmailHtml(displayName),
            text: buildEmailText(displayName),
            tags: [{ name: "campaign", value: "voice-clone-activation" }],
          }),
        });

        if (!resendRes.ok) {
          const errText = await resendRes.text();
          errors.push(`${email}: ${errText}`);
          continue;
        }

        // Mark as sent
        await supabase
          .from("profiles")
          .update({ clone_email_sent: true })
          .eq("id", profile.id);

        sent++;
      } catch (userErr) {
        errors.push(`${profile.id}: ${String(userErr)}`);
      }
    }

    console.log(`[activation-email] sent=${sent}, errors=${errors.length}`);
    return new Response(JSON.stringify({ sent, errors }), { status: 200 });

  } catch (err) {
    console.error("[activation-email] unexpected error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
