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
  saveHighScore,
  type GameState,
} from "./lib/gameState";
import { generateWorld } from "./lib/world";
import { checkQuests } from "./lib/quests";
import type { MonsterState, TradeOffer } from "./lib/types";

// ── Constants ──────────────────────────────────────────────────────────────
const DAY_DURATION = 180;
const PLAYER_SPEED = 8;
const INTERACT_RADIUS = 4;
const REGEN_RADIUS = 6;
const HUNGER_DRAIN_RATE = 2;
const CAMPFIRE_REGEN = 5;
const MONSTER_SPEED = 3.5;
const WRAITH_SPEED = 4.5;
const RESOURCE_RESPAWN = 30;

// ── Scene mesh registry ────────────────────────────────────────────────────
interface SceneMeshes {
  scene: BABYLON.Scene;
  playerBody: BABYLON.Mesh;
  playerHead: BABYLON.Mesh;
  groundMesh: BABYLON.Mesh;
  skybox: BABYLON.Mesh;
  sun: BABYLON.PointLight;
  ambient: BABYLON.HemisphericLight;
  worldMeshes: Map<string, BABYLON.Mesh>;
  monsterMeshes: Map<string, BABYLON.Mesh>;
  spiritMeshes: Map<string, BABYLON.Mesh>;
  campfireLight: BABYLON.PointLight | null;
  campfireMesh: BABYLON.Mesh | null;
  shelterMesh: BABYLON.Mesh | null;
}

function dist2d(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

function buildTreeMesh(scene: BABYLON.Scene, id: string, x: number, z: number): BABYLON.Mesh {
  const trunk = BABYLON.MeshBuilder.CreateCylinder(
    `trunk_${id}`,
    { height: 2.5, diameterTop: 0.3, diameterBottom: 0.5, tessellation: 6 },
    scene
  );
  trunk.position.set(x, 1.25, z);
  const trunkMat = new BABYLON.StandardMaterial(`trunkMat_${id}`, scene);
  trunkMat.diffuseColor = new BABYLON.Color3(0.45, 0.28, 0.12);
  trunk.material = trunkMat;
  const canopy = BABYLON.MeshBuilder.CreateSphere(
    `canopy_${id}`,
    { diameter: 3.5 + Math.random(), segments: 5 },
    scene
  );
  canopy.position.set(x, 4, z);
  const canopyMat = new BABYLON.StandardMaterial(`canopyMat_${id}`, scene);
  canopyMat.diffuseColor = new BABYLON.Color3(
    0.15 + Math.random() * 0.1,
    0.52 + Math.random() * 0.1,
    0.15
  );
  canopy.material = canopyMat;
  return trunk;
}

function buildRockMesh(scene: BABYLON.Scene, id: string, x: number, z: number): BABYLON.Mesh {
  const rock = BABYLON.MeshBuilder.CreateSphere(
    `rock_${id}`,
    { diameter: 1.2 + Math.random() * 0.6, segments: 4 },
    scene
  );
  rock.position.set(x, 0.5, z);
  rock.scaling.y = 0.7;
  const mat = new BABYLON.StandardMaterial(`rockMat_${id}`, scene);
  mat.diffuseColor = new BABYLON.Color3(0.55, 0.5, 0.45);
  rock.material = mat;
  return rock;
}

function buildFoodMesh(scene: BABYLON.Scene, id: string, x: number, z: number): BABYLON.Mesh {
  const food = BABYLON.MeshBuilder.CreateSphere(
    `food_${id}`,
    { diameter: 0.5, segments: 4 },
    scene
  );
  food.position.set(x, 0.25, z);
  const mat = new BABYLON.StandardMaterial(`foodMat_${id}`, scene);
  mat.diffuseColor = new BABYLON.Color3(0.9, 0.2, 0.2);
  mat.emissiveColor = new BABYLON.Color3(0.3, 0.0, 0.0);
  food.material = mat;
  return food;
}

function buildCabinMesh(scene: BABYLON.Scene, x: number, z: number): BABYLON.Mesh {
  const body = BABYLON.MeshBuilder.CreateBox("cabin", { width: 5, height: 3, depth: 4 }, scene);
  body.position.set(x, 1.5, z);
  const mat = new BABYLON.StandardMaterial("cabinMat", scene);
  mat.diffuseColor = new BABYLON.Color3(0.4, 0.25, 0.1);
  body.material = mat;
  const roof = BABYLON.MeshBuilder.CreateCylinder(
    "cabinRoof",
    { height: 2, diameterTop: 0, diameterBottom: 6, tessellation: 4 },
    scene
  );
  roof.position.set(x, 4, z);
  const roofMat = new BABYLON.StandardMaterial("cabinRoofMat", scene);
  roofMat.diffuseColor = new BABYLON.Color3(0.3, 0.15, 0.05);
  roof.material = roofMat;
  return body;
}

function buildCaveMesh(scene: BABYLON.Scene, x: number, z: number): BABYLON.Mesh {
  const cave = BABYLON.MeshBuilder.CreateSphere("cave", { diameter: 5, segments: 5 }, scene);
  cave.position.set(x, 0, z);
  cave.scaling.y = 0.6;
  const mat = new BABYLON.StandardMaterial("caveMat", scene);
  mat.diffuseColor = new BABYLON.Color3(0.2, 0.18, 0.15);
  cave.material = mat;
  return cave;
}

function buildRuinsMesh(scene: BABYLON.Scene, x: number, z: number): BABYLON.Mesh {
  const base = BABYLON.MeshBuilder.CreateBox("ruins", { width: 8, height: 0.5, depth: 8 }, scene);
  base.position.set(x, 0.25, z);
  const mat = new BABYLON.StandardMaterial("ruinsMat", scene);
  mat.diffuseColor = new BABYLON.Color3(0.5, 0.45, 0.35);
  base.material = mat;
  for (let i = 0; i < 4; i++) {
    const px = x + (i < 2 ? -3 : 3);
    const pz = z + (i % 2 === 0 ? -3 : 3);
    const pillar = BABYLON.MeshBuilder.CreateCylinder(
      `ruins_pillar_${i}`,
      { height: 3 + Math.random() * 2, diameter: 0.8, tessellation: 6 },
      scene
    );
    pillar.position.set(px, 1.5, pz);
    pillar.material = mat;
  }
  return base;
}

function buildVillageMesh(scene: BABYLON.Scene, x: number, z: number): BABYLON.Mesh {
  const base = BABYLON.MeshBuilder.CreateBox("village", { width: 10, height: 0.3, depth: 10 }, scene);
  base.position.set(x, 0.15, z);
  const mat = new BABYLON.StandardMaterial("villageMat", scene);
  mat.diffuseColor = new BABYLON.Color3(0.35, 0.3, 0.22);
  base.material = mat;
  // A few small ruined structures
  for (let i = 0; i < 3; i++) {
    const hut = BABYLON.MeshBuilder.CreateBox(
      `village_hut_${i}`,
      { width: 2, height: 1.5, depth: 2 },
      scene
    );
    hut.position.set(x + (i - 1) * 3.5, 0.75, z + (i % 2 === 0 ? 2 : -2));
    hut.material = mat;
  }
  return base;
}

function buildTraderMesh(scene: BABYLON.Scene, x: number, z: number): BABYLON.Mesh {
  const body = BABYLON.MeshBuilder.CreateCylinder(
    "trader",
    { height: 2, diameterTop: 0.8, diameterBottom: 1, tessellation: 8 },
    scene
  );
  body.position.set(x, 1, z);
  const mat = new BABYLON.StandardMaterial("traderMat", scene);
  mat.diffuseColor = new BABYLON.Color3(0.5, 0.2, 0.6);
  mat.emissiveColor = new BABYLON.Color3(0.1, 0.0, 0.15);
  body.material = mat;
  const head = BABYLON.MeshBuilder.CreateSphere("traderHead", { diameter: 0.8, segments: 5 }, scene);
  head.position.set(x, 2.4, z);
  const headMat = new BABYLON.StandardMaterial("traderHeadMat", scene);
  headMat.diffuseColor = new BABYLON.Color3(0.85, 0.7, 0.5);
  head.material = headMat;
  return body;
}

function buildMonsterMesh(
  scene: BABYLON.Scene,
  id: string,
  kind: MonsterState["kind"],
  x: number,
  z: number
): BABYLON.Mesh {
  const colors: Record<MonsterState["kind"], BABYLON.Color3> = {
    shadow: new BABYLON.Color3(0.1, 0.05, 0.2),
    wraith: new BABYLON.Color3(0.3, 0.1, 0.5),
    beast: new BABYLON.Color3(0.5, 0.1, 0.1),
    goblin: new BABYLON.Color3(0.1, 0.35, 0.1),
  };
  const mesh = BABYLON.MeshBuilder.CreateBox(
    `monster_${id}`,
    { width: 1.2, height: 2, depth: 1.2 },
    scene
  );
  mesh.position.set(x, 1, z);
  const mat = new BABYLON.StandardMaterial(`monsterMat_${id}`, scene);
  mat.diffuseColor = colors[kind];
  mat.emissiveColor = colors[kind].scale(0.5);
  mesh.material = mat;
  return mesh;
}

function buildSpiritMesh(scene: BABYLON.Scene, id: string, x: number, z: number): BABYLON.Mesh {
  const mesh = BABYLON.MeshBuilder.CreateSphere(
    `spirit_${id}`,
    { diameter: 1, segments: 5 },
    scene
  );
  mesh.position.set(x, 2.5, z);
  const mat = new BABYLON.StandardMaterial(`spiritMat_${id}`, scene);
  mat.diffuseColor = new BABYLON.Color3(0.6, 0.4, 1.0);
  mat.emissiveColor = new BABYLON.Color3(0.3, 0.1, 0.6);
  mat.alpha = 0.7;
  mesh.material = mat;
  mesh.isVisible = false;
  return mesh;
}

function spawnWorldMeshes(
  scene: BABYLON.Scene,
  worldObjects: GameState["worldObjects"],
  worldMeshes: Map<string, BABYLON.Mesh>
) {
  for (const obj of worldObjects) {
    let mesh: BABYLON.Mesh | null = null;
    if (obj.kind === "tree") mesh = buildTreeMesh(scene, obj.id, obj.x, obj.z);
    else if (obj.kind === "rock") mesh = buildRockMesh(scene, obj.id, obj.x, obj.z);
    else if (obj.kind === "food") mesh = buildFoodMesh(scene, obj.id, obj.x, obj.z);
    else if (obj.kind === "cabin") mesh = buildCabinMesh(scene, obj.x, obj.z);
    else if (obj.kind === "cave") mesh = buildCaveMesh(scene, obj.x, obj.z);
    else if (obj.kind === "ruins") mesh = buildRuinsMesh(scene, obj.x, obj.z);
    else if (obj.kind === "village") mesh = buildVillageMesh(scene, obj.x, obj.z);
    else if (obj.kind === "trader") mesh = buildTraderMesh(scene, obj.x, obj.z);
    if (mesh) worldMeshes.set(obj.id, mesh);
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createInitialState());
  const meshesRef = useRef<SceneMeshes | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const [hudState, setHudState] = useState<GameState>(() => stateRef.current);
  const [isNight, setIsNight] = useState(false);

  const syncHUD = useCallback(() => {
    setHudState({ ...stateRef.current, inventory: new Map(stateRef.current.inventory) });
    setIsNight(stateRef.current.timeOfDay === "night");
  }, []);

  const handleRestart = useCallback(() => {
    const fresh = createInitialState();
    const world = generateWorld();
    fresh.worldObjects = world.objects;
    fresh.monsters = world.monsters.map((mon) => ({ ...mon }));
    fresh.spirits = world.spirits.map((sp) => ({ ...sp }));
    stateRef.current = fresh;
    const m = meshesRef.current;
    if (m) {
      m.worldMeshes.forEach((mesh) => mesh.dispose());
      m.worldMeshes.clear();
      m.monsterMeshes.forEach((mesh) => mesh.dispose());
      m.monsterMeshes.clear();
      m.spiritMeshes.forEach((mesh) => mesh.dispose());
      m.spiritMeshes.clear();
      m.campfireLight?.dispose();
      m.campfireMesh?.dispose();
      m.shelterMesh?.dispose();
      m.campfireLight = null;
      m.campfireMesh = null;
      m.shelterMesh = null;
      spawnWorldMeshes(m.scene, fresh.worldObjects, m.worldMeshes);
      for (const mon of fresh.monsters) {
        const mesh = buildMonsterMesh(m.scene, mon.id, mon.kind, mon.x, mon.z);
        mesh.isVisible = false;
        m.monsterMeshes.set(mon.id, mesh);
      }
      for (const sp of fresh.spirits) {
        const mesh = buildSpiritMesh(m.scene, sp.id, sp.x, sp.z);
        m.spiritMeshes.set(sp.id, mesh);
      }
    }
    syncHUD();
  }, [syncHUD]);

  const handleChop = useCallback(() => {
    const gs = stateRef.current;
    const p = gs.player;
    const tree = gs.worldObjects.find(
      (o) => o.kind === "tree" && !o.depleted && dist2d(p.x, p.z, o.x, o.z) < INTERACT_RADIUS
    );
    if (!tree) {
      addMessage(gs, "No tree nearby! Walk up to a tree first.", "warning");
    } else {
      tree.depleted = true;
      tree.depletedAt = Date.now();
      addInventory(gs, "wood", 3);
      addScore(gs, 5);
      addMessage(gs, "+3 🪵 Wood collected!", "info");
      const mesh = meshesRef.current?.worldMeshes.get(tree.id);
      if (mesh) mesh.isVisible = false;
    }
    syncHUD();
  }, [syncHUD]);

  const handleMine = useCallback(() => {
    const gs = stateRef.current;
    const p = gs.player;
    const rock = gs.worldObjects.find(
      (o) => o.kind === "rock" && !o.depleted && dist2d(p.x, p.z, o.x, o.z) < INTERACT_RADIUS
    );
    if (!rock) {
      addMessage(gs, "No rock nearby! Walk up to a rock first.", "warning");
    } else {
      rock.depleted = true;
      rock.depletedAt = Date.now();
      addInventory(gs, "stone", 2);
      if (Math.random() < 0.12) {
        addInventory(gs, "gem", 1);
        addMessage(gs, "+2 🪨 Stone & +1 💎 Gem found!", "info");
        addScore(gs, 20);
      } else {
        addMessage(gs, "+2 🪨 Stone collected!", "info");
        addScore(gs, 5);
      }
      const mesh = meshesRef.current?.worldMeshes.get(rock.id);
      if (mesh) mesh.isVisible = false;
    }
    syncHUD();
  }, [syncHUD]);

  const handleGather = useCallback(() => {
    const gs = stateRef.current;
    const p = gs.player;
    const food = gs.worldObjects.find(
      (o) => o.kind === "food" && !o.depleted && dist2d(p.x, p.z, o.x, o.z) < INTERACT_RADIUS
    );
    if (!food) {
      addMessage(gs, "No food nearby! Look for red berries in the forest.", "warning");
    } else {
      food.depleted = true;
      food.depletedAt = Date.now();
      addInventory(gs, "food", 2);
      if (Math.random() < 0.3) {
        addInventory(gs, "herb", 1);
        addMessage(gs, "+2 🍎 Food & +1 🌿 Herb found!", "info");
      } else {
        addMessage(gs, "+2 🍎 Food gathered!", "info");
      }
      addScore(gs, 5);
      const mesh = meshesRef.current?.worldMeshes.get(food.id);
      if (mesh) mesh.isVisible = false;
    }
    syncHUD();
  }, [syncHUD]);

  const handleBuildCampfire = useCallback(() => {
    const gs = stateRef.current;
    const m = meshesRef.current;
    if (getInv(gs, "wood") < 5) {
      addMessage(gs, "Need 5 🪵 wood to build campfire!", "warning");
      return;
    }
    if (!m) return;
    addInventory(gs, "wood", -5);
    gs.player.hasCampfire = true;
    gs.flags.add("campfire_built");
    addMessage(gs, "🔥 Campfire built! You feel safer.", "quest");
    addScore(gs, 30);
    const cf = BABYLON.MeshBuilder.CreateCylinder(
      "campfire",
      { height: 0.4, diameter: 1.2, tessellation: 8 },
      m.scene
    );
    cf.position.set(gs.player.x, 0.2, gs.player.z);
    const cfMat = new BABYLON.StandardMaterial("campfireMat", m.scene);
    cfMat.diffuseColor = new BABYLON.Color3(0.9, 0.4, 0.05);
    cfMat.emissiveColor = new BABYLON.Color3(0.5, 0.2, 0.0);
    cf.material = cfMat;
    m.campfireMesh = cf;
    const light = new BABYLON.PointLight(
      "campfireLight",
      new BABYLON.Vector3(gs.player.x, 1, gs.player.z),
      m.scene
    );
    light.diffuse = new BABYLON.Color3(1, 0.6, 0.2);
    light.intensity = 2;
    light.range = 15;
    m.campfireLight = light;
    syncHUD();
  }, [syncHUD]);

  const handleBuildShelter = useCallback(() => {
    const gs = stateRef.current;
    if (getInv(gs, "wood") < 10 || getInv(gs, "stone") < 3) {
      addMessage(gs, "Need 10 🪵 + 3 🪨 to build shelter!", "warning");
      return;
    }
    addInventory(gs, "wood", -10);
    addInventory(gs, "stone", -3);
    gs.player.hasShelter = true;
    gs.flags.add("shelter_built");
    addMessage(gs, "🏕️ Shelter built! You have a home base.", "quest");
    addScore(gs, 60);
    syncHUD();
  }, [syncHUD]);

  const handleEat = useCallback(() => {
    const gs = stateRef.current;
    if (getInv(gs, "food") < 1) return;
    addInventory(gs, "food", -1);
    gs.player.hunger = Math.min(100, gs.player.hunger + 30);
    gs.player.hp = Math.min(gs.player.maxHp, gs.player.hp + 10);
    addMessage(gs, "🍎 You ate some food. Feeling better!", "info");
    syncHUD();
  }, [syncHUD]);

  const handleTrade = useCallback(
    (offer: TradeOffer) => {
      const gs = stateRef.current;
      if (getInv(gs, offer.give.type) < offer.give.count) return;
      addInventory(gs, offer.give.type, -offer.give.count);
      addInventory(gs, offer.receive.type, offer.receive.count);
      if (offer.receive.type === "lantern") gs.player.hasLantern = true;
      addMessage(gs, `Trade complete! Got ${offer.receive.count} ${offer.receive.type}!`, "quest");
      addScore(gs, 15);
      gs.showTrader = false;
      syncHUD();
    },
    [syncHUD]
  );

  const handleCloseTrader = useCallback(() => {
    stateRef.current.showTrader = false;
    syncHUD();
  }, [syncHUD]);

  const handleCloseClue = useCallback(() => {
    stateRef.current.activeClue = null;
    syncHUD();
  }, [syncHUD]);

  const handleToggleInventory = useCallback(() => {
    const gs = stateRef.current;
    gs.showInventory = !gs.showInventory;
    if (gs.showInventory) gs.showQuests = false;
    syncHUD();
  }, [syncHUD]);

  const handleToggleQuests = useCallback(() => {
    const gs = stateRef.current;
    gs.showQuests = !gs.showQuests;
    if (gs.showQuests) gs.showInventory = false;
    syncHUD();
  }, [syncHUD]);

  // ── Babylon scene setup ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true });
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.4, 0.6, 0.9, 1);

    const camera = new BABYLON.ArcRotateCamera(
      "cam",
      -Math.PI / 2,
      Math.PI / 3.5,
      18,
      BABYLON.Vector3.Zero(),
      scene
    );
    camera.lowerRadiusLimit = 8;
    camera.upperRadiusLimit = 35;
    camera.lowerBetaLimit = 0.3;
    camera.upperBetaLimit = Math.PI / 2.2;
    camera.attachControl(canvas, true);

    const ambient = new BABYLON.HemisphericLight("ambient", new BABYLON.Vector3(0, 1, 0), scene);
    ambient.intensity = 0.8;
    ambient.diffuse = new BABYLON.Color3(1, 0.95, 0.85);
    ambient.groundColor = new BABYLON.Color3(0.2, 0.3, 0.2);

    const sun = new BABYLON.PointLight("sun", new BABYLON.Vector3(30, 40, -20), scene);
    sun.intensity = 1.5;
    sun.diffuse = new BABYLON.Color3(1, 0.95, 0.8);

    const ground = BABYLON.MeshBuilder.CreateGround(
      "ground",
      { width: 200, height: 200, subdivisions: 8 },
      scene
    );
    const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.22, 0.45, 0.18);
    groundMat.specularColor = new BABYLON.Color3(0, 0, 0);
    ground.material = groundMat;

    const skybox = BABYLON.MeshBuilder.CreateSphere("skybox", { diameter: 400, segments: 8 }, scene);
    const skyMat = new BABYLON.StandardMaterial("skyMat", scene);
    skyMat.backFaceCulling = false;
    skyMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    skyMat.emissiveColor = new BABYLON.Color3(0.4, 0.65, 0.95);
    skyMat.specularColor = new BABYLON.Color3(0, 0, 0);
    skybox.material = skyMat;

    const playerBody = BABYLON.MeshBuilder.CreateCylinder(
      "player",
      { height: 1.8, diameterTop: 0.5, diameterBottom: 0.7, tessellation: 8 },
      scene
    );
    playerBody.position.set(0, 0.9, 0);
    const playerMat = new BABYLON.StandardMaterial("playerMat", scene);
    playerMat.diffuseColor = new BABYLON.Color3(0.3, 0.6, 0.9);
    playerBody.material = playerMat;

    const playerHead = BABYLON.MeshBuilder.CreateSphere(
      "playerHead",
      { diameter: 0.6, segments: 5 },
      scene
    );
    playerHead.position.set(0, 2.1, 0);
    const headMat = new BABYLON.StandardMaterial("headMat", scene);
    headMat.diffuseColor = new BABYLON.Color3(0.85, 0.7, 0.55);
    playerHead.material = headMat;

    const worldMeshes = new Map<string, BABYLON.Mesh>();
    const monsterMeshes = new Map<string, BABYLON.Mesh>();
    const spiritMeshes = new Map<string, BABYLON.Mesh>();

    meshesRef.current = {
      scene,
      playerBody,
      playerHead,
      groundMesh: ground,
      skybox,
      sun,
      ambient,
      worldMeshes,
      monsterMeshes,
      spiritMeshes,
      campfireLight: null,
      campfireMesh: null,
      shelterMesh: null,
    };

    // Generate and populate world
    const world = generateWorld();
    const gs = stateRef.current;
    gs.worldObjects = world.objects;
    gs.monsters = world.monsters.map((mon) => ({ ...mon }));
    gs.spirits = world.spirits.map((sp) => ({ ...sp }));

    spawnWorldMeshes(scene, gs.worldObjects, worldMeshes);

    for (const mon of gs.monsters) {
      const mesh = buildMonsterMesh(scene, mon.id, mon.kind, mon.x, mon.z);
      mesh.isVisible = false;
      monsterMeshes.set(mon.id, mesh);
    }
    for (const sp of gs.spirits) {
      const mesh = buildSpiritMesh(scene, sp.id, sp.x, sp.z);
      spiritMeshes.set(sp.id, mesh);
    }

    // Keyboard
    const onKeyDown = (e: KeyboardEvent) => keysRef.current.add(e.key.toLowerCase());
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    scene.onKeyboardObservable.add((info) => {
      if (
        info.type === BABYLON.KeyboardEventTypes.KEYDOWN &&
        info.event.key.toLowerCase() === "t"
      ) {
        const g = stateRef.current;
        if (g.nearTrader && !g.showTrader && !g.gameOver) {
          g.showTrader = true;
          syncHUD();
        }
      }
    });

    // Pointer interactions
    scene.onPointerObservable.add((info) => {
      if (info.type !== BABYLON.PointerEventTypes.POINTERTAP) return;
      const pick = scene.pick(scene.pointerX, scene.pointerY);
      if (!pick.hit || !pick.pickedMesh) return;
      const meshName = pick.pickedMesh.name;
      const g = stateRef.current;
      const p = g.player;

      for (const sp of g.spirits) {
        if (meshName === `spirit_${sp.id}` && sp.visible) {
          g.activeClue = sp.clue.text;
          sp.read = true;
          g.spiritsRead = g.spirits.filter((s) => s.read).length;
          if (g.spiritsRead >= 3) g.flags.add("spirits_3");
          addScore(g, 25);
          syncHUD();
          return;
        }
      }

      if (meshName === "trader" || meshName === "traderHead") {
        const traderObj = g.worldObjects.find((o) => o.kind === "trader");
        if (traderObj && dist2d(p.x, p.z, traderObj.x, traderObj.z) < INTERACT_RADIUS + 2) {
          g.showTrader = true;
          syncHUD();
        } else {
          addMessage(g, "Get closer to the trader!", "warning");
          syncHUD();
        }
      }
    });

    // ── Main game loop ─────────────────────────────────────────────────────
    let lastTime = performance.now();
    let hudTimer = 0;
    let messageTimer = 0;
    let nightSurvivedChecked = false;

    scene.onBeforeRenderObservable.add(() => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const g = stateRef.current;
      if (g.gameOver) return;

      const m = meshesRef.current;
      if (!m) return;

      // Time advance
      g.time += dt / DAY_DURATION;
      if (g.time >= 1) {
        g.time -= 1;
        g.dayCount++;
        nightSurvivedChecked = false;
      }
      const prevTod = g.timeOfDay;
      g.timeOfDay = computeTimeOfDay(g.time);
      const night = g.timeOfDay === "night";

      if (prevTod === "night" && g.timeOfDay === "dawn" && !nightSurvivedChecked) {
        nightSurvivedChecked = true;
        g.flags.add("night_survived");
        addMessage(g, "☀️ You survived the night!", "quest");
        addScore(g, 50);
      }

      // Sky colour
      const t = g.time;
      let skyR: number, skyG: number, skyB: number, ambI: number, sunI: number;
      if (t < 0.1 || t >= 0.95) {
        skyR = 0.02; skyG = 0.03; skyB = 0.12; ambI = 0.15; sunI = 0.0;
      } else if (t < 0.2) {
        const p2 = (t - 0.1) / 0.1;
        skyR = 0.02 + p2 * 0.6; skyG = 0.03 + p2 * 0.35; skyB = 0.12 + p2 * 0.4;
        ambI = 0.15 + p2 * 0.65; sunI = p2 * 1.5;
      } else if (t < 0.75) {
        skyR = 0.4; skyG = 0.65; skyB = 0.9; ambI = 0.8; sunI = 1.5;
      } else if (t < 0.95) {
        const p2 = (t - 0.75) / 0.2;
        skyR = 0.4 + p2 * 0.3; skyG = 0.65 - p2 * 0.4; skyB = 0.9 - p2 * 0.7;
        ambI = 0.8 - p2 * 0.65; sunI = 1.5 - p2 * 1.5;
      } else {
        skyR = 0.02; skyG = 0.03; skyB = 0.12; ambI = 0.15; sunI = 0.0;
      }
      (m.skybox.material as BABYLON.StandardMaterial).emissiveColor.set(skyR, skyG, skyB);
      scene.clearColor.set(skyR * 0.5, skyG * 0.5, skyB * 0.5, 1);
      m.ambient.intensity = ambI;
      m.sun.intensity = sunI;

      // Player movement
      const keys = keysRef.current;
      let dx = 0, dz = 0;
      if (keys.has("w") || keys.has("arrowup")) dz -= 1;
      if (keys.has("s") || keys.has("arrowdown")) dz += 1;
      if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
      if (keys.has("d") || keys.has("arrowright")) dx += 1;
      if (dx !== 0 || dz !== 0) {
        const len = Math.sqrt(dx * dx + dz * dz);
        dx = (dx / len) * PLAYER_SPEED * dt;
        dz = (dz / len) * PLAYER_SPEED * dt;
        g.player.x = Math.max(-95, Math.min(95, g.player.x + dx));
        g.player.z = Math.max(-95, Math.min(95, g.player.z + dz));
      }
      m.playerBody.position.set(g.player.x, 0.9, g.player.z);
      m.playerHead.position.set(g.player.x, 2.1, g.player.z);
      camera.target.set(g.player.x, 1, g.player.z);

      // Hunger drain
      g.player.hunger = Math.max(0, g.player.hunger - (HUNGER_DRAIN_RATE / 60) * dt);
      if (g.player.hunger <= 0) {
        g.player.hp = Math.max(0, g.player.hp - 3 * dt);
      }

      // Campfire healing
      if (g.player.hasCampfire && m.campfireMesh) {
        const cfx = m.campfireMesh.position.x;
        const cfz = m.campfireMesh.position.z;
        const nearFire = dist2d(g.player.x, g.player.z, cfx, cfz) < REGEN_RADIUS;
        g.nearCampfire = nearFire;
        if (nearFire) g.player.hp = Math.min(g.player.maxHp, g.player.hp + CAMPFIRE_REGEN * dt);
      } else {
        g.nearCampfire = false;
      }

      // Shelter proximity
      if (g.player.hasShelter) {
        g.nearShelter = dist2d(g.player.x, g.player.z, 0, 0) < REGEN_RADIUS + 2;
        if (g.nearShelter) {
          g.player.hp = Math.min(g.player.maxHp, g.player.hp + 2 * dt);
          g.player.hunger = Math.min(100, g.player.hunger + 1 * dt);
        }
      } else {
        g.nearShelter = false;
      }

      // Resource respawn
      const nowMs = Date.now();
      for (const obj of g.worldObjects) {
        if (
          obj.depleted &&
          obj.depletedAt !== undefined &&
          nowMs - obj.depletedAt > RESOURCE_RESPAWN * 1000
        ) {
          obj.depleted = false;
          obj.depletedAt = undefined;
          const mesh = m.worldMeshes.get(obj.id);
          if (mesh) mesh.isVisible = true;
        }
      }

      // Proximity flags for landmarks
      const cabinObj = g.worldObjects.find((o) => o.kind === "cabin");
      if (cabinObj && !g.flags.has("cabin_found") && dist2d(g.player.x, g.player.z, cabinObj.x, cabinObj.z) < 8) {
        g.flags.add("cabin_found");
        addMessage(g, "🏚️ Found the abandoned cabin!", "quest");
        addScore(g, 30);
      }

      const caveObj = g.worldObjects.find((o) => o.kind === "cave");
      if (caveObj && !g.flags.has("cave_found") && dist2d(g.player.x, g.player.z, caveObj.x, caveObj.z) < 8) {
        g.flags.add("cave_found");
        addMessage(g, "🕳️ Discovered the cave entrance!", "quest");
        addScore(g, 30);
      }

      const ruinsObj = g.worldObjects.find((o) => o.kind === "ruins");
      if (ruinsObj && !g.flags.has("ruins_found") && dist2d(g.player.x, g.player.z, ruinsObj.x, ruinsObj.z) < 10) {
        g.flags.add("ruins_found");
        addMessage(g, "🏛️ You found the ancient ruins!", "quest");
        addScore(g, 30);
      }

      const villageObj = g.worldObjects.find((o) => o.kind === "village");
      if (villageObj && !g.flags.has("village_found") && dist2d(g.player.x, g.player.z, villageObj.x, villageObj.z) < 10) {
        g.flags.add("village_found");
        addMessage(g, "🏘️ You found the abandoned village!", "quest");
        addScore(g, 30);
      }

      // Trader proximity
      const traderObj = g.worldObjects.find((o) => o.kind === "trader");
      g.nearTrader = !!(traderObj && dist2d(g.player.x, g.player.z, traderObj.x, traderObj.z) < INTERACT_RADIUS + 2);

      // Spirits: show at night, hide at day
      for (const sp of g.spirits) {
        sp.visible = night;
        const mesh = m.spiritMeshes.get(sp.id);
        if (mesh) {
          mesh.isVisible = sp.visible;
          // Float up and down
          mesh.position.y = 2.5 + Math.sin(now * 0.002 + sp.x) * 0.3;
        }
      }

      // Monster AI
      for (const mon of g.monsters) {
        const mesh = m.monsterMeshes.get(mon.id);

        // Monsters only active at night (or always for beast/goblin during day with lower chance)
        const monsterActive = night || mon.kind === "beast" || mon.kind === "goblin";
        if (mesh) mesh.isVisible = monsterActive;
        if (!monsterActive) continue;

        if (mon.stunned > 0) {
          mon.stunned -= dt;
          continue;
        }

        const d = dist2d(g.player.x, g.player.z, mon.x, mon.z);

        // Campfire repels monsters
        let repelledByFire = false;
        if (g.player.hasCampfire && m.campfireMesh) {
          const cfx = m.campfireMesh.position.x;
          const cfz = m.campfireMesh.position.z;
          const fireDist = dist2d(mon.x, mon.z, cfx, cfz);
          if (fireDist < 12) repelledByFire = true;
        }

        // Lantern repels wraits
        const repelledByLantern = g.player.hasLantern && mon.kind === "wraith" && d < 10;

        if (repelledByFire || repelledByLantern) {
          mon.chasing = false;
          mon.retreating = true;
        } else if (d < mon.alertRadius) {
          mon.chasing = true;
          mon.retreating = false;
        } else if (d > mon.chaseRadius) {
          mon.chasing = false;
        }

        const speed = mon.kind === "wraith" ? WRAITH_SPEED : MONSTER_SPEED;

        if (mon.retreating) {
          // Move away from player
          const rdx = mon.x - g.player.x;
          const rdz = mon.z - g.player.z;
          const rlen = Math.sqrt(rdx * rdx + rdz * rdz) || 1;
          mon.x += (rdx / rlen) * speed * dt;
          mon.z += (rdz / rlen) * speed * dt;
          if (dist2d(g.player.x, g.player.z, mon.x, mon.z) > mon.chaseRadius + 5) {
            mon.retreating = false;
          }
        } else if (mon.chasing) {
          const cdx = g.player.x - mon.x;
          const cdz = g.player.z - mon.z;
          const clen = Math.sqrt(cdx * cdx + cdz * cdz) || 1;
          mon.x += (cdx / clen) * speed * dt;
          mon.z += (cdz / clen) * speed * dt;
        }

        if (mesh) mesh.position.set(mon.x, 1, mon.z);

        // Damage player on contact
        if (d < 1.5 && g.player.invincibleTimer <= 0) {
          const dmg = mon.kind === "wraith" ? 15 : mon.kind === "beast" ? 20 : 10;
          g.player.hp = Math.max(0, g.player.hp - dmg);
          g.player.invincibleTimer = 1.5;
          addMessage(g, `⚠️ ${mon.kind} attacks! -${dmg} HP`, "danger");
          // Knock monster back
          mon.stunned = 0.5;
          mon.chasing = false;
        }
      }

      // Invincibility timer
      if (g.player.invincibleTimer > 0) g.player.invincibleTimer -= dt;

      // Game over
      if (g.player.hp <= 0) {
        g.gameOver = true;
        saveHighScore(g.score);
      }

      // Message expiry
      messageTimer += dt * 1000;
      if (messageTimer > 200) {
        messageTimer = 0;
        const now2 = Date.now();
        g.messages = g.messages.filter((msg) => msg.expires > now2);
      }

      // Quest checks
      const { updated, newlyCompleted } = checkQuests(g.quests, g.inventory, g.flags);
      g.quests = updated;
      for (const q of newlyCompleted) {
        if (q.reward && q.reward.count > 0) {
          addInventory(g, q.reward.type, q.reward.count);
          addMessage(g, `✅ Quest done: ${q.title}! +${q.reward.count} ${q.reward.type}`, "quest");
        } else {
          addMessage(g, `✅ Quest done: ${q.title}!`, "quest");
        }
        addScore(g, 50);
        if (q.unlockFlag) g.flags.add(q.unlockFlag);
      }

      // HUD sync throttle
      hudTimer += dt;
      if (hudTimer > 0.1) {
        hudTimer = 0;
        syncHUD();
      }
    });

    engine.runRenderLoop(() => scene.render());

    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      engine.dispose();
    };
  }, [syncHUD]);

  return (
    <Shell>
      <div className="relative w-full h-full">
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
      </div>
    </Shell>
  );
}
