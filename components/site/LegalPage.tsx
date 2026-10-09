import type { ReactNode } from "react";

/** Where privacy and legal questions go. Set up forwarding for it (docs/security.md § Email). */
export const PRIVACY_EMAIL = "privacy@syllabyss.tech";

/** Shared layout for /privacy and /terms (#5): a readable column of numbered sections. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-3xl text-text">{title}</h1>
      <p className="mt-1 text-sm text-faint">Last updated {updated}</p>
      <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-muted [&_a]:text-signal [&_a]:underline [&_a]:underline-offset-4 [&_li]:mt-1.5 [&_strong]:text-text [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </main>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-xl text-text">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
