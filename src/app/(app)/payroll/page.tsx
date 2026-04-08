import Link from "next/link";
import UploadZone from "./_components/upload-zone";

export default function PayrollPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white">Payroll</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Upload a payroll file to preview and send emails to employees.
          </p>
        </div>
        <Link
          href="/payroll/history"
          className="text-sm text-zinc-400 hover:text-black dark:hover:text-white"
        >
          View history →
        </Link>
      </div>
      <UploadZone />
    </div>
  );
}
