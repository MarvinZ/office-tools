"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createClientAction } from "../actions";

export default function CreateClientModal() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await createClientAction(new FormData(e.currentTarget));
    if (result && "error" in result) {
      setError(result.error ?? "Something went wrong.");
      setPending(false);
    }
    // On success, createClientAction redirects — no need to close
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black hover:bg-zinc-100"
      >
        + New client
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-16">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <h2 className="text-base font-semibold text-black dark:text-white">New client</h2>
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-black dark:hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6 py-5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">Company name *</label>
                <input
                  name="name"
                  required
                  placeholder="Acme Corp"
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">Admin email *</label>
                <input
                  name="adminEmail"
                  type="email"
                  required
                  placeholder="admin@acme.com"
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
                <p className="text-xs text-zinc-400">This person will receive an invitation to create their account and access the portal.</p>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex justify-end gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-zinc-200 px-5 py-2 text-sm text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black"
                >
                  {pending ? "Creating..." : "Create client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
