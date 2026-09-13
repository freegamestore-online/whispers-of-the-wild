import { useState } from "react";
import type { GameState } from "../lib/gameState";
import type { ResourceType, TradeOffer } from "../lib/types";

const RESOURCE_ICONS: Record<ResourceType, string> = {
  wood: "🪵",
  stone: "🪨",
  food: "🍎",
  gem: "💎",
  lantern: "🏮",
  rope: "🪢",
  herb: "🌿",
};

const TRADE_OFFERS: TradeOffer[] = [
  { give: { type: "wood", count: 10 }, receive: { type: "food", count: 3 } },
  { give: { type: "stone", count: 5 }, receive: { type: "rope", count: 2 } },
  { give: { type: "gem", count: 1 }, receive: { type: "lantern", count: 1 } },
  { give: { type: "herb", count: 3 }, receive: { type: "food", count: 5 } },
  { give: { type: "wood", count: 8 }, receive: { type: "rope", count: 3 }, nightOnly: true },
  { give: { type: "rope", count: 2 }, receive: { type: "gem", count: 1 } },
];

interface HUDProps {
  state: GameState;
  onChop: () => void;
  onMine: () => void;
  onGather: () => void;
  onBuildCampfire: () => void;
  onBuildShelter: () => void;
  onEat: () => void;
  onTrade: (offer: TradeOffer) => void;
  onCloseTrader: () => void;
  onCloseClue: () => void;
  onToggleInventory: () => void;
  onToggleQuests: () => void;
  onRestart: () => void;
  isNight: boolean;
}

export function HUD({
  state,
  onChop,
  onMine,
  onGather,
  onBuildCampfire,
  onBuildShelter,
  onEat,
  onTrade,
  onCloseTrader,
  onCloseClue,
  onToggleInventory,
  onToggleQuests,
  onRestart,
  isNight,
}: HUDProps) {
  const [activeTab, setActiveTab] = useState<"quests" | "inventory">("quests");
  const inv = state.inventory;

  const timeColor =
    state.timeOfDay === "night"
      ? "text-indigo-300"
      : state.timeOfDay === "dusk"
        ? "text-orange-300"
        : state.timeOfDay === "dawn"
          ? "text-pink-300"
          : "text-yellow-300";

  const timeLabel =
    state.timeOfDay === "night"
      ? "🌙 Night"
      : state.timeOfDay === "dusk"
        ? "🌅 Dusk"
        : state.timeOfDay === "dawn"
          ? "🌄 Dawn"
          : "☀️ Day";

  const availableTrades = TRADE_OFFERS.filter((t) => !t.nightOnly || isNight);

  if (state.gameOver) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
        <div
          className="rounded-2xl p-8 text-center max-w-sm mx-4"
          style={{ background: "#1a1a2e", border: "2px solid #4a4a8a" }}
        >
          <div className="text-5xl mb-4">💀</div>
          <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: "Fraunces, serif" }}>
            Lost in the Wild
          </h2>
          <p className="text-gray-400 mb-2">You didn't survive the forest...</p>
          <p className="text-yellow-400 font-semibold mb-6">Score: {state.score}</p>
          <button
            onClick={onRestart}
            className="px-8 py-3 rounded-xl font-bold text-white text-lg"
            style={{ background: "linear-gradient(135deg, #2d5a27, #4a8a3a)", minHeight: 44 }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div
        className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 py-2"
        style={{ background: "rgba(10,15,25,0.85)", backdropFilter: "blur(8px)" }}
      >
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-sm" style={{ fontFamily: "Fraunces, serif" }}>
            🌲 Whispers of the Wild
          </span>
          <span className={`text-xs font-semibold ${timeColor}`}>{timeLabel}</span>
          <span className="text-gray-400 text-xs">Day {state.dayCount}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-yellow-400 font-bold">⭐ {state.score}</span>
          <button
            onClick={onToggleInventory}
            className="text-xs px-2 py-1 rounded-lg font-semibold"
            style={{ background: "#2a3a2a", color: "#7ec87e", minHeight: 36 }}
          >
            🎒
          </button>
          <button
            onClick={onToggleQuests}
            className="text-xs px-2 py-1 rounded-lg font-semibold"
            style={{ background: "#2a2a3a", color: "#9898e8", minHeight: 36 }}
          >
            📋
          </button>
        </div>
      </div>

      {/* ── Vital bars ──────────────────────────────────────────────────── */}
      <div className="absolute top-12 left-3 z-30 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-red-400 w-4">❤️</span>
          <div className="w-24 h-2 rounded-full bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(state.player.hp / state.player.maxHp) * 100}%`,
                background: state.player.hp > 50 ? "#22c55e" : state.player.hp > 25 ? "#f59e0b" : "#ef4444",
              }}
            />
          </div>
          <span className="text-xs text-gray-400">{state.player.hp}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs w-4">🍽️</span>
          <div className="w-24 h-2 rounded-full bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${state.player.hunger}%`,
                background: state.player.hunger > 50 ? "#f59e0b" : state.player.hunger > 25 ? "#ef4444" : "#7f1d1d",
              }}
            />
          </div>
          <span className="text-xs text-gray-400">{Math.round(state.player.hunger)}</span>
        </div>
      </div>

      {/* ── Quick resource strip ─────────────────────────────────────────── */}
      <div
        className="absolute top-12 right-3 z-30 flex flex-col gap-1"
        style={{ fontSize: "11px" }}
      >
        {(["wood", "stone", "food", "gem"] as ResourceType[]).map((r) => (
          <div key={r} className="flex items-center gap-1 text-gray-300">
            <span>{RESOURCE_ICONS[r]}</span>
            <span className="font-bold text-white">{inv.get(r) ?? 0}</span>
          </div>
        ))}
      </div>

      {/* ── Messages ────────────────────────────────────────────────────── */}
      <div className="absolute bottom-32 left-0 right-0 z-30 flex flex-col items-center gap-2 px-4 pointer-events-none">
        {state.messages.map((msg) => (
          <div
            key={msg.id}
            className="px-4 py-2 rounded-xl text-sm font-semibold max-w-sm text-center"
            style={{
              background:
                msg.type === "spirit"
                  ? "rgba(100,60,180,0.9)"
                  : msg.type === "danger"
                    ? "rgba(180,30,30,0.9)"
                    : msg.type === "quest"
                      ? "rgba(30,120,60,0.9)"
                      : msg.type === "warning"
                        ? "rgba(180,100,20,0.9)"
                        : "rgba(20,40,60,0.9)",
              color: "white",
              backdropFilter: "blur(6px)",
            }}
          >
            {msg.type === "spirit" && "👻 "}
            {msg.type === "danger" && "⚠️ "}
            {msg.type === "quest" && "✅ "}
            {msg.text}
          </div>
        ))}
      </div>

      {/* ── Action buttons ──────────────────────────────────────────────── */}
      <div
        className="absolute bottom-4 left-0 right-0 z-30 flex justify-center gap-2 px-3 flex-wrap"
      >
        <ActionBtn emoji="🪓" label="Chop" onClick={onChop} color="#2d5a27" />
        <ActionBtn emoji="⛏️" label="Mine" onClick={onMine} color="#4a3a1a" />
        <ActionBtn emoji="🍎" label="Gather" onClick={onGather} color="#5a1a2a" />
        {!state.player.hasCampfire && (
          <ActionBtn
            emoji="🔥"
            label={`Fire (5🪵)`}
            onClick={onBuildCampfire}
            color="#7a2a10"
            disabled={(inv.get("wood") ?? 0) < 5}
          />
        )}
        {state.player.hasCampfire && !state.player.hasShelter && (
          <ActionBtn
            emoji="🏕️"
            label={`Shelter (10🪵 3🪨)`}
            onClick={onBuildShelter}
            color="#1a3a5a"
            disabled={(inv.get("wood") ?? 0) < 10 || (inv.get("stone") ?? 0) < 3}
          />
        )}
        {(inv.get("food") ?? 0) > 0 && (
          <ActionBtn emoji="🍽️" label="Eat" onClick={onEat} color="#1a4a2a" />
        )}
      </div>

      {/* ── Proximity hints ─────────────────────────────────────────────── */}
      <div className="absolute bottom-24 left-0 right-0 z-30 flex justify-center gap-2 pointer-events-none">
        {state.nearTrader && (
          <span className="text-xs px-3 py-1 rounded-full font-semibold" style={{ background: "rgba(80,40,120,0.9)", color: "#e0c0ff" }}>
            💰 Press T to Trade
          </span>
        )}
        {state.nearCampfire && (
          <span className="text-xs px-3 py-1 rounded-full font-semibold" style={{ background: "rgba(120,60,20,0.9)", color: "#ffd0a0" }}>
            🔥 Near Campfire — safe zone
          </span>
        )}
        {state.nearShelter && (
          <span className="text-xs px-3 py-1 rounded-full font-semibold" style={{ background: "rgba(20,60,120,0.9)", color: "#a0d0ff" }}>
            🏕️ Near Shelter — resting
          </span>
        )}
      </div>

      {/* ── Spirit clue overlay ─────────────────────────────────────────── */}
      {state.activeClue && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
        >
          <div
            className="rounded-2xl p-6 max-w-xs mx-4 text-center"
            style={{ background: "rgba(40,20,80,0.97)", border: "2px solid #9060d0" }}
          >
            <div className="text-4xl mb-3">👻</div>
            <p className="text-purple-200 text-base italic leading-relaxed mb-4">
              "{state.activeClue}"
            </p>
            <button
              onClick={onCloseClue}
              className="px-6 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: "#6030a0", minHeight: 44 }}
            >
              Understood...
            </button>
          </div>
        </div>
      )}

      {/* ── Trader overlay ──────────────────────────────────────────────── */}
      {state.showTrader && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
        >
          <div
            className="rounded-2xl p-5 max-w-sm w-full mx-4"
            style={{ background: "rgba(20,30,50,0.98)", border: "2px solid #6060a0" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white" style={{ fontFamily: "Fraunces, serif" }}>
                🧙 Mysterious Traveller
              </h3>
              <button onClick={onCloseTrader} className="text-gray-400 text-xl px-2" style={{ minHeight: 44, minWidth: 44 }}>✕</button>
            </div>
            <p className="text-gray-400 text-xs mb-4 italic">"I have things you need, traveller. What will you offer?"</p>
            <div className="flex flex-col gap-2">
              {availableTrades.map((offer, i) => {
                const canAfford = (inv.get(offer.give.type) ?? 0) >= offer.give.count;
                return (
                  <button
                    key={i}
                    onClick={() => canAfford && onTrade(offer)}
                    disabled={!canAfford}
                    className="flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-opacity"
                    style={{
                      background: canAfford ? "rgba(60,80,40,0.8)" : "rgba(40,40,40,0.5)",
                      color: canAfford ? "#c0e0a0" : "#666",
                      minHeight: 44,
                      opacity: canAfford ? 1 : 0.5,
                    }}
                  >
                    <span>{RESOURCE_ICONS[offer.give.type]} {offer.give.count} {offer.give.type}</span>
                    <span className="text-gray-400 mx-2">→</span>
                    <span>{RESOURCE_ICONS[offer.receive.type]} {offer.receive.count} {offer.receive.type}</span>
                    {offer.nightOnly && <span className="text-indigo-400 text-xs ml-1">🌙</span>}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-700 text-xs text-gray-500 flex flex-wrap gap-2">
              {(["wood", "stone", "food", "gem", "lantern", "rope", "herb"] as ResourceType[]).map((r) => (
                <span key={r}>{RESOURCE_ICONS[r]} {inv.get(r) ?? 0}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Side panel: inventory + quests ──────────────────────────────── */}
      {(state.showInventory || state.showQuests) && (
        <div
          className="absolute top-12 right-0 bottom-32 z-30 w-64 overflow-y-auto"
          style={{ background: "rgba(10,15,25,0.92)", backdropFilter: "blur(8px)" }}
        >
          <div className="flex border-b border-gray-800">
            <button
              onClick={() => setActiveTab("inventory")}
              className="flex-1 py-2 text-xs font-bold"
              style={{ color: activeTab === "inventory" ? "#7ec87e" : "#666", minHeight: 40 }}
            >
              🎒 Inventory
            </button>
            <button
              onClick={() => setActiveTab("quests")}
              className="flex-1 py-2 text-xs font-bold"
              style={{ color: activeTab === "quests" ? "#9898e8" : "#666", minHeight: 40 }}
            >
              📋 Quests
            </button>
          </div>

          {activeTab === "inventory" && (
            <div className="p-3 flex flex-col gap-2">
              {(["wood", "stone", "food", "gem", "lantern", "rope", "herb"] as ResourceType[]).map((r) => (
                <div key={r} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <span className="text-sm text-gray-300">{RESOURCE_ICONS[r]} {r}</span>
                  <span className="font-bold text-white">{inv.get(r) ?? 0}</span>
                </div>
              ))}
              <div className="mt-2 pt-2 border-t border-gray-800 text-xs text-gray-500">
                {state.player.hasCampfire && <div className="text-orange-400">🔥 Campfire built</div>}
                {state.player.hasShelter && <div className="text-blue-400">🏕️ Shelter built</div>}
                {state.player.hasLantern && <div className="text-yellow-400">🏮 Lantern equipped</div>}
              </div>
            </div>
          )}

          {activeTab === "quests" && (
            <div className="p-3 flex flex-col gap-2">
              {state.quests.map((q) => (
                <div
                  key={q.id}
                  className="px-3 py-2 rounded-lg text-xs"
                  style={{
                    background: q.completed
                      ? "rgba(30,80,30,0.4)"
                      : q.unlocked
                        ? "rgba(40,40,80,0.4)"
                        : "rgba(30,30,30,0.3)",
                    border: q.completed ? "1px solid #2d6a2d" : q.unlocked ? "1px solid #4a4a8a" : "1px solid #333",
                    opacity: q.unlocked || q.completed ? 1 : 0.4,
                  }}
                >
                  <div className="font-bold text-gray-200 mb-1">
                    {q.completed ? "✅" : q.unlocked ? "🔵" : "🔒"} {q.title}
                  </div>
                  <div className="text-gray-400">{q.description}</div>
                  {q.reward && q.unlocked && !q.completed && (
                    <div className="text-yellow-500 mt-1">
                      Reward: {RESOURCE_ICONS[q.reward.type]} {q.reward.count} {q.reward.type}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Move instructions ────────────────────────────────────────────── */}
      <div
        className="absolute bottom-4 left-3 z-30 text-gray-600 pointer-events-none"
        style={{ fontSize: "10px" }}
      >
        <div>WASD/Arrows: Move</div>
        <div>T: Trade (near trader)</div>
        <div>Click world objects</div>
      </div>
    </>
  );
}

function ActionBtn({
  emoji,
  label,
  onClick,
  color,
  disabled = false,
}: {
  emoji: string;
  label: string;
  onClick: () => void;
  color: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center px-3 py-2 rounded-xl text-xs font-bold text-white transition-opacity"
      style={{
        background: color,
        minHeight: 52,
        minWidth: 56,
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <span className="text-xl">{emoji}</span>
      <span className="mt-0.5 text-center leading-tight" style={{ fontSize: 9 }}>{label}</span>
    </button>
  );
}
