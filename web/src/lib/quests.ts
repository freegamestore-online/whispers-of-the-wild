import type { Quest, Inventory } from "./types";

export const QUEST_DEFS: Omit<Quest, "completed" | "unlocked">[] = [
  {
    id: "q1",
    title: "TASK 01: Gather Wood",
    description: "Chop trees to collect 10 wood.",
    check: (inv) => (inv.get("wood") ?? 0) >= 10,
    reward: { type: "food", count: 3 },
    unlockFlag: "q1_done",
  },
  {
    id: "q2",
    title: "TASK 02: Build a Campfire",
    description: "Use 5 wood to build a campfire at camp.",
    check: (_inv, flags) => flags.has("campfire_built"),
    reward: { type: "stone", count: 5 },
    unlockFlag: "q2_done",
  },
  {
    id: "q3",
    title: "TASK 03: Stock Up",
    description: "Collect 5 stone and 5 food.",
    check: (inv) => (inv.get("stone") ?? 0) >= 5 && (inv.get("food") ?? 0) >= 5,
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
    description: "Trade with a traveller to obtain a lantern.",
    check: (inv) => (inv.get("lantern") ?? 0) >= 1,
    reward: { type: "herb", count: 3 },
    unlockFlag: "q5_done",
  },
  {
    id: "q6",
    title: "TASK 06: Discover the Ruins",
    description: "Find the ancient ruins deep in the forest.",
    check: (_inv, flags) => flags.has("ruins_found"),
    reward: { type: "gem", count: 2 },
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
  // unlock next quest after completion
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
