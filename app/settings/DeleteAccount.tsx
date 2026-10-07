"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { Button } from "@/components/ui";
import { DELETE_CONFIRM_PHRASE } from "@/lib/account/confirm";

/** Typed confirmation, then DELETE /api/me/account, then sign out and forget this browser's Sonar chats. */
export function DeleteAccount() {
  const { signOut } = useClerk();
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const ready = typed.trim().toLowerCase() === DELETE_CONFIRM_PHRASE;

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me/account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: DELETE_CONFIRM_PHRASE }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Something went wrong (${res.status})`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
      return;
    }
    // Sonar's saved chats live only in this browser.
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    // The Clerk user is gone, so signOut may fail; land on the landing page either way.
    await signOut({ redirectUrl: "/" }).catch(() => router.replace("/"));
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        This permanently deletes your account and everything in it: your Modules, uploaded files, Games, Runs, XP, badges,
        friends and leaderboard entries. It can&apos;t be undone.
      </p>
      <label htmlFor={id} className="flex flex-col gap-1.5">
        <span className="font-display text-sm text-text">
          Type <span className="text-danger">{DELETE_CONFIRM_PHRASE}</span> to confirm
        </span>
        <input
          id={id}
          value={typed}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          disabled={busy}
          onChange={(e) => setTyped(e.target.value)}
          className="h-11 rounded-md border border-border bg-bg-2 px-3 text-text outline-none focus:border-danger"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button variant="danger" disabled={!ready || busy} onClick={remove}>
        {busy ? "Deleting…" : "Delete my account"}
      </Button>
    </div>
  );
}
