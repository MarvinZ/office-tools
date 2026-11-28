import type { Demographics } from "@/lib/barbers/clients";

/**
 * Clients by age range (NOURA Módulo 1 §11): one horizontal bar per range in
 * the ranges' natural order, one hue, with the count and share printed on
 * each row, so the rows double as the table the PDF asks for. "Unknown age"
 * is neutral gray and named, never told apart by color alone.
 * Hue validated (dataviz validator): #257de0 on white, #338ced on #09090b.
 */
export default function AgeDistribution({
  data,
  labels,
  totalLabel,
  emptyLabel,
}: {
  data: Demographics;
  labels: Record<string, string>; // range key → "18 a 24", "Edad desconocida"…
  totalLabel: string; // "28 clientes considerados"
  emptyLabel: string;
}) {
  if (data.total === 0) return <p className="text-sm text-zinc-400">{emptyLabel}</p>;
  const max = Math.max(...data.groups.map((g) => g.count), 1);
  return (
    <div className="flex flex-col gap-2">
      <table className="w-full text-sm">
        <caption className="sr-only">{totalLabel}</caption>
        <tbody>
          {data.groups.map((g) => {
            const unknown = g.key === "unknown";
            const label = labels[g.key] ?? g.key;
            return (
              <tr key={g.key} title={`${label}: ${g.count} (${g.percent}%)`}>
                <th scope="row" className="w-32 py-1 pr-3 text-left text-xs font-normal text-zinc-600 dark:text-zinc-400">
                  {label}
                </th>
                <td className="py-1">
                  <div className="flex h-4 items-center">
                    {g.count > 0 && (
                      <div
                        aria-hidden
                        className={`h-2.5 rounded-r ${unknown ? "bg-zinc-400 dark:bg-zinc-500" : "bg-[#257de0] dark:bg-[#338ced]"}`}
                        style={{ width: `${Math.max(2, (g.count / max) * 100)}%` }}
                      />
                    )}
                  </div>
                </td>
                <td className="w-24 py-1 pl-3 text-right text-xs tabular-nums text-zinc-700 dark:text-zinc-300">
                  {g.count} · {g.percent}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-zinc-500">{totalLabel}</p>
    </div>
  );
}
