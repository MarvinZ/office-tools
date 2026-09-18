import type { ServiceInput } from "@/services/barbers/catalog";

/**
 * A realistically large service catalog (~180 services) for demo tenants,
 * so the typeahead/combobox and "most used at this location" favorites
 * actually have enough volume to be meaningful to try out — a 5-service
 * catalog can't exercise search or ranking in any interesting way.
 *
 * `prices` is [priceAtLocation0, priceAtLocation1] matching DEMO_LOCATIONS'
 * order in demo.ts (Escalante, Santa Ana) — Santa Ana prices run slightly
 * higher, consistent with the existing hand-picked services.
 */
export const DEMO_BARBER_SERVICES: { input: ServiceInput; prices: [number, number] }[] = [
  // ── Cabello — cortes ──────────────────────────────────────────────────────
  { input: { name: "Corte de cabello", category: "Cabello", defaultCommissionRate: 0.20, status: "active", tags: ["demo"] }, prices: [8000, 9500] },
  { input: { name: "Corte a máquina", category: "Cabello", defaultCommissionRate: 0.18, status: "active", tags: ["demo"] }, prices: [6000, 7000] },
  { input: { name: "Corte con tijera", category: "Cabello", defaultCommissionRate: 0.22, status: "active", tags: ["demo"] }, prices: [9500, 11000] },
  { input: { name: "Corte fade bajo", category: "Cabello", defaultCommissionRate: 0.22, status: "active", tags: ["demo"] }, prices: [9000, 10500] },
  { input: { name: "Corte fade medio", category: "Cabello", defaultCommissionRate: 0.22, status: "active", tags: ["demo"] }, prices: [9500, 11000] },
  { input: { name: "Corte fade alto", category: "Cabello", defaultCommissionRate: 0.22, status: "active", tags: ["demo"] }, prices: [9500, 11000] },
  { input: { name: "Corte fade calvo (skin fade)", category: "Cabello", defaultCommissionRate: 0.25, status: "active", tags: ["demo"] }, prices: [11000, 12500] },
  { input: { name: "Corte degradado clásico", category: "Cabello", defaultCommissionRate: 0.22, status: "active", tags: ["demo"] }, prices: [9000, 10500] },
  { input: { name: "Corte undercut", category: "Cabello", defaultCommissionRate: 0.22, status: "active", tags: ["demo"] }, prices: [9500, 11000] },
  { input: { name: "Corte pompadour", category: "Cabello", defaultCommissionRate: 0.25, status: "active", tags: ["demo"] }, prices: [10500, 12000] },
  { input: { name: "Corte quiff", category: "Cabello", defaultCommissionRate: 0.24, status: "active", tags: ["demo"] }, prices: [10000, 11500] },
  { input: { name: "Corte texturizado", category: "Cabello", defaultCommissionRate: 0.23, status: "active", tags: ["demo"] }, prices: [9500, 11000] },
  { input: { name: "Corte crew cut", category: "Cabello", defaultCommissionRate: 0.18, status: "active", tags: ["demo"] }, prices: [7000, 8000] },
  { input: { name: "Corte buzz cut", category: "Cabello", defaultCommissionRate: 0.16, status: "active", tags: ["demo"] }, prices: [5500, 6500] },
  { input: { name: "Corte militar", category: "Cabello", defaultCommissionRate: 0.16, status: "active", tags: ["demo"] }, prices: [5500, 6500] },
  { input: { name: "Corte mohawk", category: "Cabello", defaultCommissionRate: 0.26, status: "active", tags: ["demo"] }, prices: [11000, 12500] },
  { input: { name: "Corte a navaja completo", category: "Cabello", defaultCommissionRate: 0.28, status: "active", tags: ["demo"] }, prices: [12000, 13500] },
  { input: { name: "Diseño de líneas (1 línea)", category: "Cabello", defaultCommissionRate: 0.15, status: "active", tags: ["demo"] }, prices: [1500, 2000] },
  { input: { name: "Diseño de líneas (patrón)", category: "Cabello", defaultCommissionRate: 0.20, status: "active", tags: ["demo"] }, prices: [3000, 3500] },
  { input: { name: "Retoque de corte (7 días)", category: "Cabello", defaultCommissionRate: 0.18, status: "active", tags: ["demo"] }, prices: [4000, 4500] },
  { input: { name: "Perfilado de contorno", category: "Cabello", defaultCommissionRate: 0.15, status: "active", tags: ["demo"] }, prices: [2500, 3000] },
  { input: { name: "Lavado de cabello", category: "Cabello", defaultCommissionRate: 0.12, status: "active", tags: ["demo"] }, prices: [2000, 2500] },
  { input: { name: "Lavado + hidratación", category: "Cabello", defaultCommissionRate: 0.15, status: "active", tags: ["demo"] }, prices: [3500, 4000] },
  { input: { name: "Peinado con secadora", category: "Cabello", defaultCommissionRate: 0.15, status: "active", tags: ["demo"] }, prices: [3000, 3500] },
  { input: { name: "Peinado para evento", category: "Cabello", defaultCommissionRate: 0.20, status: "active", tags: ["demo"] }, prices: [6000, 7000] },

  // ── Barba y afeitado ──────────────────────────────────────────────────────
  { input: { name: "Arreglo de barba", category: "Barba", defaultCommissionRate: 0.20, status: "active", tags: ["demo"] }, prices: [5000, 6000] },
  { input: { name: "Perfilado de barba", category: "Barba", defaultCommissionRate: 0.18, status: "active", tags: ["demo"] }, prices: [4000, 4800] },
  { input: { name: "Diseño de barba", category: "Barba", defaultCommissionRate: 0.22, status: "active", tags: ["demo"] }, prices: [6000, 7000] },
  { input: { name: "Barba a navaja", category: "Barba", defaultCommissionRate: 0.24, status: "active", tags: ["demo"] }, prices: [6500, 7500] },
  { input: { name: "Afeitado clásico", category: "Barba", defaultCommissionRate: 0.18, status: "active", tags: ["demo"] }, prices: [6000, 7000] },
  { input: { name: "Afeitado con toalla caliente", category: "Barba", defaultCommissionRate: 0.22, status: "active", tags: ["demo"] }, prices: [7500, 8500] },
  { input: { name: "Afeitado facial completo", category: "Barba", defaultCommissionRate: 0.20, status: "active", tags: ["demo"] }, prices: [7000, 8000] },
  { input: { name: "Recorte de bigote", category: "Barba", defaultCommissionRate: 0.12, status: "active", tags: ["demo"] }, prices: [2000, 2500] },
  { input: { name: "Diseño de bigote", category: "Barba", defaultCommissionRate: 0.15, status: "active", tags: ["demo"] }, prices: [2500, 3000] },
  { input: { name: "Perfilado de patillas", category: "Barba", defaultCommissionRate: 0.12, status: "active", tags: ["demo"] }, prices: [2000, 2500] },
  { input: { name: "Tinte de barba", category: "Barba", defaultCommissionRate: 0.22, status: "active", tags: ["demo"] }, prices: [6500, 7500] },
  { input: { name: "Hidratación de barba", category: "Barba", defaultCommissionRate: 0.15, status: "active", tags: ["demo"] }, prices: [3500, 4000] },
  { input: { name: "Aplicación de aceite para barba", category: "Barba", defaultCommissionRate: 0.10, status: "active", tags: ["demo"] }, prices: [1500, 2000] },

  // ── Combos ────────────────────────────────────────────────────────────────
  { input: { name: "Corte + Barba", category: "Combo", defaultCommissionRate: 0.22, status: "active", tags: ["demo"] }, prices: [11500, 13500] },
  { input: { name: "Corte + Barba + Cejas", category: "Combo", defaultCommissionRate: 0.24, status: "active", tags: ["demo"] }, prices: [13000, 15000] },
  { input: { name: "Corte + Afeitado clásico", category: "Combo", defaultCommissionRate: 0.24, status: "active", tags: ["demo"] }, prices: [12500, 14000] },
  { input: { name: "Corte + Tinte", category: "Combo", defaultCommissionRate: 0.26, status: "active", tags: ["demo"] }, prices: [15000, 17000] },
  { input: { name: "Corte + Diseño de líneas", category: "Combo", defaultCommissionRate: 0.22, status: "active", tags: ["demo"] }, prices: [10500, 12000] },
  { input: { name: "Paquete completo (Corte + Barba + Facial)", category: "Combo", defaultCommissionRate: 0.28, status: "active", tags: ["demo"] }, prices: [16500, 18500] },
  { input: { name: "Paquete novio", category: "Combo", defaultCommissionRate: 0.28, status: "active", tags: ["demo"] }, prices: [18000, 20000] },
  { input: { name: "Paquete padre e hijo", category: "Combo", defaultCommissionRate: 0.20, status: "active", tags: ["demo"] }, prices: [14000, 16000] },

  // ── Color y tratamientos ──────────────────────────────────────────────────
  { input: { name: "Tinte completo", category: "Color", defaultCommissionRate: 0.25, status: "active", tags: ["demo"] }, prices: [12000, 14000] },
  { input: { name: "Tinte de canas", category: "Color", defaultCommissionRate: 0.22, status: "active", tags: ["demo"] }, prices: [10000, 11500] },
  { input: { name: "Mechas / balayage", category: "Color", defaultCommissionRate: 0.28, status: "active", tags: ["demo"] }, prices: [18000, 21000] },
  { input: { name: "Decoloración", category: "Color", defaultCommissionRate: 0.28, status: "active", tags: ["demo"] }, prices: [16000, 18500] },
  { input: { name: "Retoque de color (raíz)", category: "Color", defaultCommissionRate: 0.22, status: "active", tags: ["demo"] }, prices: [9000, 10500] },
  { input: { name: "Alisado con keratina", category: "Tratamiento", defaultCommissionRate: 0.28, status: "active", tags: ["demo"] }, prices: [22000, 25000] },
  { input: { name: "Tratamiento capilar hidratante", category: "Tratamiento", defaultCommissionRate: 0.20, status: "active", tags: ["demo"] }, prices: [8000, 9500] },
  { input: { name: "Tratamiento anticaspa", category: "Tratamiento", defaultCommissionRate: 0.18, status: "active", tags: ["demo"] }, prices: [7000, 8000] },
  { input: { name: "Tratamiento fortalecedor", category: "Tratamiento", defaultCommissionRate: 0.20, status: "active", tags: ["demo"] }, prices: [8500, 10000] },
  { input: { name: "Botox capilar", category: "Tratamiento", defaultCommissionRate: 0.26, status: "active", tags: ["demo"] }, prices: [18000, 20500] },
  { input: { name: "Permanente / rizado", category: "Tratamiento", defaultCommissionRate: 0.26, status: "active", tags: ["demo"] }, prices: [16000, 18500] },
  { input: { name: "Relajado / alisado japonés", category: "Tratamiento", defaultCommissionRate: 0.28, status: "active", tags: ["demo"] }, prices: [20000, 23000] },

  // ── Niños ─────────────────────────────────────────────────────────────────
  { input: { name: "Corte niño (hasta 10 años)", category: "Niños", defaultCommissionRate: 0.16, status: "active", tags: ["demo"] }, prices: [5500, 6500] },
  { input: { name: "Corte adolescente", category: "Niños", defaultCommissionRate: 0.18, status: "active", tags: ["demo"] }, prices: [6500, 7500] },
  { input: { name: "Primer corte de bebé", category: "Niños", defaultCommissionRate: 0.15, status: "active", tags: ["demo"] }, prices: [4500, 5000] },
  { input: { name: "Corte niño + diseño", category: "Niños", defaultCommissionRate: 0.18, status: "active", tags: ["demo"] }, prices: [7000, 8000] },

  // ── Cejas y rostro ────────────────────────────────────────────────────────
  { input: { name: "Perfilado de cejas", category: "Rostro", defaultCommissionRate: 0.12, status: "active", tags: ["demo"] }, prices: [2000, 2500] },
  { input: { name: "Depilación de cejas con cera", category: "Rostro", defaultCommissionRate: 0.14, status: "active", tags: ["demo"] }, prices: [2500, 3000] },
  { input: { name: "Depilación de cejas con hilo", category: "Rostro", defaultCommissionRate: 0.14, status: "active", tags: ["demo"] }, prices: [2500, 3000] },
  { input: { name: "Limpieza facial básica", category: "Rostro", defaultCommissionRate: 0.20, status: "active", tags: ["demo"] }, prices: [8000, 9500] },
  { input: { name: "Limpieza facial profunda", category: "Rostro", defaultCommissionRate: 0.24, status: "active", tags: ["demo"] }, prices: [11000, 13000] },
  { input: { name: "Mascarilla facial", category: "Rostro", defaultCommissionRate: 0.16, status: "active", tags: ["demo"] }, prices: [5000, 6000] },
  { input: { name: "Exfoliación facial", category: "Rostro", defaultCommissionRate: 0.16, status: "active", tags: ["demo"] }, prices: [4500, 5500] },
  { input: { name: "Depilación de nariz y oídos", category: "Rostro", defaultCommissionRate: 0.10, status: "active", tags: ["demo"] }, prices: [1500, 2000] },
  { input: { name: "Masaje facial relajante", category: "Rostro", defaultCommissionRate: 0.18, status: "active", tags: ["demo"] }, prices: [6000, 7000] },

  // ── Manos y uñas ──────────────────────────────────────────────────────────
  { input: { name: "Manicure", category: "Uñas", defaultCommissionRate: 0.15, status: "active", tags: ["demo"] }, prices: [4500, 5000] },
  { input: { name: "Manicure spa", category: "Uñas", defaultCommissionRate: 0.18, status: "active", tags: ["demo"] }, prices: [6500, 7500] },
  { input: { name: "Pedicure", category: "Uñas", defaultCommissionRate: 0.18, status: "active", tags: ["demo"] }, prices: [7000, 8000] },
  { input: { name: "Pedicure spa", category: "Uñas", defaultCommissionRate: 0.20, status: "active", tags: ["demo"] }, prices: [9000, 10500] },
  { input: { name: "Manicure + Pedicure combo", category: "Uñas", defaultCommissionRate: 0.20, status: "active", tags: ["demo"] }, prices: [11000, 13000] },
  { input: { name: "Limado y pulido de uñas", category: "Uñas", defaultCommissionRate: 0.10, status: "active", tags: ["demo"] }, prices: [2000, 2500] },
  { input: { name: "Parafina en manos", category: "Uñas", defaultCommissionRate: 0.14, status: "active", tags: ["demo"] }, prices: [3500, 4000] },

  // ── Masajes y spa ─────────────────────────────────────────────────────────
  { input: { name: "Masaje de cuero cabelludo", category: "Spa", defaultCommissionRate: 0.18, status: "active", tags: ["demo"] }, prices: [5000, 6000] },
  { input: { name: "Masaje de hombros y cuello", category: "Spa", defaultCommissionRate: 0.20, status: "active", tags: ["demo"] }, prices: [6500, 7500] },
  { input: { name: "Masaje relajante espalda", category: "Spa", defaultCommissionRate: 0.24, status: "active", tags: ["demo"] }, prices: [12000, 14000] },
  { input: { name: "Terapia con toallas calientes", category: "Spa", defaultCommissionRate: 0.14, status: "active", tags: ["demo"] }, prices: [3000, 3500] },

  // ── Depilación con cera ───────────────────────────────────────────────────
  { input: { name: "Depilación de cejas", category: "Cera", defaultCommissionRate: 0.12, status: "active", tags: ["demo"] }, prices: [2000, 2500] },
  { input: { name: "Depilación de espalda", category: "Cera", defaultCommissionRate: 0.24, status: "active", tags: ["demo"] }, prices: [10000, 12000] },
  { input: { name: "Depilación de pecho", category: "Cera", defaultCommissionRate: 0.22, status: "active", tags: ["demo"] }, prices: [9000, 10500] },
  { input: { name: "Depilación de brazos", category: "Cera", defaultCommissionRate: 0.18, status: "active", tags: ["demo"] }, prices: [6000, 7000] },
  { input: { name: "Depilación facial completa", category: "Cera", defaultCommissionRate: 0.16, status: "active", tags: ["demo"] }, prices: [4500, 5500] },

  // ── Cabello — más estilos ─────────────────────────────────────────────────
  { input: { name: "Corte curly / rizado definido", category: "Cabello", defaultCommissionRate: 0.24, status: "active", tags: ["demo"] }, prices: [10000, 11500] },
  { input: { name: "Corte afro", category: "Cabello", defaultCommissionRate: 0.24, status: "active", tags: ["demo"] }, prices: [10000, 11500] },
  { input: { name: "Corte a capas", category: "Cabello", defaultCommissionRate: 0.22, status: "active", tags: ["demo"] }, prices: [9000, 10500] },
  { input: { name: "Corte escalado", category: "Cabello", defaultCommissionRate: 0.20, status: "active", tags: ["demo"] }, prices: [8500, 10000] },
  { input: { name: "Corte con flequillo", category: "Cabello", defaultCommissionRate: 0.20, status: "active", tags: ["demo"] }, prices: [8500, 10000] },
  { input: { name: "Corte ejecutivo", category: "Cabello", defaultCommissionRate: 0.20, status: "active", tags: ["demo"] }, prices: [8500, 10000] },
  { input: { name: "Corte deportivo", category: "Cabello", defaultCommissionRate: 0.16, status: "active", tags: ["demo"] }, prices: [6000, 7000] },
  { input: { name: "Corte high top fade", category: "Cabello", defaultCommissionRate: 0.26, status: "active", tags: ["demo"] }, prices: [11500, 13000] },
  { input: { name: "Corte low taper", category: "Cabello", defaultCommissionRate: 0.22, status: "active", tags: ["demo"] }, prices: [9000, 10500] },
  { input: { name: "Corte mid taper", category: "Cabello", defaultCommissionRate: 0.22, status: "active", tags: ["demo"] }, prices: [9000, 10500] },
  { input: { name: "Corte french crop", category: "Cabello", defaultCommissionRate: 0.24, status: "active", tags: ["demo"] }, prices: [10000, 11500] },
  { input: { name: "Corte side part", category: "Cabello", defaultCommissionRate: 0.22, status: "active", tags: ["demo"] }, prices: [9000, 10500] },
  { input: { name: "Corte slick back", category: "Cabello", defaultCommissionRate: 0.24, status: "active", tags: ["demo"] }, prices: [10000, 11500] },
  { input: { name: "Corte curly shag", category: "Cabello", defaultCommissionRate: 0.25, status: "active", tags: ["demo"] }, prices: [10500, 12000] },
  { input: { name: "Corte de transición (dejar crecer)", category: "Cabello", defaultCommissionRate: 0.18, status: "active", tags: ["demo"] }, prices: [7000, 8000] },
  { input: { name: "Corte con máquina + tijera", category: "Cabello", defaultCommissionRate: 0.22, status: "active", tags: ["demo"] }, prices: [9500, 11000] },
  { input: { name: "Corte a domicilio", category: "Cabello", defaultCommissionRate: 0.30, status: "active", tags: ["demo"] }, prices: [15000, 15000] },
  { input: { name: "Corte VIP (sin espera)", category: "Cabello", defaultCommissionRate: 0.24, status: "active", tags: ["demo"] }, prices: [12000, 13500] },
  { input: { name: "Diseño artístico personalizado", category: "Cabello", defaultCommissionRate: 0.28, status: "active", tags: ["demo"] }, prices: [8000, 9500] },
  { input: { name: "Diseño de iniciales", category: "Cabello", defaultCommissionRate: 0.22, status: "active", tags: ["demo"] }, prices: [4000, 4500] },
  { input: { name: "Diseño de número", category: "Cabello", defaultCommissionRate: 0.20, status: "active", tags: ["demo"] }, prices: [3500, 4000] },
  { input: { name: "Repaso de nuca (5 días)", category: "Cabello", defaultCommissionRate: 0.10, status: "active", tags: ["demo"] }, prices: [1500, 2000] },
  { input: { name: "Repaso de contorno (5 días)", category: "Cabello", defaultCommissionRate: 0.10, status: "active", tags: ["demo"] }, prices: [1500, 2000] },
  { input: { name: "Peinado clásico con gel", category: "Cabello", defaultCommissionRate: 0.14, status: "active", tags: ["demo"] }, prices: [2500, 3000] },
  { input: { name: "Peinado con cera texturizante", category: "Cabello", defaultCommissionRate: 0.14, status: "active", tags: ["demo"] }, prices: [2500, 3000] },
  { input: { name: "Secado y cepillado", category: "Cabello", defaultCommissionRate: 0.12, status: "active", tags: ["demo"] }, prices: [2000, 2500] },
  { input: { name: "Plancha para caballero", category: "Cabello", defaultCommissionRate: 0.18, status: "active", tags: ["demo"] }, prices: [5000, 6000] },
  { input: { name: "Consulta de estilo", category: "Cabello", defaultCommissionRate: 0.08, status: "active", tags: ["demo"] }, prices: [1000, 1000] },

  // ── Barba — más estilos ───────────────────────────────────────────────────
  { input: { name: "Barba estilo candado", category: "Barba", defaultCommissionRate: 0.20, status: "active", tags: ["demo"] }, prices: [5500, 6500] },
  { input: { name: "Barba estilo chivera", category: "Barba", defaultCommissionRate: 0.18, status: "active", tags: ["demo"] }, prices: [5000, 6000] },
  { input: { name: "Barba full beard", category: "Barba", defaultCommissionRate: 0.22, status: "active", tags: ["demo"] }, prices: [6000, 7000] },
  { input: { name: "Barba corporativa", category: "Barba", defaultCommissionRate: 0.20, status: "active", tags: ["demo"] }, prices: [5500, 6500] },
  { input: { name: "Barba degradada", category: "Barba", defaultCommissionRate: 0.22, status: "active", tags: ["demo"] }, prices: [6000, 7000] },
  { input: { name: "Contorno de barba con navaja", category: "Barba", defaultCommissionRate: 0.20, status: "active", tags: ["demo"] }, prices: [5500, 6500] },
  { input: { name: "Repaso de barba (5 días)", category: "Barba", defaultCommissionRate: 0.10, status: "active", tags: ["demo"] }, prices: [2000, 2500] },
  { input: { name: "Afeitado de cuello", category: "Barba", defaultCommissionRate: 0.10, status: "active", tags: ["demo"] }, prices: [1500, 2000] },
  { input: { name: "Afeitado exprés", category: "Barba", defaultCommissionRate: 0.14, status: "active", tags: ["demo"] }, prices: [4000, 4500] },
  { input: { name: "Ritual de afeitado premium", category: "Barba", defaultCommissionRate: 0.26, status: "active", tags: ["demo"] }, prices: [9500, 11000] },
  { input: { name: "Alisado de barba", category: "Barba", defaultCommissionRate: 0.18, status: "active", tags: ["demo"] }, prices: [5000, 6000] },
  { input: { name: "Relleno de barba (micropigmentación)", category: "Barba", defaultCommissionRate: 0.30, status: "active", tags: ["demo"] }, prices: [20000, 22000] },

  // ── Combos adicionales ────────────────────────────────────────────────────
  { input: { name: "Corte + Barba + Cera facial", category: "Combo", defaultCommissionRate: 0.25, status: "active", tags: ["demo"] }, prices: [15000, 17000] },
  { input: { name: "Corte + Manicure", category: "Combo", defaultCommissionRate: 0.20, status: "active", tags: ["demo"] }, prices: [12000, 13500] },
  { input: { name: "Corte + Masaje de hombros", category: "Combo", defaultCommissionRate: 0.24, status: "active", tags: ["demo"] }, prices: [13500, 15500] },
  { input: { name: "Barba + Cejas + Nariz", category: "Combo", defaultCommissionRate: 0.20, status: "active", tags: ["demo"] }, prices: [8000, 9000] },
  { input: { name: "Corte + Barba + Tratamiento capilar", category: "Combo", defaultCommissionRate: 0.28, status: "active", tags: ["demo"] }, prices: [19000, 21500] },
  { input: { name: "Express (corte rápido)", category: "Combo", defaultCommissionRate: 0.16, status: "active", tags: ["demo"] }, prices: [6000, 7000] },
  { input: { name: "Paquete quinceañero", category: "Combo", defaultCommissionRate: 0.22, status: "active", tags: ["demo"] }, prices: [13000, 15000] },
  { input: { name: "Paquete graduación", category: "Combo", defaultCommissionRate: 0.24, status: "active", tags: ["demo"] }, prices: [15000, 17000] },
  { input: { name: "Membresía mensual — 2 cortes", category: "Combo", defaultCommissionRate: 0.18, status: "active", tags: ["demo"] }, prices: [14000, 16000] },
  { input: { name: "Membresía mensual — corte + barba", category: "Combo", defaultCommissionRate: 0.20, status: "active", tags: ["demo"] }, prices: [20000, 23000] },

  // ── Color y tratamientos adicionales ──────────────────────────────────────
  { input: { name: "Tinte fantasía", category: "Color", defaultCommissionRate: 0.30, status: "active", tags: ["demo"] }, prices: [20000, 23000] },
  { input: { name: "Tinte para barba y cabello", category: "Color", defaultCommissionRate: 0.26, status: "active", tags: ["demo"] }, prices: [15000, 17000] },
  { input: { name: "Iluminaciones parciales", category: "Color", defaultCommissionRate: 0.26, status: "active", tags: ["demo"] }, prices: [14000, 16000] },
  { input: { name: "Matizado", category: "Color", defaultCommissionRate: 0.20, status: "active", tags: ["demo"] }, prices: [8000, 9500] },
  { input: { name: "Tratamiento de keratina exprés", category: "Tratamiento", defaultCommissionRate: 0.22, status: "active", tags: ["demo"] }, prices: [12000, 14000] },
  { input: { name: "Tratamiento capilar con colágeno", category: "Tratamiento", defaultCommissionRate: 0.22, status: "active", tags: ["demo"] }, prices: [10000, 11500] },
  { input: { name: "Tratamiento anticaída", category: "Tratamiento", defaultCommissionRate: 0.22, status: "active", tags: ["demo"] }, prices: [10500, 12000] },
  { input: { name: "Tratamiento nutritivo profundo", category: "Tratamiento", defaultCommissionRate: 0.22, status: "active", tags: ["demo"] }, prices: [9500, 11000] },
  { input: { name: "Terapia capilar con vapor", category: "Tratamiento", defaultCommissionRate: 0.18, status: "active", tags: ["demo"] }, prices: [6500, 7500] },

  // ── Niños adicionales ─────────────────────────────────────────────────────
  { input: { name: "Corte niña (hasta 10 años)", category: "Niños", defaultCommissionRate: 0.16, status: "active", tags: ["demo"] }, prices: [5500, 6500] },
  { input: { name: "Corte niño con diseño básico", category: "Niños", defaultCommissionRate: 0.18, status: "active", tags: ["demo"] }, prices: [6500, 7500] },
  { input: { name: "Corte gemelos (2 niños)", category: "Niños", defaultCommissionRate: 0.16, status: "active", tags: ["demo"] }, prices: [10000, 11500] },
  { input: { name: "Peinado para fiesta infantil", category: "Niños", defaultCommissionRate: 0.14, status: "active", tags: ["demo"] }, prices: [3500, 4000] },

  // ── Rostro adicionales ────────────────────────────────────────────────────
  { input: { name: "Laminado de cejas", category: "Rostro", defaultCommissionRate: 0.18, status: "active", tags: ["demo"] }, prices: [7000, 8000] },
  { input: { name: "Tinte de cejas", category: "Rostro", defaultCommissionRate: 0.14, status: "active", tags: ["demo"] }, prices: [3000, 3500] },
  { input: { name: "Extracción de puntos negros", category: "Rostro", defaultCommissionRate: 0.18, status: "active", tags: ["demo"] }, prices: [6000, 7000] },
  { input: { name: "Hidratación facial profunda", category: "Rostro", defaultCommissionRate: 0.20, status: "active", tags: ["demo"] }, prices: [8000, 9500] },
  { input: { name: "Contorno facial con hilo", category: "Rostro", defaultCommissionRate: 0.16, status: "active", tags: ["demo"] }, prices: [4000, 4500] },
  { input: { name: "Aplicación de mascarilla de carbón", category: "Rostro", defaultCommissionRate: 0.16, status: "active", tags: ["demo"] }, prices: [4500, 5500] },
  { input: { name: "Peeling facial suave", category: "Rostro", defaultCommissionRate: 0.18, status: "active", tags: ["demo"] }, prices: [7000, 8500] },

  // ── Manos y uñas adicionales ──────────────────────────────────────────────
  { input: { name: "Manicure exprés", category: "Uñas", defaultCommissionRate: 0.12, status: "active", tags: ["demo"] }, prices: [3000, 3500] },
  { input: { name: "Pedicure exprés", category: "Uñas", defaultCommissionRate: 0.14, status: "active", tags: ["demo"] }, prices: [4500, 5000] },
  { input: { name: "Exfoliación de manos", category: "Uñas", defaultCommissionRate: 0.12, status: "active", tags: ["demo"] }, prices: [2500, 3000] },
  { input: { name: "Exfoliación de pies", category: "Uñas", defaultCommissionRate: 0.14, status: "active", tags: ["demo"] }, prices: [3000, 3500] },
  { input: { name: "Masaje de manos y antebrazos", category: "Uñas", defaultCommissionRate: 0.14, status: "active", tags: ["demo"] }, prices: [3500, 4000] },
  { input: { name: "Masaje de pies", category: "Uñas", defaultCommissionRate: 0.16, status: "active", tags: ["demo"] }, prices: [4500, 5500] },

  // ── Spa adicionales ───────────────────────────────────────────────────────
  { input: { name: "Masaje de espalda y hombros", category: "Spa", defaultCommissionRate: 0.22, status: "active", tags: ["demo"] }, prices: [9500, 11000] },
  { input: { name: "Masaje deportivo", category: "Spa", defaultCommissionRate: 0.26, status: "active", tags: ["demo"] }, prices: [14000, 16000] },
  { input: { name: "Terapia de piedras calientes", category: "Spa", defaultCommissionRate: 0.26, status: "active", tags: ["demo"] }, prices: [15000, 17000] },
  { input: { name: "Reflexología podal", category: "Spa", defaultCommissionRate: 0.20, status: "active", tags: ["demo"] }, prices: [8500, 10000] },
  { input: { name: "Sesión de relajación (20 min)", category: "Spa", defaultCommissionRate: 0.18, status: "active", tags: ["demo"] }, prices: [6000, 7000] },

  // ── Depilación adicional ──────────────────────────────────────────────────
  { input: { name: "Depilación de piernas", category: "Cera", defaultCommissionRate: 0.22, status: "active", tags: ["demo"] }, prices: [9000, 10500] },
  { input: { name: "Depilación de abdomen", category: "Cera", defaultCommissionRate: 0.18, status: "active", tags: ["demo"] }, prices: [6500, 7500] },
  { input: { name: "Depilación de glúteos", category: "Cera", defaultCommissionRate: 0.18, status: "active", tags: ["demo"] }, prices: [6500, 7500] },
  { input: { name: "Depilación de línea alba", category: "Cera", defaultCommissionRate: 0.12, status: "active", tags: ["demo"] }, prices: [2000, 2500] },
  { input: { name: "Depilación con hilo (rostro completo)", category: "Cera", defaultCommissionRate: 0.16, status: "active", tags: ["demo"] }, prices: [4000, 4500] },

  // ── Otros servicios ───────────────────────────────────────────────────────
  { input: { name: "Aplicación de tónico capilar", category: "Otros", defaultCommissionRate: 0.10, status: "active", tags: ["demo"] }, prices: [2000, 2500] },
  { input: { name: "Aplicación de minoxidil", category: "Otros", defaultCommissionRate: 0.08, status: "active", tags: ["demo"] }, prices: [1500, 2000] },
  { input: { name: "Consulta de tricología", category: "Otros", defaultCommissionRate: 0.10, status: "active", tags: ["demo"] }, prices: [3000, 3000] },
  { input: { name: "Prueba de alergia (tinte)", category: "Otros", defaultCommissionRate: 0.05, status: "active", tags: ["demo"] }, prices: [500, 500] },
  { input: { name: "Venta de producto — cera para cabello", category: "Otros", defaultCommissionRate: 0.10, status: "active", tags: ["demo"] }, prices: [4500, 4500] },
  { input: { name: "Venta de producto — aceite para barba", category: "Otros", defaultCommissionRate: 0.10, status: "active", tags: ["demo"] }, prices: [5500, 5500] },
  { input: { name: "Venta de producto — shampoo", category: "Otros", defaultCommissionRate: 0.10, status: "active", tags: ["demo"] }, prices: [6000, 6000] },
  { input: { name: "Venta de producto — kit de afeitado", category: "Otros", defaultCommissionRate: 0.10, status: "active", tags: ["demo"] }, prices: [9500, 9500] },
  { input: { name: "Retoque post-servicio (cortesía)", category: "Otros", defaultCommissionRate: 0.00, status: "active", tags: ["demo"] }, prices: [0, 0] },
  { input: { name: "Servicio a domicilio — evento", category: "Otros", defaultCommissionRate: 0.30, status: "active", tags: ["demo"] }, prices: [25000, 25000] },
  { input: { name: "Corte descontinuado (archivo)", category: "Cabello", defaultCommissionRate: 0.20, status: "inactive", tags: ["demo"] }, prices: [8000, 9000] },
  { input: { name: "Servicio de temporada (archivo)", category: "Otros", defaultCommissionRate: 0.15, status: "inactive", tags: ["demo"] }, prices: [5000, 5000] },
];

/** Sanity check for demo/dev use — the catalog should be sizable enough to exercise search/favorites. */
export const DEMO_BARBER_SERVICES_COUNT = DEMO_BARBER_SERVICES.length;
