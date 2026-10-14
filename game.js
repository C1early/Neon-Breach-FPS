import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const canvas = document.querySelector("#game-canvas");
const startScreen = document.querySelector("#start-screen");
const pauseScreen = document.querySelector("#pause-screen");
const gameOverScreen = document.querySelector("#game-over");
const startButton = document.querySelector("#start-button");
const resumeButton = document.querySelector("#resume-button");
const restartButton = document.querySelector("#restart-button");
const healthValue = document.querySelector("#health-value");
const healthBar = document.querySelector("#health-bar");
const armorValue = document.querySelector("#armor-value");
const armorBar = document.querySelector("#armor-bar");
const ammoValue = document.querySelector("#ammo-value");
const reserveValue = document.querySelector("#reserve-value");
const reloadStatus = document.querySelector("#reload-status");
const waveValue = document.querySelector("#wave-value");
const waveStatus = document.querySelector("#wave-status");
const killsValue = document.querySelector("#kills-value");
const scoreValue = document.querySelector("#score-value");
const objective = document.querySelector("#objective");
const hitMarker = document.querySelector("#hit-marker");
const damageVignette = document.querySelector("#damage-vignette");
const killFeed = document.querySelector("#kill-feed");
const notification = document.querySelector("#notification");
const finalWave = document.querySelector("#final-wave");
const finalKills = document.querySelector("#final-kills");
const finalScore = document.querySelector("#final-score");
const radar = document.querySelector("#radar");
const radarContext = radar.getContext("2d");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance"
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x061116);
scene.fog = new THREE.FogExp2(0x071419, 0.013);

const camera = new THREE.PerspectiveCamera(
  74,
  window.innerWidth / window.innerHeight,
  0.08,
  160
);
camera.rotation.order = "YXZ";
scene.add(camera);

const cameraFillLight = new THREE.PointLight(0xb9eaff, 7, 20, 2);
cameraFillLight.position.set(0, 1.2, 2.5);
camera.add(cameraFillLight);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.42,
  0.34,
  0.92
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const centerScreen = new THREE.Vector2(0, 0);

const collisionBoxes = [];
const worldMeshes = [];
const hitboxes = [];
const enemies = [];
const tracers = [];
const particles = [];
const projectiles = [];
const dustSystems = [];

const enemyMaterials = {
  droneBody: new THREE.MeshStandardMaterial({
    color: 0x26343a,
    metalness: 0.78,
    roughness: 0.3,
    emissive: 0x0b3033,
    emissive: 0x16494d,
    emissiveIntensity: 0.95
  }),
  droneArmor: new THREE.MeshStandardMaterial({
    color: 0x72878e,
    metalness: 0.86,
    roughness: 0.24,
    emissive: 0x102f34,
    emissiveIntensity: 0.4
  }),
  droneGlow: new THREE.MeshStandardMaterial({
    color: 0x53ffce,
    emissive: 0x22d3a2,
    emissiveIntensity: 3.45,
    metalness: 0.2,
    roughness: 0.18
  }),
  sentinelBody: new THREE.MeshStandardMaterial({
    color: 0x60412f,
    metalness: 0.72,
    roughness: 0.34,
    emissive: 0x411604,
    emissiveIntensity: 1
  }),
  sentinelArmor: new THREE.MeshStandardMaterial({
    color: 0xb7783e,
    metalness: 0.82,
    roughness: 0.3,
    emissive: 0x351406,
    emissiveIntensity: 0.3
  }),
  sentinelGlow: new THREE.MeshStandardMaterial({
    color: 0xffb342,
    emissive: 0xff7a18,
    emissiveIntensity: 3.6,
    metalness: 0.2,
    roughness: 0.18
  })
};

const particleGeometry = new THREE.BoxGeometry(0.08, 0.08, 0.08);
const projectileGeometry = new THREE.SphereGeometry(0.16, 10, 10);
const bulletMaterial = new THREE.MeshBasicMaterial({
  color: 0x9ffff0,
  transparent: true,
  opacity: 0.9,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});

function createSurfaceTexture(baseColor, lineColor, accentColor, size = 512) {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = size;
  textureCanvas.height = size;
  const context = textureCanvas.getContext("2d");

  context.fillStyle = baseColor;
  context.fillRect(0, 0, size, size);

  const image = context.getImageData(0, 0, size, size);
  for (let index = 0; index < image.data.length; index += 4) {
    const noise = (Math.random() - 0.5) * 16;
    image.data[index] = Math.max(0, Math.min(255, image.data[index] + noise));
    image.data[index + 1] = Math.max(0, Math.min(255, image.data[index + 1] + noise));
    image.data[index + 2] = Math.max(0, Math.min(255, image.data[index + 2] + noise));
  }
  context.putImageData(image, 0, 0);

  context.strokeStyle = lineColor;
  context.lineWidth = 2;
  for (let step = 0; step <= size; step += 64) {
    context.beginPath();
    context.moveTo(step, 0);
    context.lineTo(step, size);
    context.stroke();
    context.beginPath();
    context.moveTo(0, step);
    context.lineTo(size, step);
    context.stroke();
  }

  context.strokeStyle = accentColor;
  context.lineWidth = 1;
  for (let step = 32; step <= size; step += 64) {
    context.beginPath();
    context.moveTo(step, 0);
    context.lineTo(step, size);
    context.stroke();
    context.beginPath();
    context.moveTo(0, step);
    context.lineTo(size, step);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(18, 18);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

function addCollisionBox(x, z, width, depth) {
  collisionBoxes.push({
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2
  });
}

function addBox({
  x,
  y,
  z,
  width,
  height,
  depth,
  material,
  collision = false,
  castShadow = true,
  receiveShadow = true
}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    material
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  scene.add(mesh);
  worldMeshes.push(mesh);

  if (collision) {
    addCollisionBox(x, z, width, depth);
  }

  return mesh;
}

function buildSky() {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(110, 48, 28),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x071823) },
        horizonColor: { value: new THREE.Color(0x11444a) },
        lowerColor: { value: new THREE.Color(0x020609) },
        sunColor: { value: new THREE.Color(0xff9a3d) }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 lowerColor;
        uniform vec3 sunColor;
        varying vec3 vWorldPosition;
        void main() {
          vec3 direction = normalize(vWorldPosition);
          float heightMix = smoothstep(-0.12, 0.72, direction.y);
          vec3 skyColor = mix(lowerColor, horizonColor, smoothstep(-0.2, 0.1, direction.y));
          skyColor = mix(skyColor, topColor, heightMix);
          float sunAmount = pow(max(dot(direction, normalize(vec3(0.6, 0.2, -1.0))), 0.0), 34.0);
          float horizonGlow = pow(1.0 - abs(direction.y), 7.0);
          skyColor += sunColor * sunAmount * 0.8;
          skyColor += horizonColor * horizonGlow * 0.25;
          gl_FragColor = vec4(skyColor, 1.0);
        }
      `
    })
  );
  scene.add(sky);
}

function buildWorld() {
  buildSky();

  const floorTexture = createSurfaceTexture("#172025", "#35515a", "#20363b");
  const floorMaterial = new THREE.MeshStandardMaterial({
    map: floorTexture,
    color: 0x6d7b7e,
    roughness: 0.72,
    metalness: 0.35
  });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  worldMeshes.push(floor);

  const industrialWall = new THREE.MeshStandardMaterial({
    color: 0x253237,
    roughness: 0.55,
    metalness: 0.68
  });
  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x111d22,
    roughness: 0.32,
    metalness: 0.92
  });
  const warmMetal = new THREE.MeshStandardMaterial({
    color: 0x6f4f31,
    roughness: 0.42,
    metalness: 0.74
  });
  const hazardMaterial = new THREE.MeshStandardMaterial({
    color: 0xb66a12,
    emissive: 0x5e2102,
    emissiveIntensity: 0.32,
    roughness: 0.46,
    metalness: 0.56
  });
  const cyanGlow = new THREE.MeshStandardMaterial({
    color: 0x67fff0,
    emissive: 0x1cd8c7,
    emissiveIntensity: 2.35,
    roughness: 0.2,
    metalness: 0.1
  });

  addBox({
    x: 0,
    y: 3,
    z: -36,
    width: 72,
    height: 6,
    depth: 2,
    material: industrialWall,
    collision: true
  });
  addBox({
    x: 0,
    y: 3,
    z: 36,
    width: 72,
    height: 6,
    depth: 2,
    material: industrialWall,
    collision: true
  });
  addBox({
    x: -36,
    y: 3,
    z: 0,
    width: 2,
    height: 6,
    depth: 72,
    material: industrialWall,
    collision: true
  });
  addBox({
    x: 36,
    y: 3,
    z: 0,
    width: 2,
    height: 6,
    depth: 72,
    material: industrialWall,
    collision: true
  });

  const pillarPositions = [
    [-15, -15],
    [15, -15],
    [-15, 15],
    [15, 15],
    [-25, 0],
    [25, 0]
  ];

  for (const [x, z] of pillarPositions) {
    addBox({
      x,
      y: 2.4,
      z,
      width: 2.8,
      height: 4.8,
      depth: 2.8,
      material: darkMetal,
      collision: true
    });
    addBox({
      x,
      y: 4.82,
      z,
      width: 3.25,
      height: 0.18,
      depth: 3.25,
      material: hazardMaterial,
      collision: false
    });
  }

  const cratePositions = [
    [-9, 5, 3.4, 1.8, 2.6],
    [10, 5, 3.4, 1.8, 2.6],
    [-11, -7, 2.4, 2.2, 2.4],
    [9, -8, 2.4, 2.2, 2.4],
    [-22, 19, 4.4, 2.1, 3.2],
    [22, 19, 4.4, 2.1, 3.2],
    [-22, -20, 4.4, 2.1, 3.2],
    [22, -20, 4.4, 2.1, 3.2]
  ];

  for (const [x, z, width, height, depth] of cratePositions) {
    addBox({
      x,
      y: height / 2,
      z,
      width,
      height,
      depth,
      material: warmMetal,
      collision: true
    });
  }

  const reactorBase = new THREE.Mesh(
    new THREE.CylinderGeometry(4.8, 5.6, 1.2, 32),
    darkMetal
  );
  reactorBase.position.set(0, 0.6, 0);
  reactorBase.castShadow = true;
  reactorBase.receiveShadow = true;
  scene.add(reactorBase);
  worldMeshes.push(reactorBase);

  const reactorCore = new THREE.Mesh(
    new THREE.CylinderGeometry(2.5, 3.2, 8.5, 32),
    new THREE.MeshStandardMaterial({
      color: 0x0c474b,
      emissive: 0x0fc6bb,
      emissiveIntensity: 1.15,
      metalness: 0.55,
      roughness: 0.26,
      transparent: true,
      opacity: 0.72
    })
  );
  reactorCore.position.set(0, 5.05, 0);
  scene.add(reactorCore);

  const reactorRings = new THREE.Group();
  for (let index = 0; index < 4; index += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.1 + index * 0.32, 0.08, 10, 48),
      cyanGlow
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -2.4 + index * 1.7;
    reactorRings.add(ring);
  }
  reactorRings.position.set(0, 5.05, 0);
  scene.add(reactorRings);

  addCollisionBox(0, 0, 8.2, 8.2);

  const stripPositions = [
    [-30, 2.6, -34.8, 11, 0.13, 0.1],
    [30, 2.6, 34.8, 11, 0.13, 0.1],
    [-34.8, 2.6, -12, 0.1, 0.13, 10],
    [34.8, 2.6, 12, 0.1, 0.13, 10]
  ];
  for (const [x, y, z, width, height, depth] of stripPositions) {
    addBox({
      x,
      y,
      z,
      width,
      height,
      depth,
      material: cyanGlow,
      collision: false,
      castShadow: false
    });
  }

  const dustGeometry = new THREE.BufferGeometry();
  const dustCount = 900;
  const dustPositions = new Float32Array(dustCount * 3);
  for (let index = 0; index < dustCount; index += 1) {
    dustPositions[index * 3] = (Math.random() - 0.5) * 68;
    dustPositions[index * 3 + 1] = Math.random() * 12;
    dustPositions[index * 3 + 2] = (Math.random() - 0.5) * 68;
  }
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({
      color: 0xa8fff4,
      size: 0.035,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  scene.add(dust);
  dustSystems.push(dust);

  const ambient = new THREE.HemisphereLight(0x82d7dc, 0x24170d, 1.16);
  scene.add(ambient);

  const moonLight = new THREE.DirectionalLight(0xc8f2ff, 2.2);
  moonLight.position.set(-18, 28, 16);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(2048, 2048);
  moonLight.shadow.camera.left = -38;
  moonLight.shadow.camera.right = 38;
  moonLight.shadow.camera.top = 38;
  moonLight.shadow.camera.bottom = -38;
  moonLight.shadow.camera.near = 1;
  moonLight.shadow.camera.far = 80;
  moonLight.shadow.bias = -0.00015;
  scene.add(moonLight);

  const lightSpecs = [
    [-25, 4.5, -25, 0x4ef7e5],
    [25, 4.5, -25, 0xff7a2d],
    [-25, 4.5, 25, 0xff7a2d],
    [25, 4.5, 25, 0x4ef7e5]
  ];

  for (const [x, y, z, color] of lightSpecs) {
    const light = new THREE.PointLight(color, 28, 24, 2);
    light.position.set(x, y, z);
    light.castShadow = true;
    light.shadow.mapSize.set(512, 512);
    scene.add(light);
  }

  return {
    reactorCore,
    reactorRings
  };
}

const worldAnimation = buildWorld();

function createWeapon() {
  const weapon = new THREE.Group();
  const polymer = new THREE.MeshStandardMaterial({
    color: 0x1c2529,
    roughness: 0.34,
    metalness: 0.72
  });
  const metal = new THREE.MeshStandardMaterial({
    color: 0x75858a,
    roughness: 0.22,
    metalness: 0.94
  });
  const accent = new THREE.MeshStandardMaterial({
    color: 0x25e5d1,
    emissive: 0x16b7a8,
    emissiveIntensity: 2.1,
    roughness: 0.24,
    metalness: 0.52
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.82), polymer);
  body.position.set(0, 0, -0.25);
  body.castShadow = true;
  weapon.add(body);

  const upperRail = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.54), metal);
  upperRail.position.set(0, 0.14, -0.34);
  upperRail.castShadow = true;
  weapon.add(upperRail);

  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.055, 0.67, 12),
    metal
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.01, -0.92);
  barrel.castShadow = true;
  weapon.add(barrel);

  const muzzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.065, 0.12, 12),
    metal
  );
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, 0.01, -1.28);
  muzzle.castShadow = true;
  weapon.add(muzzle);

  const sideGlow = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.07, 0.42), accent);
  sideGlow.position.set(-0.12, 0.02, -0.27);
  weapon.add(sideGlow);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 0.2), polymer);
  grip.position.set(0, -0.22, 0.04);
  grip.rotation.x = -0.18;
  grip.castShadow = true;
  weapon.add(grip);

  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.13), accent);
  sight.position.set(0, 0.23, -0.3);
  weapon.add(sight);

  const muzzleAnchor = new THREE.Object3D();
  muzzleAnchor.position.set(0, 0.015, -1.36);
  weapon.add(muzzleAnchor);

  const muzzleFlash = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 12, 12),
    new THREE.MeshBasicMaterial({
      color: 0xb7fff3,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  muzzleFlash.position.copy(muzzleAnchor.position);
  weapon.add(muzzleFlash);

  const muzzleLight = new THREE.PointLight(0x56f7e5, 0, 8, 2);
  muzzleLight.position.copy(muzzleAnchor.position);
  weapon.add(muzzleLight);

  weapon.position.set(0.28, -0.27, -0.54);
  weapon.rotation.set(-0.03, -0.03, 0);
  camera.add(weapon);

  return {
    group: weapon,
    muzzleAnchor,
    muzzleFlash,
    muzzleLight
  };
}

const weapon = createWeapon();

const player = {
  position: new THREE.Vector3(0, 1.7, 28),
  velocity: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  radius: 0.45,
  height: 1.7,
  health: 100,
  armor: 50,
  ammo: 24,
  magazineSize: 24,
  reserve: 120,
  onGround: true,
  verticalVelocity: 0,
  walkPhase: 0,
  recoil: 0,
  shake: 0,
  damageTimer: 0,
  fireCooldown: 0,
  reloadTimer: 0,
  reloading: false,
  isMoving: false,
  aiming: false
};

const game = {
  started: false,
  paused: false,
  gameOver: false,
  pointerLocked: false,
  wave: 1,
  pendingSpawns: 0,
  spawnTimer: 0,
  waveCooldown: 3,
  waveActive: false,
  kills: 0,
  score: 0,
  elapsed: 0,
  shotsFired: 0,
  shotsHit: 0
};

const keys = new Set();
let mouseDown = false;
let audioContext = null;
let noiseBuffer = null;
let notificationTimer = 0;

function initAudio() {
  if (audioContext) {
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  audioContext = new AudioContextClass();
  const sampleRate = audioContext.sampleRate;
  noiseBuffer = audioContext.createBuffer(1, sampleRate, sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
}

function playNoise(duration, volume, frequency, type = "lowpass") {
  if (!audioContext || !noiseBuffer) {
    return;
  }

  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();
  source.buffer = noiseBuffer;
  filter.type = type;
  filter.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    audioContext.currentTime + duration
  );
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioContext.destination);
  source.start();
  source.stop(audioContext.currentTime + duration);
}

function playTone(frequency, duration, volume, type = "sine", endFrequency = null) {
  if (!audioContext) {
    return;
  }

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  if (endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(
      endFrequency,
      audioContext.currentTime + duration
    );
  }
  gain.gain.setValueAtTime(volume, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    audioContext.currentTime + duration
  );
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function playShotSound() {
  initAudio();
  playNoise(0.11, 0.48, 2200, "bandpass");
  playTone(145, 0.09, 0.16, "sawtooth", 58);
}

function playHitSound() {
  playTone(1280, 0.045, 0.08, "square", 920);
}

function playKillSound() {
  playTone(220, 0.2, 0.12, "sawtooth", 820);
  playNoise(0.16, 0.22, 900, "bandpass");
}

function playDamageSound() {
  playTone(86, 0.28, 0.22, "sawtooth", 48);
  playNoise(0.18, 0.18, 420, "lowpass");
}

function showNotification(text, duration = 1800) {
  notification.textContent = text;
  notification.classList.add("visible");
  notificationTimer = duration / 1000;
}

function addKillFeed(text) {
  const entry = document.createElement("div");
  entry.className = "kill-entry";
  entry.textContent = text;
  killFeed.prepend(entry);
  window.setTimeout(() => entry.remove(), 4200);
  while (killFeed.children.length > 5) {
    killFeed.lastElementChild?.remove();
  }
}

function flashHitMarker(kill = false) {
  hitMarker.style.filter = kill ? "hue-rotate(35deg) saturate(2)" : "";
  hitMarker.classList.remove("active");
  void hitMarker.offsetWidth;
  hitMarker.classList.add("active");
}

function updateHud() {
  healthValue.textContent = Math.max(0, Math.ceil(player.health));
  armorValue.textContent = Math.max(0, Math.ceil(player.armor));
  ammoValue.textContent = player.ammo;
  reserveValue.textContent = player.reserve;
  killsValue.textContent = game.kills;
  scoreValue.textContent = game.score;
  waveValue.textContent = game.wave;

  healthBar.style.transform = `scaleX(${Math.max(0, player.health) / 100})`;
  armorBar.style.transform = `scaleX(${Math.max(0, player.armor) / 50})`;

  if (player.reloading) {
    reloadStatus.textContent = "RELOADING";
    reloadStatus.classList.add("reloading");
  } else if (player.ammo <= 0) {
    reloadStatus.textContent = "EMPTY";
    reloadStatus.classList.add("reloading");
  } else {
    reloadStatus.textContent = "READY";
    reloadStatus.classList.remove("reloading");
  }
}

function randomSpawnPosition(minDistance = 13) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = minDistance + Math.random() * 18;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;

    if (!collidesAt(x, z, 0.65) && x * x + z * z > 100) {
      return new THREE.Vector3(x, 0, z);
    }
  }

  return new THREE.Vector3(-28, 0, -28);
}

function createHealthBar() {
  const healthCanvas = document.createElement("canvas");
  healthCanvas.width = 160;
  healthCanvas.height = 24;
  const context = healthCanvas.getContext("2d");
  const texture = new THREE.CanvasTexture(healthCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false
    })
  );
  sprite.scale.set(1.8, 0.27, 1);
  sprite.position.y = 2.75;

  return {
    canvas: healthCanvas,
    context,
    texture,
    sprite
  };
}

function drawHealthBar(bar, ratio, isSentinel) {
  const { context, canvas, texture } = bar;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(0, 0, 0, 0.74)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = isSentinel ? "#f59e0b" : "#38e8c8";
  context.fillRect(4, 4, Math.max(0, (canvas.width - 8) * ratio), canvas.height - 8);
  context.strokeStyle = "rgba(255, 255, 255, 0.5)";
  context.lineWidth = 2;
  context.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
  texture.needsUpdate = true;
}

function createEnemy(type = "drone", forcedPosition = null) {
  const isSentinel = type === "sentinel";
  const group = new THREE.Group();
  const bodyMaterial = isSentinel ? enemyMaterials.sentinelBody : enemyMaterials.droneBody;
  const armorMaterial = isSentinel
    ? enemyMaterials.sentinelArmor
    : enemyMaterials.droneArmor;
  const glowMaterial = isSentinel ? enemyMaterials.sentinelGlow : enemyMaterials.droneGlow;

  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(isSentinel ? 0.95 : 0.78, 1.15, 0.52),
    bodyMaterial
  );
  torso.position.y = 1.28;
  torso.castShadow = true;
  group.add(torso);

  const chestPlate = new THREE.Mesh(
    new THREE.BoxGeometry(isSentinel ? 0.68 : 0.54, 0.58, 0.12),
    armorMaterial
  );
  chestPlate.position.set(0, 1.42, 0.29);
  chestPlate.castShadow = true;
  group.add(chestPlate);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(isSentinel ? 0.5 : 0.42, 0.42, 0.4),
    armorMaterial
  );
  head.position.y = 2.05;
  head.castShadow = true;
  group.add(head);

  const eye = new THREE.Mesh(
    new THREE.BoxGeometry(isSentinel ? 0.31 : 0.25, 0.07, 0.05),
    glowMaterial
  );
  eye.position.set(0, 2.07, 0.225);
  group.add(eye);

  const beaconMaterial = new THREE.MeshBasicMaterial({
    color: isSentinel ? 0xffa52f : 0x63ffe4,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 12, 12),
    beaconMaterial
  );
  beacon.position.y = 2.48;
  group.add(beacon);

  const beaconRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.025, 8, 24),
    beaconMaterial
  );
  beaconRing.position.y = 2.48;
  beaconRing.rotation.x = Math.PI / 2;
  group.add(beaconRing);

  const shoulderGeometry = new THREE.BoxGeometry(0.25, 0.25, 0.25);
  const leftShoulder = new THREE.Mesh(shoulderGeometry, armorMaterial);
  leftShoulder.position.set(isSentinel ? -0.68 : -0.56, 1.63, 0);
  leftShoulder.castShadow = true;
  group.add(leftShoulder);

  const rightShoulder = leftShoulder.clone();
  rightShoulder.position.x *= -1;
  group.add(rightShoulder);

  const armGeometry = new THREE.BoxGeometry(0.16, 0.78, 0.18);
  const leftArm = new THREE.Mesh(armGeometry, bodyMaterial);
  leftArm.position.set(isSentinel ? -0.7 : -0.57, 1.18, 0);
  leftArm.castShadow = true;
  group.add(leftArm);

  const rightArm = leftArm.clone();
  rightArm.position.x *= -1;
  group.add(rightArm);

  const legGeometry = new THREE.BoxGeometry(0.22, 0.78, 0.24);
  const leftLeg = new THREE.Mesh(legGeometry, bodyMaterial);
  leftLeg.position.set(-0.24, 0.42, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.24;
  group.add(rightLeg);

  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(isSentinel ? 1.5 : 1.2, 2.55, 1.05),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false
    })
  );
  hitbox.position.y = 1.25;
  group.add(hitbox);

  const healthBar = createHealthBar();
  group.add(healthBar.sprite);

  const position = forcedPosition || randomSpawnPosition(isSentinel ? 18 : 14);
  group.position.copy(position);

  const enemy = {
    type,
    group,
    hitbox,
    healthBar,
    eye,
    beacon,
    beaconRing,
    torso,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    position,
    maxHealth: isSentinel ? 118 : 72,
    health: isSentinel ? 118 : 72,
    speed: isSentinel ? 1.9 + Math.min(game.wave * 0.08, 0.8) : 3.1 + Math.min(game.wave * 0.09, 1.1),
    radius: isSentinel ? 0.72 : 0.56,
    attackCooldown: Math.random() * 0.8,
    shotCooldown: 0.6 + Math.random() * 1.4,
    deathTimer: 0,
    flash: 0,
    walkPhase: Math.random() * Math.PI * 2
  };

  hitbox.userData.enemy = enemy;
  drawHealthBar(healthBar, 1, isSentinel);
  scene.add(group);
  hitboxes.push(hitbox);
  enemies.push(enemy);
  return enemy;
}

function removeEnemy(enemy) {
  scene.remove(enemy.group);
  const hitboxIndex = hitboxes.indexOf(enemy.hitbox);
  if (hitboxIndex >= 0) {
    hitboxes.splice(hitboxIndex, 1);
  }
  const enemyIndex = enemies.indexOf(enemy);
  if (enemyIndex >= 0) {
    enemies.splice(enemyIndex, 1);
  }
}

function spawnEnemy(forcedPosition = null) {
  const sentinelChance = Math.min(0.18 + game.wave * 0.035, 0.46);
  return createEnemy(
    Math.random() < sentinelChance ? "sentinel" : "drone",
    forcedPosition
  );
}

function circleIntersectsBox(x, z, radius, box) {
  const closestX = Math.max(box.minX, Math.min(x, box.maxX));
  const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
  const deltaX = x - closestX;
  const deltaZ = z - closestZ;
  return deltaX * deltaX + deltaZ * deltaZ < radius * radius;
}

function collidesAt(x, z, radius) {
  if (x - radius < -34.5 || x + radius > 34.5 || z - radius < -34.5 || z + radius > 34.5) {
    return true;
  }

  return collisionBoxes.some((box) => circleIntersectsBox(x, z, radius, box));
}

function moveWithCollision(position, deltaX, deltaZ, radius) {
  const nextX = position.x + deltaX;
  if (!collidesAt(nextX, position.z, radius)) {
    position.x = nextX;
  }

  const nextZ = position.z + deltaZ;
  if (!collidesAt(position.x, nextZ, radius)) {
    position.z = nextZ;
  }
}

function spawnImpact(point, color = 0xffc36b, count = 8) {
  for (let index = 0; index < count; index += 1) {
    const mesh = new THREE.Mesh(
      particleGeometry,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    mesh.position.copy(point);
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 7,
      Math.random() * 5 + 1,
      (Math.random() - 0.5) * 7
    );
    particles.push({
      mesh,
      velocity,
      life: 0.55 + Math.random() * 0.45,
      maxLife: 1
    });
    scene.add(mesh);
  }
}

function spawnTracer(start, end) {
  const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  const material = new THREE.LineBasicMaterial({
    color: 0x8ffff2,
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const line = new THREE.Line(geometry, material);
  scene.add(line);
  tracers.push({ line, life: 0.09 });
}

function spawnProjectile(position, targetPosition, isHostile = true) {
  const projectile = new THREE.Mesh(
    projectileGeometry,
    new THREE.MeshBasicMaterial({
      color: isHostile ? 0xff8a31 : 0x7cfff0,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  projectile.position.copy(position);
  const velocity = targetPosition
    .clone()
    .sub(position)
    .normalize()
    .multiplyScalar(isHostile ? 13 : 28);
  projectile.userData.velocity = velocity;
  projectile.userData.hostile = isHostile;
  projectile.userData.life = 4.5;
  scene.add(projectile);
  projectiles.push(projectile);
}

function damagePlayer(amount, source = "enemy") {
  const armorAbsorption = Math.min(player.armor, amount * 0.55);
  player.armor -= armorAbsorption;
  player.health -= amount - armorAbsorption;
  player.damageTimer = 0.32;
  player.shake = Math.max(player.shake, source === "melee" ? 0.24 : 0.16);
  damageVignette.classList.add("active");
  playDamageSound();

  if (player.health <= 0) {
    endGame();
  }
}

function shoot() {
  if (!game.started || game.paused || game.gameOver || player.reloading) {
    return;
  }

  if (player.ammo <= 0) {
    playTone(180, 0.04, 0.05, "square");
    startReload();
    return;
  }

  player.ammo -= 1;
  player.fireCooldown = 0.095;
  player.recoil = Math.min(1, player.recoil + 0.86);
  game.shotsFired += 1;
  playShotSound();

  weapon.muzzleFlash.material.opacity = 1;
  weapon.muzzleLight.intensity = 25;
  window.setTimeout(() => {
    weapon.muzzleFlash.material.opacity = 0;
    weapon.muzzleLight.intensity = 0;
  }, 46);

  scene.updateMatrixWorld(true);
  const muzzlePosition = new THREE.Vector3();
  weapon.muzzleAnchor.getWorldPosition(muzzlePosition);

  const shotDirection = new THREE.Vector3();
  camera.getWorldDirection(shotDirection);
  const spread = player.aiming ? 0.0015 : player.isMoving ? 0.012 : 0.0065;
  shotDirection.x += (Math.random() - 0.5) * spread;
  shotDirection.y += (Math.random() - 0.5) * spread;
  shotDirection.z += (Math.random() - 0.5) * spread;
  shotDirection.normalize();

  raycaster.set(camera.position, shotDirection);
  raycaster.far = 110;

  const targetHits = raycaster.intersectObjects(hitboxes, false);
  const worldHits = raycaster.intersectObjects(worldMeshes, false);
  const closestTarget = targetHits[0] || null;
  const closestWorld = worldHits[0] || null;

  let hitPoint = camera.position.clone().add(shotDirection.multiplyScalar(95));
  let didHitEnemy = false;

  if (
    closestTarget &&
    (!closestWorld || closestTarget.distance < closestWorld.distance)
  ) {
    hitPoint = closestTarget.point.clone();
    const enemy = closestTarget.object.userData.enemy;
    if (enemy && enemy.health > 0) {
      applyDamage(enemy, 34);
      didHitEnemy = true;
      game.shotsHit += 1;
    }
  } else if (closestWorld) {
    hitPoint = closestWorld.point.clone();
    spawnImpact(hitPoint, 0x9ae9e2, 6);
  }

  spawnTracer(muzzlePosition, hitPoint);

  if (didHitEnemy) {
    flashHitMarker(false);
    playHitSound();
  }

  player.pitch = Math.min(
    1.36,
    player.pitch + 0.0055 + Math.random() * 0.003
  );
  updateHud();
}

function applyDamage(enemy, amount) {
  enemy.health -= amount;
  enemy.flash = 0.08;
  drawHealthBar(enemy.healthBar, enemy.health / enemy.maxHealth, enemy.type === "sentinel");

  if (enemy.health <= 0) {
    const points = enemy.type === "sentinel" ? 260 : 130;
    game.score += points;
    game.kills += 1;
    flashHitMarker(true);
    playKillSound();
    addKillFeed(
      `${enemy.type === "sentinel" ? "重装哨兵" : "机械突袭者"}已摧毁  +${points}`
    );
    spawnImpact(
      enemy.group.position.clone().add(new THREE.Vector3(0, 1.25, 0)),
      enemy.type === "sentinel" ? 0xff9a42 : 0x4effd5,
      18
    );
    removeEnemy(enemy);
    updateHud();
  }
}

function startReload() {
  if (
    player.reloading ||
    player.ammo >= player.magazineSize ||
    player.reserve <= 0
  ) {
    return;
  }

  player.reloading = true;
  player.reloadTimer = 1.42;
  playTone(190, 0.06, 0.06, "square");
  window.setTimeout(() => playTone(280, 0.06, 0.06, "square"), 520);
  window.setTimeout(() => playTone(420, 0.08, 0.07, "square"), 1050);
  updateHud();
}

function finishReload() {
  const needed = player.magazineSize - player.ammo;
  const amount = Math.min(needed, player.reserve);
  player.ammo += amount;
  player.reserve -= amount;
  player.reloading = false;
  player.reloadTimer = 0;
  updateHud();
}

function updatePlayer(delta) {
  const forwardInput = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
  const sideInput = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
  const inputLength = Math.hypot(forwardInput, sideInput);
  const sprinting = keys.has("ShiftLeft") || keys.has("ShiftRight");
  const speed = player.aiming ? 3.5 : sprinting ? 9.1 : 6.2;

  const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  const movement = new THREE.Vector3();

  if (inputLength > 0) {
    movement
      .addScaledVector(forward, forwardInput / inputLength)
      .addScaledVector(right, sideInput / inputLength)
      .multiplyScalar(speed * delta);
    moveWithCollision(player.position, movement.x, movement.z, player.radius);
    player.walkPhase += delta * (sprinting ? 13 : 9.4);
    player.isMoving = true;
  } else {
    player.isMoving = false;
  }

  if (keys.has("Space") && player.onGround) {
    player.verticalVelocity = 6.7;
    player.onGround = false;
  }

  player.verticalVelocity -= 19.5 * delta;
  player.position.y += player.verticalVelocity * delta;

  if (player.position.y <= player.height) {
    player.position.y = player.height;
    player.verticalVelocity = 0;
    player.onGround = true;
  }

  updateWeapon(delta, sprinting);
}

function updateWeapon(delta, sprinting) {
  const bobAmount = player.isMoving ? (sprinting ? 0.025 : 0.016) : 0.004;
  const targetX = player.aiming
    ? 0.015
    : 0.28 + Math.cos(player.walkPhase * 0.5) * bobAmount;
  const targetY =
    (player.aiming ? -0.17 : -0.27) +
    Math.abs(Math.sin(player.walkPhase)) * bobAmount -
    player.recoil * 0.025;
  const targetZ = (player.aiming ? -0.4 : -0.54) + player.recoil * 0.09;

  weapon.group.position.x += (targetX - weapon.group.position.x) * Math.min(1, delta * 12);
  weapon.group.position.y += (targetY - weapon.group.position.y) * Math.min(1, delta * 14);
  weapon.group.position.z += (targetZ - weapon.group.position.z) * Math.min(1, delta * 18);
  weapon.group.rotation.z = Math.sin(player.walkPhase * 0.5) * bobAmount * 0.7;

  player.recoil = Math.max(0, player.recoil - delta * 6.8);
  player.shake = Math.max(0, player.shake - delta * 1.9);
  player.damageTimer = Math.max(0, player.damageTimer - delta);
  player.fireCooldown = Math.max(0, player.fireCooldown - delta);
}

function updateEnemies(delta) {
  const playerCenter = player.position.clone();
  playerCenter.y = 0;

  for (const enemy of enemies) {
    const toPlayer = playerCenter.clone().sub(enemy.position);
    const distance = toPlayer.length();
    const direction = distance > 0.001 ? toPlayer.normalize() : new THREE.Vector3();
    const isSentinel = enemy.type === "sentinel";

    enemy.attackCooldown -= delta;
    enemy.shotCooldown -= delta;
    enemy.walkPhase += delta * (isSentinel ? 3.8 : 6.8);
    enemy.group.rotation.y = Math.atan2(direction.x, direction.z);

    let moving = false;
    if (isSentinel) {
      const desiredDistance = 10.5;
      if (distance > desiredDistance + 1.4) {
        moveWithCollision(
          enemy.position,
          direction.x * enemy.speed * delta,
          direction.z * enemy.speed * delta,
          enemy.radius
        );
        moving = true;
      } else if (distance < desiredDistance - 2.5) {
        moveWithCollision(
          enemy.position,
          -direction.x * enemy.speed * 0.7 * delta,
          -direction.z * enemy.speed * 0.7 * delta,
          enemy.radius
        );
        moving = true;
      }

      if (distance < 24 && enemy.shotCooldown <= 0) {
        enemy.shotCooldown = 1.85 - Math.min(game.wave * 0.035, 0.5) + Math.random() * 0.65;
        const start = enemy.group.position
          .clone()
          .add(new THREE.Vector3(0, 1.45, 0))
          .addScaledVector(direction, 0.7);
        const target = player.position.clone();
        target.y -= 0.12;
        spawnProjectile(start, target, true);
        playTone(160, 0.12, 0.06, "sawtooth", 72);
      }
    } else if (distance > 1.55) {
      moveWithCollision(
        enemy.position,
        direction.x * enemy.speed * delta,
        direction.z * enemy.speed * delta,
        enemy.radius
      );
      moving = true;
    }

    if (distance < 1.92 && enemy.attackCooldown <= 0) {
      enemy.attackCooldown = isSentinel ? 1.25 : 0.88;
      damagePlayer(isSentinel ? 18 : 11, "melee");
    }

    const walkSwing = moving ? Math.sin(enemy.walkPhase) * 0.34 : 0;
    enemy.leftArm.rotation.x = walkSwing;
    enemy.rightArm.rotation.x = -walkSwing;
    enemy.leftLeg.rotation.x = -walkSwing * 0.85;
    enemy.rightLeg.rotation.x = walkSwing * 0.85;
    enemy.torso.position.y = 1.28 + (moving ? Math.abs(Math.sin(enemy.walkPhase)) * 0.05 : 0);

    enemy.group.position.copy(enemy.position);
    enemy.group.position.y = moving
      ? Math.abs(Math.sin(enemy.walkPhase)) * 0.07
      : 0;

    const pulse = 1 + Math.sin(game.elapsed * (isSentinel ? 5 : 7) + enemy.walkPhase) * 0.18;
    enemy.eye.scale.setScalar(pulse);
    enemy.beacon.scale.setScalar(1 + Math.sin(game.elapsed * 8 + enemy.walkPhase) * 0.28);
    enemy.beaconRing.rotation.z += delta * (isSentinel ? 3.4 : 5.2);

    if (enemy.flash > 0) {
      enemy.flash -= delta;
      enemy.torso.material.emissiveIntensity = 3.2;
    } else {
      enemy.torso.material.emissiveIntensity = isSentinel ? 0.65 : 0.55;
    }

    enemy.healthBar.sprite.rotation.y = -enemy.group.rotation.y;
  }
}

function updateProjectiles(delta) {
  for (let index = projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = projectiles[index];
    projectile.userData.life -= delta;
    projectile.position.addScaledVector(projectile.userData.velocity, delta);

    const hitPlayer =
      projectile.userData.hostile &&
      projectile.position.distanceTo(player.position) < 0.82;
    const hitWorld =
      projectile.position.y < 0.08 ||
      collidesAt(projectile.position.x, projectile.position.z, 0.12);

    if (hitPlayer) {
      damagePlayer(13, "projectile");
    }

    if (hitPlayer || hitWorld || projectile.userData.life <= 0) {
      spawnImpact(
        projectile.position.clone(),
        projectile.userData.hostile ? 0xff7a2d : 0x67fff0,
        7
      );
      scene.remove(projectile);
      projectile.geometry.dispose();
      projectile.material.dispose();
      projectiles.splice(index, 1);
    }
  }
}

function updateEffects(delta) {
  for (let index = tracers.length - 1; index >= 0; index -= 1) {
    const tracer = tracers[index];
    tracer.life -= delta;
    tracer.line.material.opacity = Math.max(0, tracer.life / 0.09);
    if (tracer.life <= 0) {
      scene.remove(tracer.line);
      tracer.line.geometry.dispose();
      tracer.line.material.dispose();
      tracers.splice(index, 1);
    }
  }

  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];
    particle.life -= delta;
    particle.velocity.y -= 12 * delta;
    particle.mesh.position.addScaledVector(particle.velocity, delta);
    particle.mesh.rotation.x += delta * 6;
    particle.mesh.rotation.y += delta * 4;
    particle.mesh.material.opacity = Math.max(0, particle.life / particle.maxLife);

    if (particle.life <= 0) {
      scene.remove(particle.mesh);
      particle.mesh.material.dispose();
      particles.splice(index, 1);
    }
  }

  for (const dust of dustSystems) {
    dust.rotation.y += delta * 0.008;
  }
}

function updateWaves(delta) {
  if (!game.started || game.gameOver) {
    return;
  }

  if (game.pendingSpawns > 0) {
    game.spawnTimer -= delta;
    if (game.spawnTimer <= 0) {
      spawnEnemy();
      game.pendingSpawns -= 1;
      game.spawnTimer = Math.max(0.28, 0.78 - game.wave * 0.03);
      updateHud();
    }
  } else if (enemies.length === 0) {
    if (game.waveActive) {
      game.waveActive = false;
      game.waveCooldown = 4.5;
      waveStatus.textContent = "区域安全";
      objective.textContent = `下一波将在 ${game.waveCooldown.toFixed(1)} 秒后抵达`;
      showNotification(`第 ${game.wave} 波清除`, 1800);
      player.reserve += 36;
      player.armor = Math.min(50, player.armor + 16);
      updateHud();
    }

    game.waveCooldown -= delta;
    objective.textContent = `下一波将在 ${Math.max(0, game.waveCooldown).toFixed(1)} 秒后抵达`;

    if (game.waveCooldown <= 0) {
      game.wave += 1;
      startWave();
    }
  }
}

function startWave() {
  game.pendingSpawns = 3 + game.wave * 2;
  game.spawnTimer = 0.3;
  game.waveActive = true;
  waveStatus.textContent = "交战中";
  objective.textContent = `清除 ${game.pendingSpawns} 个敌对单位`;
  showNotification(`第 ${game.wave} 波开始`, 1600);
  updateHud();
}

function updateCamera(delta) {
  const shakeAmount = player.shake * player.shake;
  const shakeX = (Math.random() - 0.5) * shakeAmount;
  const shakeY = (Math.random() - 0.5) * shakeAmount;
  camera.position.set(
    player.position.x + shakeX,
    player.position.y + shakeY,
    player.position.z
  );
  camera.rotation.y = player.yaw + shakeX * 0.1;
  camera.rotation.x = player.pitch + shakeY * 0.12;

  const targetFov = player.aiming
    ? 52
    : player.isMoving && (keys.has("ShiftLeft") || keys.has("ShiftRight"))
      ? 79
      : 74;
  camera.fov += (targetFov - camera.fov) * Math.min(1, delta * 6);
  camera.updateProjectionMatrix();
}

function updateRadar() {
  const width = radar.width;
  const height = radar.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const range = 34;
  const scale = width / (range * 2);

  radarContext.clearRect(0, 0, width, height);

  radarContext.fillStyle = "rgba(2, 12, 14, 0.88)";
  radarContext.beginPath();
  radarContext.arc(centerX, centerY, centerX - 2, 0, Math.PI * 2);
  radarContext.fill();

  radarContext.strokeStyle = "rgba(45, 212, 191, 0.23)";
  radarContext.lineWidth = 1;
  for (const radius of [0.33, 0.66, 0.95]) {
    radarContext.beginPath();
    radarContext.arc(centerX, centerY, (centerX - 5) * radius, 0, Math.PI * 2);
    radarContext.stroke();
  }

  radarContext.fillStyle = "rgba(45, 212, 191, 0.08)";
  radarContext.beginPath();
  radarContext.moveTo(centerX, centerY);
  radarContext.arc(
    centerX,
    centerY,
    centerX - 5,
    -Math.PI / 2 - 0.52,
    -Math.PI / 2 + 0.52
  );
  radarContext.closePath();
  radarContext.fill();

  for (const enemy of enemies) {
    const deltaX = enemy.position.x - player.position.x;
    const deltaZ = enemy.position.z - player.position.z;
    const cosine = Math.cos(-player.yaw);
    const sine = Math.sin(-player.yaw);
    const rotatedX = deltaX * cosine - deltaZ * sine;
    const rotatedZ = deltaX * sine + deltaZ * cosine;
    const screenX = centerX + rotatedX * scale;
    const screenY = centerY + rotatedZ * scale;

    if (Math.hypot(screenX - centerX, screenY - centerY) > centerX - 7) {
      continue;
    }

    radarContext.fillStyle = enemy.type === "sentinel" ? "#f59e0b" : "#ef4444";
    radarContext.beginPath();
    radarContext.arc(screenX, screenY, enemy.type === "sentinel" ? 4.5 : 3.6, 0, Math.PI * 2);
    radarContext.fill();
  }

  radarContext.fillStyle = "#eaffff";
  radarContext.beginPath();
  radarContext.moveTo(centerX, centerY - 7);
  radarContext.lineTo(centerX - 5, centerY + 5);
  radarContext.lineTo(centerX + 5, centerY + 5);
  radarContext.closePath();
  radarContext.fill();
}

function updateEnvironment(delta) {
  worldAnimation.reactorCore.rotation.y += delta * 0.32;
  worldAnimation.reactorRings.rotation.y -= delta * 0.5;

  const corePulse = 1.1 + Math.sin(game.elapsed * 2.2) * 0.24;
  worldAnimation.reactorCore.material.emissiveIntensity = corePulse;
}

function updateNotifications(delta) {
  if (notificationTimer > 0) {
    notificationTimer -= delta;
    if (notificationTimer <= 0) {
      notification.classList.remove("visible");
    }
  }
}

function resetGame() {
  for (const enemy of [...enemies]) {
    removeEnemy(enemy);
  }

  for (const projectile of [...projectiles]) {
    scene.remove(projectile);
    projectile.geometry.dispose();
    projectile.material.dispose();
  }
  projectiles.length = 0;

  for (const tracer of [...tracers]) {
    scene.remove(tracer.line);
    tracer.line.geometry.dispose();
    tracer.line.material.dispose();
  }
  tracers.length = 0;

  for (const particle of [...particles]) {
    scene.remove(particle.mesh);
    particle.mesh.material.dispose();
  }
  particles.length = 0;

  player.position.set(0, 1.7, 28);
  player.velocity.set(0, 0, 0);
  player.yaw = 0;
  player.pitch = 0;
  player.health = 100;
  player.armor = 50;
  player.ammo = player.magazineSize;
  player.reserve = 120;
  player.onGround = true;
  player.verticalVelocity = 0;
  player.walkPhase = 0;
  player.recoil = 0;
  player.shake = 0;
  player.damageTimer = 0;
  player.fireCooldown = 0;
  player.reloadTimer = 0;
  player.reloading = false;
  player.isMoving = false;
  player.aiming = false;
  document.body.classList.remove("aiming");

  game.started = true;
  game.paused = false;
  game.gameOver = false;
  game.wave = 0;
  game.pendingSpawns = 0;
  game.spawnTimer = 0;
  game.waveCooldown = 0.8;
  game.waveActive = false;
  game.kills = 0;
  game.score = 0;
  game.elapsed = 0;
  game.shotsFired = 0;
  game.shotsHit = 0;

  killFeed.replaceChildren();
  damageVignette.classList.remove("active");
  gameOverScreen.classList.remove("visible");
  pauseScreen.classList.remove("visible");
  startScreen.classList.remove("visible");
  waveStatus.textContent = "准备中";
  objective.textContent = "战斗即将开始";
  updateHud();
}

function requestPointerLock() {
  if (canvas.requestPointerLock) {
    const result = canvas.requestPointerLock();
    if (result && typeof result.catch === "function") {
      result.catch(() => {});
    }
  }
}

function startGame(skipPointerLock = false) {
  initAudio();
  resetGame();

  if (skipPointerLock) {
    game.pointerLocked = true;
    game.paused = false;
    game.wave = 1;
    startWave();
  } else {
    requestPointerLock();
  }
}

function resumeGame() {
  initAudio();
  requestPointerLock();
}

function endGame() {
  if (game.gameOver) {
    return;
  }

  game.gameOver = true;
  game.paused = true;
  mouseDown = false;
  setAiming(false);
  document.exitPointerLock?.();
  finalWave.textContent = game.wave;
  finalKills.textContent = game.kills;
  finalScore.textContent = game.score;
  gameOverScreen.classList.add("visible");
  pauseScreen.classList.remove("visible");
}

function handlePointerLockChange() {
  game.pointerLocked = document.pointerLockElement === canvas;
  if (game.gameOver || !game.started) {
    return;
  }

  game.paused = !game.pointerLocked;
  if (game.paused) {
    setAiming(false);
  }
  pauseScreen.classList.toggle("visible", game.paused);
}

function handleMouseMove(event) {
  if (!game.pointerLocked || game.paused || game.gameOver) {
    return;
  }

  const sensitivity = player.aiming ? 0.001 : 0.0018;
  player.yaw -= event.movementX * sensitivity;
  player.pitch -= event.movementY * sensitivity;
  player.pitch = Math.max(-1.34, Math.min(1.34, player.pitch));
}

function handleKeyDown(event) {
  keys.add(event.code);

  if (event.code === "KeyR") {
    startReload();
  }

  if (
    ["KeyW", "KeyA", "KeyS", "KeyD", "Space"].includes(event.code)
  ) {
    event.preventDefault();
  }
}

function handleKeyUp(event) {
  keys.delete(event.code);
}

function setAiming(value) {
  const nextAiming = Boolean(value && game.pointerLocked && !game.paused && !game.gameOver);
  if (player.aiming === nextAiming) {
    return;
  }

  player.aiming = nextAiming;
  document.body.classList.toggle("aiming", player.aiming);
  playTone(player.aiming ? 260 : 190, 0.055, 0.045, "square");
}

function toggleAiming() {
  setAiming(!player.aiming);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.033);

  if (game.started && !game.gameOver) {
    game.elapsed += delta;

    if (!game.paused) {
      updatePlayer(delta);
      updateEnemies(delta);
      updateProjectiles(delta);

      if (mouseDown && player.fireCooldown <= 0) {
        shoot();
      }

      if (player.reloading) {
        player.reloadTimer -= delta;
        if (player.reloadTimer <= 0) {
          finishReload();
        }
      }

      updateWaves(delta);
      updateEffects(delta);
      updateNotifications(delta);
    }
  } else {
    updateEffects(delta);
  }

  updateEnvironment(delta);
  updateCamera(delta);
  updateRadar();
  updateHud();
  composer.render();
}

startButton.addEventListener("click", () => startGame(false));
resumeButton.addEventListener("click", resumeGame);
restartButton.addEventListener("click", () => startGame(false));

canvas.addEventListener("mousedown", (event) => {
  if (event.button === 0 && game.pointerLocked) {
    mouseDown = true;
    shoot();
  } else if (event.button === 2) {
    toggleAiming();
  }
});

window.addEventListener("mouseup", (event) => {
  if (event.button !== 2) {
    mouseDown = false;
  }
});

canvas.addEventListener("contextmenu", (event) => event.preventDefault());
document.addEventListener("mousemove", handleMouseMove);
document.addEventListener("pointerlockchange", handlePointerLockChange);
window.addEventListener("keydown", handleKeyDown, { passive: false });
window.addEventListener("keyup", handleKeyUp);
window.addEventListener("blur", () => {
  keys.clear();
  mouseDown = false;
  setAiming(false);
});

window.addEventListener("resize", () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  composer.setSize(width, height);
  bloomPass.setSize(width, height);
});

window.__FPS_DEBUG__ = {
  start: () => startGame(true),
  state: () => ({
    started: game.started,
    paused: game.paused,
    gameOver: game.gameOver,
    wave: game.wave,
    enemies: enemies.length,
    pendingSpawns: game.pendingSpawns,
    health: player.health,
    armor: player.armor,
    ammo: player.ammo,
    reserve: player.reserve,
    kills: game.kills,
    score: game.score,
    shotsFired: game.shotsFired,
    shotsHit: game.shotsHit,
    aiming: player.aiming
  }),
  shoot: () => shoot(),
  setAiming: (value) => setAiming(value),
  toggleAiming,
  spawnEnemy: (type = "drone") => createEnemy(type, new THREE.Vector3(0, 0, 8)),
  setPlayerPosition: (x, y, z) => {
    player.position.set(x, y, z);
  },
  damagePlayer: (amount) => damagePlayer(amount, "debug")
};

updateHud();
animate();
