// Central mutable game state shared between Babylon scene and React HUD
import type {
  Inventory,
  PlayerState,
  WorldObject,
  MonsterState,
  SpiritState,
  GameMessage,
  TimeOfDay,
  ResourceType,
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
  nearCave: boolean;
  nearCabin: boolean;
  nearRuins: boolean;
  nearVillage: boolean;
  activeClue: string | null;
  showInventory: boolean;
  showQuests: boolean;
  spiritsRead: number;
  monstersRepelled: number;
  highScore: number;
}

function loadHighScore(): number {
  try {
    return parseInt(localStorage.getItem("whispers_highscore") ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(score: number) {
  try {
    const prev = loadHighScore();
    if (score > prev) localStorage.setItem("whispers_highscore", String(score));
  } catch {
    // ignore
  }
}

export function createInitialState(): GameState {
  const inv: Inventory = new Map();
  const resources: ResourceType[] = [
    "wood", "stone", "food", "gem", "lantern", "rope", "herb",
    "mushroom", "coal", "axe", "pickaxe",
  ];
  for (const r of resources) inv.set(r, 0);
  inv.set("food", 3);

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
      hasAxe: false,
      hasPickaxe: false,
      invincibleTimer: 0,
    },
    inventory: inv,
    quests: buildQuests(),
    flags: new Set(),
    worldObjects: [],
    monsters: [],
    spirits: [],
    messages: [],
    time: 0.25,
    dayCount: 1,
    timeOfDay: "dawn",
    score: 0,
    gameOver: false,
    showTrader: false,
    nearTrader: false,
    nearCampfire: false,
    nearShelter: false,
    nearCave: false,
    nearCabin: false,
    nearRuins: false,
    nearVillage: false,
    activeClue: null,
    showInventory: false,
    showQuests: true,
    spiritsRead: 0,
    monstersRepelled: 0,
    highScore: loadHighScore(),
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
  if (state.messages.length > 4) state.messages.shift();
}

export function addInventory(state: GameState, type: ResourceType, count: number) {
  const cur = state.inventory.get(type) ?? 0;
  state.inventory.set(type, Math.max(0, cur + count));
}

export function getInv(state: GameState, type: ResourceType): number {
  return state.inventory.get(type) ?? 0;
}

export function computeTimeOfDay(t: number): TimeOfDay {
  if (t < 0.08 || t >= 0.93) return "night";
  if (t < 0.2) return "dawn";
  if (t < 0.72) return "day";
  if (t < 0.93) return "dusk";
  return "night";
}

export function addScore(state: GameState, pts: number) {
  state.score += pts;
}
