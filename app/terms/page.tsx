import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/games";

export const metadata = { title: "Terms of Service · Clip Uploader" };

const UPDATED = "30 October 2026";

export default function Terms() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p>Last updated: {UPDATED}</p>
      <p>
        These terms govern your use of Clip Uploader (&quot;the site&quot;), run by Avanish Wankhede (&quot;the owner&quot;).
        By signing in you agree to these terms and to our <Link href="/privacy">Privacy Policy</Link>. If you don&apos;t
        agree, don&apos;t use the site.
      </p>

      <h2>1. YouTube Terms of Service</h2>
      <p>
        The site uses YouTube API Services. By using the site you agree to be bound by the{" "}
        <a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a>, and every clip must follow YouTube&apos;s
        Community Guidelines.
      </p>

      <h2>2. Who can use the site</h2>
      <ul>
        <li>You must be at least 13 and old enough to have a Google account where you live.</li>
        <li>Accounts are approved by the owner, who may decline or remove any account at any time.</li>
        <li>Keep your Google account secure; you&apos;re responsible for what is submitted through it.</li>
      </ul>

      <h2>3. Your clips</h2>
      <ul>
        <li>Only submit clips you recorded yourself, or have every right to share.</li>
        <li>
          No copyrighted material you don&apos;t own or have permission to use, including music, films, TV or streams by
          others.
        </li>
        <li>
          No hateful, violent, sexual, harassing, misleading or illegal content, no content showing other people without
          their consent, and nothing that breaks YouTube&apos;s Community Guidelines.
        </li>
        <li>You keep ownership of your clips.</li>
      </ul>

      <h2>4. Permission you give us</h2>
      <p>
        By submitting a clip, you give the owner a non-exclusive, worldwide, royalty-free permission to publish it on our
        YouTube channel, with a title and description that include your display name and the date, and to keep it there or
        remove it. The channel isn&apos;t monetized, and you won&apos;t be paid for clips. You can ask for a published
        clip to be removed at any time by emailing {CONTACT_EMAIL}.
      </p>

      <h2>5. Review and removal</h2>
      <ul>
        <li>The owner reviews every clip and may reject one for any reason, or none.</li>
        <li>The owner may remove published clips and suspend accounts that break these terms.</li>
        <li>
          Copyright or other complaints about a clip: email {CONTACT_EMAIL} with the video link. We&apos;ll review it and take
          the clip down where appropriate.
        </li>
      </ul>

      <h2>6. Ending your use</h2>
      <p>
        You can stop at any time and delete your account on the <Link href="/account">Account</Link> page. Videos already on
        YouTube stay there unless you ask us to remove them.
      </p>

      <h2>7. No warranty</h2>
      <p>
        The site is a free, non-commercial project provided &quot;as is&quot;, without warranties of any kind. It may be
        unavailable, change, or shut down at any time, and uploads may be delayed or fail.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        To the extent the law allows, the owner isn&apos;t liable for indirect or consequential losses, or for loss of clips
        or data, arising from your use of the site. You&apos;re responsible for the clips you submit, including any claim that
        a clip infringes someone else&apos;s rights.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update these terms. We&apos;ll change the date above, and for significant changes we&apos;ll ask you to accept
        them again before you continue.
      </p>

      <h2>10. Law</h2>
      <p>These terms are governed by the laws of India.</p>

      <h2>11. Contact</h2>
      <p>{CONTACT_EMAIL}</p>
    </>
  );
}
