import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@/components/ui";
import { requirePlayer } from "@/lib/auth";
import { DeleteAccount } from "./DeleteAccount";

export const metadata: Metadata = { title: "Settings · SYLLABYSS" };

// Settings (#5): what we keep about you, and account deletion. Profile edits stay on /u/[username].
export default async function SettingsPage() {
  await requirePlayer();
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <header>
        <h1 className="text-3xl text-text">Settings</h1>
        <p className="mt-1 text-muted">Your account and your data.</p>
      </header>

      <Panel title="Your data">
        <p className="text-sm text-muted">
          We keep the text of the files you upload (never the files themselves), the Games made from them, your Runs and
          guesses, and your profile, XP and friends. Page text is sent to Google Gemini to make Games and study notes, and
          Sonar sends your progress to Anthropic&apos;s Claude to coach you. The{" "}
          <Link href="/privacy" className="text-signal underline underline-offset-4">
            Privacy Policy
          </Link>{" "}
          has the details, and the{" "}
          <Link href="/terms" className="text-signal underline underline-offset-4">
            Terms
          </Link>{" "}
          cover what you can upload.
        </p>
      </Panel>

      <Panel title="Delete account" className="border-danger/60">
        <DeleteAccount />
      </Panel>
    </main>
  );
}
