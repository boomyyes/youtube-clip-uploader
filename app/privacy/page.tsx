import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/games";

export const metadata = { title: "Privacy Policy · Clip Uploader" };

const UPDATED = "30 October 2026";

export default function Privacy() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>Last updated: {UPDATED}</p>
      <p>
        Clip Uploader (&quot;the site&quot;, &quot;we&quot;) is run by Avanish Wankhede, the owner of the YouTube channel the
        site publishes to. This policy explains what we collect, why, who handles it, and how you can delete it. You must
        accept this policy (by signing in) before using the site.
      </p>

      <h2>1. YouTube API Services</h2>
      <p>
        The site uses <strong>YouTube API Services</strong> to upload approved clips to our YouTube channel and to read
        that channel&apos;s name. By using the site you agree to be bound by the{" "}
        <a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a>. Google&apos;s handling of data is described in
        the <a href="https://policies.google.com/privacy">Google Privacy Policy</a>.
      </p>

      <h2>2. What we collect</h2>
      <ul>
        <li>
          <strong>Your Google account basics</strong> when you sign in with Google: your name, email address and Google
          account ID. We don&apos;t receive your password and don&apos;t get access to your YouTube account.
        </li>
        <li>
          <strong>What you submit:</strong> your video clips, the game you choose, any note you add, and when you submitted
          them.
        </li>
        <li>
          <strong>Review and upload records:</strong> each clip&apos;s status, any rejection reason, its generated title and
          description, and, once it&apos;s on YouTube, the YouTube video ID with the upload time and uploader.
        </li>
        <li>
          <strong>For the channel owner only (YouTube API data):</strong> an access token for the owner&apos;s channel, stored
          encrypted, plus the channel&apos;s ID and name. No other user&apos;s YouTube data is accessed.
        </li>
      </ul>

      <h2>3. How we use it</h2>
      <ul>
        <li>To sign you in and let the owner approve your account.</li>
        <li>
          To let the owner review your clips, and to upload approved clips to our YouTube channel with your name and the date
          in the title and description.
        </li>
        <li>To show you the status of your clips.</li>
        <li>To keep a record of uploads in case of copyright or abuse complaints.</li>
      </ul>
      <p>We don&apos;t sell your data, use it for advertising, or use it for any purpose not listed here.</p>

      <h2>4. Who we share it with</h2>
      <p>Only the services that run the site, each processing data on our behalf:</p>
      <ul>
        <li><strong>Google</strong>: sign-in, and YouTube for publishing.</li>
        <li><strong>Supabase</strong>: account and clip records (database and sign-in sessions).</li>
        <li><strong>Cloudflare R2</strong>: temporary storage of clip files.</li>
        <li><strong>Vercel</strong>: hosting the website.</li>
        <li><strong>GitHub</strong>: runs the scheduled job that uploads approved clips.</li>
      </ul>
      <p>
        These services may process data outside your country. Approved clips are published on our public YouTube channel,
        where anyone can see them along with the title and description, which include your name.
      </p>

      <h2>5. Ads, third-party content and cookies</h2>
      <ul>
        <li>The site shows <strong>no ads</strong> and no third-party content. It links to YouTube, which has its own policies.</li>
        <li>
          We use <strong>cookies only to keep you signed in</strong> (and a short-lived one while the owner connects YouTube).
          We don&apos;t use analytics or tracking cookies, and neither we nor any third party collect other information from
          your device or browser through the site.
        </li>
      </ul>

      <h2>6. How long we keep it</h2>
      <ul>
        <li>
          Clip files are deleted as soon as they&apos;re on YouTube or rejected. Unfinished uploads are deleted automatically
          within 30 days.
        </li>
        <li>Account and clip records are kept until you delete your account.</li>
        <li>
          The channel name is refreshed from YouTube several times a day. If the owner&apos;s YouTube access is revoked or
          expires, the stored token and channel details are deleted.
        </li>
      </ul>

      <h2>7. Deleting your data</h2>
      <ul>
        <li>
          <strong>Delete it yourself:</strong> on the <Link href="/account">Account</Link> page, &quot;Delete my account&quot;
          immediately removes your account, clip records, upload records and any clips still stored with us.
        </li>
        <li>
          <strong>Or ask us:</strong> email {CONTACT_EMAIL}. We delete your data as soon as possible and{" "}
          <strong>within 7 days</strong>.
        </li>
        <li>
          Deleting your data here <strong>does not delete videos on YouTube</strong>. Data on YouTube is deleted through
          YouTube itself; to have a published clip removed from our channel, email us.
        </li>
      </ul>

      <h2>8. Revoking YouTube access (channel owner)</h2>
      <p>
        The channel owner can revoke the site&apos;s access at any time with &quot;Disconnect YouTube&quot; on the Admin page,
        which revokes the token with Google and deletes it immediately, or through Google&apos;s security settings page at{" "}
        <a href="https://security.google.com/settings/security/permissions">security.google.com/settings/security/permissions</a>.
        After a revocation, all stored YouTube API data is deleted as soon as possible and within 7 days.
      </p>

      <h2>9. Security</h2>
      <p>
        Data is sent over HTTPS. The YouTube token is encrypted at rest, clip files are private and reachable only through
        short-lived signed links, and each user can see only their own clips.
      </p>

      <h2>10. Children</h2>
      <p>The site isn&apos;t meant for children under 13 (or the minimum age to have a Google account where you live).</p>

      <h2>11. Changes</h2>
      <p>
        We&apos;ll update the date above when this policy changes. If we start using your data in a new way, we&apos;ll ask you
        to accept the updated policy before continuing.
      </p>

      <h2>12. Contact</h2>
      <p>Privacy questions or complaints: {CONTACT_EMAIL}</p>
    </>
  );
}
