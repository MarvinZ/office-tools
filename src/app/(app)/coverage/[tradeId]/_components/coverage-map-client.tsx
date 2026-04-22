"use client";

import { useState, useCallback, useRef, useTransition } from "react";
import { GoogleMap, useJsApiLoader, DrawingManager, Polygon } from "@react-google-maps/api";
import { Trash2, Edit2, Check, X, MapPin, Loader } from "lucide-react";
import type { Polygon as GeoPolygon } from "geojson";
import type { CoverageAreaUI } from "@/services/coverage/coverage";
import { createCoverageAreaAction, updateCoverageAreaAction, deleteCoverageAreaAction } from "../actions";

const LIBRARIES: ("drawing")[] = ["drawing"];

const MAP_CENTER = { lat: 10.0, lng: -84.0 }; // Central America default

const POLYGON_OPTIONS = {
  fillColor: "#2563EB",
  fillOpacity: 0.15,
  strokeColor: "#2563EB",
  strokeOpacity: 0.8,
  strokeWeight: 2,
};

const NEW_POLYGON_OPTIONS = {
  ...POLYGON_OPTIONS,
  fillColor: "#16A34A",
  strokeColor: "#16A34A",
};

function googlePolygonToGeoJSON(polygon: google.maps.Polygon): GeoPolygon {
  const path = polygon.getPath().getArray();
  const coords = path.map((latLng) => [latLng.lng(), latLng.lat()]);
  // Close the ring
  if (coords.length > 0) coords.push(coords[0]);
  return { type: "Polygon", coordinates: [coords] };
}

function geoJSONToLatLngs(polygon: GeoPolygon): google.maps.LatLngLiteral[] {
  return polygon.coordinates[0].slice(0, -1).map(([lng, lat]) => ({ lat, lng }));
}

type Props = {
  tradeId: string;
  tradeName: string;
  initialAreas: CoverageAreaUI[];
};

export default function CoverageMapClient({ tradeId, tradeName, initialAreas }: Props) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: LIBRARIES,
  });

  const [areas, setAreas] = useState<CoverageAreaUI[]>(initialAreas);
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [newPolygon, setNewPolygon] = useState<google.maps.Polygon | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [savingNew, setSavingNew] = useState(false);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);

  const handlePolygonComplete = useCallback((polygon: google.maps.Polygon) => {
    // Switch drawing manager back to non-drawing mode
    if (drawingManagerRef.current) {
      drawingManagerRef.current.setDrawingMode(null);
    }
    setNewPolygon(polygon);
    setNewLabel("");
  }, []);

  function cancelNew() {
    newPolygon?.setMap(null);
    setNewPolygon(null);
    setNewLabel("");
  }

  function saveNew() {
    if (!newPolygon) return;
    const geoPolygon = googlePolygonToGeoJSON(newPolygon);
    setSavingNew(true);
    startTransition(async () => {
      await createCoverageAreaAction(tradeId, geoPolygon, newLabel || undefined);
      // Optimistic: refresh by reloading the list via router is not available here,
      // so we add a placeholder — the real data comes on next page load/refresh.
      newPolygon.setMap(null);
      setNewPolygon(null);
      setNewLabel("");
      setSavingNew(false);
      // Trigger a soft refresh by updating areas from server
      window.location.reload();
    });
  }

  function startEdit(area: CoverageAreaUI) {
    setEditingId(area.id);
    setEditLabel(area.label ?? "");
  }

  function saveEdit(id: string) {
    startTransition(async () => {
      await updateCoverageAreaAction(tradeId, id, editLabel || null);
      setAreas((prev) => prev.map((a) => a.id === id ? { ...a, label: editLabel || null } : a));
      setEditingId(null);
    });
  }

  function deleteArea(id: string) {
    startTransition(async () => {
      await deleteCoverageAreaAction(tradeId, id);
      setAreas((prev) => prev.filter((a) => a.id !== id));
    });
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
        Failed to load Google Maps. Check your API key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-[480px] items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <Loader size={20} className="animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Instructions */}
      {!newPolygon && (
        <p className="text-sm text-zinc-500">
          Use the polygon tool on the map to draw a coverage area for <strong className="text-black dark:text-white">{tradeName}</strong>. Draw as many areas as needed.
        </p>
      )}

      {/* New polygon save bar */}
      {newPolygon && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900/50 dark:bg-green-900/20">
          <MapPin size={16} className="shrink-0 text-green-600 dark:text-green-400" />
          <div className="flex flex-1 items-center gap-2">
            <input
              autoFocus
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Area name (optional) — e.g. Miami Metro"
              className="flex-1 rounded-lg border border-green-200 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-green-400 dark:border-green-800 dark:bg-zinc-900 dark:text-white"
            />
          </div>
          <button
            onClick={saveNew}
            disabled={savingNew || isPending}
            className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            <Check size={14} />
            {savingNew ? "Saving…" : "Save area"}
          </button>
          <button
            onClick={cancelNew}
            disabled={savingNew}
            className="flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400"
          >
            <X size={14} />
            Cancel
          </button>
        </div>
      )}

      {/* Map */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800" style={{ height: 480 }}>
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={MAP_CENTER}
          zoom={6}
          options={{
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
          }}
        >
          {/* Existing polygons */}
          {areas.map((area) => (
            <Polygon
              key={area.id}
              paths={geoJSONToLatLngs(area.polygon)}
              options={POLYGON_OPTIONS}
            />
          ))}

          {/* Drawing manager */}
          <DrawingManager
            onLoad={(dm) => { drawingManagerRef.current = dm; }}
            onPolygonComplete={handlePolygonComplete}
            options={{
              drawingControl: !newPolygon,
              drawingControlOptions: {
                position: google.maps.ControlPosition.TOP_CENTER,
                drawingModes: [google.maps.drawing.OverlayType.POLYGON],
              },
              polygonOptions: NEW_POLYGON_OPTIONS,
            }}
          />
        </GoogleMap>
      </div>

      {/* Areas list */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Saved areas ({areas.length})
        </h2>

        {areas.length === 0 ? (
          <p className="text-sm text-zinc-400">No coverage areas yet. Draw one on the map above.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {areas.map((area) => (
              <div
                key={area.id}
                className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <MapPin size={14} className="shrink-0 text-blue-500" />
                  {editingId === area.id ? (
                    <input
                      autoFocus
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      placeholder="Area name"
                      className="flex-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                    />
                  ) : (
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium text-black dark:text-white truncate">
                        {area.label ?? <span className="italic text-zinc-400">Unnamed area</span>}
                      </span>
                      <span className="text-xs text-zinc-400">Added {area.createdAt}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-3">
                  {editingId === area.id ? (
                    <>
                      <button
                        onClick={() => saveEdit(area.id)}
                        disabled={isPending}
                        className="flex items-center gap-1 rounded-lg bg-black px-2.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black"
                      >
                        <Check size={12} />
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-500 hover:border-zinc-400 dark:border-zinc-700"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(area)}
                        disabled={isPending}
                        className="rounded-lg border border-zinc-200 p-1.5 text-zinc-500 hover:border-zinc-400 hover:text-black disabled:opacity-50 dark:border-zinc-700 dark:hover:text-white"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => deleteArea(area.id)}
                        disabled={isPending}
                        className="rounded-lg border border-zinc-200 p-1.5 text-zinc-500 hover:border-red-300 hover:text-red-500 disabled:opacity-50 dark:border-zinc-700"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
