import type { WorldObject, SpiritState, MonsterState } from "./types";

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
  { text: "The old tree remembers what happened here... look for the one that stands alone.", hint: "forest" },
  { text: "Follow the river east when the moon is high... something waits beneath the surface.", hint: "river" },
  { text: "The cabin holds secrets of the one who came before... the door was never locked.", hint: "cabin" },
  { text: "Beneath the stones, something sleeps... it has been waiting for centuries.", hint: "cave" },
  { text: "The ruins were not always silent... once, they sang with life.", hint: "ruins" },
  { text: "Light your lantern before the wraiths find you... darkness is their home.", hint: "night" },
  { text: "Three gems will open what is sealed... the ancient ones left a key.", hint: "ruins" },
  { text: "The trader knows more than they let on... ask them about the forest's past.", hint: "trader" },
  { text: "The village fell on a winter night... no one ever knew why.", hint: "village" },
  { text: "Something in the cave breathes... it is not stone.", hint: "cave" },
  { text: "The mushrooms glow at midnight... follow them north.", hint: "forest" },
  { text: "Water remembers everything it touches... the river has seen it all.", hint: "river" },
];

export function generateWorld(): WorldDef {
  const rand = seededRand(42);
  const objects: WorldObject[] = [];
  const spirits: SpiritState[] = [];
  const monsters: MonsterState[] = [];

  // ── Dense forest ring around camp (8-30 units) ─────────────────────────
  for (let i = 0; i < 60; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 8 + rand() * 25;
    objects.push({
      id: `tree_${i}`,
      kind: "tree",
      x: Math.cos(angle) * dist,
      z: Math.sin(angle) * dist,
      variant: Math.floor(rand() * 3),
    });
  }

  // ── Rocks scattered ─────────────────────────────────────────────────────
  for (let i = 0; i < 25; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 6 + rand() * 35;
    objects.push({
      id: `rock_${i}`,
      kind: "rock",
      x: Math.cos(angle) * dist,
      z: Math.sin(angle) * dist,
    });
  }

  // ── Food (berries) ──────────────────────────────────────────────────────
  for (let i = 0; i < 18; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 5 + rand() * 40;
    objects.push({
      id: `food_${i}`,
      kind: "food",
      x: Math.cos(angle) * dist,
      z: Math.sin(angle) * dist,
    });
  }

  // ── Mushrooms ───────────────────────────────────────────────────────────
  for (let i = 0; i < 12; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 10 + rand() * 45;
    objects.push({
      id: `mushroom_${i}`,
      kind: "mushroom",
      x: Math.cos(angle) * dist,
      z: Math.sin(angle) * dist,
    });
  }

  // ── East: Abandoned cabin (x=40, z=8) ───────────────────────────────────
  objects.push({ id: "cabin", kind: "cabin", x: 42, z: 8 });
  for (let i = 0; i < 10; i++) {
    const angle = rand() * Math.PI * 2;
    objects.push({
      id: `tree_cabin_${i}`,
      kind: "tree",
      x: 42 + Math.cos(angle) * (4 + rand() * 8),
      z: 8 + Math.sin(angle) * (4 + rand() * 8),
      variant: 1,
    });
  }
  // Rocks near cabin
  for (let i = 0; i < 5; i++) {
    objects.push({
      id: `rock_cabin_${i}`,
      kind: "rock",
      x: 42 + (rand() - 0.5) * 14,
      z: 8 + (rand() - 0.5) * 14,
    });
  }

  // ── Far east: Cave entrance (x=65, z=-12) ───────────────────────────────
  objects.push({ id: "cave", kind: "cave", x: 65, z: -12 });
  // Coal rocks near cave
  for (let i = 0; i < 6; i++) {
    objects.push({
      id: `rock_cave_${i}`,
      kind: "rock",
      x: 65 + (rand() - 0.5) * 16,
      z: -12 + (rand() - 0.5) * 16,
    });
  }

  // ── North: Ancient ruins (x=5, z=-60) ───────────────────────────────────
  objects.push({ id: "ruins", kind: "ruins", x: 5, z: -60 });
  for (let i = 0; i < 8; i++) {
    objects.push({
      id: `ruins_rock_${i}`,
      kind: "rock",
      x: 5 + (rand() - 0.5) * 18,
      z: -60 + (rand() - 0.5) * 18,
    });
  }
  for (let i = 0; i < 6; i++) {
    const angle = rand() * Math.PI * 2;
    objects.push({
      id: `ruins_tree_${i}`,
      kind: "tree",
      x: 5 + Math.cos(angle) * (10 + rand() * 8),
      z: -60 + Math.sin(angle) * (10 + rand() * 8),
      variant: 2,
    });
  }

  // ── South-west: Abandoned village (x=-45, z=35) ─────────────────────────
  objects.push({ id: "village", kind: "village", x: -45, z: 35 });
  for (let i = 0; i < 5; i++) {
    objects.push({
      id: `village_rock_${i}`,
      kind: "rock",
      x: -45 + (rand() - 0.5) * 20,
      z: 35 + (rand() - 0.5) * 20,
    });
  }
  for (let i = 0; i < 8; i++) {
    const angle = rand() * Math.PI * 2;
    objects.push({
      id: `village_tree_${i}`,
      kind: "tree",
      x: -45 + Math.cos(angle) * (8 + rand() * 10),
      z: 35 + Math.sin(angle) * (8 + rand() * 10),
    });
  }

  // ── River markers (west side, x=-30 to -50, z=-20 to 20) ───────────────
  for (let i = 0; i < 4; i++) {
    objects.push({
      id: `river_${i}`,
      kind: "river",
      x: -35 + i * 3,
      z: -20 + i * 14,
    });
  }

  // ── Trader spawn point (x=-22, z=18) ────────────────────────────────────
  objects.push({ id: "trader", kind: "trader", x: -22, z: 18 });

  // ── Spirits (scattered, appear at night) ────────────────────────────────
  const spiritPositions = [
    { x: 15, z: -12 },
    { x: -18, z: 22 },
    { x: 38, z: -5 },
    { x: -5, z: -42 },
    { x: 52, z: 10 },
    { x: 10, z: -55 },
    { x: -32, z: -15 },
    { x: 25, z: 32 },
    { x: -40, z: 30 },
    { x: 60, z: -20 },
    { x: -10, z: 50 },
    { x: 20, z: -30 },
  ];
  spiritPositions.forEach((pos, i) => {
    const clue = SPIRIT_CLUES[i % SPIRIT_CLUES.length] ?? SPIRIT_CLUES[0]!;
    spirits.push({
      id: `spirit_${i}`,
      x: pos.x,
      z: pos.z,
      clue,
      visible: false,
      read: false,
    });
  });

  // ── Monsters ─────────────────────────────────────────────────────────────
  const monsterSpawns: Array<{ x: number; z: number; kind: MonsterState["kind"] }> = [
    { x: 22, z: 22, kind: "shadow" },
    { x: -28, z: -22, kind: "beast" },
    { x: 48, z: -18, kind: "wraith" },
    { x: -12, z: -50, kind: "shadow" },
    { x: 58, z: 8, kind: "beast" },
    { x: -42, z: 28, kind: "goblin" },
    { x: 30, z: -40, kind: "wraith" },
    { x: -35, z: 50, kind: "goblin" },
    { x: 70, z: -5, kind: "beast" },
    { x: 15, z: -65, kind: "shadow" },
  ];

  monsterSpawns.forEach((spawn, i) => {
    const hpMap: Record<MonsterState["kind"], number> = {
      shadow: 2, wraith: 2, beast: 4, goblin: 3,
    };
    const alertMap: Record<MonsterState["kind"], number> = {
      shadow: 8, wraith: 14, beast: 6, goblin: 10,
    };
    const chaseMap: Record<MonsterState["kind"], number> = {
      shadow: 14, wraith: 22, beast: 12, goblin: 16,
    };
    monsters.push({
      id: `monster_${i}`,
      x: spawn.x,
      z: spawn.z,
      vx: 0,
      vz: 0,
      alertRadius: alertMap[spawn.kind],
      chaseRadius: chaseMap[spawn.kind],
      chasing: false,
      hp: hpMap[spawn.kind],
      maxHp: hpMap[spawn.kind],
      kind: spawn.kind,
      stunned: 0,
      retreating: false,
    });
  });

  return { objects, spirits, monsters };
}
