import { CONTACT_EMAIL } from "@/lib/games";

export const metadata = { title: "Terms of Service · Clip Uploader" };

// Draft for the YouTube API audit. Have it reviewed before relying on it.
export default function Terms() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p>Last updated: 30 October 2026</p>
      <ol>
        <li>Accounts are approved by the channel owner, who may remove access at any time.</li>
        <li>Only upload clips you recorded yourself and have the right to share. No copyrighted music, film or TV footage you don&apos;t own.</li>
        <li>No hateful, violent, sexual, harassing or otherwise harmful content, and nothing that breaks YouTube&apos;s Community Guidelines.</li>
        <li>By uploading, you give the channel owner permission to publish your clip on our YouTube channel with your name, and to remove it later.</li>
        <li>The owner reviews every clip and may reject any clip without giving a reason.</li>
        <li>By using this site you also agree to the <a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a>.</li>
        <li>The site is provided as is, with no guarantee that it is always available.</li>
      </ol>
      <p>Questions: {CONTACT_EMAIL}</p>
    </>
  );
}
