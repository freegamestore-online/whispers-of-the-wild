import { useRef, useEffect, useState, useCallback } from "react";
import { Shell } from "./components/Shell";
import { HUD } from "./components/HUD";
import * as BABYLON from "@babylonjs/core";
import {
  createInitialState,
  addMessage,
  addInventory,
  getInv,
  computeTimeOfDay,
  addScore,
  type GameState,
} from "./lib/gameState";
import { generateWorld } from "./lib/world";
import { checkQuests } from "./lib/quests";
import type { TradeOffer, WorldObject } from "./lib/types";

// ─── Constants ───────────────────────────────────────────────────────────────
const PLAYER_SPEED = 8;
const DAY_DURATION = 120; // seconds per full day
const INTERACT_RADIUS = 4;
const TRADER_RADIUS = 5;
const CAMPFIRE_RADIUS = 6;
const SHELTER_RADIUS = 6;
const MONSTER_DAMAGE = 8;
const MONSTER_ATTACK_INTERVAL = 1500; // ms
const HUNGER_DRAIN = 100 / (DAY_DURATION * 2); // drain per second
const REGEN_RATE = 3; // hp per second near campfire/shelter at night

// ─── Mesh building helpers ────────────────────────────────────────────────────
function makeTree(scene: BABYLON.Scene, x: number, z: number, id: string): BABYLON.Mesh {
  const root = new BABYLON.Mesh(id, scene);
  root.position.set(x, 0, z);

  const trunk = BABYLON.MeshBuilder.CreateCylinder(
    `${id}_trunk`,
    { height: 1.6, diameter: 0.4, tessellation: 6 },
    scene
  );
  trunk.position.set(x, 0.8, z);
  const trunkMat = new BABYLON.StandardMaterial(`${id}_trunkMat`, scene);
  trunkMat.diffuseColor = new BABYLON.Color3(0.4, 0.25, 0.1);
  trunk.material = trunkMat;

  const canopy = BABYLON.MeshBuilder.CreateSphere(
    `${id}_canopy`,
    { diameter: 2.2, segments: 5 },
    scene
  );
  canopy.position.set(x, 2.5, z);
  const canopyMat = new BABYLON.StandardMaterial(`${id}_canopyMat`, scene);
  canopyMat.diffuseColor = new BABYLON.Color3(0.2, 0.55, 0.2);
  canopy.material = canopyMat;

  trunk.metadata = { worldId: id, kind: "tree" };
  canopy.metadata = { worldId: id, kind: "tree" };
  return root;
}

function makeRock(scene: BABYLON.Scene, x: number, z: number, id: string): BABYLON.Mesh {
  const rock = BABYLON.MeshBuilder.CreateSphere(
    id,
    { diameter: 0.9 + Math.random() * 0.5, segments: 4 },
    scene
  );
  rock.position.set(x, 0.4, z);
  rock.scaling.y = 0.7;
  const mat = new BABYLON.StandardMaterial(`${id}_mat`, scene);
  mat.diffuseColor = new BABYLON.Color3(0.5, 0.48, 0.44);
  rock.material = mat;
  rock.metadata = { worldId: id, kind: "rock" };
  return rock;
}

function makeFood(scene: BABYLON.Scene, x: number, z: number, id: string): BABYLON.Mesh {
  const bush = BABYLON.MeshBuilder.CreateSphere(
    id,
    { diameter: 0.6, segments: 4 },
    scene
  );
  bush.position.set(x, 0.3, z);
  const mat = new BABYLON.StandardMaterial(`${id}_mat`, scene);
  mat.diffuseColor = new BABYLON.Color3(0.8, 0.15, 0.15);
  bush.material = mat;
  bush.metadata = { worldId: id, kind: "food" };
  return bush;
}

function makeCampfire(scene: BABYLON.Scene, x: number, z: number): BABYLON.Mesh {
  const base = BABYLON.MeshBuilder.CreateCylinder(
    "campfire",
    { height: 0.3, diameter: 1.2, tessellation: 8 },
    scene
  );
  base.position.set(x, 0.15, z);
  const mat = new BABYLON.StandardMaterial("campfireMat", scene);
  mat.diffuseColor = new BABYLON.Color3(0.8, 0.4, 0.1);
  mat.emissiveColor = new BABYLON.Color3(0.6, 0.2, 0.05);
  base.material = mat;

  const light = new BABYLON.PointLight("campfireLight", new BABYLON.Vector3(x, 1.5, z), scene);
  light.diffuse = new BABYLON.Color3(1, 0.6, 0.2);
  light.intensity = 2;
  light.range = 12;

  return base;
}

function makeShelter(scene: BABYLON.Scene, x: number, z: number): BABYLON.Mesh {
  const body = BABYLON.MeshBuilder.CreateBox(
    "shelter",
    { width: 3, height: 2, depth: 3 },
    scene
  );
  body.position.set(x, 1, z);
  const mat = new BABYLON.StandardMaterial("shelterMat", scene);
  mat.diffuseColor = new BABYLON.Color3(0.55, 0.38, 0.2);
  body.material = mat;

  const roof = BABYLON.MeshBuilder.CreateCylinder(
    "shelterRoof",
    { height: 1.5, diameterTop: 0, diameterBottom: 4.2, tessellation: 4 },
    scene
  );
  roof.position.set(x, 2.75, z);
  const roofMat = new BABYLON.StandardMaterial("shelterRoofMat", scene);
  roofMat.diffuseColor = new BABYLON.Color3(0.35, 0.22, 0.1);
  roof.material = roofMat;
  return body;
}

function makeCabin(scene: BABYLON.Scene, x: number, z: number): BABYLON.Mesh {
  const body = BABYLON.MeshBuilder.CreateBox(
    "cabin",
    { width: 5, height: 3, depth: 4 },
    scene
  );
  body.position.set(x, 1.5, z);
  const mat = new BABYLON.StandardMaterial("cabinMat", scene);
  mat.diffuseColor = new BABYLON.Color3(0.35, 0.22, 0.12);
  body.material = mat;

  const roof = BABYLON.MeshBuilder.CreateCylinder(
    "cabinRoof",
    { height: 2, diameterTop: 0, diameterBottom: 6.5, tessellation: 4 },
    scene
  );
  roof.position.set(x, 4, z);
  const roofMat = new BABYLON.StandardMaterial("cabinRoofMat", scene);
  roofMat.diffuseColor = new BABYLON.Color3(0.22, 0.14, 0.08);
  roof.material = roofMat;

  body.metadata = { worldId: "cabin", kind: "cabin" };
  return body;
}

function makeCave(scene: BABYLON.Scene, x: number, z: number): BABYLON.Mesh {
  const arch = BABYLON.MeshBuilder.CreateSphere(
    "cave",
    { diameter: 4, segments: 5 },
    scene
  );
  arch.position.set(x, 1, z);
  arch.scaling.set(1, 0.7, 0.6);
  const mat = new BABYLON.StandardMaterial("caveMat", scene);
  mat.diffuseColor = new BABYLON.Color3(0.25, 0.22, 0.2);
  arch.material = mat;
  arch.metadata = { worldId: "cave", kind: "cave" };
  return arch;
}

function makeRuins(scene: BABYLON.Scene, x: number, z: number): BABYLON.Mesh[] {
  const meshes: BABYLON.Mesh[] = [];
  const positions = [
    [0, 0], [3, 0], [0, 3], [3, 3], [1.5, -1], [-1, 1.5],
  ] as [number, number][];
  positions.forEach(([dx, dz], i) => {
    const h = 0.5 + Math.random() * 2;
    const pillar = BABYLON.MeshBuilder.CreateBox(
      `ruins_pillar_${i}`,
      { width: 0.8, height: h, depth: 0.8 },
      scene
    );
    pillar.position.set(x + dx, h / 2, z + dz);
    const mat = new BABYLON.StandardMaterial(`ruins_mat_${i}`, scene);
    mat.diffuseColor = new BABYLON.Color3(0.45, 0.42, 0.38);
    pillar.material = mat;
    if (i === 0) pillar.metadata = { worldId: "ruins", kind: "ruins" };
    meshes.push(pillar);
  });
  return meshes;
}

function makeTrader(scene: BABYLON.Scene, x: number, z: number): BABYLON.Mesh {
  const body = BABYLON.MeshBuilder.CreateCylinder(
    "trader_body",
    { height: 1.8, diameterTop: 0.6, diameterBottom: 0.8, tessellation: 8 },
    scene
  );
  body.position.set(x, 0.9, z);
  const mat = new BABYLON.StandardMaterial("traderMat", scene);
  mat.diffuseColor = new BABYLON.Color3(0.5, 0.2, 0.6);
  mat.emissiveColor = new BABYLON.Color3(0.1, 0.0, 0.15);
  body.material = mat;

  const head = BABYLON.MeshBuilder.CreateSphere(
    "trader_head",
    { diameter: 0.55, segments: 6 },
    scene
  );
  head.position.set(x, 2.1, z);
  const headMat = new BABYLON.StandardMaterial("traderHeadMat", scene);
  headMat.diffuseColor = new BABYLON.Color3(0.85, 0.7, 0.55);
  head.material = headMat;

  body.metadata = { worldId: "trader", kind: "trader" };
  return body;
}

function makeSpirit(scene: BABYLON.Scene, x: number, z: number, id: string): BABYLON.Mesh {
  const orb = BABYLON.MeshBuilder.CreateSphere(
    id,
    { diameter: 0.7, segments: 8 },
    scene
  );
  orb.position.set(x, 1.8, z);
  const mat = new BABYLON.StandardMaterial(`${id}_mat`, scene);
  mat.diffuseColor = new BABYLON.Color3(0.6, 0.4, 1.0);
  mat.emissiveColor = new BABYLON.Color3(0.3, 0.1, 0.7);
  mat.alpha = 0.75;
  orb.material = mat;
  orb.metadata = { worldId: id, kind: "spirit" };
  orb.setEnabled(false);
  return orb;
}

function makeMonster(scene: BABYLON.Scene, x: number, z: number, id: string, kind: string): BABYLON.Mesh {
  const colors: Record<string, BABYLON.Color3> = {
    shadow: new BABYLON.Color3(0.1, 0.05, 0.2),
    wraith: new BABYLON.Color3(0.05, 0.2, 0.15),
    beast: new BABYLON.Color3(0.3, 0.05, 0.05),
  };
  const col = colors[kind] ?? new BABYLON.Color3(0.2, 0.1, 0.1);

  const body = BABYLON.MeshBuilder.CreateBox(
    id,
    { width: 0.9, height: 1.4, depth: 0.6 },
    scene
  );
  body.position.set(x, 0.7, z);
  const mat = new BABYLON.StandardMaterial(`${id}_mat`, scene);
  mat.diffuseColor = col;
  mat.emissiveColor = col.scale(0.5);
  body.material = mat;
  body.metadata = { worldId: id, kind: "monster" };
  body.setEnabled(false);
  return body;
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createInitialState());
  const [hudState, setHudState] = useState<GameState>(stateRef.current);
  const keysRef = useRef<Set<string>>(new Set());
  const meshMapRef = useRef<Map<string, BABYLON.Mesh | BABYLON.Mesh[]>>(new Map());
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  const engineRef = useRef<BABYLON.Engine | null>(null);
  const cameraRef = useRef<BABYLON.ArcRotateCamera | null>(null);
  const playerMeshRef = useRef<BABYLON.Mesh | null>(null);
  const lastAttackRef = useRef<Map<string, number>>(new Map());
  const lastHudUpdateRef = useRef(0);
  const restartFlagRef = useRef(false);

  // Push current state snapshot to React
  const syncHud = useCallback(() => {
    const now = performance.now();
    if (now - lastHudUpdateRef.current < 100) return;
    lastHudUpdateRef.current = now;
    // shallow clone so React re-renders
    setHudState({ ...stateRef.current, inventory: new Map(stateRef.current.inventory) });
  }, []);

  // ── Action handlers (called from HUD buttons) ───────────────────────────
  const handleChop = useCallback(() => {
    const gs = stateRef.current;
    const px = gs.player.x;
    const pz = gs.player.z;
    // find nearest undepleted tree
    const tree = gs.worldObjects.find(
      (o) =>
        o.kind === "tree" &&
        !o.depleted &&
        Math.hypot(o.x - px, o.z - pz) <= INTERACT_RADIUS
    );
    if (!tree) {
      addMessage(gs, "No tree nearby to chop!", "warning");
      syncHud();
      return;
    }
    tree.depleted = true;
    tree.depletedAt = Date.now();
    // hide mesh
    const m = meshMapRef.current.get(tree.id);
    if (m && !Array.isArray(m)) m.setEnabled(false);
    const gained = 2 + Math.floor(Math.random() * 3);
    addInventory(gs, "wood", gained);
    addScore(gs, 5);
    addMessage(gs, `Chopped! +${gained} 🪵 wood`, "info");
    runQuestCheck();
    syncHud();
  }, [syncHud]);

  const handleMine = useCallback(() => {
    const gs = stateRef.current;
    const px = gs.player.x;
    const pz = gs.player.z;
    const rock = gs.worldObjects.find(
      (o) =>
        o.kind === "rock" &&
        !o.depleted &&
        Math.hypot(o.x - px, o.z - pz) <= INTERACT_RADIUS
    );
    if (!rock) {
      addMessage(gs, "No rock nearby to mine!", "warning");
      syncHud();
      return;
    }
    rock.depleted = true;
    rock.depletedAt = Date.now();
    const m = meshMapRef.current.get(rock.id);
    if (m && !Array.isArray(m)) m.setEnabled(false);
    const gained = 1 + Math.floor(Math.random() * 3);
    addInventory(gs, "stone", gained);
    // chance for gem
    if (Math.random() < 0.12) {
      addInventory(gs, "gem", 1);
      addMessage(gs, `Mined! +${gained} 🪨 stone and a 💎 gem!`, "quest");
    } else {
      addMessage(gs, `Mined! +${gained} 🪨 stone`, "info");
    }
    addScore(gs, 5);
    runQuestCheck();
    syncHud();
  }, [syncHud]);

  const handleGather = useCallback(() => {
    const gs = stateRef.current;
    const px = gs.player.x;
    const pz = gs.player.z;
    const item = gs.worldObjects.find(
      (o) =>
        o.kind === "food" &&
        !o.depleted &&
        Math.hypot(o.x - px, o.z - pz) <= INTERACT_RADIUS
    );
    if (!item) {
      addMessage(gs, "No berries or mushrooms nearby!", "warning");
      syncHud();
      return;
    }
    item.depleted = true;
    item.depletedAt = Date.now();
    const m = meshMapRef.current.get(item.id);
    if (m && !Array.isArray(m)) m.setEnabled(false);
    const gained = 1 + Math.floor(Math.random() * 2);
    addInventory(gs, "food", gained);
    // chance for herb
    if (Math.random() < 0.25) {
      addInventory(gs, "herb", 1);
      addMessage(gs, `Gathered! +${gained} 🍎 food and a 🌿 herb!`, "info");
    } else {
      addMessage(gs, `Gathered! +${gained} 🍎 food`, "info");
    }
    addScore(gs, 3);
    runQuestCheck();
    syncHud();
  }, [syncHud]);

  const handleBuildCampfire = useCallback(() => {
    const gs = stateRef.current;
    if (getInv(gs, "wood") < 5) {
      addMessage(gs, "Need 5 wood to build a campfire!", "warning");
      syncHud();
      return;
    }
    addInventory(gs, "wood", -5);
    gs.player.hasCampfire = true;
    gs.flags.add("campfire_built");
    // spawn campfire mesh at player position
    const scene = sceneRef.current;
    if (scene) {
      makeCampfire(scene, gs.player.x, gs.player.z);
      // add campfire to world objects so proximity works
      gs.worldObjects.push({ id: "campfire", kind: "campfire", x: gs.player.x, z: gs.player.z });
    }
    addMessage(gs, "🔥 Campfire built! You feel safer.", "quest");
    addScore(gs, 30);
    runQuestCheck();
    syncHud();
  }, [syncHud]);

  const handleBuildShelter = useCallback(() => {
    const gs = stateRef.current;
    if (getInv(gs, "wood") < 10 || getInv(gs, "stone") < 3) {
      addMessage(gs, "Need 10 wood + 3 stone to build shelter!", "warning");
      syncHud();
      return;
    }
    addInventory(gs, "wood", -10);
    addInventory(gs, "stone", -3);
    gs.player.hasShelter = true;
    gs.flags.add("shelter_built");
    const scene = sceneRef.current;
    if (scene) {
      makeShelter(scene, gs.player.x + 3, gs.player.z);
      gs.worldObjects.push({ id: "shelter", kind: "shelter", x: gs.player.x + 3, z: gs.player.z });
    }
    addMessage(gs, "🏕️ Shelter built! You can rest here.", "quest");
    addScore(gs, 50);
    runQuestCheck();
    syncHud();
  }, [syncHud]);

  const handleEat = useCallback(() => {
    const gs = stateRef.current;
    if (getInv(gs, "food") <= 0) return;
    addInventory(gs, "food", -1);
    gs.player.hunger = Math.min(100, gs.player.hunger + 30);
    gs.player.hp = Math.min(gs.player.maxHp, gs.player.hp + 10);
    addMessage(gs, "🍽️ Ate food. Feeling better!", "info");
    syncHud();
  }, [syncHud]);

  const handleTrade = useCallback(
    (offer: TradeOffer) => {
      const gs = stateRef.current;
      if (getInv(gs, offer.give.type) < offer.give.count) return;
      addInventory(gs, offer.give.type, -offer.give.count);
      addInventory(gs, offer.receive.type, offer.receive.count);
      addMessage(
        gs,
        `Traded ${offer.give.count} ${offer.give.type} → ${offer.receive.count} ${offer.receive.type}`,
        "quest"
      );
      addScore(gs, 15);
      runQuestCheck();
      syncHud();
    },
    [syncHud]
  );

  const handleCloseTrader = useCallback(() => {
    stateRef.current.showTrader = false;
    syncHud();
  }, [syncHud]);

  const handleCloseClue = useCallback(() => {
    stateRef.current.activeClue = null;
    syncHud();
  }, [syncHud]);

  const handleToggleInventory = useCallback(() => {
    const gs = stateRef.current;
    gs.showInventory = !gs.showInventory;
    if (gs.showInventory) gs.showQuests = false;
    syncHud();
  }, [syncHud]);

  const handleToggleQuests = useCallback(() => {
    const gs = stateRef.current;
    gs.showQuests = !gs.showQuests;
    if (gs.showQuests) gs.showInventory = false;
    syncHud();
  }, [syncHud]);

  const handleRestart = useCallback(() => {
    restartFlagRef.current = true;
  }, []);

  // ── Quest checker ────────────────────────────────────────────────────────
  function runQuestCheck() {
    const gs = stateRef.current;
    const { updated, newlyCompleted } = checkQuests(gs.quests, gs.inventory, gs.flags);
    gs.quests = updated;
    for (const q of newlyCompleted) {
      if (q.unlockFlag) gs.flags.add(q.unlockFlag);
      if (q.reward) addInventory(gs, q.reward.type, q.reward.count);
      addMessage(gs, `Quest complete: ${q.title}!`, "quest", 6000);
      addScore(gs, 100);
    }
  }

  // ── Main Babylon effect ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ── Engine + Scene ──────────────────────────────────────────────────
    const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: false });
    engineRef.current = engine;
    const scene = new BABYLON.Scene(engine);
    sceneRef.current = scene;
    scene.clearColor = new BABYLON.Color4(0.36, 0.55, 0.8, 1);
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    scene.fogColor = new BABYLON.Color3(0.7, 0.85, 1.0);
    scene.fogDensity = 0.018;

    // ── Camera ──────────────────────────────────────────────────────────
    const camera = new BABYLON.ArcRotateCamera(
      "cam",
      -Math.PI / 2,
      Math.PI / 3.5,
      18,
      BABYLON.Vector3.Zero(),
      scene
    );
    camera.lowerRadiusLimit = 8;
    camera.upperRadiusLimit = 30;
    camera.lowerBetaLimit = 0.3;
    camera.upperBetaLimit = Math.PI / 2.4;
    cameraRef.current = camera;

    // ── Lighting ────────────────────────────────────────────────────────
    const sun = new BABYLON.HemisphericLight("sun", new BABYLON.Vector3(0.3, 1, 0.2), scene);
    sun.intensity = 1.2;
    sun.diffuse = new BABYLON.Color3(1, 0.95, 0.85);
    sun.groundColor = new BABYLON.Color3(0.3, 0.4, 0.3);

    // ── Ground ──────────────────────────────────────────────────────────
    const ground = BABYLON.MeshBuilder.CreateGround(
      "ground",
      { width: 160, height: 160, subdivisions: 8 },
      scene
    );
    const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.25, 0.45, 0.2);
    ground.material = groundMat;

    // River (blue strip)
    const river = BABYLON.MeshBuilder.CreateGround(
      "river",
      { width: 6, height: 80 },
      scene
    );
    river.position.set(20, 0.02, 10);
    river.rotation.y = 0.3;
    const riverMat = new BABYLON.StandardMaterial("riverMat", scene);
    riverMat.diffuseColor = new BABYLON.Color3(0.2, 0.45, 0.8);
    river.material = riverMat;

    // Mountain silhouettes (far background)
    const mtnPositions = [
      { x: -70, z: -70 },
      { x: 0, z: -80 },
      { x: 70, z: -65 },
      { x: -80, z: 10 },
      { x: 80, z: 20 },
    ];
    mtnPositions.forEach(({ x, z }, i) => {
      const mtn = BABYLON.MeshBuilder.CreateCylinder(
        `mtn_${i}`,
        { height: 18 + Math.random() * 12, diameterTop: 0, diameterBottom: 14 + Math.random() * 8, tessellation: 5 },
        scene
      );
      mtn.position.set(x, 0, z);
      const mtnMat = new BABYLON.StandardMaterial(`mtnMat_${i}`, scene);
      mtnMat.diffuseColor = new BABYLON.Color3(0.38, 0.38, 0.4);
      mtn.material = mtnMat;
    });

    // ── Player mesh ─────────────────────────────────────────────────────
    const playerBody = BABYLON.MeshBuilder.CreateCylinder(
      "player",
      { height: 1.6, diameterTop: 0.5, diameterBottom: 0.7, tessellation: 8 },
      scene
    );
    playerBody.position.set(0, 0.8, 0);
    const playerMat = new BABYLON.StandardMaterial("playerMat", scene);
    playerMat.diffuseColor = new BABYLON.Color3(0.85, 0.65, 0.45);
    playerBody.material = playerMat;

    const playerHead = BABYLON.MeshBuilder.CreateSphere(
      "playerHead",
      { diameter: 0.55, segments: 6 },
      scene
    );
    playerHead.position.set(0, 1.9, 0);
    const headMat = new BABYLON.StandardMaterial("playerHeadMat", scene);
    headMat.diffuseColor = new BABYLON.Color3(0.85, 0.65, 0.45);
    playerHead.material = headMat;

    playerMeshRef.current = playerBody;

    // ── World generation ─────────────────────────────────────────────────
    const worldDef = generateWorld();
    const gs = stateRef.current;
    gs.worldObjects = worldDef.objects;
    gs.spirits = worldDef.spirits;
    gs.monsters = worldDef.monsters;

    // Build meshes for world objects
    for (const obj of worldDef.objects) {
      switch (obj.kind) {
        case "tree": {
          const m = makeTree(scene, obj.x, obj.z, obj.id);
          meshMapRef.current.set(obj.id, m);
          break;
        }
        case "rock": {
          const m = makeRock(scene, obj.x, obj.z, obj.id);
          meshMapRef.current.set(obj.id, m);
          break;
        }
        case "food": {
          const m = makeFood(scene, obj.x, obj.z, obj.id);
          meshMapRef.current.set(obj.id, m);
          break;
        }
        case "cabin": {
          const m = makeCabin(scene, obj.x, obj.z);
          meshMapRef.current.set(obj.id, m);
          break;
        }
        case "cave": {
          const m = makeCave(scene, obj.x, obj.z);
          meshMapRef.current.set(obj.id, m);
          break;
        }
        case "ruins": {
          const ms = makeRuins(scene, obj.x, obj.z);
          meshMapRef.current.set(obj.id, ms);
          break;
        }
        case "trader": {
          const m = makeTrader(scene, obj.x, obj.z);
          meshMapRef.current.set(obj.id, m);
          break;
        }
      }
    }

    // Build spirit meshes
    for (const sp of worldDef.spirits) {
      const m = makeSpirit(scene, sp.x, sp.z, sp.id);
      meshMapRef.current.set(sp.id, m);
    }

    // Build monster meshes
    for (const mn of worldDef.monsters) {
      const m = makeMonster(scene, mn.x, mn.z, mn.id, mn.kind);
      meshMapRef.current.set(mn.id, m);
    }

    // ── Pointer picking (click world objects) ────────────────────────────
    scene.onPointerObservable.add((info) => {
      if (info.type !== BABYLON.PointerEventTypes.POINTERTAP) return;
      const pick = info.pickInfo;
      if (!pick?.hit || !pick.pickedMesh) return;
      const meta = pick.pickedMesh.metadata as { worldId?: string; kind?: string } | null;
      if (!meta?.worldId) return;

      const wid = meta.worldId;
      const kind = meta.kind;
      const gs = stateRef.current;
      const px = gs.player.x;
      const pz = gs.player.z;

      const obj = gs.worldObjects.find((o) => o.id === wid);
      if (obj) {
        const dist = Math.hypot(obj.x - px, obj.z - pz);
        if (dist > INTERACT_RADIUS * 2) {
          addMessage(gs, "Too far away — move closer!", "warning");
          syncHud();
          return;
        }
      }

      if (kind === "tree") handleChop();
      else if (kind === "rock") handleMine();
      else if (kind === "food") handleGather();
      else if (kind === "cabin") {
        if (!gs.flags.has("cabin_found")) {
          gs.flags.add("cabin_found");
          addMessage(gs, "You found the abandoned cabin! Strange markings on the walls...", "quest", 6000);
          addScore(gs, 50);
          runQuestCheck();
          syncHud();
        }
      } else if (kind === "cave") {
        if (!gs.flags.has("cave_found")) {
          gs.flags.add("cave_found");
          addInventory(gs, "gem", 1);
          addMessage(gs, "A dark cave... you find a gem inside!", "quest", 5000);
          addScore(gs, 40);
          runQuestCheck();
          syncHud();
        }
      } else if (kind === "ruins") {
        if (!gs.flags.has("ruins_found")) {
          gs.flags.add("ruins_found");
          addMessage(gs, "Ancient ruins... something powerful slept here once.", "spirit", 6000);
          addScore(gs, 80);
          runQuestCheck();
          syncHud();
        }
      } else if (kind === "trader") {
        const dist = Math.hypot(-20 - px, 15 - pz);
        if (dist <= TRADER_RADIUS * 2) {
          gs.showTrader = true;
          syncHud();
        }
      } else if (kind === "spirit") {
        const sp = gs.spirits.find((s) => s.id === wid);
        if (sp?.visible) {
          gs.activeClue = sp.clue.text;
          addScore(gs, 20);
          syncHud();
        }
      }
    });

    // ── Keyboard ─────────────────────────────────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
      if (e.key.toLowerCase() === "t") {
        const gs = stateRef.current;
        if (gs.nearTrader) {
          gs.showTrader = !gs.showTrader;
          syncHud();
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // ── Game loop variables ──────────────────────────────────────────────
    let lastTime = performance.now();
    let nightSurvived = false;

    // ── Render loop ──────────────────────────────────────────────────────
    scene.onBeforeRenderObservable.add(() => {
      // Handle restart
      if (restartFlagRef.current) {
        restartFlagRef.current = false;
        const fresh = createInitialState();
        const newWorld = generateWorld();
        fresh.worldObjects = newWorld.objects;
        fresh.spirits = newWorld.spirits;
        fresh.monsters = newWorld.monsters;
        stateRef.current = fresh;
        // reset player position
        playerBody.position.set(0, 0.8, 0);
        playerHead.position.set(0, 1.9, 0);
        fresh.player.x = 0;
        fresh.player.z = 0;
        nightSurvived = false;
        // restore world meshes
        for (const obj of newWorld.objects) {
          const m = meshMapRef.current.get(obj.id);
          if (m) {
            if (Array.isArray(m)) m.forEach((mm) => mm.setEnabled(true));
            else m.setEnabled(true);
          }
        }
        syncHud();
        return;
      }

      const gs = stateRef.current;
      if (gs.gameOver) return;

      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // ── Time of day ──────────────────────────────────────────────────
      gs.time = (gs.time + dt / DAY_DURATION) % 1;
      const prevTod = gs.timeOfDay;
      gs.timeOfDay = computeTimeOfDay(gs.time);

      // Day count
      if (prevTod === "night" && gs.timeOfDay === "dawn") {
        gs.dayCount++;
        if (!nightSurvived) {
          nightSurvived = true;
          gs.flags.add("night_survived");
          addMessage(gs, "You survived the night! 🌄", "quest", 5000);
          runQuestCheck();
        }
      }

      // ── Sky / lighting by time ───────────────────────────────────────
      const t = gs.time;
      const isNight = gs.timeOfDay === "night";
      const isDusk = gs.timeOfDay === "dusk";
      const isDawn = gs.timeOfDay === "dawn";

      if (isNight) {
        scene.clearColor = new BABYLON.Color4(0.04, 0.04, 0.12, 1);
        scene.fogColor = new BABYLON.Color3(0.04, 0.04, 0.1);
        scene.fogDensity = 0.03;
        sun.intensity = 0.2;
        sun.diffuse = new BABYLON.Color3(0.3, 0.3, 0.6);
      } else if (isDusk) {
        const p = (t - 0.75) / 0.2;
        scene.clearColor = new BABYLON.Color4(0.7 - p * 0.6, 0.4 - p * 0.35, 0.2 - p * 0.15, 1);
        scene.fogDensity = 0.018 + p * 0.012;
        sun.intensity = 1.2 - p * 1.0;
        sun.diffuse = new BABYLON.Color3(1, 0.6 - p * 0.3, 0.3 - p * 0.1);
      } else if (isDawn) {
        const p = (t - 0.1) / 0.1;
        scene.clearColor = new BABYLON.Color4(0.3 + p * 0.3, 0.3 + p * 0.4, 0.5 + p * 0.3, 1);
        sun.intensity = 0.2 + p * 1.0;
        sun.diffuse = new BABYLON.Color3(1, 0.7 + p * 0.25, 0.5 + p * 0.35);
        scene.fogDensity = 0.03 - p * 0.012;
      } else {
        scene.clearColor = new BABYLON.Color4(0.36, 0.55, 0.8, 1);
        scene.fogColor = new BABYLON.Color3(0.7, 0.85, 1.0);
        scene.fogDensity = 0.018;
        sun.intensity = 1.2;
        sun.diffuse = new BABYLON.Color3(1, 0.95, 0.85);
      }

      // ── Player movement ──────────────────────────────────────────────
      const keys = keysRef.current;
      let dx = 0;
      let dz = 0;
      if (keys.has("w") || keys.has("arrowup")) dz -= 1;
      if (keys.has("s") || keys.has("arrowdown")) dz += 1;
      if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
      if (keys.has("d") || keys.has("arrowright")) dx += 1;

      if (dx !== 0 || dz !== 0) {
        const len = Math.hypot(dx, dz);
        dx = (dx / len) * PLAYER_SPEED * dt;
        dz = (dz / len) * PLAYER_SPEED * dt;
        gs.player.x = Math.max(-75, Math.min(75, gs.player.x + dx));
        gs.player.z = Math.max(-75, Math.min(75, gs.player.z + dz));
        gs.player.angle = Math.atan2(dx, dz);

        playerBody.position.x = gs.player.x;
        playerBody.position.z = gs.player.z;
        playerHead.position.x = gs.player.x;
        playerHead.position.z = gs.player.z;
        playerBody.rotation.y = gs.player.angle;

        // Camera follows player
        camera.target.set(gs.player.x, 0.5, gs.player.z);
      }

      // ── Proximity checks ─────────────────────────────────────────────
      const px = gs.player.x;
      const pz = gs.player.z;

      const traderObj = gs.worldObjects.find((o) => o.kind === "trader");
      gs.nearTrader = traderObj
        ? Math.hypot(traderObj.x - px, traderObj.z - pz) <= TRADER_RADIUS
        : false;

      const campfireObj = gs.worldObjects.find((o) => o.kind === "campfire");
      gs.nearCampfire = campfireObj
        ? Math.hypot(campfireObj.x - px, campfireObj.z - pz) <= CAMPFIRE_RADIUS
        : false;

      const shelterObj = gs.worldObjects.find((o) => o.kind === "shelter");
      gs.nearShelter = shelterObj
        ? Math.hypot(shelterObj.x - px, shelterObj.z - pz) <= SHELTER_RADIUS
        : false;

      // ── Hunger drain ─────────────────────────────────────────────────
      gs.player.hunger = Math.max(0, gs.player.hunger - HUNGER_DRAIN * dt);
      if (gs.player.hunger <= 0) {
        gs.player.hp = Math.max(0, gs.player.hp - 3 * dt);
      }

      // ── Campfire / shelter regen ──────────────────────────────────────
      if ((gs.nearCampfire || gs.nearShelter) && gs.player.hp < gs.player.maxHp) {
        gs.player.hp = Math.min(gs.player.maxHp, gs.player.hp + REGEN_RATE * dt);
      }

      // ── Resource respawn (every 60s) ─────────────────────────────────
      const nowMs = Date.now();
      for (const obj of gs.worldObjects) {
        if (obj.depleted && obj.depletedAt && nowMs - obj.depletedAt > 60000) {
          obj.depleted = false;
          obj.depletedAt = undefined;
          const m = meshMapRef.current.get(obj.id);
          if (m && !Array.isArray(m)) m.setEnabled(true);
        }
      }

      // ── Spirits: visible at night ─────────────────────────────────────
      for (const sp of gs.spirits) {
        const waVisible = sp.visible;
        sp.visible = isNight;
        const m = meshMapRef.current.get(sp.id);
        if (m && !Array.isArray(m)) {
          m.setEnabled(sp.visible);
          // float animation
          if (sp.visible) {
            m.position.y = 1.8 + Math.sin(now / 800 + sp.x) * 0.3;
          }
        }
        // Proximity clue trigger
        if (sp.visible && !waVisible) {
          // just became visible
        }
        if (sp.visible) {
          const dist = Math.hypot(sp.x - px, sp.z - pz);
          if (dist < 4 && !gs.activeClue) {
            gs.activeClue = sp.clue.text;
            addScore(gs, 20);
          }
        }
      }

      // ── Monsters: active at night, patrol + chase ─────────────────────
      for (const mn of gs.monsters) {
        const m = meshMapRef.current.get(mn.id);
        if (m && !Array.isArray(m)) {
          m.setEnabled(isNight);
        }
        if (!isNight) {
          mn.chasing = false;
          continue;
        }

        const distToPlayer = Math.hypot(mn.x - px, mn.z - pz);

        // Chase logic
        if (distToPlayer < mn.alertRadius) {
          mn.chasing = true;
        } else if (distToPlayer > mn.chaseRadius) {
          mn.chasing = false;
        }

        // Can't chase if near campfire/shelter
        if ((gs.nearCampfire || gs.nearShelter) && mn.chasing) {
          mn.chasing = false;
          if (Math.random() < 0.01) {
            addMessage(gs, "A monster lurks nearby, but the fire keeps it away...", "warning");
          }
        }

        const speed = mn.kind === "wraith" ? 3.5 : mn.kind === "beast" ? 4.5 : 2.5;

        if (mn.chasing) {
          const angle = Math.atan2(px - mn.x, pz - mn.z);
          mn.vx = Math.sin(angle) * speed;
          mn.vz = Math.cos(angle) * speed;
          if (Math.random() < 0.005) {
            addMessage(gs, "⚠️ Something is chasing you — run!", "danger");
          }
        } else {
          // Wander
          mn.vx += (Math.random() - 0.5) * 0.5;
          mn.vz += (Math.random() - 0.5) * 0.5;
          const len = Math.hypot(mn.vx, mn.vz);
          if (len > 1.5) {
            mn.vx = (mn.vx / len) * 1.5;
            mn.vz = (mn.vz / len) * 1.5;
          }
        }

        mn.x += mn.vx * dt;
        mn.z += mn.vz * dt;
        mn.x = Math.max(-75, Math.min(75, mn.x));
        mn.z = Math.max(-75, Math.min(75, mn.z));

        if (m && !Array.isArray(m)) {
          m.position.x = mn.x;
          m.position.z = mn.z;
          m.position.y = 0.7 + Math.sin(now / 400 + mn.x) * 0.1;
        }

        // Attack player
        if (distToPlayer < 1.5 && mn.chasing) {
          const lastAtk = lastAttackRef.current.get(mn.id) ?? 0;
          if (nowMs - lastAtk > MONSTER_ATTACK_INTERVAL) {
            lastAttackRef.current.set(mn.id, nowMs);
            gs.player.hp = Math.max(0, gs.player.hp - MONSTER_DAMAGE);
            addMessage(gs, `💀 A ${mn.kind} attacked you! -${MONSTER_DAMAGE} HP`, "danger");
            // Knockback
            const kbAngle = Math.atan2(px - mn.x, pz - mn.z);
            gs.player.x += Math.sin(kbAngle) * 3;
            gs.player.z += Math.cos(kbAngle) * 3;
            playerBody.position.x = gs.player.x;
            playerBody.position.z = gs.player.z;
            playerHead.position.x = gs.player.x;
            playerHead.position.z = gs.player.z;
          }
        }
      }

      // ── Game over check ──────────────────────────────────────────────
      if (gs.player.hp <= 0) {
        gs.gameOver = true;
      }

      // ── Lantern equip ────────────────────────────────────────────────
      if (!gs.player.hasLantern && getInv(gs, "lantern") > 0) {
        gs.player.hasLantern = true;
        addMessage(gs, "🏮 Lantern equipped! Night feels less scary.", "quest");
      }

      // ── Expire messages ──────────────────────────────────────────────
      gs.messages = gs.messages.filter((m) => Date.now() < m.expires);

      // ── Sync HUD ─────────────────────────────────────────────────────
      syncHud();
    });

    engine.runRenderLoop(() => scene.render());

    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      engine.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isNight = hudState.timeOfDay === "night";

  return (
    <Shell>
      <div style={{ position: "relative", width: "100%", height: "100dvh", overflow: "hidden" }}>
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }}
        />
        <HUD
          state={hudState}
          onChop={handleChop}
          onMine={handleMine}
          onGather={handleGather}
          onBuildCampfire={handleBuildCampfire}
          onBuildShelter={handleBuildShelter}
          onEat={handleEat}
          onTrade={handleTrade}
          onCloseTrader={handleCloseTrader}
          onCloseClue={handleCloseClue}
          onToggleInventory={handleToggleInventory}
          onToggleQuests={handleToggleQuests}
          onRestart={handleRestart}
          isNight={isNight}
        />

        {/* Touch D-pad for mobile */}
        <TouchDpad keysRef={keysRef} />
      </div>
    </Shell>
  );
}

// ─── Mobile D-pad ─────────────────────────────────────────────────────────────
function TouchDpad({ keysRef }: { keysRef: React.RefObject<Set<string>> }) {
  const press = (key: string) => keysRef.current?.add(key);
  const release = (key: string) => keysRef.current?.delete(key);

  const Btn = ({
    label,
    k,
    style,
  }: {
    label: string;
    k: string;
    style?: React.CSSProperties;
  }) => (
    <button
      onPointerDown={() => press(k)}
      onPointerUp={() => release(k)}
      onPointerLeave={() => release(k)}
      style={{
        width: 48,
        height: 48,
        borderRadius: 8,
        background: "rgba(255,255,255,0.15)",
        border: "1px solid rgba(255,255,255,0.25)",
        color: "white",
        fontSize: 18,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        userSelect: "none",
        touchAction: "none",
        ...style,
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        position: "absolute",
        bottom: 80,
        left: 16,
        zIndex: 35,
        display: "grid",
        gridTemplateColumns: "48px 48px 48px",
        gridTemplateRows: "48px 48px 48px",
        gap: 4,
        pointerEvents: "auto",
      }}
    >
      <div />
      <Btn label="▲" k="w" />
      <div />
      <Btn label="◀" k="a" />
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 8,
          background: "rgba(255,255,255,0.05)",
        }}
      />
      <Btn label="▶" k="d" />
      <div />
      <Btn label="▼" k="s" />
      <div />
    </div>
  );
}
