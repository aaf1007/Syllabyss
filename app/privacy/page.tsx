import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, PRIVACY_EMAIL, Section } from "@/components/site/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy · SYLLABYSS" };

// Public (#5). Keep it true: when a new service gets user data (a provider, analytics, a tracer),
// add it under "Who else handles your data" in the same PR.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="October 6, 2026">
      <p>
        Syllabyss turns your course notes into study games. This page explains what we collect, why, who else handles it,
        and how to delete it. Questions: <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.
      </p>

      <Section title="1. What we collect">
        <ul>
          <li>
            <strong>Account details</strong> from sign-in: your email address and, if you sign in with Google, your name
            and profile photo.
          </li>
          <li>
            <strong>Your profile</strong>: username, display name and avatar. These are public to other players.
          </li>
          <li>
            <strong>Your study material</strong>: the text of each page of the files you upload (PDF, PowerPoint, Word).
            We read the text and then discard the file itself. We also keep the Modules, Games and study notes made from it.
          </li>
          <li>
            <strong>How you play</strong>: your Runs, guesses, scores, XP, streaks, badges and the times you played.
          </li>
          <li>
            <strong>Friends</strong>: who you&apos;ve added and your friend requests.
          </li>
          <li>
            <strong>Sonar chats</strong>: the messages you send our study coach. Your saved chat history is stored in your
            browser, not on our servers. The server holds a conversation only in memory while it&apos;s answering.
          </li>
          <li>
            <strong>Technical data</strong>: our hosting providers log IP addresses and browser details to run and protect
            the service.
          </li>
        </ul>
        <p>
          We use only the cookies needed to keep you signed in. There are no advertising or analytics trackers.
        </p>
      </Section>

      <Section title="2. How we use it">
        <ul>
          <li>To make Games and study notes from your files, run your games, and score them.</li>
          <li>To show your progress, leaderboards, friends and profile.</li>
          <li>To let Sonar coach you based on how you&apos;ve been doing.</li>
          <li>To keep the service secure, prevent abuse and fix problems.</li>
        </ul>
        <p>We don&apos;t sell your data, and we don&apos;t use it for advertising.</p>
      </Section>

      <Section title="3. Who else handles your data">
        <p>We use these service providers to run Syllabyss. They process data only to provide their service to us.</p>
        <ul>
          <li>
            <strong>Google (Gemini API)</strong> receives the text of the pages you choose, to write Games and study notes.
          </li>
          <li>
            <strong>Anthropic (Claude API)</strong> receives your Sonar messages and a summary of your progress, to write
            Sonar&apos;s replies. If Claude is unavailable, Google Gemini is used instead.
          </li>
          <li>
            <strong>Clerk</strong> handles sign-in and stores your account details.
          </li>
          <li>
            <strong>Tiger Data (Timescale)</strong> hosts our database.
          </li>
          <li>
            <strong>Render</strong> and <strong>Cloudflare</strong> host the site and carry its traffic.
          </li>
        </ul>
        <p>
          We use the Gemini and Claude APIs under terms that don&apos;t allow them to train their models on your content.
          These providers are mostly in the United States, so your data may be stored and processed outside your country,
          including outside Canada.
        </p>
        <p>
          Your profile, XP, badges and leaderboard positions are visible to other players. Your files, Modules, Games and
          study notes are private to you.
        </p>
      </Section>

      <Section title="4. How long we keep it">
        <p>
          We keep your data until you delete it or delete your account. Deleting a file, Game or Module removes it straight away. Deleting your account removes all of your data from our database at once. Copies in our providers&apos;
          backups and logs expire on their normal schedule.
        </p>
      </Section>

      <Section title="5. Your choices">
        <ul>
          <li>Edit your profile from your profile page at any time.</li>
          <li>
            Delete your account and all of its data from <Link href="/settings">Settings</Link>.
          </li>
          <li>
            To get a copy of your data, correct it, or ask anything else about it, email{" "}
            <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>. We&apos;ll reply within 30 days.
          </li>
        </ul>
      </Section>

      <Section title="6. Security">
        <p>
          Every connection to Syllabyss and to our database is encrypted. Every request checks that you&apos;re signed in,
          and you can only reach your own files, Modules and Games. We limit how often the AI features can be used to
          prevent abuse. No system is perfectly secure: please don&apos;t upload anything more sensitive than course
          material.
        </p>
      </Section>

      <Section title="7. Children">
        <p>Syllabyss isn&apos;t for children under 13, and we don&apos;t knowingly collect their data.</p>
      </Section>

      <Section title="8. Changes">
        <p>
          If we change this policy, we&apos;ll update the date at the top. If a change affects how your data is used,
          we&apos;ll tell you in the app before it takes effect.
        </p>
      </Section>
    </LegalPage>
  );
}
