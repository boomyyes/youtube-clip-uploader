import { CONTACT_EMAIL } from "@/lib/games";

export const metadata = { title: "Privacy Policy · Clip Uploader" };

// Draft for the YouTube API audit. Have it reviewed before relying on it.
export default function Privacy() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>Last updated: 30 October 2026</p>
      <h2>What we collect</h2>
      <ul>
        <li>Your Google account name and email address, when you sign in with Google.</li>
        <li>Video clips you upload, the game you choose, and any note you add.</li>
        <li>Records of each upload to YouTube: the video ID, the time, and who uploaded it.</li>
      </ul>
      <h2>How we use it</h2>
      <p>
        We use this information only to run this site: to let approved users submit clips, to let the channel owner review them,
        and to upload approved clips to our YouTube channel with your name in the title and description.
      </p>
      <h2>YouTube API Services</h2>
      <p>
        This site uses YouTube API Services to upload videos to our channel. By using it you agree to the{" "}
        <a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a>. Google&apos;s use of data is covered by the{" "}
        <a href="https://policies.google.com/privacy">Google Privacy Policy</a>. The channel owner can revoke this site&apos;s access
        at any time from the <a href="https://myaccount.google.com/permissions">Google security settings page</a>.
      </p>
      <h2>Storage and deletion</h2>
      <p>
        Uploaded files are stored temporarily and deleted once they are on YouTube or rejected. Account and clip records are kept
        while your account exists. To delete your account and data, contact the channel owner.
      </p>
      <h2>Sharing</h2>
      <p>We do not sell or share your information. Approved clips are published on our YouTube channel, which is public.</p>
      <h2>Cookies</h2>
      <p>We use cookies only to keep you signed in.</p>
      <h2>Contact</h2>
      <p>{CONTACT_EMAIL}</p>
    </>
  );
}
