import * as THREE from 'three';

const MAP_HALF_SIZE = 100;
const EDGE_MARGIN = 5;
const EYE_HEIGHT = 1.6;
const PICKUP_RADIUS = 2.2;
const NPC_PICKUP_RADIUS = 1.6;
const ITEMS_PER_TYPE = 15;
const WIN_THRESHOLD = 12;
const MIN_ITEM_SPACING = 4;
const BOB_AMPLITUDE = 0.15;
const BOB_SPEED = 2;
const ROTATE_SPEED = 1.2;
const NPC_SPEED_MIN = 3.5;
const NPC_SPEED_MAX = 5;
const PITCH_LIMIT = Math.PI / 2 - 0.05;
const DEFAULT_MOUSE_SENSITIVITY = 0.0022;
const DEFAULT_MOVE_SPEED = 12;
const COINS_KEY = 'elementopia_coins';
const UPGRADES_KEY = 'elementopia_upgrades';
const SHOP_SPEED_BOOST_COST = 200;
const SHOP_SPEED_BOOST_MULTIPLIER = 1.1;
const SHOP_DOUBLE_ELEMENT_COST = 500;
const SHOP_JUMP_COST = 100;
const SHOP_DOUBLE_JUMP_COST = 300;
const SHOP_MINION_COST = 500;
const SHOP_SWIMMING_COST = 250;
const TORNADO_SPEED = 3;
const TORNADO_CHASE_SPEED = 7;
const TORNADO_DETECT_RADIUS = 30;
const TORNADO_RADIUS = 4;
const TORNADO_KNOCKBACK_FORCE = 60;
const TORNADO_KNOCKBACK_COOLDOWN = 1.5;
let tornado = null;
let tornadoTexture = null;
let smokeTexture;
const knockbackVelocity = { x: 0, z: 0 };

const GATE_COST = 1000;
const GATE_X = MAP_HALF_SIZE;
const GATE_INTERACT_DISTANCE = 4;
const WALL_CLEAR_HEIGHT = 9;
const DESERT_WIDTH = 150;
let nearGate = false;
let gateBarrier = null;
let boundaryWallSegments = [];
const JUMP_SPEED = 12;
const GRAVITY = 18;

const TREE_TRUNK_HEIGHT = 0.16;
const TREE_TIERS = [
  { radius: 0.2, height: 0.26, y: TREE_TRUNK_HEIGHT + 0.1 },
  { radius: 0.15, height: 0.22, y: TREE_TRUNK_HEIGHT + 0.24 },
  { radius: 0.1, height: 0.17, y: TREE_TRUNK_HEIGHT + 0.36 },
];
const TREE_CENTER_OFFSET = (TREE_TRUNK_HEIGHT + TREE_TIERS[TREE_TIERS.length - 1].y) / 2;
const GIANT_TREE_COUNT = 40;
const GIANT_TREE_MIN_SCALE = 5;
const GIANT_TREE_MAX_SCALE = 11;

const LAKE_RADIUS = 20;
const LAKE_SHORE_WIDTH = 10;
const LAKE_WATER_LEVEL = 0.05;
const LAKE_BED_DEPTH = 1.5;
const LAKE_EXCLUSION_RADIUS = LAKE_RADIUS + 3;
const GIANT_TREE_EXCLUSION_RADIUS = LAKE_RADIUS + 4;
const SPAWN_Z = LAKE_RADIUS + LAKE_SHORE_WIDTH + 5;

function isInsideLake(x, z) {
  return Math.hypot(x, z) < LAKE_EXCLUSION_RADIUS;
}

function pushOutsideLake(x, z) {
  const dist = Math.hypot(x, z);
  if (dist >= LAKE_RADIUS || dist === 0) return [x, z];
  const scale = LAKE_RADIUS / dist;
  return [x * scale, z * scale];
}

function baseTerrainHeight(x, z) {
  return Math.sin(x * 0.025) * Math.cos(z * 0.025) * 3 + Math.sin(x * 0.06 + 2) * Math.cos(z * 0.05 - 1) * 1.2;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function desertTerrainHeight(x, z) {
  return Math.sin(x * 0.04) * Math.cos(z * 0.05) * 1.2 + Math.sin(x * 0.1 + z * 0.08) * 0.4;
}

function terrainHeight(x, z) {
  if (x > MAP_HALF_SIZE) return desertTerrainHeight(x, z);

  const dist = Math.hypot(x, z);
  const blendEnd = LAKE_RADIUS + LAKE_SHORE_WIDTH;

  // Inside the lake: a bowl that meets the water's surface height exactly at the shoreline,
  // so the water plane's rim never floats above or sinks below the ground.
  if (dist <= LAKE_RADIUS) {
    const smooth = smoothstep(dist / LAKE_RADIUS);
    return THREE.MathUtils.lerp(-LAKE_BED_DEPTH, LAKE_WATER_LEVEL, smooth);
  }

  if (dist >= blendEnd) return baseTerrainHeight(x, z);

  const t = (dist - LAKE_RADIUS) / LAKE_SHORE_WIDTH;
  const smooth = smoothstep(t);
  return THREE.MathUtils.lerp(LAKE_WATER_LEVEL, baseTerrainHeight(x, z), smooth);
}

let flameTexture;
let waterTexture;
let windTexture;
let waveTexture;
let lakeWaves = [];
const WAVE_COUNT = 22;
const WAVE_SCALE = 0.5;

let treeFlames = [];
const TREE_FIRE_CHANCE = 0.1;
const TREE_FIRE_FLAME_MIN = 2;
const TREE_FIRE_FLAME_MAX = 4;
const FLAME_SCALE = 1.15;

const NPC_HEAD_SIZE = 0.45;
const NPC_BODY_WIDTH = 0.5;
const NPC_BODY_HEIGHT = 0.7;
const NPC_BODY_DEPTH = 0.25;
const NPC_LIMB_WIDTH = 0.25;
const NPC_LIMB_HEIGHT = 0.65;
const NPC_LIMB_DEPTH = 0.25;
const NPC_TOTAL_HEIGHT = NPC_LIMB_HEIGHT + NPC_BODY_HEIGHT + NPC_HEAD_SIZE;
const NPC_CENTER_OFFSET = NPC_TOTAL_HEIGHT / 2;
const NPC_SCALE = 1.25;
const NPC_WALK_SWING = 0.7;
const NPC_WALK_CYCLE_SPEED = 3;
const NPC_TURN_SPEED = 2.2;

const HOUSE_INSET = 20;
const HOUSE_EXCLUSION_RADIUS = 14;
const HOUSE_OFFSET = MAP_HALF_SIZE - HOUSE_INSET;
const HOUSE_CORNERS = [
  { x: HOUSE_OFFSET, z: HOUSE_OFFSET, typeId: 'flame' },
  { x: -HOUSE_OFFSET, z: HOUSE_OFFSET, typeId: 'water' },
  { x: HOUSE_OFFSET, z: -HOUSE_OFFSET, typeId: 'nature' },
  { x: -HOUSE_OFFSET, z: -HOUSE_OFFSET, typeId: 'wind' },
];

function isNearHouse(x, z) {
  return HOUSE_CORNERS.some((corner) => Math.hypot(x - corner.x, z - corner.z) < HOUSE_EXCLUSION_RADIUS);
}

const HOUSE_WALL_SIZE = 6;
const HOUSE_WALL_HEIGHT = 4;
const HOUSE_WALL_THICKNESS = 0.3;
const HOUSE_DOOR_WIDTH = 1.8;
const HOUSE_DOOR_HEIGHT = 2.6;
const HOUSE_PLAYER_RADIUS = 0.4;
const SHOP_INTERACT_DISTANCE = 3;

function getHouseWallSegments() {
  const half = HOUSE_WALL_SIZE / 2;
  const t = HOUSE_WALL_THICKNESS;
  const sideWidth = (HOUSE_WALL_SIZE - HOUSE_DOOR_WIDTH) / 2;
  return [
    { cx: 0, cz: -half + t / 2, hw: half, hd: t / 2 },
    { cx: -half + t / 2, cz: 0, hw: t / 2, hd: half },
    { cx: half - t / 2, cz: 0, hw: t / 2, hd: half },
    { cx: -half + sideWidth / 2, cz: half - t / 2, hw: sideWidth / 2, hd: t / 2 },
    { cx: half - sideWidth / 2, cz: half - t / 2, hw: sideWidth / 2, hd: t / 2 },
  ];
}

const HOUSE_WALL_SEGMENTS = getHouseWallSegments();
let houses = [];
let shopLabelTexture;

function resolveHouseCollision(x, z) {
  for (const house of houses) {
    const relative = new THREE.Vector3(x - house.x, 0, z - house.z).applyEuler(new THREE.Euler(0, -house.rotation, 0));
    for (const seg of HOUSE_WALL_SEGMENTS) {
      const dx = relative.x - seg.cx;
      const dz = relative.z - seg.cz;
      const overlapX = seg.hw + HOUSE_PLAYER_RADIUS - Math.abs(dx);
      const overlapZ = seg.hd + HOUSE_PLAYER_RADIUS - Math.abs(dz);
      if (overlapX <= 0 || overlapZ <= 0) continue;
      if (overlapX < overlapZ) {
        relative.x = seg.cx + Math.sign(dx || 1) * (seg.hw + HOUSE_PLAYER_RADIUS);
      } else {
        relative.z = seg.cz + Math.sign(dz || 1) * (seg.hd + HOUSE_PLAYER_RADIUS);
      }
    }
    const resolved = relative.applyEuler(new THREE.Euler(0, house.rotation, 0));
    x = resolved.x + house.x;
    z = resolved.z + house.z;
  }
  return [x, z];
}

const ITEM_TYPES = [
  { id: 'flame', label: 'Flame', emoji: '🔥', color: 0xff0000, createObject: () => createFlameSprite() },
  { id: 'water', label: 'Water', emoji: '💧', color: 0x0000ff, createObject: () => createWaterSprite() },
  { id: 'nature', label: 'Nature', emoji: '🍃', color: 0x00ff00, createObject: () => createTreeMesh() },
  { id: 'wind', label: 'Wind', emoji: '🌬️', color: 0xffffff, createObject: () => createWindSprite() },
];

function getType(id) {
  return ITEM_TYPES.find((t) => t.id === id);
}

let scene, camera, renderer, clock;
let yaw = 0;
let pitch = 0;
let activeItems = [];
let npcs = [];
let running = true;

let gameState = 'WELCOME'; // WELCOME | IDLE | SELECT | PLAYING | PAUSED | SETTINGS | SHOP | WON | LOST | QUIT
let previousState = 'SELECT';
let playerChosenType = null;
let playerRemaining = 0;
let lastResultNpc = null;
let coins = loadCoins();
let upgrades = loadUpgrades();
let nearShop = false;
let chatOpen = false;
let playerJumpOffset = 0;
let playerVerticalVelocity = 0;
let usedDoubleJump = false;
let minion = null;
let playerBody = null;
const PLAYER_SKIN_COLOR = 0xf0c090;
const PLAYER_BODY_SCALE = 0.85;
const LEG_FORWARD_OFFSET = 0.25;

let mouseSensitivity = DEFAULT_MOUSE_SENSITIVITY;
let moveSpeed = DEFAULT_MOVE_SPEED;

const move = { forward: false, backward: false, left: false, right: false };

await init();
requestAnimationFrame(animate);

async function init() {
  initScene();
  initCamera();
  initRenderer();
  initLights();

  flameTexture = await loadFlameTexture();
  waterTexture = await loadWaterTexture();
  waveTexture = await loadWaveTexture();
  tornadoTexture = await loadTornadoTexture();

  initGround();
  initLake();
  spawnElementHouses();
  spawnGiantTrees();
  spawnGate();
  spawnBoundaryWall();
  initDesertGround();
  spawnDesertDecor();
  spawnDesertWalls();
  spawnDesertHouses();
  initTornado();
  initPlayerBody();
  initPointerLock();
  bindKeys();
  bindTopBar();
  bindOverlayEvents();

  clock = new THREE.Clock();
  window.addEventListener('resize', onWindowResize);

  refreshCoinDisplay();
  updateUI();
}

// --- Scene setup ---

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 30, 120);
}

function initCamera() {
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, terrainHeight(0, SPAWN_Z) + EYE_HEIGHT, SPAWN_Z);
}

function initRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.getElementById('app').appendChild(renderer.domElement);
}

function initLights() {
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(50, 80, 30);
  scene.add(dirLight);
}

function initGround() {
  const segments = 100;
  const geometry = new THREE.PlaneGeometry(MAP_HALF_SIZE * 2, MAP_HALF_SIZE * 2, segments, segments);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const yLocal = position.getY(i);
    // PlaneGeometry lies flat in local XY before rotation; after rotation.x = -90deg,
    // local Z becomes world height and local Y becomes -worldZ, so sample with that flip.
    position.setZ(i, terrainHeight(x, -yLocal));
  }
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({ color: 0x4caf50 });
  const ground = new THREE.Mesh(geometry, material);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
}

function initLake() {
  const geometry = new THREE.CircleGeometry(LAKE_RADIUS, 48);
  const material = new THREE.MeshStandardMaterial({ color: 0x2f7bbf, transparent: true, opacity: 0.85 });
  const water = new THREE.Mesh(geometry, material);
  water.rotation.x = -Math.PI / 2;
  water.position.y = LAKE_WATER_LEVEL;
  scene.add(water);

  spawnLakeWaves();
}

async function loadWaveTexture() {
  const img = await loadImage('assets/wave.svg');
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, size * 0.05, size * 0.05, size * 0.9, size * 0.9);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function spawnLakeWaves() {
  for (let i = 0; i < WAVE_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * LAKE_RADIUS * 0.75;
    const baseX = Math.cos(angle) * dist;
    const baseZ = Math.sin(angle) * dist;
    const material = new THREE.SpriteMaterial({ map: waveTexture, transparent: true, depthWrite: false, opacity: 0.85 });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(WAVE_SCALE, WAVE_SCALE, 1);
    sprite.position.set(baseX, LAKE_WATER_LEVEL + 0.02, baseZ);
    scene.add(sprite);
    lakeWaves.push({
      sprite,
      baseX,
      baseZ,
      driftAngle: Math.random() * Math.PI * 2,
      driftAmplitude: WAVE_SCALE * (0.6 + Math.random() * 0.5),
      driftSpeed: 0.5 + Math.random() * 0.4,
      bobOffset: Math.random() * Math.PI * 2,
    });
  }
}

function animateLakeWaves(elapsed) {
  for (const wave of lakeWaves) {
    const drift = Math.sin(elapsed * wave.driftSpeed + wave.bobOffset) * wave.driftAmplitude;
    wave.sprite.position.x = wave.baseX + Math.cos(wave.driftAngle) * drift;
    wave.sprite.position.z = wave.baseZ + Math.sin(wave.driftAngle) * drift;

    const pulse = 1 + Math.sin(elapsed * 1.4 + wave.bobOffset) * 0.15;
    wave.sprite.scale.set(WAVE_SCALE * pulse, WAVE_SCALE * pulse, 1);
  }
}

function createBurningFlame(scale) {
  const material = new THREE.SpriteMaterial({
    map: flameTexture,
    transparent: true,
    depthWrite: false,
    opacity: 0.8,
    color: 0xffddaa,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(FLAME_SCALE * scale, FLAME_SCALE * scale, 1);
  return sprite;
}

function maybeIgniteTree(tree) {
  if (Math.random() >= TREE_FIRE_CHANCE) return;
  const flameCount = TREE_FIRE_FLAME_MIN + Math.floor(Math.random() * (TREE_FIRE_FLAME_MAX - TREE_FIRE_FLAME_MIN + 1));
  for (let i = 0; i < flameCount; i++) {
    const tier = TREE_TIERS[Math.floor(Math.random() * TREE_TIERS.length)];
    const localY = tier.y - TREE_CENTER_OFFSET + (Math.random() - 0.5) * tier.height * 0.5;
    const angle = Math.random() * Math.PI * 2;
    const radius = tier.radius * (0.3 + Math.random() * 0.6);
    const scale = 0.22 + Math.random() * 0.16;
    const flame = createBurningFlame(scale);
    flame.position.set(Math.cos(angle) * radius, localY, Math.sin(angle) * radius);
    tree.add(flame);
    treeFlames.push({ sprite: flame, baseScale: scale, bobOffset: Math.random() * Math.PI * 2 });
  }
}

function animateTreeFlames(elapsed) {
  for (const flame of treeFlames) {
    const flicker = 1 + Math.sin(elapsed * 10 + flame.bobOffset) * 0.1 + Math.sin(elapsed * 23 + flame.bobOffset) * 0.06;
    const s = FLAME_SCALE * flame.baseScale * flicker;
    flame.sprite.scale.set(s, s, 1);
  }
}

function createShopLabelTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(20,20,20,0.85)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffd54f';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SHOP', canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createShopSign() {
  const group = new THREE.Group();

  const podium = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.5), new THREE.MeshStandardMaterial({ color: 0x7a5230 }));
  podium.position.y = 0.5;
  group.add(podium);

  if (!shopLabelTexture) shopLabelTexture = createShopLabelTexture();
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: shopLabelTexture, transparent: true, depthWrite: false }));
  label.scale.set(1.4, 0.53, 1);
  label.position.set(0, 1.55, 0);
  group.add(label);

  return group;
}

function createMinecraftHouse(roofColor) {
  const group = new THREE.Group();
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x9e9e9e });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: roofColor });
  const windowMaterial = new THREE.MeshStandardMaterial({ color: 0xbfe3f5 });

  const addWall = (width, height, depth, x, y, z) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMaterial);
    wall.position.set(x, y, z);
    group.add(wall);
  };

  const half = HOUSE_WALL_SIZE / 2;
  const t = HOUSE_WALL_THICKNESS;
  const sideWidth = (HOUSE_WALL_SIZE - HOUSE_DOOR_WIDTH) / 2;
  const midY = HOUSE_WALL_HEIGHT / 2;

  addWall(HOUSE_WALL_SIZE, HOUSE_WALL_HEIGHT, t, 0, midY, -half + t / 2);
  addWall(t, HOUSE_WALL_HEIGHT, HOUSE_WALL_SIZE, -half + t / 2, midY, 0);
  addWall(t, HOUSE_WALL_HEIGHT, HOUSE_WALL_SIZE, half - t / 2, midY, 0);
  addWall(sideWidth, HOUSE_WALL_HEIGHT, t, -half + sideWidth / 2, midY, half - t / 2);
  addWall(sideWidth, HOUSE_WALL_HEIGHT, t, half - sideWidth / 2, midY, half - t / 2);

  const lintelHeight = HOUSE_WALL_HEIGHT - HOUSE_DOOR_HEIGHT;
  if (lintelHeight > 0) {
    addWall(HOUSE_DOOR_WIDTH, lintelHeight, t, 0, HOUSE_DOOR_HEIGHT + lintelHeight / 2, half - t / 2);
  }

  const roofHeight = 2.6;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(HOUSE_WALL_SIZE * 0.78, roofHeight, 4), roofMaterial);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = HOUSE_WALL_HEIGHT + roofHeight / 2;
  group.add(roof);

  const windowGeometry = new THREE.BoxGeometry(0.9, 0.9, 0.12);
  for (const offset of [-1.9, 1.9]) {
    const window = new THREE.Mesh(windowGeometry, windowMaterial);
    window.position.set(offset, HOUSE_WALL_HEIGHT * 0.62, half + 0.06);
    group.add(window);
  }

  const shopSign = createShopSign();
  shopSign.position.set(0, 0, -half + 1.1);
  group.add(shopSign);

  return { group, shopSign };
}

function spawnBoundaryWall() {
  if (upgrades.desertGate) return;
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x6b6b6b });
  const wallHeight = 10;
  const thickness = 1;
  const gateHalfWidth = 4;
  const segmentLength = 20;

  const addRange = (rangeStart, rangeEnd) => {
    for (let z = rangeStart; z < rangeEnd; z += segmentLength) {
      const segStart = z;
      const segEnd = Math.min(z + segmentLength, rangeEnd);
      const length = segEnd - segStart;
      if (length <= 0) continue;
      const centerZ = (segStart + segEnd) / 2;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(thickness, wallHeight, length), wallMaterial);
      wall.position.set(MAP_HALF_SIZE, terrainHeight(MAP_HALF_SIZE, centerZ) + wallHeight / 2, centerZ);
      scene.add(wall);
      boundaryWallSegments.push(wall);
    }
  };

  addRange(-MAP_HALF_SIZE, -gateHalfWidth);
  addRange(gateHalfWidth, MAP_HALF_SIZE);
}

function clearBoundaryWall() {
  for (const segment of boundaryWallSegments) scene.remove(segment);
  boundaryWallSegments = [];
}

function spawnGateBarrier() {
  const barrierMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4423 });
  gateBarrier = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 6.5), barrierMaterial);
  gateBarrier.position.set(GATE_X, terrainHeight(GATE_X, 0) + 2.5, 0);
  scene.add(gateBarrier);
}

async function loadTornadoTexture() {
  const img = await loadImage('assets/tornado.svg');
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSmokeTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(190,190,190,0.75)');
  gradient.addColorStop(1, 'rgba(190,190,190,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function pickPuffHeight() {
  const roll = Math.random();
  if (roll < 0.55) return 0.2 + Math.random() * 1.4; // ground-hugging skirt
  if (roll < 0.8) return 2 + Math.random() * 8; // debris lifted mid-air
  return 13 + Math.random() * 5; // smoke swirling above the funnel's top
}

function createTornadoMesh() {
  const material = new THREE.SpriteMaterial({ map: tornadoTexture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  const aspect = tornadoTexture.image.width / tornadoTexture.image.height;
  const spriteHeight = 16;
  sprite.scale.set(spriteHeight * aspect, spriteHeight, 1);
  sprite.position.y = spriteHeight / 2;
  const group = new THREE.Group();
  group.add(sprite);

  if (!smokeTexture) smokeTexture = createSmokeTexture();
  const puffCount = 1504;
  const puffs = [];
  for (let i = 0; i < puffCount; i++) {
    const puffMaterial = new THREE.SpriteMaterial({ map: smokeTexture, transparent: true, depthWrite: false });
    const puffSprite = new THREE.Sprite(puffMaterial);
    const scale = 1.3 + Math.random() * 1.2;
    puffSprite.scale.set(scale, scale, 1);
    group.add(puffSprite);
    const baseY = pickPuffHeight();
    const radius = baseY > 12 ? 7 + Math.random() * 9 : 4 + Math.random() * 5;
    puffs.push({
      sprite: puffSprite,
      angle: Math.random() * Math.PI * 2,
      radius,
      orbitSpeed: 1.5 + Math.random() * 1.5,
      bobOffset: Math.random() * Math.PI * 2,
      baseY,
    });
  }

  return { group, sprite, puffs };
}

function pickTornadoTarget() {
  const bound = MAP_HALF_SIZE - EDGE_MARGIN;
  let x, z;
  do {
    x = (Math.random() * 2 - 1) * bound;
    z = (Math.random() * 2 - 1) * bound;
  } while (isInsideLake(x, z) || isNearHouse(x, z));
  tornado.targetX = x;
  tornado.targetZ = z;
}

function initTornado() {
  const { group, sprite, puffs } = createTornadoMesh();
  scene.add(group);
  tornado = { group, sprite, puffs, targetX: 0, targetZ: 0, lastHitTime: -Infinity };
  pickTornadoTarget();
  group.position.set(tornado.targetX, terrainHeight(tornado.targetX, tornado.targetZ), tornado.targetZ);
  pickTornadoTarget();
}

function updateTornado(delta, elapsed) {
  if (!tornado) return;

  const distToPlayerXZ = Math.hypot(camera.position.x - tornado.group.position.x, camera.position.z - tornado.group.position.z);
  const playerGrounded = playerJumpOffset <= 0;
  const isChasing = playerGrounded && distToPlayerXZ < TORNADO_DETECT_RADIUS;

  const targetX = isChasing ? camera.position.x : tornado.targetX;
  const targetZ = isChasing ? camera.position.z : tornado.targetZ;
  const speed = isChasing ? TORNADO_CHASE_SPEED : TORNADO_SPEED;

  const dx = targetX - tornado.group.position.x;
  const dz = targetZ - tornado.group.position.z;
  const dist = Math.hypot(dx, dz);
  if (!isChasing && dist < 2) {
    pickTornadoTarget();
  } else if (dist > 0.1) {
    tornado.group.position.x += (dx / dist) * speed * delta;
    tornado.group.position.z += (dz / dist) * speed * delta;
  }
  tornado.group.position.y = terrainHeight(tornado.group.position.x, tornado.group.position.z);
  tornado.sprite.position.y = 8 + Math.sin(elapsed * 1.2) * 0.8;
  tornado.sprite.material.opacity = 0.95 + Math.sin(elapsed * 0.8) * 0.05;

  for (const puff of tornado.puffs) {
    puff.angle += puff.orbitSpeed * delta;
    puff.sprite.position.set(
      Math.cos(puff.angle) * puff.radius,
      puff.baseY + Math.sin(elapsed * 1.5 + puff.bobOffset) * 0.3,
      Math.sin(puff.angle) * puff.radius
    );
  }

  if (distToPlayerXZ < TORNADO_RADIUS && elapsed - tornado.lastHitTime > TORNADO_KNOCKBACK_COOLDOWN) {
    tornado.lastHitTime = elapsed;
    const nx = (camera.position.x - tornado.group.position.x) / (distToPlayerXZ || 1);
    const nz = (camera.position.z - tornado.group.position.z) / (distToPlayerXZ || 1);
    knockbackVelocity.x = nx * TORNADO_KNOCKBACK_FORCE;
    knockbackVelocity.z = nz * TORNADO_KNOCKBACK_FORCE;
    playerVerticalVelocity = TORNADO_KNOCKBACK_FORCE * 0.4;
  }
}

function spawnGate() {
  const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0x8d8d8d });
  const pillarGeometry = new THREE.BoxGeometry(1.2, 6, 1.2);
  for (const z of [-3.5, 3.5]) {
    const pillar = new THREE.Mesh(pillarGeometry, stoneMaterial);
    pillar.position.set(GATE_X, terrainHeight(GATE_X, z) + 3, z);
    scene.add(pillar);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 8), stoneMaterial);
  lintel.position.set(GATE_X, terrainHeight(GATE_X, 0) + 6.2, 0);
  scene.add(lintel);

  if (!upgrades.desertGate) spawnGateBarrier();
}

function openGateBarrier() {
  if (gateBarrier) {
    scene.remove(gateBarrier);
    gateBarrier = null;
  }
}

function checkGateProximity() {
  const dist = Math.hypot(camera.position.x - GATE_X, camera.position.z);
  nearGate = !upgrades.desertGate && dist < GATE_INTERACT_DISTANCE;
  document.getElementById('gate-hint').classList.toggle('hidden', !nearGate);
}

function tryOpenGate() {
  if ((gameState !== 'PLAYING' && gameState !== 'IDLE') || !nearGate || upgrades.desertGate) return;
  previousState = gameState;
  gameState = 'GATE';
  if (document.pointerLockElement) document.exitPointerLock();
  updateUI();
}

function confirmOpenGate() {
  if (coins < GATE_COST) return;
  coins -= GATE_COST;
  upgrades.desertGate = true;
  saveCoins();
  saveUpgrades();
  refreshCoinDisplay();
  nearGate = false;
  document.getElementById('gate-hint').classList.add('hidden');
  openGateBarrier();
  clearBoundaryWall();
  closeGateMenu();
}

function closeGateMenu() {
  gameState = previousState === 'IDLE' ? 'IDLE' : 'PLAYING';
  updateUI();
  lockPointer();
}

function createCactus() {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0x4f7942 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 2.2, 8), material);
  trunk.position.y = 1.1;
  group.add(trunk);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 1, 8), material);
    arm.position.set(side * 0.35, 1.3, 0);
    arm.rotation.z = side * 0.5;
    group.add(arm);
  }
  return group;
}

function initDesertGround() {
  const segments = 60;
  const geometry = new THREE.PlaneGeometry(DESERT_WIDTH, MAP_HALF_SIZE * 2, segments, segments);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const localX = position.getX(i);
    const localY = position.getY(i);
    const worldX = MAP_HALF_SIZE + DESERT_WIDTH / 2 + localX;
    const worldZ = -localY;
    position.setZ(i, terrainHeight(worldX, worldZ));
  }
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({ color: 0xdcc07a });
  const ground = new THREE.Mesh(geometry, material);
  ground.rotation.x = -Math.PI / 2;
  ground.position.x = MAP_HALF_SIZE + DESERT_WIDTH / 2;
  scene.add(ground);
}

function spawnDesertWalls() {
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xb89968 });
  const wallHeight = 8;
  const thickness = 1.5;
  const segmentLength = 20;

  const addWallSegment = (x, z, rotationY) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(segmentLength, wallHeight, thickness), wallMaterial);
    wall.position.set(x, terrainHeight(x, z) + wallHeight / 2, z);
    wall.rotation.y = rotationY;
    scene.add(wall);
  };

  const eastX = MAP_HALF_SIZE + DESERT_WIDTH;
  for (let z = -MAP_HALF_SIZE + segmentLength / 2; z < MAP_HALF_SIZE; z += segmentLength) {
    addWallSegment(eastX, z, Math.PI / 2);
  }
  for (let x = MAP_HALF_SIZE + segmentLength / 2; x < MAP_HALF_SIZE + DESERT_WIDTH; x += segmentLength) {
    addWallSegment(x, MAP_HALF_SIZE, 0);
    addWallSegment(x, -MAP_HALF_SIZE, 0);
  }
}

function spawnDesertHouses() {
  const roofColor = 0xb5651d;
  const positions = [
    { x: MAP_HALF_SIZE + 40, z: 40 },
    { x: MAP_HALF_SIZE + 40, z: -40 },
    { x: MAP_HALF_SIZE + 100, z: 0 },
  ];
  for (const pos of positions) {
    const { group: house } = createMinecraftHouse(roofColor);
    house.position.set(pos.x, terrainHeight(pos.x, pos.z), pos.z);
    house.rotation.y = Math.random() * Math.PI * 2;
    scene.add(house);
  }
}

function spawnDesertDecor() {
  for (let i = 0; i < 30; i++) {
    const x = MAP_HALF_SIZE + 8 + Math.random() * (DESERT_WIDTH - 16);
    const z = (Math.random() * 2 - 1) * (MAP_HALF_SIZE - 5);
    const cactus = createCactus();
    cactus.position.set(x, terrainHeight(x, z), z);
    cactus.rotation.y = Math.random() * Math.PI * 2;
    cactus.scale.setScalar(0.8 + Math.random() * 0.6);
    scene.add(cactus);
  }
  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x9c8060 });
  for (let i = 0; i < 15; i++) {
    const x = MAP_HALF_SIZE + 8 + Math.random() * (DESERT_WIDTH - 16);
    const z = (Math.random() * 2 - 1) * (MAP_HALF_SIZE - 5);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + Math.random() * 0.8), rockMaterial);
    rock.position.set(x, terrainHeight(x, z), z);
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    scene.add(rock);
  }
}

function spawnElementHouses() {
  for (const corner of HOUSE_CORNERS) {
    const type = getType(corner.typeId);
    const { group: house } = createMinecraftHouse(type.color);
    const rotation = Math.atan2(-corner.x, -corner.z);
    house.position.set(corner.x, terrainHeight(corner.x, corner.z), corner.z);
    house.rotation.y = rotation;
    scene.add(house);

    const shopLocal = new THREE.Vector3(0, 0, -HOUSE_WALL_SIZE / 2 + 1.1).applyEuler(new THREE.Euler(0, rotation, 0));
    houses.push({
      x: corner.x,
      z: corner.z,
      rotation,
      shopX: corner.x + shopLocal.x,
      shopZ: corner.z + shopLocal.z,
    });
  }
}

function spawnGiantTrees() {
  const bound = MAP_HALF_SIZE - EDGE_MARGIN;
  for (let i = 0; i < GIANT_TREE_COUNT; i++) {
    let x, z;
    do {
      x = (Math.random() * 2 - 1) * bound;
      z = (Math.random() * 2 - 1) * bound;
    } while (Math.hypot(x, z) < GIANT_TREE_EXCLUSION_RADIUS || isNearHouse(x, z));

    const scale = GIANT_TREE_MIN_SCALE + Math.random() * (GIANT_TREE_MAX_SCALE - GIANT_TREE_MIN_SCALE);
    const tree = createTreeMesh();
    tree.scale.setScalar(scale);
    tree.rotation.y = Math.random() * Math.PI * 2;
    tree.position.set(x, terrainHeight(x, z) + TREE_CENTER_OFFSET * scale, z);
    maybeIgniteTree(tree);
    scene.add(tree);
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Look & movement (manual pointer lock, so sensitivity is adjustable) ---

function initPointerLock() {
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('pointerlockchange', onPointerLockChange);
  document.addEventListener('pointerlockerror', () => console.error('Pointer lock request was rejected by the browser'));
}

function onMouseMove(event) {
  if (document.pointerLockElement !== renderer.domElement) return;
  yaw -= event.movementX * mouseSensitivity;
  pitch -= event.movementY * mouseSensitivity;
  pitch = THREE.MathUtils.clamp(pitch, -PITCH_LIMIT, PITCH_LIMIT);
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
}

function onPointerLockChange() {
  // Ignore unlocks we triggered ourselves when a round already ended, a menu opened, or
  // chat was opened — gameState/chatOpen is switched before those calls, so this only fires
  // for an unexpected/user-driven unlock (Esc key) while actually playing or roaming.
  if (chatOpen) return;
  if (document.pointerLockElement !== renderer.domElement && (gameState === 'PLAYING' || gameState === 'IDLE')) {
    previousState = gameState;
    gameState = 'PAUSED';
    updateUI();
  }
}

function lockPointer() {
  renderer.domElement.requestPointerLock();
}

function bindKeys() {
  document.addEventListener('keydown', (event) => {
    if (chatOpen) {
      if (event.code === 'Escape') closeChat(false);
      return;
    }
    if (event.code === 'KeyT' && (gameState === 'PLAYING' || gameState === 'IDLE')) {
      event.preventDefault();
      openChat();
      return;
    }
    setMoveKey(event.code, true);
  });
  document.addEventListener('keyup', (event) => {
    if (chatOpen) return;
    setMoveKey(event.code, false);
  });

  const chatInput = document.getElementById('chat-input');
  chatInput.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.code === 'Enter') submitChat();
    else if (event.code === 'Escape') closeChat(false);
  });
}

function openChat() {
  chatOpen = true;
  move.forward = move.backward = move.left = move.right = false;
  if (document.pointerLockElement) document.exitPointerLock();
  const input = document.getElementById('chat-input');
  document.getElementById('chat').classList.remove('hidden');
  input.value = '';
  requestAnimationFrame(() => input.focus());
}

function closeChat(shouldSubmit) {
  const input = document.getElementById('chat-input');
  if (shouldSubmit) {
    const text = input.value.trim();
    if (text && !tryHandleChatCommand(text)) addChatLine(`You: ${text}`);
  }
  chatOpen = false;
  document.getElementById('chat').classList.add('hidden');
  input.blur();
  if (gameState === 'PLAYING' || gameState === 'IDLE') lockPointer();
}

function tryHandleChatCommand(text) {
  const match = text.match(/^\/player give coins\/:\/(\d+)\/:\/coins\/$/);
  if (!match) return false;
  const amount = parseInt(match[1], 10);
  coins += amount;
  saveCoins();
  refreshCoinDisplay();
  addChatLine(`✨ +${amount} 🪙`);
  return true;
}

function submitChat() {
  closeChat(true);
}

function addChatLine(text) {
  const log = document.getElementById('chat-log');
  const line = document.createElement('div');
  line.className = 'chat-line';
  line.textContent = text;
  log.appendChild(line);
  while (log.children.length > 6) log.removeChild(log.firstChild);
  setTimeout(() => line.remove(), 8000);
}

function setMoveKey(code, isDown) {
  switch (code) {
    case 'KeyW': case 'ArrowUp': move.forward = isDown; break;
    case 'KeyS': case 'ArrowDown': move.backward = isDown; break;
    case 'KeyA': case 'ArrowLeft': move.left = isDown; break;
    case 'KeyD': case 'ArrowRight': move.right = isDown; break;
    case 'Space': if (isDown) tryJump(); break;
    case 'KeyE': if (isDown) { tryOpenShop(); tryOpenGate(); } break;
    case 'Escape':
      if (isDown && gameState === 'SHOP') closeShop();
      else if (isDown && gameState === 'GATE') closeGateMenu();
      break;
  }
}

function tryOpenShop() {
  if ((gameState !== 'PLAYING' && gameState !== 'IDLE') || !nearShop) return;
  previousState = gameState;
  gameState = 'SHOP';
  if (document.pointerLockElement) document.exitPointerLock();
  updateUI();
}

function closeShop() {
  gameState = previousState === 'IDLE' ? 'IDLE' : 'PLAYING';
  updateUI();
  lockPointer();
}

function checkShopProximity() {
  nearShop = houses.some((house) => Math.hypot(camera.position.x - house.shopX, camera.position.z - house.shopZ) < SHOP_INTERACT_DISTANCE);
  document.getElementById('shop-hint').classList.toggle('hidden', !nearShop);
}

function updateMovement(delta) {
  const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, yaw, 0));
  const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, yaw, 0));
  const moveZ = Number(move.forward) - Number(move.backward);
  const moveX = Number(move.right) - Number(move.left);

  const step = new THREE.Vector3();
  step.addScaledVector(forward, moveZ);
  step.addScaledVector(right, moveX);
  if (step.lengthSq() > 0) step.normalize();

  camera.position.addScaledVector(step, getEffectiveMoveSpeed() * delta);
  camera.position.x += knockbackVelocity.x * delta;
  camera.position.z += knockbackVelocity.z * delta;
  knockbackVelocity.x *= 0.9;
  knockbackVelocity.z *= 0.9;

  // Only block passage near ground level — the boundary/gate walls are a
  // finite height, so a player launched high enough (e.g. by the tornado)
  // should be able to sail over them instead of hitting an invisible
  // ceiling that extends infinitely upward.
  if (playerJumpOffset < WALL_CLEAR_HEIGHT) {
    const maxX = upgrades.desertGate ? MAP_HALF_SIZE + DESERT_WIDTH : MAP_HALF_SIZE;
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -MAP_HALF_SIZE, maxX);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -MAP_HALF_SIZE, MAP_HALF_SIZE);
  }
  const canSwim = upgrades.swimming && playerChosenType === 'water';
  if (!canSwim) {
    [camera.position.x, camera.position.z] = pushOutsideLake(camera.position.x, camera.position.z);
  }
  [camera.position.x, camera.position.z] = resolveHouseCollision(camera.position.x, camera.position.z);

  if (upgrades.canJump || playerJumpOffset > 0 || playerVerticalVelocity !== 0) {
    playerVerticalVelocity -= GRAVITY * delta;
    playerJumpOffset += playerVerticalVelocity * delta;
    if (playerJumpOffset <= 0) {
      playerJumpOffset = 0;
      playerVerticalVelocity = 0;
      usedDoubleJump = false;
    }
  } else {
    playerJumpOffset = 0;
    playerVerticalVelocity = 0;
    usedDoubleJump = false;
  }

  let groundY = terrainHeight(camera.position.x, camera.position.z) + EYE_HEIGHT + playerJumpOffset;
  if (canSwim && Math.hypot(camera.position.x, camera.position.z) < LAKE_RADIUS) {
    groundY = Math.max(groundY, LAKE_WATER_LEVEL + 0.4);
  }
  camera.position.y = groundY;
}

function tryJump() {
  if (!upgrades.canJump || (gameState !== 'PLAYING' && gameState !== 'IDLE')) return;
  if (playerJumpOffset <= 0) {
    playerVerticalVelocity = JUMP_SPEED;
    usedDoubleJump = false;
  } else if (upgrades.doubleJump && !usedDoubleJump) {
    playerVerticalVelocity = JUMP_SPEED;
    usedDoubleJump = true;
  }
}

// --- Flame sprite texture (emoji-style flame artwork, loaded once) ---

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function loadFlameTexture() {
  const img = await loadImage('assets/flame.svg');
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.save();
  ctx.filter = 'blur(10px)';
  ctx.globalAlpha = 0.5;
  ctx.drawImage(img, size * 0.06, size * 0.06, size * 0.88, size * 0.88);
  ctx.restore();

  ctx.globalAlpha = 1;
  ctx.drawImage(img, size * 0.05, size * 0.05, size * 0.9, size * 0.9);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createFlameSprite() {
  const material = new THREE.SpriteMaterial({ map: flameTexture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(FLAME_SCALE, FLAME_SCALE, 1);
  return sprite;
}

// --- Water sprite texture (emoji-style droplet artwork, loaded once) ---

const WATER_SCALE = 0.85;

async function loadWaterTexture() {
  const img = await loadImage('assets/water.svg');
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, size * 0.15, size * 0.05, size * 0.7, size * 0.9);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createWaterSprite() {
  const material = new THREE.SpriteMaterial({ map: waterTexture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(WATER_SCALE, WATER_SCALE, 1);
  return sprite;
}

function createShapeMesh(geometry, color) {
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color }));
}

// --- Wind sprite texture (triple-spiral-in-a-circle emblem, drawn procedurally) ---

function windTailPoint(cx, cy, baseAngleDeg, maxLen, t) {
  const baseAngle = (baseAngleDeg * Math.PI) / 180;
  const totalSweep = (150 * Math.PI) / 180;
  const r = maxLen * t;
  const theta = baseAngle + totalSweep * t;
  return [cx + r * Math.cos(theta), cy + r * Math.sin(theta)];
}

function windSpiralPoints(cx, cy, baseAngleDeg, maxLen, maxWidth, n = 60) {
  const point = (t) => windTailPoint(cx, cy, baseAngleDeg, maxLen, t);
  const width = (t) => maxWidth * Math.pow(Math.sin((Math.min(t, 1) * Math.PI) / 2), 0.8);

  const left = [];
  const right = [];
  const eps = 0.001;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const [px, py] = point(t);
    const [p2x, p2y] = point(Math.min(t + eps, 1));
    const [p1x, p1y] = point(Math.max(t - eps, 0));
    const tx = p2x - p1x;
    const ty = p2y - p1y;
    const tl = Math.hypot(tx, ty) || 1;
    const nx = -ty / tl;
    const ny = tx / tl;
    const w = width(t);
    left.push([px + nx * w, py + ny * w]);
    right.push([px - nx * w, py - ny * w]);
  }

  // rounded cap at the tip — same normal formula as above so it lines up exactly
  const [tipX, tipY] = point(1);
  const [p2x, p2y] = point(1);
  const [p1x, p1y] = point(0.995);
  const tx = p2x - p1x;
  const ty = p2y - p1y;
  const tl = Math.hypot(tx, ty) || 1;
  const nx = -ty / tl;
  const ny = tx / tl;
  const capW = width(1);
  const capPts = [];
  const steps = 16;
  const startAngle = Math.atan2(ny, nx);
  for (let i = 0; i <= steps; i++) {
    const a = startAngle - Math.PI * (i / steps);
    capPts.push([tipX + capW * Math.cos(a), tipY + capW * Math.sin(a)]);
  }

  return [[cx, cy], ...left, ...capPts, ...right.slice().reverse()];
}

function createWindTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const cx = size * 0.5;
  const cy = size * 0.5;
  const outerR = size * 0.44;
  const color = 'rgb(255,255,255)';
  const tailLen = outerR * 0.72;
  const tailMaxWidth = outerR * 0.24;
  const holeT = 0.86;
  const holeR = tailMaxWidth * 0.42;

  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.018;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = color;
  for (let i = 0; i < 3; i++) {
    const angle = i * 120 - 90;
    const poly = windSpiralPoints(cx, cy, angle, tailLen, tailMaxWidth);
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let j = 1; j < poly.length; j++) ctx.lineTo(poly[j][0], poly[j][1]);
    ctx.closePath();
    ctx.fill();

    const [hx, hy] = windTailPoint(cx, cy, angle, tailLen, holeT);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(hx, hy, holeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createWindSprite() {
  if (!windTexture) windTexture = createWindTexture();
  const material = new THREE.SpriteMaterial({ map: windTexture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.9, 0.9, 1);
  return sprite;
}

function createTreeMesh() {
  const group = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.04, TREE_TRUNK_HEIGHT, 6),
    new THREE.MeshStandardMaterial({ color: 0x8d6e42 })
  );
  trunk.position.y = TREE_TRUNK_HEIGHT / 2 - TREE_CENTER_OFFSET;
  group.add(trunk);

  const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x3a8f3a });
  for (const tier of TREE_TIERS) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(tier.radius, tier.height, 8), foliageMaterial);
    cone.position.y = tier.y - TREE_CENTER_OFFSET;
    group.add(cone);
  }

  return group;
}

// --- Collectible items ---

function spawnItems() {
  for (const item of activeItems) scene.remove(item.object);
  activeItems = [];

  for (const type of ITEM_TYPES) {
    for (let i = 0; i < ITEMS_PER_TYPE; i++) {
      const position = findSpawnPosition();
      const object = type.createObject();
      object.position.copy(position);
      scene.add(object);
      activeItems.push({
        object,
        typeId: type.id,
        basePosition: position.clone(),
        bobOffset: Math.random() * Math.PI * 2,
      });
    }
  }
}

function findSpawnPosition() {
  const bound = MAP_HALF_SIZE - EDGE_MARGIN;
  let candidate;
  for (let attempt = 0; attempt < 20; attempt++) {
    const x = (Math.random() * 2 - 1) * bound;
    const z = (Math.random() * 2 - 1) * bound;
    candidate = new THREE.Vector3(x, terrainHeight(x, z) + 0.6, z);
    if (isInsideLake(x, z) || isNearHouse(x, z)) continue;
    const tooClose = activeItems.some((item) => item.basePosition.distanceTo(candidate) < MIN_ITEM_SPACING);
    if (!tooClose) return candidate;
  }
  return candidate;
}

function removeItem(item) {
  scene.remove(item.object);
  const index = activeItems.indexOf(item);
  if (index !== -1) activeItems.splice(index, 1);
}

function animateItems(elapsed, delta) {
  for (const item of activeItems) {
    item.object.position.y = item.basePosition.y + Math.sin(elapsed * BOB_SPEED + item.bobOffset) * BOB_AMPLITUDE;
    if (item.typeId === 'flame') {
      const flicker = 1 + Math.sin(elapsed * 10 + item.bobOffset) * 0.08 + Math.sin(elapsed * 23 + item.bobOffset) * 0.04;
      item.object.scale.set(FLAME_SCALE * flicker, FLAME_SCALE * flicker, 1);
    } else if (item.typeId === 'wind') {
      item.object.material.rotation += ROTATE_SPEED * delta;
    } else if (item.typeId === 'nature') {
      item.object.rotation.y += ROTATE_SPEED * delta;
    }
    // water: no extra animation — just the shared bob above, like the flame
  }
}

function checkPlayerCollisions() {
  for (let i = activeItems.length - 1; i >= 0; i--) {
    const item = activeItems[i];
    if (item.typeId !== playerChosenType) continue;
    if (camera.position.distanceTo(item.object.position) < PICKUP_RADIUS) {
      removeItem(item);
      playerRemaining = Math.max(0, playerRemaining - (upgrades.doubleElement ? 2 : 1));
      updateHUD();
      if (playerRemaining === 0) {
        triggerRoundWon();
        break;
      }
    }
  }
}

// --- Rival NPCs ---

function createSplitLimb(width, height, depth, topMaterial, bottomMaterial, jointY, offsetX) {
  const pivot = new THREE.Group();
  pivot.position.set(offsetX, jointY, 0);
  const halfHeight = height / 2;

  const upper = new THREE.Mesh(new THREE.BoxGeometry(width, halfHeight, depth), topMaterial);
  upper.position.y = -halfHeight / 2;
  pivot.add(upper);

  const lower = new THREE.Mesh(new THREE.BoxGeometry(width, halfHeight, depth), bottomMaterial);
  lower.position.y = -halfHeight - halfHeight / 2;
  pivot.add(lower);

  return pivot;
}

function createMinecraftCharacter(color) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color });
  const clothesMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4423 });

  const hipY = NPC_LIMB_HEIGHT - NPC_CENTER_OFFSET;
  const shoulderY = NPC_LIMB_HEIGHT + NPC_BODY_HEIGHT - NPC_CENTER_OFFSET;
  const bodyY = NPC_LIMB_HEIGHT + NPC_BODY_HEIGHT / 2 - NPC_CENTER_OFFSET;
  const headY = NPC_LIMB_HEIGHT + NPC_BODY_HEIGHT + NPC_HEAD_SIZE / 2 - NPC_CENTER_OFFSET;

  const head = new THREE.Mesh(new THREE.BoxGeometry(NPC_HEAD_SIZE, NPC_HEAD_SIZE, NPC_HEAD_SIZE), material);
  head.position.y = headY;
  group.add(head);

  const eyeMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.35) });
  const eyeSize = NPC_HEAD_SIZE * 0.15;
  const eyeZ = NPC_HEAD_SIZE / 2 + 0.01;
  const eyeSpacing = NPC_HEAD_SIZE * 0.22;
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(eyeSize, eyeSize, 0.02), eyeMaterial);
    eye.position.set(side * eyeSpacing, NPC_HEAD_SIZE * 0.05, eyeZ);
    head.add(eye);
  }

  const body = new THREE.Mesh(new THREE.BoxGeometry(NPC_BODY_WIDTH, NPC_BODY_HEIGHT, NPC_BODY_DEPTH), clothesMaterial);
  body.position.y = bodyY;
  group.add(body);

  const armOffsetX = NPC_BODY_WIDTH / 2 + NPC_LIMB_WIDTH / 2;
  const legOffsetX = NPC_LIMB_WIDTH / 2 + 0.02;

  const leftArm = createSplitLimb(NPC_LIMB_WIDTH, NPC_LIMB_HEIGHT, NPC_LIMB_DEPTH, clothesMaterial, material, shoulderY, -armOffsetX);
  const rightArm = createSplitLimb(NPC_LIMB_WIDTH, NPC_LIMB_HEIGHT, NPC_LIMB_DEPTH, clothesMaterial, material, shoulderY, armOffsetX);
  const leftLeg = createSplitLimb(NPC_LIMB_WIDTH, NPC_LIMB_HEIGHT, NPC_LIMB_DEPTH, clothesMaterial, material, hipY, -legOffsetX);
  const rightLeg = createSplitLimb(NPC_LIMB_WIDTH, NPC_LIMB_HEIGHT, NPC_LIMB_DEPTH, clothesMaterial, material, hipY, legOffsetX);
  group.add(leftArm, rightArm, leftLeg, rightLeg);

  group.scale.setScalar(NPC_SCALE);

  return { group, head, body, leftArm, rightArm, leftLeg, rightLeg };
}

function createNPC(typeId) {
  const type = getType(typeId);
  const character = createMinecraftCharacter(type.color);
  const mesh = character.group;
  const bound = MAP_HALF_SIZE - EDGE_MARGIN;
  let x, z;
  do {
    x = (Math.random() * 2 - 1) * bound;
    z = (Math.random() * 2 - 1) * bound;
  } while (isInsideLake(x, z) || isNearHouse(x, z));
  mesh.position.set(x, terrainHeight(x, z) + NPC_CENTER_OFFSET * NPC_SCALE, z);
  scene.add(mesh);
  return {
    mesh,
    leftArm: character.leftArm,
    rightArm: character.rightArm,
    leftLeg: character.leftLeg,
    rightLeg: character.rightLeg,
    walkPhase: Math.random() * Math.PI * 2,
    assignedType: typeId,
    remaining: WIN_THRESHOLD,
    targetItem: null,
    speed: NPC_SPEED_MIN + Math.random() * (NPC_SPEED_MAX - NPC_SPEED_MIN),
  };
}

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function turnToward(npc, targetAngle, delta) {
  const diff = normalizeAngle(targetAngle - npc.mesh.rotation.y);
  const maxStep = NPC_TURN_SPEED * delta;
  npc.mesh.rotation.y += Math.abs(diff) <= maxStep ? diff : Math.sign(diff) * maxStep;
}

function setNPCWalkPose(npc, swing) {
  npc.leftArm.rotation.x = swing;
  npc.rightArm.rotation.x = -swing;
  npc.leftLeg.rotation.x = -swing;
  npc.rightLeg.rotation.x = swing;
}

function initPlayerBody() {
  const character = createMinecraftCharacter(PLAYER_SKIN_COLOR);
  character.group.remove(character.head);
  character.group.remove(character.body);
  character.group.scale.setScalar(PLAYER_BODY_SCALE);
  scene.add(character.group);
  playerBody = { ...character, walkPhase: 0 };
}

function updatePlayerBody(delta) {
  if (!playerBody) return;
  const x = camera.position.x - Math.sin(yaw) * LEG_FORWARD_OFFSET;
  const z = camera.position.z - Math.cos(yaw) * LEG_FORWARD_OFFSET;
  playerBody.group.position.set(x, terrainHeight(x, z) + NPC_CENTER_OFFSET * PLAYER_BODY_SCALE + playerJumpOffset, z);
  playerBody.group.rotation.y = yaw;

  const isMoving = move.forward || move.backward || move.left || move.right;
  if (isMoving) {
    playerBody.walkPhase += delta * getEffectiveMoveSpeed() * NPC_WALK_CYCLE_SPEED * 0.3;
    setNPCWalkPose(playerBody, Math.sin(playerBody.walkPhase) * NPC_WALK_SWING);
  } else {
    setNPCWalkPose(playerBody, 0);
  }
}

function clearNPCs() {
  for (const npc of npcs) scene.remove(npc.mesh);
  npcs = [];
}

function clearMinion() {
  if (minion) scene.remove(minion.mesh);
  minion = null;
}

function updateMinion(delta) {
  if (!minion || gameState !== 'PLAYING') return;
  if (!minion.targetItem) {
    minion.targetItem = findNearestItem(minion.mesh.position, minion.assignedType);
    if (!minion.targetItem) return;
  }
  const targetPos = minion.targetItem.object.position;
  const dx = targetPos.x - minion.mesh.position.x;
  const dz = targetPos.z - minion.mesh.position.z;
  const dist = Math.hypot(dx, dz);
  if (dist < NPC_PICKUP_RADIUS) {
    setNPCWalkPose(minion, 0);
    removeItem(minion.targetItem);
    minion.targetItem = null;
    playerRemaining = Math.max(0, playerRemaining - 1);
    updateHUD();
    if (playerRemaining === 0) triggerRoundWon();
  } else {
    minion.mesh.position.x += (dx / dist) * minion.speed * delta;
    minion.mesh.position.z += (dz / dist) * minion.speed * delta;
    [minion.mesh.position.x, minion.mesh.position.z] = pushOutsideLake(minion.mesh.position.x, minion.mesh.position.z);
    [minion.mesh.position.x, minion.mesh.position.z] = resolveHouseCollision(minion.mesh.position.x, minion.mesh.position.z);
    minion.mesh.position.y = terrainHeight(minion.mesh.position.x, minion.mesh.position.z) + NPC_CENTER_OFFSET * NPC_SCALE;
    minion.walkPhase += delta * minion.speed * NPC_WALK_CYCLE_SPEED;
    setNPCWalkPose(minion, Math.sin(minion.walkPhase) * NPC_WALK_SWING);
    turnToward(minion, Math.atan2(dx / dist, dz / dist), delta);
  }
}

function findNearestItem(position, typeId) {
  let nearest = null;
  let nearestDist = Infinity;
  for (const item of activeItems) {
    if (item.typeId !== typeId) continue;
    const dist = position.distanceTo(item.object.position);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = item;
    }
  }
  return nearest;
}

function updateNPCs(delta) {
  for (const npc of npcs) {
    if (!npc.targetItem) {
      npc.targetItem = findNearestItem(npc.mesh.position, npc.assignedType);
      if (!npc.targetItem) continue;
    }
    const targetPos = npc.targetItem.object.position;
    const dx = targetPos.x - npc.mesh.position.x;
    const dz = targetPos.z - npc.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < NPC_PICKUP_RADIUS) {
      setNPCWalkPose(npc, 0);
      collectItemForNPC(npc, npc.targetItem);
      npc.targetItem = null;
    } else {
      npc.mesh.position.x += (dx / dist) * npc.speed * delta;
      npc.mesh.position.z += (dz / dist) * npc.speed * delta;
      [npc.mesh.position.x, npc.mesh.position.z] = pushOutsideLake(npc.mesh.position.x, npc.mesh.position.z);
      [npc.mesh.position.x, npc.mesh.position.z] = resolveHouseCollision(npc.mesh.position.x, npc.mesh.position.z);
      npc.mesh.position.y = terrainHeight(npc.mesh.position.x, npc.mesh.position.z) + NPC_CENTER_OFFSET * NPC_SCALE;
      npc.walkPhase += delta * npc.speed * NPC_WALK_CYCLE_SPEED;
      setNPCWalkPose(npc, Math.sin(npc.walkPhase) * NPC_WALK_SWING);
      turnToward(npc, Math.atan2(dx / dist, dz / dist), delta);
    }
  }
}

function collectItemForNPC(npc, item) {
  removeItem(item);
  npc.remaining--;
  updateHUD();
  if (npc.remaining === 0) triggerRoundLost(npc);
}

// --- Round flow ---

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function startRound(typeId) {
  playerChosenType = typeId;
  playerRemaining = WIN_THRESHOLD;
  lastResultNpc = null;

  clearNPCs();
  const otherTypes = shuffle(ITEM_TYPES.map((t) => t.id).filter((id) => id !== typeId));
  npcs = otherTypes.map((id) => createNPC(id));

  clearMinion();
  if (upgrades.minion) minion = createNPC(typeId);

  spawnItems();

  const corner = HOUSE_CORNERS.find((c) => c.typeId === typeId);
  const toCenter = new THREE.Vector2(-corner.x, -corner.z).normalize();
  const baseX = corner.x + toCenter.x * 10;
  const baseZ = corner.z + toCenter.y * 10;
  camera.position.set(baseX, terrainHeight(baseX, baseZ) + EYE_HEIGHT, baseZ);
  yaw = Math.atan2(-toCenter.x, -toCenter.y);
  pitch = 0;
  camera.rotation.set(pitch, yaw, 0, 'YXZ');

  gameState = 'PLAYING';
  updateUI();
  updateHUD();
  lockPointer();
}

function triggerRoundWon() {
  gameState = 'WON';
  coins += 100;
  saveCoins();
  refreshCoinDisplay();
  if (document.pointerLockElement) document.exitPointerLock();
  updateUI();
}

function triggerRoundLost(npc) {
  gameState = 'LOST';
  lastResultNpc = npc;
  if (document.pointerLockElement) document.exitPointerLock();
  updateUI();
}

// --- Coins persistence ---

function loadCoins() {
  const value = parseInt(localStorage.getItem(COINS_KEY), 10);
  return Number.isFinite(value) ? value : 0;
}

function saveCoins() {
  localStorage.setItem(COINS_KEY, String(coins));
}

function loadUpgrades() {
  try {
    const parsed = JSON.parse(localStorage.getItem(UPGRADES_KEY));
    return {
      speedBoostLevel: Number.isFinite(parsed?.speedBoostLevel) ? parsed.speedBoostLevel : 0,
      doubleElement: Boolean(parsed?.doubleElement),
      canJump: Boolean(parsed?.canJump),
      doubleJump: Boolean(parsed?.doubleJump),
      minion: Boolean(parsed?.minion),
      swimming: Boolean(parsed?.swimming),
      desertGate: Boolean(parsed?.desertGate),
    };
  } catch {
    return { speedBoostLevel: 0, doubleElement: false, canJump: false, doubleJump: false, minion: false, swimming: false, desertGate: false };
  }
}

function saveUpgrades() {
  localStorage.setItem(UPGRADES_KEY, JSON.stringify(upgrades));
}

function getEffectiveMoveSpeed() {
  return moveSpeed * Math.pow(SHOP_SPEED_BOOST_MULTIPLIER, upgrades.speedBoostLevel);
}

function refreshCoinDisplay() {
  document.getElementById('coin-display').textContent = `🪙 ${coins}`;
}

// --- HUD ---

function updateHUD() {
  const goalEl = document.getElementById('player-goal');
  if (playerChosenType) {
    const type = getType(playerChosenType);
    goalEl.textContent = `${type.emoji} ${WIN_THRESHOLD - playerRemaining}/${WIN_THRESHOLD}`;
  }

  const opponentsEl = document.getElementById('opponents');
  opponentsEl.innerHTML = npcs
    .map((npc) => {
      const type = getType(npc.assignedType);
      return `<div>${type.emoji} ${WIN_THRESHOLD - npc.remaining}/${WIN_THRESHOLD}</div>`;
    })
    .join('');
}

// --- Top bar (settings / fullscreen), always available ---

function bindTopBar() {
  document.getElementById('battle-btn').addEventListener('click', goToSelect);
  document.getElementById('settings-btn').addEventListener('click', openSettings);
  document.getElementById('fullscreen-btn').addEventListener('click', () => {
    toggleFullscreen();
    updateUI();
  });
}

function goToSelect() {
  if (playerChosenType) {
    startRound(playerChosenType);
    return;
  }
  gameState = 'SELECT';
  if (document.pointerLockElement) document.exitPointerLock();
  updateUI();
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen();
}

function openSettings() {
  previousState = gameState;
  gameState = 'SETTINGS';
  if (document.pointerLockElement) document.exitPointerLock();
  updateUI();
}

function closeSettings() {
  gameState = previousState;
  updateUI();
  if (gameState === 'PLAYING' || gameState === 'IDLE') lockPointer();
}

function restartGame() {
  if (!confirm('Restart the game? This resets your coins and shop upgrades.')) return;
  coins = 0;
  saveCoins();
  const hadGateOpen = upgrades.desertGate;
  upgrades = { speedBoostLevel: 0, doubleElement: false, canJump: false, doubleJump: false, minion: false, swimming: false, desertGate: false };
  saveUpgrades();
  refreshCoinDisplay();
  if (hadGateOpen && !gateBarrier) {
    spawnGateBarrier();
    spawnBoundaryWall();
  }
  clearNPCs();
  clearMinion();
  for (const item of activeItems) scene.remove(item.object);
  activeItems = [];
  playerChosenType = null;
  gameState = 'WELCOME';
  updateUI();
}

function abandonRound() {
  clearNPCs();
  clearMinion();
  for (const item of activeItems) scene.remove(item.object);
  activeItems = [];
  gameState = 'IDLE';
  updateUI();
  lockPointer();
}

function buyUpgrade(kind) {
  if (kind === 'speed') {
    if (coins < SHOP_SPEED_BOOST_COST) return;
    coins -= SHOP_SPEED_BOOST_COST;
    upgrades.speedBoostLevel++;
  } else if (kind === 'double') {
    if (upgrades.doubleElement || coins < SHOP_DOUBLE_ELEMENT_COST) return;
    coins -= SHOP_DOUBLE_ELEMENT_COST;
    upgrades.doubleElement = true;
  } else if (kind === 'jump') {
    if (upgrades.canJump || coins < SHOP_JUMP_COST) return;
    coins -= SHOP_JUMP_COST;
    upgrades.canJump = true;
  } else if (kind === 'doubleJump') {
    if (!upgrades.canJump || upgrades.doubleJump || coins < SHOP_DOUBLE_JUMP_COST) return;
    coins -= SHOP_DOUBLE_JUMP_COST;
    upgrades.doubleJump = true;
  } else if (kind === 'minion') {
    if (!upgrades.canJump || upgrades.minion || coins < SHOP_MINION_COST) return;
    coins -= SHOP_MINION_COST;
    upgrades.minion = true;
  } else if (kind === 'swimming') {
    if (playerChosenType !== 'water' || upgrades.swimming || coins < SHOP_SWIMMING_COST) return;
    coins -= SHOP_SWIMMING_COST;
    upgrades.swimming = true;
  }
  saveCoins();
  saveUpgrades();
  refreshCoinDisplay();
  updateUI();
}

function quitGame() {
  running = false;
  if (document.pointerLockElement) document.exitPointerLock();
  if (document.fullscreenElement) document.exitFullscreen();
  gameState = 'QUIT';
  updateUI();
  window.close();
}

// --- Overlay (menus/screens) ---

function bindOverlayEvents() {
  const overlay = document.getElementById('overlay');

  overlay.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    handleOverlayAction(target.dataset.action, target);
  });

  overlay.addEventListener('input', (event) => {
    if (event.target.dataset.action === 'set-sensitivity') {
      mouseSensitivity = DEFAULT_MOUSE_SENSITIVITY * (event.target.value / 10);
    } else if (event.target.dataset.action === 'set-speed') {
      moveSpeed = Number(event.target.value);
    }
  });
}

function handleOverlayAction(action, el) {
  switch (action) {
    case 'start-round':
      startRound(el.dataset.type);
      break;
    case 'start-explore':
      gameState = 'IDLE';
      updateUI();
      lockPointer();
      break;
    case 'resume':
      gameState = previousState === 'IDLE' ? 'IDLE' : 'PLAYING';
      updateUI();
      lockPointer();
      break;
    case 'open-settings':
      openSettings();
      break;
    case 'back':
      closeSettings();
      break;
    case 'restart-game':
      restartGame();
      break;
    case 'abandon-round':
      abandonRound();
      break;
    case 'quit-game':
      quitGame();
      break;
    case 'toggle-fullscreen':
      toggleFullscreen();
      updateUI();
      break;
    case 'next-round':
    case 'retry':
      startRound(playerChosenType);
      break;
    case 'go-explore':
      abandonRound();
      break;
    case 'reopen':
      gameState = 'WELCOME';
      running = true;
      requestAnimationFrame(animate);
      updateUI();
      break;
    case 'buy':
      buyUpgrade(el.dataset.kind);
      break;
    case 'confirm-gate':
      confirmOpenGate();
      break;
    case 'cancel-gate':
      closeGateMenu();
      break;
    case 'close-shop':
      closeShop();
      break;
  }
}

function updateUI() {
  document.getElementById('hud').classList.toggle('hidden', gameState !== 'PLAYING');
  const overlay = document.getElementById('overlay');
  const isActive = gameState === 'PLAYING' || gameState === 'IDLE';
  overlay.classList.toggle('hidden', isActive);
  overlay.innerHTML = isActive ? '' : renderOverlayContent();
}

function renderOverlayContent() {
  switch (gameState) {
    case 'WELCOME':
      return `
        <div class="panel">
          <h1>Elementopia</h1>
          <p>Explore the world freely. Start a round any time from the
          ⚔️ button in the top-right corner.</p>
          <button data-action="start-explore">Click to Explore</button>
        </div>`;
    case 'SELECT':
      return `
        <div class="panel">
          <h1>Elementopia</h1>
          <p>Pick an element to collect. Three rivals will race for the others.</p>
          <div class="element-grid">
            ${ITEM_TYPES.map(
              (t) => `<button class="element-card" data-action="start-round" data-type="${t.id}">
                <span class="element-emoji">${t.emoji}</span><span>${t.label}</span>
              </button>`
            ).join('')}
          </div>
        </div>`;
    case 'PAUSED':
      return `
        <div class="panel">
          <h1>Paused</h1>
          <button data-action="resume">Resume</button>
          ${previousState === 'PLAYING' ? '<button data-action="abandon-round">Stop Battle</button>' : ''}
          <button data-action="open-settings">Settings</button>
          <button data-action="restart-game">Restart Game</button>
          <button data-action="quit-game">Quit</button>
        </div>`;
    case 'SETTINGS':
      return `
        <div class="panel">
          <h1>Settings</h1>
          <label class="settings-row">Mouse Sensitivity
            <input type="range" min="1" max="20" value="${Math.round((mouseSensitivity / DEFAULT_MOUSE_SENSITIVITY) * 10)}" data-action="set-sensitivity" />
          </label>
          <label class="settings-row">Movement Speed
            <input type="range" min="5" max="25" value="${moveSpeed}" data-action="set-speed" />
          </label>
          <button data-action="toggle-fullscreen">${document.fullscreenElement ? 'Exit Fullscreen' : 'Fullscreen'}</button>
          <button data-action="restart-game">Restart Game</button>
          <button data-action="quit-game">Quit</button>
          <button data-action="back">Back</button>
        </div>`;
    case 'SHOP':
      return `
        <div class="panel">
          <h1>Shop</h1>
          <p>🪙 ${coins}</p>
          <button data-action="buy" data-kind="speed">+10% Speed — 200 🪙 (Lv. ${upgrades.speedBoostLevel})</button>
          <button data-action="buy" data-kind="double" ${upgrades.doubleElement ? 'disabled' : ''}>${upgrades.doubleElement ? 'Elements Count Double — Owned' : 'Elements Count Double — 500 🪙'}</button>
          <button data-action="buy" data-kind="jump" ${upgrades.canJump ? 'disabled' : ''}>${upgrades.canJump ? 'Jumping — Owned' : 'Jumping — 100 🪙'}</button>
          ${
            upgrades.canJump
              ? `
          <button data-action="buy" data-kind="doubleJump" ${upgrades.doubleJump ? 'disabled' : ''}>${upgrades.doubleJump ? 'Double Jump — Owned' : 'Double Jump — 300 🪙'}</button>
          <button data-action="buy" data-kind="minion" ${upgrades.minion ? 'disabled' : ''}>${upgrades.minion ? 'Minion Helper — Owned' : 'Minion Helper — 500 🪙'}</button>`
              : ''
          }
          ${
            playerChosenType === 'water'
              ? `<button data-action="buy" data-kind="swimming" ${upgrades.swimming ? 'disabled' : ''}>${upgrades.swimming ? 'Swimming — Owned' : 'Swimming — 250 🪙'}</button>`
              : ''
          }
          <button data-action="close-shop">Leave Shop</button>
        </div>`;
    case 'GATE':
      return `
        <div class="panel">
          <h1>Desert Gate</h1>
          <p>Beyond here lies a vast desert. Spend 1000 🪙 to open the gate?</p>
          <p>🪙 ${coins}</p>
          <button data-action="confirm-gate" ${coins < GATE_COST ? 'disabled' : ''}>${coins < GATE_COST ? 'Not enough coins' : `Open Gate — ${GATE_COST} 🪙`}</button>
          <button data-action="cancel-gate">Cancel</button>
        </div>`;
    case 'WON': {
      const type = getType(playerChosenType);
      return `
        <div class="panel">
          <h1>Round Won!</h1>
          <p>You collected all the ${type.emoji} ${type.label}!</p>
          <p>+100 coins — total: 🪙 ${coins}</p>
          <button data-action="next-round">Next Round</button>
          <button data-action="go-explore">Explore</button>
        </div>`;
    }
    case 'LOST': {
      const type = getType(lastResultNpc.assignedType);
      return `
        <div class="panel">
          <h1>Round Lost</h1>
          <p>A rival collected all the ${type.emoji} ${type.label} first!</p>
          <button data-action="retry">Try Again</button>
          <button data-action="go-explore">Explore</button>
        </div>`;
    }
    case 'QUIT':
      return `
        <div class="panel">
          <h1>Thanks for playing!</h1>
          <p>You can close this browser tab now.</p>
          <button data-action="reopen">Back to Menu</button>
        </div>`;
    default:
      return '';
  }
}

// --- Main loop ---

function animate() {
  if (!running) return;
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.1);
  const elapsed = clock.getElapsedTime();

  if (gameState === 'PLAYING' || gameState === 'IDLE') {
    updateMovement(delta);
    checkShopProximity();
    checkGateProximity();
    updatePlayerBody(delta);
    updateTornado(delta, elapsed);
  }
  if (gameState === 'PLAYING') {
    updateNPCs(delta);
    checkPlayerCollisions();
    updateMinion(delta);
  }
  animateItems(elapsed, delta);
  animateLakeWaves(elapsed);
  animateTreeFlames(elapsed);

  renderer.render(scene, camera);
}
