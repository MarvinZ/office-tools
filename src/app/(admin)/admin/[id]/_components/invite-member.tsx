"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteMemberAction } from "../../actions";

export default function InviteMember({ tenantId, clerkOrgId }: { tenantId: string; clerkOrgId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleInvite() {
    setError(null);
    startTransition(async () => {
      const result = await inviteMemberAction(tenantId, clerkOrgId, email);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEmail("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleInvite()}
          type="email"
          placeholder="user@example.com"
          className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm text-black dark:border-zinc-700 dark:text-white"
        />
        <button
          onClick={handleInvite}
          disabled={isPending || !email.trim()}
          className="shrink-0 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Invite
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
