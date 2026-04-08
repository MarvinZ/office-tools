import { currentUser } from "@clerk/nextjs/server";
import PayrollProcessor from "./payroll-processor";
import FileManager from "./file-manager";
import SendEmailForm from "./send-email-form";

export default async function DashboardPage() {
  const user = await currentUser();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-white">
          Welcome back, {user?.firstName ?? "there"}!
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Here's your dashboard.</p>
      </div>

      {/* Payroll tool */}
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-1 text-base font-semibold text-black dark:text-white">Payroll</h2>
        <p className="mb-6 text-sm text-zinc-500">Upload a payroll file, review the data, and send emails.</p>
        <PayrollProcessor />
      </div>

      {/* Dev / test tools */}
      <div className="mt-6 flex flex-col gap-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Dev tools</p>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-semibold text-black dark:text-white">File browser</h2>
          <FileManager />
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-semibold text-black dark:text-white">Test email</h2>
          <SendEmailForm />
        </div>
      </div>
    </div>
  );
}
