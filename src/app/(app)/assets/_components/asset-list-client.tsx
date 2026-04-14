"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, LayoutGrid, List } from "lucide-react";
import type { AssetRow } from "@/services/assets/assets";
import { STATUS_CONFIG, ASSET_CATEGORIES } from "../_mock/data";

type AssetStatus = AssetRow["status"];
type AssetCategory = AssetRow["category"];

const ALL = "All";

export default function AssetListClient({ assets }: { assets: AssetRow[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AssetStatus | typeof ALL>(ALL);
  const [category, setCategory] = useState<AssetCategory | typeof ALL>(ALL);
  const [view, setView] = useState<"table" | "grid">("table");

  const filtered = assets.filter((a) => {
    const matchSearch =
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.serialNumber.toLowerCase().includes(search.toLowerCase()) ||
      a.brand.toLowerCase().includes(search.toLowerCase()) ||
      a.model.toLowerCase().includes(search.toLowerCase()) ||
      a.barcode.includes(search);
    const matchStatus = status === ALL || a.status === status;
    const matchCategory = category === ALL || a.category === category;
    return matchSearch && matchStatus && matchCategory;
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, serial, barcode..."
              className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-8 pr-4 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-white"
            />
          </div>

          {/* Status filter */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as AssetStatus | typeof ALL)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          >
            <option value={ALL}>All statuses</option>
            {(Object.keys(STATUS_CONFIG) as AssetStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
            ))}
          </select>

          {/* Category filter */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as AssetCategory | typeof ALL)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          >
            <option value={ALL}>All categories</option>
            {ASSET_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-zinc-200 p-1 dark:border-zinc-700">
          <button
            onClick={() => setView("table")}
            className={`rounded-md p-1.5 transition-colors ${view === "table" ? "bg-zinc-100 text-black dark:bg-zinc-800 dark:text-white" : "text-zinc-400 hover:text-black dark:hover:text-white"}`}
          >
            <List size={15} />
          </button>
          <button
            onClick={() => setView("grid")}
            className={`rounded-md p-1.5 transition-colors ${view === "grid" ? "bg-zinc-100 text-black dark:bg-zinc-800 dark:text-white" : "text-zinc-400 hover:text-black dark:hover:text-white"}`}
          >
            <LayoutGrid size={15} />
          </button>
        </div>
      </div>

      {/* Results count */}
      {filtered.length !== assets.length && (
        <p className="text-sm text-zinc-400">{filtered.length} of {assets.length} assets</p>
      )}

      {/* Table view */}
      {view === "table" && (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                {["Asset", "Category", "Serial / Barcode", "Location", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-zinc-400">No assets found.</td>
                </tr>
              ) : filtered.map((a) => (
                <tr key={a.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-800">📦</div>
                      <div>
                        <p className="font-medium text-black dark:text-white">{a.name}</p>
                        <p className="text-xs text-zinc-400">{a.brand} {a.model}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{a.category}</td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{a.serialNumber}</p>
                    <p className="font-mono text-xs text-zinc-400">{a.barcode}</p>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    <p>{a.location}</p>
                    {a.assignedTo && <p className="text-xs text-zinc-400">{a.assignedTo}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CONFIG[a.status].color}`}>
                      {STATUS_CONFIG[a.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/assets/${a.id}`} className="text-xs text-zinc-400 hover:text-black dark:hover:text-white">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Grid view */}
      {view === "grid" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 ? (
            <p className="col-span-full text-center text-sm text-zinc-400 py-12">No assets found.</p>
          ) : filtered.map((a) => (
            <Link key={a.id} href={`/assets/${a.id}`} className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600">
              <div className="flex h-40 items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-4xl">
                📦
              </div>
              <div className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-black dark:text-white leading-tight">{a.name}</p>
                  <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CONFIG[a.status].color}`}>
                    {STATUS_CONFIG[a.status].label}
                  </span>
                </div>
                <p className="text-sm text-zinc-500">{a.brand} · {a.category}</p>
                <p className="font-mono text-xs text-zinc-400">{a.serialNumber}</p>
                {a.assignedTo && (
                  <p className="text-xs text-zinc-400">→ {a.assignedTo}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
