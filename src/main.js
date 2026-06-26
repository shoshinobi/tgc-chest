import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';

// ── Renderer ─────────────────────────────────────────────────────────────────

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;
document.getElementById('app').appendChild(renderer.domElement);

// ── Scene & camera ────────────────────────────────────────────────────────────

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x11_11_13);

const camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.01, 100);
camera.position.set(0, 0.6, 1.8);

// ── Orbit controls ────────────────────────────────────────────────────────────

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.rotateSpeed = 0.65;
controls.zoomSpeed = 0.75;
controls.panSpeed = 0.7;
controls.screenSpacePanning = false;
controls.minDistance = 1.2;
controls.maxDistance = 9.0;
controls.maxPolarAngle = Math.PI * 0.87;
controls.target.set(0, 0.75, 0);
controls.update();

// ── Re-center ─────────────────────────────────────────────────────────────────

const homePos = new THREE.Vector3(0, 0.6, 1.8);
const homeTarget = new THREE.Vector3(0, 0.75, 0);

let reCenterActive = false;
let reCenterProgress = 0;
const RC_DURATION = 0.85;
const rcFromPos = new THREE.Vector3();
const rcFromTarget = new THREE.Vector3();

function startReCenter() {
  rcFromPos.copy(camera.position);
  rcFromTarget.copy(controls.target);
  reCenterProgress = 0;
  reCenterActive = true;
}

document.getElementById('recenter-btn').addEventListener('click', startReCenter);

// ── Environment — RoomEnvironment ─────────────────────────────────────────────

const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

const roomEnv = new RoomEnvironment();
const roomEnvTexture = pmremGenerator.fromScene(roomEnv).texture;
roomEnv.dispose();

scene.environment = roomEnvTexture;
scene.environmentIntensity = 0.8;

// ── Pedestal ──────────────────────────────────────────────────────────────────

const PEDESTAL_HEIGHT = 0.1;

const pedestalGeo = new THREE.CylinderGeometry(1.08, 1.08, PEDESTAL_HEIGHT, 64);

const cubeRT = new THREE.WebGLCubeRenderTarget(128, {
  generateMipmaps: true,
  minFilter: THREE.LinearMipmapLinearFilter,
});
const cubeCamera = new THREE.CubeCamera(0.05, 10, cubeRT);
cubeCamera.position.y = PEDESTAL_HEIGHT;
scene.add(cubeCamera);

const pedestalMat = new THREE.MeshPhysicalMaterial({
  color: 0x0d_0d_10,
  roughness: 0.72,
  metalness: 0.0,
  clearcoat: 0.85,
  clearcoatRoughness: 0.44,
  envMap: cubeRT.texture,
  envMapIntensity: 0.65,
});

const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
pedestal.position.y = PEDESTAL_HEIGHT / 2;
scene.add(pedestal);

// ── Particle sprite ───────────────────────────────────────────────────────────

function createParticleSprite() {
  const size = 64;
  const half = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.0,  'rgba(255,255,255,1.0)');
  grad.addColorStop(0.2,  'rgba(255,255,255,0.85)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.12)');
  grad.addColorStop(1.0,  'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// ── Particles ─────────────────────────────────────────────────────────────────

const PARTICLE_COUNT = 700;
const SPREAD = 10;
const Y_MIN = 0;
const Y_MAX = 5.5;

const pPositions = new Float32Array(PARTICLE_COUNT * 3);
const pOrigX     = new Float32Array(PARTICLE_COUNT);
const pOrigZ     = new Float32Array(PARTICLE_COUNT);
const pPhase     = new Float32Array(PARTICLE_COUNT);
const pSpeed     = new Float32Array(PARTICLE_COUNT);

for (let i = 0; i < PARTICLE_COUNT; i++) {
  const x = (Math.random() - 0.5) * SPREAD;
  const z = (Math.random() - 0.5) * SPREAD;
  pOrigX[i] = x;
  pOrigZ[i] = z;
  pPositions[i * 3]     = x;
  pPositions[i * 3 + 1] = Math.random() * (Y_MAX - Y_MIN) + Y_MIN;
  pPositions[i * 3 + 2] = z;
  pPhase[i] = Math.random() * Math.PI * 2;
  pSpeed[i] = 0.0018 + Math.random() * 0.0025;
}

const particleGeo = new THREE.BufferGeometry();
particleGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));

const particleMat = new THREE.PointsMaterial({
  map: createParticleSprite(),
  color: 0xff_ff_ff,
  size: 0.075,
  transparent: true,
  opacity: 0.55,
  sizeAttenuation: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  alphaTest: 0.001,
});

scene.add(new THREE.Points(particleGeo, particleMat));

// ── Post-processing ───────────────────────────────────────────────────────────

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.10,  // strength
  0.84,  // radius
  0.82,  // threshold
);
composer.addPass(bloomPass);

const rgbShiftPass = new ShaderPass(RGBShiftShader);
rgbShiftPass.uniforms.amount.value = 0.0013;
composer.addPass(rgbShiftPass);

composer.addPass(new OutputPass());

// ── Textures ──────────────────────────────────────────────────────────────────

// ── Loading manager ───────────────────────────────────────────────────────────

const loaderEl  = document.getElementById('loader');
const loaderBar = document.getElementById('loader-bar');

const loadingManager = new THREE.LoadingManager();

loadingManager.onProgress = (_url, loaded, total) => {
  loaderBar.style.width = `${(loaded / total) * 100}%`;
};

loadingManager.onLoad = () => {
  loaderBar.style.width = '100%';
  loaderEl.addEventListener('transitionend', () => loaderEl.remove(), { once: true });
  // Small delay so the bar visibly hits 100% before fading
  setTimeout(() => loaderEl.classList.add('done'), 120);
};

const texLoader = new THREE.TextureLoader(loadingManager);

// Shared baked AO — used by all three material sets.
const aoTex = texLoader.load('/gltf/tex/chest_ambient_occlusion.png');
aoTex.flipY = false;

function loadSet(albedoUrl, normalUrl, mixUrl) {
  const albedo = texLoader.load(albedoUrl);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.flipY = false;
  const normal = texLoader.load(normalUrl);
  normal.flipY = false;
  const mix = texLoader.load(mixUrl);
  mix.flipY = false;
  return { albedo, normal, mix };
}

const texSets = {
  leatherBronze: loadSet(
    '/gltf/tex/leatherBronze_albedo.png',
    '/gltf/tex/leatherBronze_normal.png',
    '/gltf/tex/leatherBronze_mixmap.png',
  ),
  porcelanWood: loadSet(
    '/gltf/tex/porcelanWood_albedo.png',
    '/gltf/tex/porcelanWood_normal.png',
    '/gltf/tex/porcelanWood_mixmap.png',
  ),
  woodSteel: loadSet(
    '/gltf/tex/woodSteel_albedo.png',
    '/gltf/tex/woodSteel_normal.png',
    '/gltf/tex/woodSteel_mixmap.png',
  ),
};

// ── GLTF load ─────────────────────────────────────────────────────────────────

const chestMeshes = [];
let currentMaterial = null;
let mixer = null;
let gltfClips = [];

const gltfLoader = new GLTFLoader(loadingManager);

gltfLoader.load('/gltf/ChestBlender.gltf', (gltf) => {
  const model = gltf.scene;

  model.traverse((node) => {
    if (!node.isMesh) return;
    chestMeshes.push(node);
    const geo = node.geometry;
    if (geo.attributes.uv && !geo.attributes.uv1) {
      geo.setAttribute('uv1', geo.attributes.uv);
    }
    if (geo.attributes.uv && !geo.attributes.uv2) {
      geo.setAttribute('uv2', geo.attributes.uv);
    }
  });

  // Scale and position on pedestal
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  model.scale.setScalar(1.15 / size.y);

  box.setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y - PEDESTAL_HEIGHT;

  scene.add(model);

  // Aim orbit controls and store as home
  box.setFromObject(model);
  const finalCenter = box.getCenter(new THREE.Vector3());
  controls.target.copy(finalCenter);
  controls.update();

  homeTarget.copy(finalCenter);
  homePos.copy(camera.position);

  applyTextureSet('leatherBronze');

  if (gltf.animations?.length > 0) {
    gltfClips = gltf.animations;
    mixer = new THREE.AnimationMixer(model);
  }
});

// ── Material swap ─────────────────────────────────────────────────────────────

function applyTextureSet(setName) {
  const set = texSets[setName];
  if (!set) return;

  const prev = currentMaterial;

  currentMaterial = new THREE.MeshStandardMaterial({
    map: set.albedo,
    normalMap: set.normal,
    roughnessMap: set.mix,   // green channel
    metalnessMap: set.mix,   // blue channel
    aoMap: aoTex,            // dedicated baked AO
    aoMapIntensity: 1.0,
    side: THREE.DoubleSide,
  });

  chestMeshes.forEach((mesh) => { mesh.material = currentMaterial; });
  if (prev) prev.dispose();

  document.querySelectorAll('.mat-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.set === setName);
  });
}

// ── Animations ────────────────────────────────────────────────────────────────
// Clip 0 contains both the open (first half) and close (second half) keyframes.
// Open: play from 0 → 50% then pause. Close: resume from 50% → end.

let activeAction = null;
let pauseAtTime  = null;

function playOpen() {
  if (!mixer || !gltfClips[0]) return;
  if (!activeAction) activeAction = mixer.clipAction(gltfClips[0]);
  activeAction.paused = false;
  activeAction.reset();
  activeAction.loop = THREE.LoopOnce;
  activeAction.clampWhenFinished = true;
  activeAction.setEffectiveTimeScale(1);
  activeAction.setEffectiveWeight(1);
  activeAction.play();
  pauseAtTime = gltfClips[0].duration * 0.5;
}

function playClose() {
  if (!activeAction) return;
  pauseAtTime = null;       // cancel any pending pause
  activeAction.paused = false; // resume from wherever it stopped
}

document.getElementById('btn-open').addEventListener('click', playOpen);
document.getElementById('btn-close').addEventListener('click', playClose);

// ── Settings dropdown ─────────────────────────────────────────────────────────

const settingsBody   = document.getElementById('settings-body');
const settingsToggle = document.getElementById('settings-toggle');

settingsToggle.addEventListener('click', () => {
  const open = settingsBody.classList.toggle('open');
  settingsToggle.dataset.open = String(open);
});

// ── UI bindings ───────────────────────────────────────────────────────────────

document.querySelectorAll('.mat-btn').forEach((btn) => {
  btn.addEventListener('click', () => applyTextureSet(btn.dataset.set));
});

const fovSlider = document.getElementById('fov-slider');
const fovValue  = document.getElementById('fov-value');
fovSlider.addEventListener('input', () => {
  camera.fov = Number(fovSlider.value);
  camera.updateProjectionMatrix();
  fovValue.textContent = `${fovSlider.value}°`;
});

document.getElementById('env-intensity').addEventListener('input', (e) => {
  scene.environmentIntensity = Number(e.target.value) / 100;
  document.getElementById('env-intensity-val').textContent = scene.environmentIntensity.toFixed(2);
});

document.getElementById('bloom-strength').addEventListener('input', (e) => {
  bloomPass.strength = Number(e.target.value) / 100;
  document.getElementById('bloom-strength-val').textContent = bloomPass.strength.toFixed(2);
});

document.getElementById('bloom-blur').addEventListener('input', (e) => {
  bloomPass.radius = Number(e.target.value) / 100;
  document.getElementById('bloom-blur-val').textContent = bloomPass.radius.toFixed(2);
});

const autoOrbitBtn = document.getElementById('auto-orbit-btn');
autoOrbitBtn.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  autoOrbitBtn.dataset.active = String(controls.autoRotate);
  autoOrbitBtn.textContent = controls.autoRotate ? 'On' : 'Off';
});

// ── Inactivity auto-orbit ─────────────────────────────────────────────────────
// Starts auto-orbit 4 s after the last canvas interaction; any interaction
// (drag, scroll, touch) cancels it and restarts the countdown.

let inactivityTimer = null;

function onUserInteraction() {
  if (controls.autoRotate) {
    controls.autoRotate = false;
    autoOrbitBtn.dataset.active = 'false';
    autoOrbitBtn.textContent = 'Off';
  }
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    controls.autoRotate = true;
    autoOrbitBtn.dataset.active = 'true';
    autoOrbitBtn.textContent = 'On';
  }, 4000);
}

renderer.domElement.addEventListener('pointerdown', onUserInteraction, { passive: true });
renderer.domElement.addEventListener('wheel',       onUserInteraction, { passive: true });
renderer.domElement.addEventListener('touchstart',  onUserInteraction, { passive: true });

// Kick off the initial countdown on page load
onUserInteraction();

// ── HDR preset dropdown ───────────────────────────────────────────────────────

const HDR_PRESETS = {
  'indoor-studio': '/gltf/tex/Indoor_Studio_2.hdr',
  'neutral':       '/gltf/tex/Neutral_512.hdr',
  'photobox':      '/gltf/tex/Photobox_512.hdr',
  'studio':        '/gltf/tex/Studio.hdr',
};

document.getElementById('hdr-select').addEventListener('change', (e) => {
  const val = e.target.value;
  if (!val) {
    scene.environment = roomEnvTexture;
    if (scene.background instanceof THREE.Texture) scene.background = null;
    return;
  }
  const url = HDR_PRESETS[val];
  if (!url) return;
  new RGBELoader().load(url, (hdrTex) => {
    const envMap = pmremGenerator.fromEquirectangular(hdrTex).texture;
    scene.environment = envMap;
    hdrTex.dispose();
  });
});

document.getElementById('reset-hdr-btn').addEventListener('click', () => {
  scene.environment = roomEnvTexture;
  if (scene.background instanceof THREE.Texture) scene.background = null;
  document.getElementById('hdr-select').value = '';
});


// ── Resize ────────────────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.setSize(window.innerWidth, window.innerHeight);
});

// ── Render loop ───────────────────────────────────────────────────────────────

const clock    = new THREE.Clock();
const posAttr  = particleGeo.attributes.position;
const fpsEl    = document.getElementById('fps-counter');
let fpsFrames  = 0;
let fpsAccum   = 0;

function animate() {
  requestAnimationFrame(animate);
  const delta   = clock.getDelta();
  const elapsed = clock.elapsedTime;

  // FPS counter — update every 500 ms
  fpsFrames++;
  fpsAccum += delta;
  if (fpsAccum >= 0.5) {
    fpsEl.textContent = `${Math.round(fpsFrames / fpsAccum)} fps`;
    fpsFrames = 0;
    fpsAccum  = 0;
  }

  // Animate particles
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    pPositions[i * 3 + 1] += pSpeed[i];
    pPositions[i * 3]      = pOrigX[i] + Math.sin(elapsed * 0.38 + pPhase[i]) * 0.18;
    pPositions[i * 3 + 2]  = pOrigZ[i] + Math.cos(elapsed * 0.29 + pPhase[i]) * 0.18;
    if (pPositions[i * 3 + 1] > Y_MAX) {
      pPositions[i * 3 + 1] = Y_MIN + Math.random() * 0.4;
    }
  }
  posAttr.needsUpdate = true;

  // Update pedestal cube-map reflection
  pedestal.visible = false;
  cubeCamera.update(renderer, scene);
  pedestal.visible = true;

  // Smooth re-center
  if (reCenterActive) {
    reCenterProgress += delta / RC_DURATION;
    const t = Math.min(reCenterProgress, 1);
    const ease = 1 - (1 - t) ** 3;
    camera.position.lerpVectors(rcFromPos, homePos, ease);
    controls.target.lerpVectors(rcFromTarget, homeTarget, ease);
    if (t >= 1) reCenterActive = false;
  }

  if (mixer) {
    mixer.update(delta);
    if (activeAction && pauseAtTime !== null && activeAction.time >= pauseAtTime) {
      activeAction.paused = true;
      pauseAtTime = null;
    }
  }
  controls.update();
  composer.render();
}

animate();
