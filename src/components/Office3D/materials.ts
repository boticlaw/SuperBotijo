import * as THREE from "three";

// ===========================================
// SHARED THREE.JS MATERIALS FOR OFFICE3D
// ===========================================
// IMPORTANT: Materials created here are reused across all component instances.
// This prevents memory leaks from inline JSX materials that create new instances on every mount.
//
// Usage in components:
//   import { MATERIALS } from "./materials";
//   <mesh>
//     <primitive object={MATERIALS.skin.face} attach="material" />
//   </mesh>
//
// For dynamic colors (agent-specific), continue using inline materials but add dispose={null}
// ===========================================

export const MATERIALS = {
  // === SKIN (Avatar) ===
  skin: {
    face: new THREE.MeshStandardMaterial({ color: "#ffa07a" }),
    nose: new THREE.MeshStandardMaterial({ color: "#f08f6b" }),
    hand: new THREE.MeshStandardMaterial({ color: "#ffa07a" }),
  },

  // === EYES ===
  eyes: {
    sclera: new THREE.MeshStandardMaterial({ color: "#ffffff" }),
    pupil: new THREE.MeshStandardMaterial({ color: "#1f2937" }),
  },

  // === HAIR / BROWS / BEARD ===
  hair: {
    default: new THREE.MeshStandardMaterial({ color: "#4a3728", roughness: 0.95 }),
    brow: new THREE.MeshStandardMaterial({ color: "#4a3728" }),
  },

  // === MOUTH ===
  mouth: {
    neutral: new THREE.MeshStandardMaterial({ color: "#111111" }),
    frown: new THREE.MeshStandardMaterial({ color: "#ef4444" }),
  },

  // === CLOTHING ===
  clothing: {
    pants: new THREE.MeshStandardMaterial({ color: "#4a5568" }),
    shoes: new THREE.MeshStandardMaterial({ color: "#1f2937" }),
  },

  // === METALS ===
  metals: {
    chrome: new THREE.MeshStandardMaterial({ color: "#c0c0c0", metalness: 0.9, roughness: 0.1 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: "#1f2937", metalness: 0.8, roughness: 0.2 }),
    grayMetal: new THREE.MeshStandardMaterial({ color: "#374151", metalness: 0.5, roughness: 0.5 }),
    handleMetal: new THREE.MeshStandardMaterial({ color: "#1f2937", metalness: 0.8, roughness: 0.2 }),
  },

  // === DARK PLASTICS / SYNTHETICS ===
  plastics: {
    dark: new THREE.MeshStandardMaterial({ color: "#1f2937" }),
    darkGray: new THREE.MeshStandardMaterial({ color: "#374151" }),
    mediumGray: new THREE.MeshStandardMaterial({ color: "#6b7280" }),
    lightGray: new THREE.MeshStandardMaterial({ color: "#9ca3af" }),
    keyboard: new THREE.MeshStandardMaterial({ color: "#2d3748", roughness: 0.8 }),
    keycaps: new THREE.MeshStandardMaterial({ color: "#1f2937" }),
    spacebar: new THREE.MeshStandardMaterial({ color: "#374151" }),
  },

  // === WOOD ===
  wood: {
    desk: new THREE.MeshStandardMaterial({ color: "#8B4513" }),
    dark: new THREE.MeshStandardMaterial({ color: "#5d4037" }),
    shelf: new THREE.MeshStandardMaterial({ color: "#8b4513", roughness: 0.82 }),
    shelfBack: new THREE.MeshStandardMaterial({ color: "#6b4423", roughness: 0.9 }),
    tableTop: new THREE.MeshStandardMaterial({ color: "#5a4337", roughness: 0.7 }),
    tableLeg: new THREE.MeshStandardMaterial({ color: "#4a352b", roughness: 0.72 }),
  },

  // === WALLS / CEILING / FLOOR ===
  walls: {
    main: new THREE.MeshStandardMaterial({ color: "#e8e4de", roughness: 0.9 }),
    baseboard: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.7 }),
    ceiling: new THREE.MeshStandardMaterial({ color: "#e8e4de", roughness: 0.9 }),
  },

  // === WINDOW ===
  window: {
    glass: new THREE.MeshStandardMaterial({
      color: "#87ceeb",
      transparent: true,
      opacity: 0.3,
      roughness: 0.1,
      metalness: 0.1,
    }),
    frame: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.7 }),
  },

  // === PLANTS ===
  plants: {
    pot: new THREE.MeshStandardMaterial({ color: "#8b4513", roughness: 0.9 }),
    soil: new THREE.MeshStandardMaterial({ color: "#3d2817", roughness: 1 }),
    deskPot: new THREE.MeshStandardMaterial({ color: "#92400e", roughness: 0.9 }),
    deskSoil: new THREE.MeshStandardMaterial({ color: "#4a2a1a", roughness: 1 }),
    stem: new THREE.MeshStandardMaterial({ color: "#166534" }),
    leaf1: new THREE.MeshStandardMaterial({ color: "#22c55e" }),
    leaf2: new THREE.MeshStandardMaterial({ color: "#16a34a" }),
    leaf3: new THREE.MeshStandardMaterial({ color: "#2dd46a" }),
    sphere: new THREE.MeshStandardMaterial({ color: "#22c55e", roughness: 0.8 }),
    sphereAlt1: new THREE.MeshStandardMaterial({ color: "#1ea54e", roughness: 0.8 }),
    sphereAlt2: new THREE.MeshStandardMaterial({ color: "#2dd46a", roughness: 0.8 }),
    trunk: new THREE.MeshStandardMaterial({ color: "#5b3a1f", roughness: 0.95 }),
    succulent1: new THREE.MeshStandardMaterial({ color: "#34d399", roughness: 0.75 }),
    succulent2: new THREE.MeshStandardMaterial({ color: "#10b981", roughness: 0.75 }),
    succulent3: new THREE.MeshStandardMaterial({ color: "#059669", roughness: 0.75 }),
    succulent4: new THREE.MeshStandardMaterial({ color: "#2dd4bf", roughness: 0.75 }),
    bookshelfPot: new THREE.MeshStandardMaterial({ color: "#c2854a", roughness: 0.9 }),
  },

  // === WHITEBOARD ===
  whiteboard: {
    surface: new THREE.MeshStandardMaterial({ color: "#ffffff" }),
    frame: new THREE.MeshStandardMaterial({ color: "#1f2937", metalness: 0.3, roughness: 0.6 }),
    tray: new THREE.MeshStandardMaterial({ color: "#6b7280" }),
    markerRed: new THREE.MeshStandardMaterial({ color: "#ef4444" }),
    markerBlue: new THREE.MeshStandardMaterial({ color: "#3b82f6" }),
    markerGreen: new THREE.MeshStandardMaterial({ color: "#22c55e" }),
    markerYellow: new THREE.MeshStandardMaterial({ color: "#eab308" }),
    markerCap: new THREE.MeshStandardMaterial({ color: "#1f2937" }),
    arrow: new THREE.MeshStandardMaterial({ color: "#9ca3af" }),
  },

  // === FILE CABINET ===
  fileCabinet: {
    body: new THREE.MeshStandardMaterial({ color: "#4b5563", metalness: 0.3, roughness: 0.7 }),
    drawer: new THREE.MeshStandardMaterial({ color: "#374151", metalness: 0.5, roughness: 0.5 }),
  },

  // === COFFEE MACHINE ===
  coffee: {
    counter: new THREE.MeshStandardMaterial({ color: "#2d2d2d", metalness: 0.3, roughness: 0.7 }),
    counterTop: new THREE.MeshStandardMaterial({ color: "#e8e8e8", metalness: 0.1, roughness: 0.2 }),
    body: new THREE.MeshStandardMaterial({ color: "#3a3a3a", metalness: 0.8, roughness: 0.2 }),
    dome: new THREE.MeshStandardMaterial({ color: "#c0c0c0", metalness: 0.9, roughness: 0.1 }),
    display: new THREE.MeshStandardMaterial({ color: "#0a1628", emissive: "#1e40af", emissiveIntensity: 0.3 }),
    btnGreen: new THREE.MeshStandardMaterial({ color: "#22c55e", emissive: "#15803d", emissiveIntensity: 0.5, metalness: 0.5 }),
    btnGray: new THREE.MeshStandardMaterial({ color: "#6b7280", emissive: "#374151", emissiveIntensity: 0.5, metalness: 0.5 }),
    portafilter: new THREE.MeshStandardMaterial({ color: "#1a1a1a", metalness: 0.3, roughness: 0.8 }),
    drip: new THREE.MeshStandardMaterial({ color: "#3d2314", transparent: true, opacity: 0.8 }),
    dripTray: new THREE.MeshStandardMaterial({ color: "#1f2937", metalness: 0.6, roughness: 0.4 }),
    grate: new THREE.MeshStandardMaterial({ color: "#374151", metalness: 0.7, roughness: 0.3 }),
    cup: new THREE.MeshStandardMaterial({ color: "#fafafa", metalness: 0.1, roughness: 0.3 }),
    cupRim: new THREE.MeshStandardMaterial({ color: "#ffffff", metalness: 0.1, roughness: 0.2 }),
    coffeeInside: new THREE.MeshStandardMaterial({ color: "#2d1810", metalness: 0.3, roughness: 0.4 }),
    steam: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.3 }),
    waterTank: new THREE.MeshStandardMaterial({ color: "#1e3a5f", transparent: true, opacity: 0.6, metalness: 0.1, roughness: 0.1 }),
    waterLevel: new THREE.MeshStandardMaterial({ color: "#60a5fa", transparent: true, opacity: 0.8, emissive: "#3b82f6", emissiveIntensity: 0.2 }),
    labelBg: new THREE.MeshStandardMaterial({ color: "#1a1a1a", transparent: true, opacity: 0.9 }),
  },

  // === MONITOR ===
  monitor: {
    bezel: new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 0.6, metalness: 0.2 }),
    stand: new THREE.MeshStandardMaterial({ color: "#2d2d2d" }),
  },

  // === MAC MINI ===
  macMini: {
    body: new THREE.MeshStandardMaterial({ color: "#d1d5db", metalness: 0.7, roughness: 0.3 }),
    top: new THREE.MeshStandardMaterial({ color: "#f3f4f6", metalness: 0.6, roughness: 0.2 }),
    logo: new THREE.MeshStandardMaterial({ color: "#9ca3af", emissive: "#6b7280", emissiveIntensity: 0.3 }),
    port: new THREE.MeshStandardMaterial({ color: "#1f2937" }),
    led: new THREE.MeshStandardMaterial({ color: "#22c55e", emissive: "#15803d", emissiveIntensity: 0.8 }),
    foot: new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 1 }),
  },

  // === CHAIR ===
  chair: {
    cushion: new THREE.MeshStandardMaterial({ color: "#4a5568", roughness: 0.7 }),
    support: new THREE.MeshStandardMaterial({ color: "#2d3748", metalness: 0.25, roughness: 0.6 }),
    base: new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 0.65 }),
    armSupport: new THREE.MeshStandardMaterial({ color: "#2d3748", metalness: 0.2 }),
    column: new THREE.MeshStandardMaterial({ color: "#2d3748", metalness: 0.45, roughness: 0.45 }),
    leg: new THREE.MeshStandardMaterial({ color: "#2d3748", metalness: 0.35, roughness: 0.5 }),
    wheel: new THREE.MeshStandardMaterial({ color: "#1f2937", metalness: 0.35, roughness: 0.55 }),
  },

  // === DESK ITEMS ===
  deskItems: {
    photoFrame: new THREE.MeshStandardMaterial({ color: "#374151", roughness: 0.7 }),
    photoImage: new THREE.MeshStandardMaterial({ color: "#e0f2fe", emissive: "#0ea5e9", emissiveIntensity: 0.08 }),
    photoStand: new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 0.8 }),
    notepad: new THREE.MeshStandardMaterial({ color: "#fefce8", roughness: 0.85 }),
    binding: new THREE.MeshStandardMaterial({ color: "#9ca3af", roughness: 0.6 }),
    ring: new THREE.MeshStandardMaterial({ color: "#6b7280", metalness: 0.35, roughness: 0.35 }),
    line: new THREE.MeshStandardMaterial({ color: "#d1d5db" }),
    mugBody: new THREE.MeshStandardMaterial({ color: "#f9fafb", roughness: 0.7 }),
    mugCoffee: new THREE.MeshStandardMaterial({ color: "#4b2e1f", roughness: 0.95 }),
    mugHandle: new THREE.MeshStandardMaterial({ color: "#e5e7eb", roughness: 0.7 }),
    mugCoaster: new THREE.MeshStandardMaterial({ color: "#d1d5db", roughness: 0.8 }),
  },

  // === WALL CLOCK ===
  clock: {
    face: new THREE.MeshStandardMaterial({ color: "#f5f5f5" }),
    rim: new THREE.MeshStandardMaterial({ color: "#1f2937", metalness: 0.6, roughness: 0.3 }),
    center: new THREE.MeshStandardMaterial({ color: "#1f2937" }),
    marker: new THREE.MeshStandardMaterial({ color: "#1f2937" }),
    hourHand: new THREE.MeshStandardMaterial({ color: "#1f2937" }),
    minuteHand: new THREE.MeshStandardMaterial({ color: "#374151" }),
    secondHand: new THREE.MeshStandardMaterial({ color: "#ef4444" }),
  },

  // === GLASSES ===
  glasses: {
    frame: new THREE.MeshStandardMaterial({ color: "#111827", roughness: 0.5, metalness: 0.2 }),
  },

  // === LOUNGE CHAIR ===
  lounge: {
    seat: new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 0.65 }),
    backTask: new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.62 }),
    backExec: new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.62 }),
    backLounge: new THREE.MeshStandardMaterial({ color: "#3f4b5c", roughness: 0.62 }),
    armTask: new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.7 }),
    armExec: new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.7 }),
    armLounge: new THREE.MeshStandardMaterial({ color: "#5b6575", roughness: 0.7 }),
    pillow: new THREE.MeshStandardMaterial({ color: "#94a3b8", roughness: 0.55 }),
  },

  // === AGENT CONNECTION ===
  connection: {
    particle: new THREE.MeshStandardMaterial({ color: "#22c55e", emissive: "#22c55e", emissiveIntensity: 0.8 }),
    glow: new THREE.MeshBasicMaterial({ color: "#22c55e", transparent: true, opacity: 0.3 }),
  },

  // === THINKING PARTICLES ===
  thinking: {
    small: new THREE.MeshBasicMaterial({ color: "#3b82f6", transparent: true, opacity: 0.6 }),
    medium: new THREE.MeshBasicMaterial({ color: "#3b82f6", transparent: true, opacity: 0.5 }),
    large: new THREE.MeshBasicMaterial({ color: "#3b82f6", transparent: true, opacity: 0.4 }),
  },

  // === ERROR PARTICLES ===
  error: {
    spark1: new THREE.MeshBasicMaterial({ color: "#ef4444" }),
    spark2: new THREE.MeshBasicMaterial({ color: "#f59e0b" }),
  },

  // === EARRINGS ===
  earrings: new THREE.MeshStandardMaterial({ color: "#fbbf24", metalness: 0.7, roughness: 0.3 }),
} as const;

// Helper to create a dynamic material with dispose prevention
// Use this for agent-specific colors that vary per instance
export function createDynamicMaterial(
  color: string,
  options: Partial<THREE.MeshStandardMaterialParameters> = {}
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, ...options });
}

// Pre-create common dynamic material templates (cloned per use)
export const DYNAMIC_MATERIAL_DEFAULTS = {
  shirt: { roughness: undefined, metalness: undefined },
  desk: { roughness: undefined, metalness: undefined, emissive: "#000000", emissiveIntensity: 0 },
  hat: { roughness: 0.75 },
  hair: { roughness: 0.95 },
} as const;
