import type { WorldObject, SpiritState, MonsterState } from "./types";

// Seeded pseudo-random
function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

export interface WorldDef {
  objects: WorldObject[];
  spirits: SpiritState[];
  monsters: MonsterState[];
}

const SPIRIT_CLUES = [
  { text: "The old tree remembers what happened here...", hint: "forest" },
  { text: "Follow the river east when the moon is high...", hint: "river" },
  { text: "The cabin holds secrets of the one who came before...", hint: "cabin" },
  { text: "Beneath the stones, something sleeps...", hint: "cave" },
  { text: "The ruins were not always silent...", hint: "ruins" },
  { text: "Light your lantern before the wraiths find you...", hint: "night" },
  { text: "Three gems will open what is sealed...", hint: "ruins" },
  { text: "The trader knows more than they let on...", hint: "trader" },
];

export function generateWorld(): WorldDef {
  const rand = seededRand(42);
  const objects: WorldObject[] = [];
  const spirits: SpiritState[] = [];
  const monsters: MonsterState[] = [];

  // ── Camp area (center) ──────────────────────────────────────────────────
  // Trees around camp (ring 8-25 units)
  for (let i = 0; i < 40; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 8 + rand() * 22;
    objects.push({
      id: `tree_${i}`,
      kind: "tree",
      x: Math.cos(angle) * dist,
      z: Math.sin(angle) * dist,
    });
  }

  // Rocks scattered
  for (let i = 0; i < 20; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 6 + rand() * 30;
    objects.push({
      id: `rock_${i}`,
      kind: "rock",
      x: Math.cos(angle) * dist,
      z: Math.sin(angle) * dist,
    });
  }

  // Food (berries/mushrooms) scattered
  for (let i = 0; i < 15; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 5 + rand() * 35;
    objects.push({
      id: `food_${i}`,
      kind: "food",
      x: Math.cos(angle) * dist,
      z: Math.sin(angle) * dist,
    });
  }

  // ── East: Abandoned cabin (x=35, z=5) ───────────────────────────────────
  objects.push({ id: "cabin", kind: "cabin", x: 38, z: 8 });
  // Trees around cabin
  for (let i = 0; i < 12; i++) {
    const angle = rand() * Math.PI * 2;
    objects.push({
      id: `tree_cabin_${i}`,
      kind: "tree",
      x: 38 + Math.cos(angle) * (4 + rand() * 8),
      z: 8 + Math.sin(angle) * (4 + rand() * 8),
    });
  }

  // ── Far east: Cave entrance (x=60, z=-10) ───────────────────────────────
  objects.push({ id: "cave", kind: "cave", x: 60, z: -10 });

  // ── North: Ancient ruins (x=5, z=-55) ───────────────────────────────────
  objects.push({ id: "ruins", kind: "ruins", x: 5, z: -55 });
  // Ruins rocks
  for (let i = 0; i < 8; i++) {
    objects.push({
      id: `ruins_rock_${i}`,
      kind: "rock",
      x: 5 + (rand() - 0.5) * 16,
      z: -55 + (rand() - 0.5) * 16,
    });
  }

  // ── Trader spawn point (x=-20, z=15) ────────────────────────────────────
  objects.push({ id: "trader", kind: "trader", x: -20, z: 15 });

  // ── Spirits (appear at night, scattered) ────────────────────────────────
  const spiritPositions = [
    { x: 15, z: -12 },
    { x: -18, z: 20 },
    { x: 35, z: -5 },
    { x: -5, z: -40 },
    { x: 50, z: 10 },
    { x: 10, z: -50 },
    { x: -30, z: -15 },
    { x: 25, z: 30 },
  ];
  spiritPositions.forEach((pos, i) => {
    const clue = SPIRIT_CLUES[i % SPIRIT_CLUES.length] ?? SPIRIT_CLUES[0]!;
    spirits.push({
      id: `spirit_${i}`,
      x: pos.x,
      z: pos.z,
      clue,
      visible: false,
    });
  });

  // ── Monsters (spawn at night, farther out) ───────────────────────────────
  const monsterKinds = ["shadow", "wraith", "beast"] as const;
  const monsterSpawns = [
    { x: 20, z: 20 },
    { x: -25, z: -20 },
    { x: 45, z: -15 },
    { x: -10, z: -45 },
    { x: 55, z: 5 },
  ];
  monsterSpawns.forEach((pos, i) => {
    const kind = monsterKinds[i % monsterKinds.length] ?? "shadow";
    monsters.push({
      id: `monster_${i}`,
      x: pos.x,
      z: pos.z,
      vx: 0,
      vz: 0,
      alertRadius: kind === "wraith" ? 12 : 8,
      chaseRadius: kind === "wraith" ? 20 : 14,
      chasing: false,
      hp: kind === "beast" ? 3 : 2,
      kind,
    });
  });

  return { objects, spirits, monsters };
}
