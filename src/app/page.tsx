import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-white dark:bg-black">
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-white">
          OfficeTools
        </h1>
        <p className="text-lg text-zinc-500">
          Your workplace toolkit.
        </p>
        <Link
          href="/sign-in"
          className="rounded-full bg-black px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Log in
        </Link>
      </div>
    </div>
  );
}
