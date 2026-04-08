import FileManager from "../dashboard/_components/file-manager";
import SendEmailForm from "../dashboard/_components/send-email-form";

export default function DevToolsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-white">Dev Tools</h1>
        <p className="mt-1 text-sm text-zinc-500">Internal utilities for testing and debugging.</p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold text-black dark:text-white">File browser</h2>
        <FileManager />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold text-black dark:text-white">Test email</h2>
        <SendEmailForm />
      </div>
    </div>
  );
}
