export const DESK_DECOR_TYPES = {
  coffeeMug: "coffeeMug",
  deskPlant: "deskPlant",
  notepad: "notepad",
  deskPhoto: "deskPhoto",
} as const;

export type DeskDecorType = (typeof DESK_DECOR_TYPES)[keyof typeof DESK_DECOR_TYPES];

export interface DeskDecorItem {
  type: DeskDecorType;
  position: [number, number, number];
  rotation?: [number, number, number];
}

const DESK_DECOR_PRESETS: DeskDecorItem[][] = [
  [
    { type: DESK_DECOR_TYPES.coffeeMug, position: [-0.72, 0.81, 0.52], rotation: [0, 0.35, 0] },
    { type: DESK_DECOR_TYPES.notepad, position: [0.7, 0.81, 0.5], rotation: [0, -0.5, 0] },
    { type: DESK_DECOR_TYPES.deskPhoto, position: [-0.8, 0.81, -0.35], rotation: [0, 0.65, 0] },
  ],
  [
    { type: DESK_DECOR_TYPES.deskPlant, position: [-0.78, 0.81, -0.4], rotation: [0, 0.4, 0] },
    { type: DESK_DECOR_TYPES.coffeeMug, position: [0.76, 0.81, 0.45], rotation: [0, -0.25, 0] },
    { type: DESK_DECOR_TYPES.notepad, position: [-0.68, 0.81, 0.48], rotation: [0, 0.3, 0] },
  ],
  [
    { type: DESK_DECOR_TYPES.deskPhoto, position: [0.74, 0.81, -0.34], rotation: [0, -0.6, 0] },
    { type: DESK_DECOR_TYPES.notepad, position: [-0.72, 0.81, 0.47], rotation: [0, 0.45, 0] },
    { type: DESK_DECOR_TYPES.deskPlant, position: [0.78, 0.81, 0.46], rotation: [0, -0.25, 0] },
  ],
  [
    { type: DESK_DECOR_TYPES.notepad, position: [0.72, 0.81, 0.5], rotation: [0, -0.35, 0] },
    { type: DESK_DECOR_TYPES.coffeeMug, position: [-0.74, 0.81, 0.44], rotation: [0, 0.4, 0] },
    { type: DESK_DECOR_TYPES.deskPlant, position: [-0.8, 0.81, -0.38], rotation: [0, 0.5, 0] },
  ],
];

function getStringHash(value: string): number {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }

  return hash;
}

export function getDeskDecorPreset(agentId: string): DeskDecorItem[] {
  if (DESK_DECOR_PRESETS.length === 0) {
    return [];
  }

  const hash = getStringHash(agentId);
  const presetIndex = hash % DESK_DECOR_PRESETS.length;

  return DESK_DECOR_PRESETS[presetIndex];
}
