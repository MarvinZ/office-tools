/**
 * Skeleton while the panel's figures load (Módulo 1 §13 "Carga"): grey blocks,
 * never zeros that could be read as real values.
 */
export default function PanelLoading() {
  const block = "animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900";
  return (
    <div aria-busy="true" className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10">
      <div className={`${block} h-16 w-72`} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`${block} h-48 lg:col-span-2`} />
        <div className={`${block} h-48`} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={`${block} h-28`} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${block} h-56`} />
        <div className={`${block} h-56`} />
      </div>
    </div>
  );
}
