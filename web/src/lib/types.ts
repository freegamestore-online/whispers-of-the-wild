// ─── Shared types ───────────────────────────────────────────────────────────

export type ResourceType =
  | "wood"
  | "stone"
  | "food"
  | "gem"
  | "lantern"
  | "rope"
  | "herb"
  | "mushroom"
  | "coal"
  | "axe"
  | "pickaxe";

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
  hint: string;
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
  kind:
    | "tree"
    | "rock"
    | "food"
    | "mushroom"
    | "campfire"
    | "shelter"
    | "cabin"
    | "cave"
    | "ruins"
    | "trader"
    | "river"
    | "mountain"
    | "village";
  x: number;
  z: number;
  depleted?: boolean;
  depletedAt?: number;
  variant?: number;
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
  maxHp: number;
  kind: "shadow" | "wraith" | "beast" | "goblin";
  stunned: number; // seconds remaining stunned
  retreating: boolean;
}

export interface SpiritState {
  id: string;
  x: number;
  z: number;
  clue: SpiritClue;
  visible: boolean;
  read: boolean;
}

export interface PlayerState {
  x: number;
  z: number;
  angle: number;
  hp: number;
  maxHp: number;
  hunger: number;
  hasCampfire: boolean;
  hasShelter: boolean;
  hasLantern: boolean;
  hasAxe: boolean;
  hasPickaxe: boolean;
  invincibleTimer: number;
}
