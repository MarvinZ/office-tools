import { currentUser } from "@clerk/nextjs/server";
import SendEmailForm from "./send-email-form";
import FileManager from "./file-manager";

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
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold text-black dark:text-white">Files</h2>
        <FileManager />
      </div>
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold text-black dark:text-white">Send an email</h2>
        <SendEmailForm />
      </div>
    </div>
  );
}
