// ─── Shared types ───────────────────────────────────────────────────────────

export type ResourceType = "wood" | "stone" | "food" | "gem" | "lantern" | "rope" | "herb";

export interface InventoryItem {
  type: ResourceType;
  count: number;
}

export type Inventory = Map<ResourceType, number>;

export interface Quest {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  unlocked: boolean;
  check: (inv: Inventory, flags: Set<string>) => boolean;
  reward?: { type: ResourceType; count: number };
  unlockFlag?: string;
}

export interface SpiritClue {
  text: string;
  hint: string; // area name
}

export interface TradeOffer {
  give: { type: ResourceType; count: number };
  receive: { type: ResourceType; count: number };
  nightOnly?: boolean;
}

export interface GameMessage {
  id: number;
  text: string;
  type: "info" | "warning" | "spirit" | "quest" | "danger";
  expires: number;
}

export type TimeOfDay = "dawn" | "day" | "dusk" | "night";

export interface WorldObject {
  id: string;
  kind: "tree" | "rock" | "food" | "campfire" | "shelter" | "cabin" | "cave" | "ruins" | "trader";
  x: number;
  z: number;
  depleted?: boolean;
  depletedAt?: number;
}

export interface MonsterState {
  id: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  alertRadius: number;
  chaseRadius: number;
  chasing: boolean;
  hp: number;
  kind: "shadow" | "wraith" | "beast";
}

export interface SpiritState {
  id: string;
  x: number;
  z: number;
  clue: SpiritClue;
  visible: boolean;
}

export interface PlayerState {
  x: number;
  z: number;
  angle: number; // facing direction in radians
  hp: number;
  maxHp: number;
  hunger: number; // 0-100, drains over time
  hasCampfire: boolean;
  hasShelter: boolean;
  hasLantern: boolean;
}
