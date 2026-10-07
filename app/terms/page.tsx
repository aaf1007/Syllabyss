import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, PRIVACY_EMAIL, Section } from "@/components/site/LegalPage";

export const metadata: Metadata = { title: "Terms of Use · SYLLABYSS" };

// Public (#5).
export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" updated="October 6, 2026">
      <p>
        By creating an account or using Syllabyss, you agree to these terms and to our{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <Section title="1. Who can use Syllabyss">
        <p>
          You must be at least 13. You&apos;re responsible for your account and for what happens under it, so keep your
          sign-in secure.
        </p>
      </Section>

      <Section title="2. Your content">
        <p>
          You keep ownership of the files you upload. You allow us to store them, process them, and send their text to our
          AI providers, so that we can make your Games and study notes. You can delete them at any time.
        </p>
        <p>Only upload material you have the right to use for your own study. Don&apos;t upload:</p>
        <ul>
          <li>other people&apos;s personal information, or sensitive information about yourself;</li>
          <li>material you aren&apos;t allowed to share or copy, beyond your own personal study;</li>
          <li>anything illegal, harmful, or designed to attack or overload the service.</li>
        </ul>
      </Section>

      <Section title="3. Fair use">
        <p>
          Don&apos;t try to get around our usage limits, reach other players&apos; data, scrape the site, or interfere
          with how it runs. We may suspend or delete accounts that do.
        </p>
      </Section>

      <Section title="4. AI-generated content">
        <p>
          Games, answers, study notes and Sonar&apos;s advice are written by AI from your material, and they can be wrong
          or incomplete. Check anything important against your course material. Follow your school&apos;s
          academic-integrity rules: Syllabyss is for studying, not for doing graded work.
        </p>
      </Section>

      <Section title="5. The service">
        <p>
          Syllabyss is a student project provided &quot;as is&quot;, without warranties. We may change features, set
          limits, or stop the service. To the extent the law allows, we aren&apos;t liable for lost data, lost grades or
          indirect damages arising from your use of it.
        </p>
      </Section>

      <Section title="6. Ending your account">
        <p>
          You can delete your account at any time from <Link href="/settings">Settings</Link>. We may close accounts that
          break these terms.
        </p>
      </Section>

      <Section title="7. Contact">
        <p>
          Questions about these terms: <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.
        </p>
      </Section>
    </LegalPage>
  );
}
