// Central mutable game state shared between Babylon scene and React HUD
import type {
  Inventory,
  PlayerState,
  WorldObject,
  MonsterState,
  SpiritState,
  GameMessage,
  TimeOfDay,
} from "./types";
import type { Quest } from "./types";
import { buildQuests } from "./quests";

let _msgId = 0;

export interface GameState {
  player: PlayerState;
  inventory: Inventory;
  quests: Quest[];
  flags: Set<string>;
  worldObjects: WorldObject[];
  monsters: MonsterState[];
  spirits: SpiritState[];
  messages: GameMessage[];
  time: number; // 0..1 full day cycle
  dayCount: number;
  timeOfDay: TimeOfDay;
  score: number;
  gameOver: boolean;
  showTrader: boolean;
  nearTrader: boolean;
  nearCampfire: boolean;
  nearShelter: boolean;
  activeClue: string | null;
  showInventory: boolean;
  showQuests: boolean;
}

export function createInitialState(): GameState {
  const inv: Inventory = new Map();
  inv.set("wood", 0);
  inv.set("stone", 0);
  inv.set("food", 2);
  inv.set("gem", 0);
  inv.set("lantern", 0);
  inv.set("rope", 0);
  inv.set("herb", 0);

  return {
    player: {
      x: 0,
      z: 0,
      angle: 0,
      hp: 100,
      maxHp: 100,
      hunger: 100,
      hasCampfire: false,
      hasShelter: false,
      hasLantern: false,
    },
    inventory: inv,
    quests: buildQuests(),
    flags: new Set(),
    worldObjects: [],
    monsters: [],
    spirits: [],
    messages: [],
    time: 0.25, // start at dawn
    dayCount: 1,
    timeOfDay: "dawn",
    score: 0,
    gameOver: false,
    showTrader: false,
    nearTrader: false,
    nearCampfire: false,
    nearShelter: false,
    activeClue: null,
    showInventory: false,
    showQuests: true,
  };
}

export function addMessage(
  state: GameState,
  text: string,
  type: GameMessage["type"] = "info",
  duration = 4000
) {
  const id = ++_msgId;
  state.messages.push({ id, text, type, expires: Date.now() + duration });
  // keep max 5
  if (state.messages.length > 5) state.messages.shift();
}

export function addInventory(state: GameState, type: keyof Inventory extends never ? never : Parameters<Inventory["get"]>[0], count: number) {
  const cur = state.inventory.get(type) ?? 0;
  state.inventory.set(type, Math.max(0, cur + count));
}

export function getInv(state: GameState, type: Parameters<Inventory["get"]>[0]): number {
  return state.inventory.get(type) ?? 0;
}

export function computeTimeOfDay(t: number): TimeOfDay {
  if (t < 0.1 || t >= 0.95) return "night";
  if (t < 0.2) return "dawn";
  if (t < 0.75) return "day";
  if (t < 0.95) return "dusk";
  return "night";
}

export function addScore(state: GameState, pts: number) {
  state.score += pts;
}
