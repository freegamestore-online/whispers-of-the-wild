import type { Quest, Inventory } from "./types";

export const QUEST_DEFS: Omit<Quest, "completed" | "unlocked">[] = [
  {
    id: "q1",
    title: "TASK 01: Gather Wood",
    description: "Chop trees to collect 15 wood.",
    check: (inv) => (inv.get("wood") ?? 0) >= 15,
    reward: { type: "food", count: 4 },
    unlockFlag: "q1_done",
  },
  {
    id: "q2",
    title: "TASK 02: Build a Campfire",
    description: "Use 5 wood to build a campfire — your first safe haven.",
    check: (_inv, flags) => flags.has("campfire_built"),
    reward: { type: "stone", count: 5 },
    unlockFlag: "q2_done",
  },
  {
    id: "q3",
    title: "TASK 03: Mine the Rocks",
    description: "Collect 8 stone from the rocks nearby.",
    check: (inv) => (inv.get("stone") ?? 0) >= 8,
    reward: { type: "rope", count: 2 },
    unlockFlag: "q3_done",
  },
  {
    id: "q4",
    title: "TASK 04: Find the Cabin",
    description: "Explore east to find the abandoned cabin.",
    check: (_inv, flags) => flags.has("cabin_found"),
    reward: { type: "gem", count: 1 },
    unlockFlag: "q4_done",
  },
  {
    id: "q5",
    title: "TASK 05: Trade for a Lantern",
    description: "Trade with the mysterious traveller to obtain a lantern.",
    check: (inv) => (inv.get("lantern") ?? 0) >= 1,
    reward: { type: "herb", count: 4 },
    unlockFlag: "q5_done",
  },
  {
    id: "q6",
    title: "TASK 06: Build a Shelter",
    description: "Craft a shelter using 10 wood and 5 stone.",
    check: (_inv, flags) => flags.has("shelter_built"),
    reward: { type: "food", count: 6 },
    unlockFlag: "q6_done",
  },
  {
    id: "q7",
    title: "TASK 07: Survive the Night",
    description: "Stay alive through a full night cycle.",
    check: (_inv, flags) => flags.has("night_survived"),
    reward: { type: "wood", count: 10 },
    unlockFlag: "q7_done",
  },
  {
    id: "q8",
    title: "TASK 08: Enter the Cave",
    description: "Discover the cave entrance deep in the forest.",
    check: (_inv, flags) => flags.has("cave_found"),
    reward: { type: "coal", count: 3 },
    unlockFlag: "q8_done",
  },
  {
    id: "q9",
    title: "TASK 09: Discover the Ruins",
    description: "Find the ancient ruins to the north.",
    check: (_inv, flags) => flags.has("ruins_found"),
    reward: { type: "gem", count: 2 },
    unlockFlag: "q9_done",
  },
  {
    id: "q10",
    title: "TASK 10: Speak to the Spirits",
    description: "Receive 3 spirit clues at night.",
    check: (_inv, flags) => flags.has("spirits_3"),
    reward: { type: "gem", count: 1 },
    unlockFlag: "q10_done",
  },
  {
    id: "q11",
    title: "TASK 11: Find the Village",
    description: "Discover the abandoned village to the south-west.",
    check: (_inv, flags) => flags.has("village_found"),
    reward: { type: "rope", count: 3 },
    unlockFlag: "q11_done",
  },
  {
    id: "q12",
    title: "TASK 12: Uncover the Mystery",
    description: "Collect 5 gems and return to the ruins.",
    check: (inv, flags) => (inv.get("gem") ?? 0) >= 5 && flags.has("ruins_found"),
    reward: { type: "gem", count: 0 },
    unlockFlag: "q12_done",
  },
];

export function buildQuests(): Quest[] {
  return QUEST_DEFS.map((def, i) => ({
    ...def,
    completed: false,
    unlocked: i === 0,
  }));
}

export function checkQuests(
  quests: Quest[],
  inv: Inventory,
  flags: Set<string>
): { updated: Quest[]; newlyCompleted: Quest[] } {
  const newlyCompleted: Quest[] = [];
  const updated = quests.map((q) => {
    if (q.completed || !q.unlocked) return q;
    const done = q.check(inv, flags);
    if (done) {
      newlyCompleted.push(q);
      return { ...q, completed: true };
    }
    return q;
  });
  for (const q of newlyCompleted) {
    const idx = updated.findIndex((u) => u.id === q.id);
    if (idx >= 0 && idx + 1 < updated.length) {
      const next = updated[idx + 1];
      if (next && !next.unlocked) {
        updated[idx + 1] = { ...next, unlocked: true };
      }
    }
  }
  return { updated, newlyCompleted };
}
