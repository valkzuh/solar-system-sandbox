const canvas = document.getElementById('viz');
const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
const overlay = document.getElementById('overlay');
const overlayCtx = overlay.getContext('2d');

const presetSelect = document.getElementById('presetSelect');
const presetDescription = document.getElementById('presetDescription');
const radiusValue = document.getElementById('radiusValue');
const horizonValue = document.getElementById('horizonValue');
const iscoValue = document.getElementById('iscoValue');
const photonValue = document.getElementById('photonValue');
const shadowValue = document.getElementById('shadowValue');
const eddingtonValue = document.getElementById('eddingtonValue');
const periodValue = document.getElementById('periodValue');
const statusValue = document.getElementById('status');
const randomizeBtn = document.getElementById('randomizeBtn');
const resetBtn = document.getElementById('resetBtn');
const resetCameraBtn = document.getElementById('resetCamera');
const placePlanetBtn = document.getElementById('placePlanetBtn');
const clearPlanetsBtn = document.getElementById('clearPlanetsBtn');
const planetHint = document.getElementById('planetHint');
const planetEditor = document.getElementById('planetEditor');
const planetSelect = document.getElementById('planetSelect');
const planetMassEdit = document.getElementById('planetMassEdit');
const planetDistanceEdit = document.getElementById('planetDistanceEdit');
const planetSpeedEdit = document.getElementById('planetSpeedEdit');
const planetTiltEdit = document.getElementById('planetTiltEdit');
const planetEccEdit = document.getElementById('planetEccEdit');
const planetTempEdit = document.getElementById('planetTempEdit');
const planetMassValue = document.getElementById('planetMassValue');
const planetDistanceValue = document.getElementById('planetDistanceValue');
const planetSpeedValue = document.getElementById('planetSpeedValue');
const planetTiltValue = document.getElementById('planetTiltValue');
const planetEccValue = document.getElementById('planetEccValue');
const planetTempValue = document.getElementById('planetTempValue');
const deletePlanetBtn = document.getElementById('deletePlanetBtn');
const focusPlanetBtn = document.getElementById('focusPlanetBtn');
const autoOrbitToggle = document.getElementById('autoOrbitToggle');

const placeStarBtn = document.getElementById('placeStarBtn');
const clearStarsBtn = document.getElementById('clearStarsBtn');
const starHint = document.getElementById('starHint');
const starEditor = document.getElementById('starEditor');
const starSelect = document.getElementById('starSelect');
const starMassEdit = document.getElementById('starMassEdit');
const starTempEdit = document.getElementById('starTempEdit');
const starMassValue = document.getElementById('starMassValue');
const starTempValue = document.getElementById('starTempValue');
const starDistanceEdit = document.getElementById('starDistanceEdit');
const starSpeedEdit = document.getElementById('starSpeedEdit');
const starTiltEdit = document.getElementById('starTiltEdit');
const starEccEdit = document.getElementById('starEccEdit');
const starDistanceValue = document.getElementById('starDistanceValue');
const starSpeedValue = document.getElementById('starSpeedValue');
const starTiltValue = document.getElementById('starTiltValue');
const starEccValue = document.getElementById('starEccValue');
const deleteStarBtn = document.getElementById('deleteStarBtn');
const focusStarBtn = document.getElementById('focusStarBtn');
const showAllOrbitsToggle = document.getElementById('showAllOrbits');

const panel = document.getElementById('panel');
const panelDock = document.getElementById('panelDock');
const menuToggle = document.getElementById('menuToggle');
const menuShow = document.getElementById('menuShow');

const MASS_MIN = 1;
const MASS_MAX = 1e10;
const MASS_LOG_MIN = Math.log10(MASS_MIN);
const MASS_LOG_MAX = Math.log10(MASS_MAX);
const G = 6.6743e-11;
const C = 299792458;
const MSUN = 1.98847e30;
const MEARTH = 5.9722e24;

const defaultParams = {
  mass: 10,
  spin: 0.6,
  inclination: 35,
  accretion: 0.4,
  diskSense: 'prograde',
  diskInnerFactor: 1.0,
  diskOuterFactor: 8.0,
  diskThickness: 0.35,
  diskHue: 28,
  ringBrightness: 0.8,
  jetPower: 0.45,
  jetWidth: 0.65,
  pulse: 0.1,
  zoom: 1.0,
  starDensity: 0.5,
  dustDensity: 0.4,
  lensing: 0.8,
  gridStrength: 0.6,
  backgroundGlow: 0.55,
  animationSpeed: 1.0,
  simSpeed: 1.0,
  planetMass: 1.0,
  planetTemp: 280,
  starMass: 1.0,
  starTemp: 5800
};

const presets = [
  {
    name: 'Stellar Black Hole (X-ray Binary)',
    mode: 'blackhole',
    note: 'Compact remnant with bright accretion and modest jets.',
    params: {
      mass: 12,
      spin: 0.7,
      inclination: 40,
      accretion: 0.6,
      diskSense: 'prograde',
      diskInnerFactor: 1.05,
      diskOuterFactor: 9,
      diskThickness: 0.38,
      diskHue: 30,
      ringBrightness: 0.75,
      jetPower: 0.45,
      jetWidth: 0.7,
      pulse: 0.08,
      zoom: 1.0,
      starDensity: 0.55,
      dustDensity: 0.5,
      backgroundGlow: 0.6,
      animationSpeed: 1.2
    }
  },
  {
    name: 'Intermediate Black Hole',
    mode: 'blackhole',
    note: 'Heavier disk with calmer inflow.',
    params: {
      mass: 3800,
      spin: 0.45,
      inclination: 28,
      accretion: 0.3,
      diskSense: 'prograde',
      diskInnerFactor: 1.15,
      diskOuterFactor: 12,
      diskThickness: 0.42,
      diskHue: 24,
      ringBrightness: 0.6,
      jetPower: 0.25,
      jetWidth: 0.6,
      pulse: 0.05,
      zoom: 0.95,
      starDensity: 0.45,
      dustDensity: 0.35,
      backgroundGlow: 0.5,
      animationSpeed: 0.9
    }
  },
  {
    name: 'Supermassive (Sgr A*)',
    mode: 'blackhole',
    note: 'Massive core with deep lensing and slower dynamics.',
    params: {
      mass: 4.3e6,
      spin: 0.52,
      inclination: 25,
      accretion: 0.12,
      diskSense: 'prograde',
      diskInnerFactor: 1.1,
      diskOuterFactor: 14,
      diskThickness: 0.48,
      diskHue: 18,
      ringBrightness: 0.55,
      jetPower: 0.18,
      jetWidth: 0.5,
      pulse: 0.02,
      zoom: 0.9,
      starDensity: 0.4,
      dustDensity: 0.3,
      backgroundGlow: 0.45,
      animationSpeed: 0.7
    }
  },
  {
    name: 'Quasar (AGN)',
    mode: 'blackhole',
    note: 'Extremely luminous disk and powerful jets.',
    params: {
      mass: 8.5e7,
      spin: 0.88,
      inclination: 55,
      accretion: 1.4,
      diskSense: 'prograde',
      diskInnerFactor: 1.0,
      diskOuterFactor: 18,
      diskThickness: 0.58,
      diskHue: 36,
      ringBrightness: 0.9,
      jetPower: 0.95,
      jetWidth: 0.85,
      pulse: 0.18,
      zoom: 0.85,
      starDensity: 0.45,
      dustDensity: 0.65,
      backgroundGlow: 0.8,
      animationSpeed: 1.1
    }
  },
  {
    name: 'Blazar (Jet-Aligned)',
    mode: 'blackhole',
    note: 'Jets aligned with the observer: intense beaming.',
    params: {
      mass: 5.5e7,
      spin: 0.9,
      inclination: 8,
      accretion: 1.1,
      diskSense: 'prograde',
      diskInnerFactor: 1.0,
      diskOuterFactor: 15,
      diskThickness: 0.5,
      diskHue: 32,
      ringBrightness: 0.85,
      jetPower: 1.0,
      jetWidth: 0.5,
      pulse: 0.15,
      zoom: 1.05,
      starDensity: 0.35,
      dustDensity: 0.55,
      backgroundGlow: 0.75,
      animationSpeed: 1.2
    }
  },
  {
    name: 'Microquasar',
    mode: 'blackhole',
    note: 'Stellar mass with relativistic, focused jets.',
    params: {
      mass: 9,
      spin: 0.82,
      inclination: 48,
      accretion: 0.75,
      diskSense: 'prograde',
      diskInnerFactor: 1.0,
      diskOuterFactor: 10,
      diskThickness: 0.4,
      diskHue: 34,
      ringBrightness: 0.8,
      jetPower: 0.9,
      jetWidth: 0.55,
      pulse: 0.12,
      zoom: 1.05,
      starDensity: 0.55,
      dustDensity: 0.6,
      backgroundGlow: 0.7,
      animationSpeed: 1.3
    }
  },
  {
    name: 'Binary Black Hole',
    mode: 'blackhole',
    note: 'Two compact objects with orbital motion.',
    params: {
      mass: 45,
      spin: 0.65,
      inclination: 35,
      accretion: 0.25,
      diskSense: 'retrograde',
      diskInnerFactor: 1.2,
      diskOuterFactor: 11,
      diskThickness: 0.32,
      diskHue: 22,
      ringBrightness: 0.7,
      jetPower: 0.4,
      jetWidth: 0.75,
      pulse: 0.12,
      zoom: 0.98,
      starDensity: 0.5,
      dustDensity: 0.4,
      backgroundGlow: 0.55,
      animationSpeed: 1.1,
      simSpeed: 6.0
    }
  },
  {
    name: 'Primordial Black Hole',
    mode: 'blackhole',
    note: 'Small, fast, and mostly dark.',
    params: {
      mass: 1.3,
      spin: 0.8,
      inclination: 25,
      accretion: 0.05,
      diskSense: 'prograde',
      diskInnerFactor: 1.4,
      diskOuterFactor: 6,
      diskThickness: 0.2,
      diskHue: 12,
      ringBrightness: 0.4,
      jetPower: 0.25,
      jetWidth: 0.6,
      pulse: 0.2,
      zoom: 1.2,
      starDensity: 0.4,
      dustDensity: 0.2,
      backgroundGlow: 0.3,
      animationSpeed: 1.5
    }
  },
  {
    name: 'Pulsar (Neutron Star)',
    mode: 'pulsar',
    note: 'Not a black hole: a magnetized neutron star with beams.',
    params: {
      mass: 2.1,
      spin: 0.95,
      inclination: 30,
      accretion: 0.08,
      diskSense: 'prograde',
      diskInnerFactor: 1.2,
      diskOuterFactor: 7,
      diskThickness: 0.18,
      diskHue: 18,
      ringBrightness: 0.15,
      jetPower: 0.9,
      jetWidth: 0.5,
      pulse: 1.0,
      zoom: 1.1,
      starDensity: 0.55,
      dustDensity: 0.25,
      backgroundGlow: 0.85,
      animationSpeed: 1.6
    }
  }
];

const state = {
  mode: 'blackhole',
  params: { ...defaultParams },
  preset: presets[0].name,
  lastPreset: presets[0].name,
  selectedPlanetId: null,
  selectedStarId: null,
  cameraAutoOrbit: true,
  showAllOrbits: true
};

const paramRanges = {
  mass: [MASS_MIN, MASS_MAX],
  spin: [0, 0.998],
  inclination: [0, 80],
  accretion: [0, 2],
  diskInnerFactor: [1, 3],
  diskOuterFactor: [3, 25],
  diskThickness: [0.1, 1.2],
  diskHue: [0, 60],
  ringBrightness: [0, 1],
  jetPower: [0, 1],
  jetWidth: [0.2, 1.2],
  pulse: [0, 1],
  starDensity: [0, 1],
  dustDensity: [0, 1],
  lensing: [0, 1],
  gridStrength: [0, 1],
  backgroundGlow: [0, 1],
  animationSpeed: [0, 2.5],
  simSpeed: [0, 200],
  planetMass: [0.1, 3000],
  planetTemp: [50, 2000],
  starMass: [0.1, 50],
  starTemp: [2000, 20000]
};

const derived = {
  rg: 0,
  rs: 0,
  rPlus: 0,
  risco: 0,
  riscoRg: 6,
  rPhotonPro: 0,
  rPhotonRetro: 0,
  shadowRadiusRg: Math.sqrt(27),
  shadowPath: [],
  eddington: 0,
  iscoPeriod: 0
};

let stars = [];
let dust = [];
let physicsTimer = null;
let physicsRequestId = 0;
let isDragging = false;
let dragMode = 'rotate';
let lastPointerX = 0;
let lastPointerY = 0;

const camera = {
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  pitch: 0,
  flyPos: vec3(),
  followId: null,
  followKind: null
};

let glState = null;
let lastShaderError = '';
let pixelRatio = 1;
let lastFrameTime = 0;
let currentAutoPitch = 0;
let currentTimeSeconds = 0;
const collisionFlashes = [];
const COLLISION_FLASH_DURATION = 1.2;

const nbody = {
  bodies: [],
  planets: [],
  stars: [],
  binary: false,
  placing: false,
  placingStar: false,
  separation: 8,
  massRatio: 0.6
};

const TRAIL_MAX = 2400;
const TRAIL_SAMPLE = 0.02;
const ORBIT_TRAIL_MIN = 120;
const MAX_PLANETS = 16;
const MAX_STARS = 8;
const MAX_BH = 2;
const planetUniformData = new Float32Array(MAX_PLANETS * 4);
const planetColorData = new Float32Array(MAX_PLANETS * 4);
const planetPropData = new Float32Array(MAX_PLANETS * 4);
const starUniformData = new Float32Array(MAX_STARS * 4);
const starPropData = new Float32Array(MAX_STARS * 4);
const bhUniformData = new Float32Array(MAX_BH * 4);

function vec3(x = 0, y = 0, z = 0) {
  return { x, y, z };
}

function add3(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function sub3(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale3(v, s) {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function len3(v) {
  return Math.hypot(v.x, v.y, v.z);
}

function normalize3(v) {
  const l = len3(v) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

function cross3(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function dot3(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function getBarycenterData() {
  const bhBodies = nbody.bodies.filter((body) => body.kind === 'bh');
  const totalMass = bhBodies.reduce((sum, body) => sum + body.mass, 0) || 1;
  const bary = bhBodies.reduce(
    (acc, body) => {
      acc.x += body.pos.x * body.mass;
      acc.y += body.pos.y * body.mass;
      acc.z += body.pos.z * body.mass;
      return acc;
    },
    vec3()
  );
  const baryVel = bhBodies.reduce(
    (acc, body) => {
      acc.x += body.vel.x * body.mass;
      acc.y += body.vel.y * body.mass;
      acc.z += body.vel.z * body.mass;
      return acc;
    },
    vec3()
  );
  bary.x /= totalMass;
  bary.y /= totalMass;
  bary.z /= totalMass;
  baryVel.x /= totalMass;
  baryVel.y /= totalMass;
  baryVel.z /= totalMass;
  return { totalMass, bary, baryVel };
}

function setPlanetMass(planet, earthMass) {
  const { totalMass } = getBarycenterData();
  const clamped = Math.max(earthMass, 0.01);
  const planetMass = (clamped * MEARTH) / MSUN;
  planet.massEarth = clamped;
  planet.mass = Math.max((planetMass / state.params.mass) * totalMass, 1e-6);
  const sizeScale = Math.cbrt(clamped);
  planet.radius = Math.max(0.08, 0.08 * sizeScale);
  updatePlanetType(planet);
}

function setPlanetTemperature(planet, tempK) {
  const clamped = clamp(tempK, 50, 2000);
  planet.tempK = clamped;
  planet.tempLocked = true;
  updatePlanetType(planet);
}

function updatePlanetType(planet) {
  if (!planet) return;
  const mass = planet.massEarth || 1;
  const temp = planet.tempK || 280;
  if (mass >= 30) {
    planet.type = 1; // gas giant
  } else if (temp < 170) {
    planet.type = 2; // icy
  } else if (temp > 800) {
    planet.type = 3; // lava
  } else if (temp > 350) {
    planet.type = 4; // desert
  } else {
    planet.type = 0; // temperate
  }
}

function setStarMass(star, massMsun) {
  const { totalMass } = getBarycenterData();
  const clamped = clamp(massMsun, 0.1, 50);
  star.massMsun = clamped;
  star.mass = Math.max((clamped / state.params.mass) * totalMass, 1e-6);
  const sizeScale = Math.pow(clamped, 0.8);
  star.radius = Math.max(0.12, 0.18 * sizeScale);
  updateStarLuminosity(star);
}

function setStarTemp(star, tempK) {
  star.tempK = clamp(tempK, 2000, 20000);
  updateStarLuminosity(star);
}

function updateStarLuminosity(star) {
  if (!star) return;
  const temp = star.tempK || 5800;
  const radius = star.radius || 0.2;
  const tempFactor = Math.pow(temp / 5800, 4);
  const radiusFactor = Math.pow(radius / 0.2, 2);
  star.luminosity = clamp(radiusFactor * tempFactor, 0.1, 80);
}

function applyOrbitToBody(body, distance, speedScale) {
  const { totalMass, bary, baryVel } = getBarycenterData();
  const targetA = Math.max(distance, 0.5);
  const mu = Math.max(totalMass, 1e-6);
  const ecc = clamp(body.orbitEcc || 0, 0, 0.9);
  const tilt = ((body.orbitTilt || 0) * Math.PI) / 180;
  const sense = body.orbitDirection || (state.params.diskSense === 'retrograde' ? -1 : 1);

  const rPeri = targetA * (1 - ecc);
  const vPeri = Math.sqrt(mu * (1 + ecc) / Math.max(rPeri, 1e-6)) * (speedScale || 1);

  let pos = vec3(rPeri, 0, 0);
  let vel = vec3(0, 0, sense * vPeri);
  pos = rotateX(pos, tilt);
  vel = rotateX(vel, tilt);

  body.orbitDistance = targetA;
  body.orbitSpeedScale = speedScale;
  body.orbitDirection = sense;
  body.pos = add3(bary, pos);
  body.vel = add3(baryVel, vel);
  body.trail = [vec3(body.pos.x, body.pos.y, body.pos.z)];
  body.trailTime = 0;
}

function seedOrbitFromPosition(body, pos, speedScale) {
  const { totalMass, bary, baryVel } = getBarycenterData();
  const rel = sub3(pos, bary);
  const r = len3(rel);
  if (r < 0.4) return false;
  const mu = Math.max(totalMass, 1e-6);
  const sense = body.orbitDirection || (state.params.diskSense === 'retrograde' ? -1 : 1);
  const up = vec3(0, 1, 0);
  const tangentDir = normalize3(cross3(up, rel));
  const vMag = Math.sqrt(mu / r) * (speedScale || 1);
  body.pos = vec3(pos.x, pos.y, pos.z);
  body.vel = add3(baryVel, scale3(tangentDir, sense * vMag));
  body.orbitDistance = r;
  body.orbitSpeedScale = speedScale;
  return true;
}

function setBodySpeedScale(body, speedScale) {
  if (!body) return;
  const { baryVel } = getBarycenterData();
  const current = body.orbitSpeedScale || 1;
  const factor = current > 0 ? speedScale / current : speedScale;
  const relVel = sub3(body.vel, baryVel);
  body.vel = add3(baryVel, scale3(relVel, factor));
  body.orbitSpeedScale = speedScale;
}

function updateStarOrbit(star, distance, speedScale = 1) {
  applyOrbitToBody(star, distance, speedScale);
}

function addStarAt(pos) {
  const { bary } = getBarycenterData();
  const rel = sub3(pos, bary);
  const star = {
    id: `s${Date.now()}${Math.random().toString(16).slice(2)}`,
    kind: 'star',
    mass: 1e-6,
    massMsun: state.params.starMass || 1,
    tempK: state.params.starTemp || 5800,
    luminosity: 1,
    pos: vec3(pos.x, pos.y, pos.z),
    vel: vec3(),
    radius: 0.2,
    trail: [vec3(pos.x, pos.y, pos.z)],
    trailTime: 0,
    orbitDistance: 0,
    orbitSpeedScale: 1.0,
    orbitTilt: 0,
    orbitEcc: 0,
    orbitDirection: state.params.diskSense === 'retrograde' ? -1 : 1,
    seed: Math.random() * 1000,
    colorRgb: kelvinToRgb(state.params.starTemp || 5800)
  };
  setStarMass(star, star.massMsun);
  setStarTemp(star, star.tempK);
  const r = Math.hypot(rel.x, rel.z);
  const seeded = seedOrbitFromPosition(star, pos, star.orbitSpeedScale);
  if (!seeded) {
    updateStarOrbit(star, r, star.orbitSpeedScale);
  }
  star.trail = [vec3(star.pos.x, star.pos.y, star.pos.z)];
  nbody.stars.push(star);
  nbody.bodies.push(star);
  selectStar(star);
}

function updatePlanetOrbit(planet, distance, speedScale) {
  applyOrbitToBody(planet, distance, speedScale);
}

function rotateX(v, a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
}

function rotateY(v, a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c };
}

function hslToRgb(h, s, l) {
  const hh = ((h % 360) + 360) % 360;
  const ss = clamp(s / 100, 0, 1);
  const ll = clamp(l / 100, 0, 1);
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const hp = hh / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp >= 0 && hp < 1) {
    r = c;
    g = x;
  } else if (hp >= 1 && hp < 2) {
    r = x;
    g = c;
  } else if (hp >= 2 && hp < 3) {
    g = c;
    b = x;
  } else if (hp >= 3 && hp < 4) {
    g = x;
    b = c;
  } else if (hp >= 4 && hp < 5) {
    r = x;
    b = c;
  } else if (hp >= 5 && hp < 6) {
    r = c;
    b = x;
  }
  const m = ll - c * 0.5;
  return { r: r + m, g: g + m, b: b + m };
}

function parsePlanetColor(color) {
  if (!color || typeof color !== 'string') {
    return { r: 0.6, g: 0.8, b: 1.0 };
  }
  const hslMatch = color.match(/hsl\(\s*([-\d.]+)\s*,\s*([-\d.]+)%\s*,\s*([-\d.]+)%\s*\)/i);
  if (hslMatch) {
    const h = parseFloat(hslMatch[1]);
    const s = parseFloat(hslMatch[2]);
    const l = parseFloat(hslMatch[3]);
    return hslToRgb(h, s, l);
  }
  const rgbMatch = color.match(/rgb\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/i);
  if (rgbMatch) {
    const r = parseFloat(rgbMatch[1]) / 255;
    const g = parseFloat(rgbMatch[2]) / 255;
    const b = parseFloat(rgbMatch[3]) / 255;
    return { r: clamp(r, 0, 1), g: clamp(g, 0, 1), b: clamp(b, 0, 1) };
  }
  return { r: 0.6, g: 0.8, b: 1.0 };
}

function kelvinToRgb(kelvin) {
  const temp = clamp(kelvin, 1000, 40000) / 100;
  let r;
  let g;
  let b;
  if (temp <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(temp) - 161.1195681661;
    b = temp <= 19 ? 0 : 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
    b = 255;
  }
  return {
    r: clamp(r / 255, 0, 1),
    g: clamp(g / 255, 0, 1),
    b: clamp(b / 255, 0, 1)
  };
}

function getMassScale() {
  return Math.max(Math.log2(Math.max(state.params.mass, 1)) / 24, 0.35);
}

function getRsVisual() {
  return 2 * getMassScale();
}

function getPhysicsScale() {
  const massKg = state.params.mass * MSUN;
  const rs_m = (2 * G * massKg) / (C * C);
  return { massKg, rs_m };
}

function resetNBody() {
  nbody.planets = [];
  nbody.bodies = [];
  nbody.stars = [];
  nbody.binary = state.preset === 'Binary Black Hole';
  nbody.placing = false;
  nbody.placingStar = false;

  const totalMass = getMassScale();
  const m1 = totalMass * nbody.massRatio;
  const m2 = totalMass * (1 - nbody.massRatio);
  const sep = nbody.separation;

  if (nbody.binary) {
    const r1 = (sep * m2) / (m1 + m2);
    const r2 = (sep * m1) / (m1 + m2);
    const omega = Math.sqrt((m1 + m2) / (sep * sep * sep));
    const v1 = omega * r1;
    const v2 = omega * r2;
    const bh1 = {
      id: 'bh1',
      kind: 'bh',
      mass: m1,
      pos: vec3(r1, 0, 0),
      vel: vec3(0, 0, v1),
      radius: m1 / totalMass,
      trail: [vec3(r1, 0, 0)],
      trailTime: 0
    };
    const bh2 = {
      id: 'bh2',
      kind: 'bh',
      mass: m2,
      pos: vec3(-r2, 0, 0),
      vel: vec3(0, 0, -v2),
      radius: m2 / totalMass,
      trail: [vec3(-r2, 0, 0)],
      trailTime: 0
    };
    nbody.bodies.push(bh1, bh2);
  } else {
    const bh = {
      id: 'bh',
      kind: 'bh',
      mass: totalMass,
      pos: vec3(0, 0, 0),
      vel: vec3(0, 0, 0),
      radius: 1,
      trail: [vec3(0, 0, 0)],
      trailTime: 0
    };
    nbody.bodies.push(bh);
  }
  state.selectedPlanetId = null;
  state.selectedStarId = null;
  updatePlanetUi();
  updateStarUi();
}

function addPlanetAt(pos) {
  const { bary } = getBarycenterData();
  const earthMass = Math.max(state.params.planetMass, 0.01);
  const rel = sub3(pos, bary);
  const r = Math.hypot(rel.x, rel.z);
  if (r < 0.6) return;

  const hue = 180 + Math.random() * 120;
  const planet = {
    id: `p${Date.now()}${Math.random().toString(16).slice(2)}`,
    kind: 'planet',
    mass: 1e-6,
    pos: vec3(pos.x, 0, pos.z),
    vel: vec3(),
    trail: [vec3(pos.x, 0, pos.z)],
    trailTime: 0,
    massEarth: earthMass,
    tempK: state.params.planetTemp || 280,
    tempLocked: false,
    orbitDistance: r,
    orbitSpeedScale: 1.0,
    orbitTilt: 0,
    orbitEcc: 0,
    orbitDirection: state.params.diskSense === 'retrograde' ? -1 : 1,
    radius: Math.max(0.06, Math.log10(earthMass + 1) * 0.05),
    color: `hsl(${Math.floor(hue)}, 70%, 60%)`,
    colorRgb: hslToRgb(hue, 70, 60),
    seed: Math.random() * 1000
  };
  setPlanetMass(planet, earthMass);
  setPlanetTemperature(planet, planet.tempK);
  const seeded = seedOrbitFromPosition(planet, pos, planet.orbitSpeedScale);
  if (!seeded) {
    updatePlanetOrbit(planet, r, planet.orbitSpeedScale);
  }
  planet.trail = [vec3(planet.pos.x, planet.pos.y, planet.pos.z)];
  nbody.planets.push(planet);
  nbody.bodies.push(planet);
  selectPlanet(planet);
}

function updateNBody(dt) {
  if (!nbody.bodies.length) return;
  const totalMass = nbody.bodies.reduce((sum, body) => sum + body.mass, 0);
  if (dt <= 0) return;
  const baseSubsteps = 6;
  const simBoost = Math.max(state.params.simSpeed || 1, 1);
  const substeps = Math.min(64, Math.max(baseSubsteps, Math.ceil(baseSubsteps * Math.sqrt(simBoost))));
  const h = dt / substeps;
  const eps = 0.012 * getRsVisual();
  const G_SIM = 1.0;

  const computeAcc = () => {
    const acc = nbody.bodies.map(() => vec3());
    for (let i = 0; i < nbody.bodies.length; i += 1) {
      for (let j = i + 1; j < nbody.bodies.length; j += 1) {
        const bi = nbody.bodies[i];
        const bj = nbody.bodies[j];
        const d = sub3(bj.pos, bi.pos);
        const dist2 = d.x * d.x + d.y * d.y + d.z * d.z + eps * eps;
        const dist = Math.sqrt(dist2);
        const invDist3 = 1 / (dist2 * dist);
        const ax = d.x * invDist3 * G_SIM;
        const ay = d.y * invDist3 * G_SIM;
        const az = d.z * invDist3 * G_SIM;

        acc[i].x += ax * bj.mass;
        acc[i].y += ay * bj.mass;
        acc[i].z += az * bj.mass;
        acc[j].x -= ax * bi.mass;
        acc[j].y -= ay * bi.mass;
        acc[j].z -= az * bi.mass;
      }
    }
    return acc;
  };

  for (let step = 0; step < substeps; step += 1) {
    const acc0 = computeAcc();
    for (let i = 0; i < nbody.bodies.length; i += 1) {
      const body = nbody.bodies[i];
      body.vel = add3(body.vel, scale3(acc0[i], h * 0.5));
      body.pos = add3(body.pos, scale3(body.vel, h));
    }
    const acc1 = computeAcc();
    for (let i = 0; i < nbody.bodies.length; i += 1) {
      const body = nbody.bodies[i];
      body.vel = add3(body.vel, scale3(acc1[i], h * 0.5));
    }
  }

  const horizonScale = 1.04;
  const bhMassTotal = nbody.bodies
    .filter((body) => body.kind === 'bh')
    .reduce((sum, body) => sum + body.mass, 0) || totalMass;
  nbody.planets = nbody.planets.filter((planet) => {
    for (const body of nbody.bodies) {
      if (body.kind !== 'bh') continue;
      const horizon = (body.mass / bhMassTotal) * horizonScale;
      const dist = len3(sub3(planet.pos, body.pos));
      if (dist < horizon) {
        nbody.bodies = nbody.bodies.filter((b) => b.id !== planet.id);
        return false;
      }
    }
    return true;
  });

  nbody.stars = nbody.stars.filter((star) => {
    for (const body of nbody.bodies) {
      if (body.kind !== 'bh') continue;
      const horizon = (body.mass / bhMassTotal) * horizonScale;
      const dist = len3(sub3(star.pos, body.pos));
      if (dist < horizon) {
        nbody.bodies = nbody.bodies.filter((b) => b.id !== star.id);
        return false;
      }
    }
    return true;
  });

  const removedIds = new Set();
  for (let i = 0; i < nbody.bodies.length; i += 1) {
    const a = nbody.bodies[i];
    if (a.kind === 'bh' || removedIds.has(a.id)) continue;
    for (let j = i + 1; j < nbody.bodies.length; j += 1) {
      const b = nbody.bodies[j];
      if (b.kind === 'bh' || removedIds.has(b.id)) continue;
      const dist = len3(sub3(a.pos, b.pos));
      const minDist = (a.radius + b.radius) * 0.9;
      if (dist < minDist) {
        let primary = a;
        let secondary = b;
        if (a.kind === 'star' && b.kind === 'planet') {
          primary = a;
          secondary = b;
        } else if (b.kind === 'star' && a.kind === 'planet') {
          primary = b;
          secondary = a;
        } else if (a.mass < b.mass) {
          primary = b;
          secondary = a;
        }
        const collidePos = scale3(add3(primary.pos, secondary.pos), 0.5);

        if (primary.kind === 'star') {
          const addMass =
            secondary.kind === 'star'
              ? secondary.massMsun || 0.1
              : (secondary.massEarth || 1) * (MEARTH / MSUN);
          const newMass = (primary.massMsun || 1) + addMass;
          const newTemp =
            secondary.kind === 'star'
              ? ((primary.tempK || 5800) * (primary.massMsun || 1) +
                  (secondary.tempK || 5800) * (secondary.massMsun || 1)) /
                Math.max(newMass, 0.1)
              : primary.tempK || 5800;
          setStarMass(primary, newMass);
          setStarTemp(primary, newTemp);
          primary.colorRgb = kelvinToRgb(primary.tempK);
          addCollisionFlash(collidePos, '255,220,180');
        } else if (primary.kind === 'planet' && secondary.kind === 'planet') {
          const totalEarth = (primary.massEarth || 1) + (secondary.massEarth || 0.1);
          const newTemp =
            ((primary.tempK || 280) * (primary.massEarth || 1) +
              (secondary.tempK || 280) * (secondary.massEarth || 1)) /
            Math.max(totalEarth, 0.1);
          setPlanetMass(primary, totalEarth);
          primary.tempK = newTemp;
          updatePlanetType(primary);
          addCollisionFlash(collidePos, '255,200,140');
        } else if (primary.kind === 'planet' && secondary.kind === 'star') {
          const addMass = (primary.massEarth || 1) * (MEARTH / MSUN);
          setStarMass(secondary, (secondary.massMsun || 1) + addMass);
          addCollisionFlash(collidePos, '255,210,170');
        } else if (primary.kind === 'star' && secondary.kind === 'planet') {
          const addMass = (secondary.massEarth || 1) * (MEARTH / MSUN);
          setStarMass(primary, (primary.massMsun || 1) + addMass);
          addCollisionFlash(collidePos, '255,210,170');
        }

        removedIds.add(secondary.id);
      }
    }
  }

  if (removedIds.size) {
    nbody.bodies = nbody.bodies.filter((body) => !removedIds.has(body.id));
    nbody.planets = nbody.planets.filter((planet) => !removedIds.has(planet.id));
    nbody.stars = nbody.stars.filter((star) => !removedIds.has(star.id));
    if (state.selectedPlanetId && removedIds.has(state.selectedPlanetId)) {
      selectPlanet(null);
    }
    if (state.selectedStarId && removedIds.has(state.selectedStarId)) {
      selectStar(null);
    }
    refreshPlanetList();
    refreshStarList();
  }

  nbody.planets.forEach((planet) => {
    planet.trailTime = (planet.trailTime || 0) + dt;
    if (planet.trailTime < TRAIL_SAMPLE) return;
    planet.trailTime = 0;
    if (!planet.trail) planet.trail = [];
    planet.trail.push(vec3(planet.pos.x, planet.pos.y, planet.pos.z));
    if (planet.trail.length > TRAIL_MAX) {
      planet.trail.splice(0, planet.trail.length - TRAIL_MAX);
    }
  });

  nbody.stars.forEach((star) => {
    star.trailTime = (star.trailTime || 0) + dt;
    if (star.trailTime < TRAIL_SAMPLE) return;
    star.trailTime = 0;
    if (!star.trail) star.trail = [];
    star.trail.push(vec3(star.pos.x, star.pos.y, star.pos.z));
    if (star.trail.length > TRAIL_MAX) {
      star.trail.splice(0, star.trail.length - TRAIL_MAX);
    }
  });

  nbody.bodies
    .filter((body) => body.kind === 'bh')
    .forEach((bh) => {
      bh.trailTime = (bh.trailTime || 0) + dt;
      if (bh.trailTime < TRAIL_SAMPLE) return;
      bh.trailTime = 0;
      if (!bh.trail) bh.trail = [];
      bh.trail.push(vec3(bh.pos.x, bh.pos.y, bh.pos.z));
      if (bh.trail.length > TRAIL_MAX) {
        bh.trail.splice(0, bh.trail.length - TRAIL_MAX);
      }
    });
}

function updatePlanetHeating() {
  if (!nbody.stars.length) return;
  nbody.planets.forEach((planet) => {
    if (planet.tempLocked) return;
    let bestTemp = planet.tempK || state.params.planetTemp || 280;
    let bestDist = Infinity;
    nbody.stars.forEach((star) => {
      const d = len3(sub3(planet.pos, star.pos));
      if (d < bestDist) {
        bestDist = d;
        const lum = Math.max(star.luminosity || 1, 0.1);
        const temp =
          (star.tempK || 5800) *
          Math.sqrt((star.radius || 0.2) / Math.max(d * 2.0, 0.1)) *
          Math.pow(lum, 0.25);
        bestTemp = clamp(temp, 50, 2000);
      }
    });
    planet.tempK = bestTemp;
    updatePlanetType(planet);
  });
}

const VERT_SRC = `#version 300 es
precision highp float;
const vec2 POS[3] = vec2[](
  vec2(-1.0, -3.0),
  vec2(3.0, 1.0),
  vec2(-1.0, 1.0)
);
void main() {
  gl_Position = vec4(POS[gl_VertexID], 0.0, 1.0);
}
`;

const FRAG_SRC = `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_mass;
uniform float u_spin;
uniform float u_accretion;
uniform float u_inclination;
uniform float u_diskInner;
uniform float u_diskOuter;
uniform float u_diskThickness;
uniform float u_diskHue;
uniform float u_ringBrightness;
uniform float u_gridStrength;
uniform float u_lensing;
uniform float u_zoom;
uniform float u_camYaw;
uniform vec2 u_camOffset;
uniform vec3 u_camPos;
uniform float u_starDensity;
uniform float u_dustDensity;
uniform float u_backgroundGlow;
uniform float u_jetPower;
uniform float u_jetWidth;
uniform float u_pulse;
uniform float u_diskSense;
uniform float u_isPulsar;

const int MAX_PLANETS = 16;
uniform int u_planetCount;
uniform vec4 u_planets[MAX_PLANETS];
uniform vec4 u_planetColors[MAX_PLANETS];
uniform vec4 u_planetProps[MAX_PLANETS];
const int MAX_STARS = 8;
uniform int u_starCount;
uniform vec4 u_stars[MAX_STARS];
uniform vec4 u_starProps[MAX_STARS];
const int MAX_BH = 2;
uniform int u_bhCount;
uniform vec4 u_bhPosRs[MAX_BH];
uniform int u_orbitEnabled;
uniform vec3 u_orbitP;
uniform vec3 u_orbitQ;
uniform float u_orbitE;
uniform float u_orbitPparam;
uniform float u_orbitThickness;
uniform vec3 u_orbitColor;
uniform float u_sceneRadius;

const float PI = 3.14159265359;

vec3 rotate_x(vec3 v, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(v.x, v.y * c - v.z * s, v.y * s + v.z * c);
}

vec3 rotate_y(vec3 v, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c);
}

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec2 hash22(vec2 p) {
  float n = sin(dot(p, vec2(127.1, 311.7)));
  float n2 = sin(dot(p, vec2(269.5, 183.3)));
  return fract(vec2(n, n2) * 43758.5453);
}

float hash31(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

vec3 hash33(vec3 p) {
  return fract(
    sin(
      vec3(
        dot(p, vec3(127.1, 311.7, 74.7)),
        dot(p, vec3(269.5, 183.3, 246.1)),
        dot(p, vec3(113.5, 271.9, 124.6))
      )
    ) * 43758.5453
  );
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float f = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    f += amp * noise2(p);
    p *= 2.0;
    amp *= 0.5;
  }
  return f;
}

vec3 kelvin_to_rgb(float kelvin) {
  float temp = clamp(kelvin, 1000.0, 40000.0);
  vec3 lambda = vec3(680.0, 550.0, 440.0) * 1e-9;
  float c2 = 1.4388e-2;
  vec3 exponent = clamp(c2 / (lambda * temp), 0.0, 80.0);
  vec3 radiance = 1.0 / (pow(lambda, vec3(5.0)) * (exp(exponent) - 1.0));
  radiance /= max(max(radiance.r, radiance.g), radiance.b);
  return radiance;
}

float cbrt_safe(float x) {
  return sign(x) * pow(abs(x), 1.0 / 3.0);
}

float isco_radius_rg(float a, float sense) {
  float a_star = clamp(a, 0.0, 0.998);
  float z1 = 1.0 + cbrt_safe(1.0 - a_star * a_star) *
    (cbrt_safe(1.0 + a_star) + cbrt_safe(1.0 - a_star));
  float z2 = sqrt(3.0 * a_star * a_star + z1 * z1);
  float sign_dir = sense > 0.0 ? 1.0 : -1.0;
  float term = sqrt((3.0 - z1) * (3.0 + z1 + 2.0 * z2));
  return 3.0 + z2 - sign_dir * term;
}

float disk_texture(float r, float phi, float time) {
  float ringNoise = fbm(vec2(r * 0.22, phi * 0.7));
  float rings = sin(r * 12.0 + 2.4 * ringNoise + 0.8 * sin(phi * 4.0 + time * 0.08));
  float band = smoothstep(-0.2, 0.8, rings);
  float streaks = 0.6 + 0.4 * sin(phi * 24.0 + r * 0.7 + time * 0.2);
  float grain = fbm(vec2(r * 0.8, phi * 6.0 + time * 0.05));
  float texVal = mix(0.45, 1.75, band) * mix(0.7, 1.3, streaks) * (0.7 + 0.6 * grain);
  return clamp(texVal, 0.2, 2.6);
}

vec4 disk_sample_thin(
  vec3 pos,
  vec3 dir,
  float rs,
  float accretion,
  float spin,
  float sense,
  float diskHue,
  float mass_msun,
  float disk_inner,
  float disk_outer,
  float disk_half,
  float time
) {
  float r = length(pos.xz);
  if (r < disk_inner || r > disk_outer) {
    return vec4(0.0);
  }

  float flux = max(0.0, (1.0 - sqrt(disk_inner / max(r, disk_inner + 0.001))) / (r * r * r + 0.4));
  float temp_norm = pow(flux, 0.25);
  float acc_factor = pow(max(accretion, 0.02), 0.25);
  float mass_factor = pow(max(mass_msun, 1.0), -0.25);
  mass_factor = clamp(mass_factor * 1.6, 0.2, 1.8);

  float base_temp = mix(3000.0, 26000.0, clamp(diskHue / 60.0, 0.0, 1.0));
  float temp_em = base_temp * (0.5 + 2.2 * temp_norm) * acc_factor * mass_factor;

  float M = rs * 0.5;
  float rM = max(r / M, 2.2);
  float omega = 1.0 / (pow(rM, 1.5) + sense * spin);
  float v = omega * rM / sqrt(max(1.0 - 2.0 / rM, 0.2));
  float beta = clamp(v, 0.0, 0.98);
  vec3 v_dir = normalize(vec3(-pos.z, 0.0, pos.x)) * sense;
  float gamma = 1.0 / sqrt(1.0 - beta * beta);
  float mu = dot(v_dir, -dir);
  float doppler = 1.0 / max(gamma * (1.0 - beta * mu), 0.15);
  float grav = sqrt(max(1.0 - rs / max(r, rs + 0.001), 0.04));
  float g = doppler * grav;

  float temp_obs = temp_em * g;
  vec3 color = kelvin_to_rgb(temp_obs);

  float phase = atan(pos.z, pos.x);
  float texVal = disk_texture(r, phase, time);

  float temp_scale = pow(clamp(temp_em / 9500.0, 0.25, 3.0), 1.7);
  float emiss = texVal * (0.5 + acc_factor * 1.9) * temp_scale;
  float beaming = pow(clamp(g, 0.35, 3.2), 3.2);
  emiss *= beaming;

  float alpha = (0.35 + acc_factor * 1.2) * (0.6 + 0.4 * texVal);
  alpha *= (0.55 + disk_half * 1.8);
  return vec4(color * emiss, alpha);
}

float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float n000 = hash31(i);
  float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
  vec3 u = f * f * (3.0 - 2.0 * f);
  float nx00 = mix(n000, n100, u.x);
  float nx10 = mix(n010, n110, u.x);
  float nx01 = mix(n001, n101, u.x);
  float nx11 = mix(n011, n111, u.x);
  float nxy0 = mix(nx00, nx10, u.y);
  float nxy1 = mix(nx01, nx11, u.y);
  return mix(nxy0, nxy1, u.z);
}

float fbm3(vec3 p) {
  float f = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    f += amp * noise3(p);
    p *= 2.0;
    amp *= 0.5;
  }
  return f;
}

vec3 planet_surface_color(vec3 normal, float tempK, float seed, float typeId, vec3 baseColor) {
  float lat = asin(clamp(normal.y, -1.0, 1.0));
  float lon = atan(normal.z, normal.x);
  vec2 uv = vec2(lon / (2.0 * PI) + 0.5, lat / PI + 0.5);
  float n = fbm(uv * 5.5 + seed * 0.01);
  float n2 = fbm(uv * 12.0 + seed * 0.02);
  float n3 = fbm(uv * 24.0 + seed * 0.03);
  float tempNorm = clamp((tempK - 80.0) / 1400.0, 0.0, 1.0);
  float iceMask = smoothstep(0.25, 0.0, tempNorm) * smoothstep(0.35, 0.8, abs(lat));
  float cloudMask = smoothstep(0.62, 0.85, n2) * (0.4 + 0.6 * (1.0 - tempNorm));

  if (typeId < 0.5) {
    vec3 ocean = mix(vec3(0.02, 0.08, 0.18), vec3(0.05, 0.18, 0.32), tempNorm);
    vec3 land = mix(vec3(0.08, 0.22, 0.12), vec3(0.58, 0.44, 0.22), smoothstep(0.5, 1.0, tempNorm));
    float landMask = smoothstep(0.45, 0.6, n);
    vec3 color = mix(ocean, land, landMask);
    color = mix(color, vec3(0.86, 0.92, 1.0), iceMask);
    vec3 clouds = mix(vec3(0.75), vec3(1.0), smoothstep(0.4, 0.85, n3));
    color = mix(color, clouds, cloudMask);
    return color;
  }
  if (typeId < 1.5) {
    float band = sin((lat * 10.0) + n * 3.0 + seed);
    float stripes = smoothstep(-0.2, 0.55, band);
    float storm = smoothstep(0.82, 0.96, n3);
    vec3 base = mix(vec3(0.45, 0.32, 0.2), vec3(0.72, 0.56, 0.35), tempNorm);
    vec3 tint = mix(base, baseColor, 0.5);
    vec3 bands = mix(tint * 0.7, tint * 1.15, stripes);
    bands = mix(bands, tint * 1.4, storm * 0.35);
    return bands;
  }
  if (typeId < 2.5) {
    vec3 ice = mix(vec3(0.55, 0.75, 0.95), vec3(0.92, 0.97, 1.0), n2);
    float cracks = smoothstep(0.65, 0.92, n3);
    ice = mix(ice, vec3(0.8, 0.86, 0.95), cracks);
    return ice;
  }
  if (typeId < 3.5) {
    float cracks = smoothstep(0.55, 0.85, n2);
    vec3 base = vec3(0.04, 0.02, 0.02);
    vec3 lava = kelvin_to_rgb(max(tempK, 1200.0));
    lava = mix(lava, vec3(1.0, 0.4, 0.1), 0.5);
    return mix(base, lava, cracks);
  }
  vec3 desert = mix(vec3(0.5, 0.38, 0.24), vec3(0.7, 0.58, 0.38), n);
  float dune = smoothstep(0.45, 0.7, sin(lon * 14.0 + n * 4.0));
  desert = mix(desert, desert * 1.1, dune * 0.2);
  return desert;
}

vec3 star_surface_color(vec3 normal, float tempK, float seed) {
  vec3 base = kelvin_to_rgb(tempK);
  float lat = asin(clamp(normal.y, -1.0, 1.0));
  float lon = atan(normal.z, normal.x);
  vec3 p = vec3(lon * 6.0, lat * 6.0, seed * 0.07);
  float gran = fbm3(p);
  float spots = smoothstep(0.65, 0.9, fbm3(p * 1.7 + 3.2));
  vec3 spotColor = base * 0.6;
  vec3 color = mix(base, spotColor, spots * 0.6);
  float limb = pow(max(dot(normal, vec3(0.0, 0.0, 1.0)), 0.0), 0.25);
  float tempBoost = mix(0.85, 1.35, clamp((tempK - 3000.0) / 9000.0, 0.0, 1.0));
  float brightness = mix(0.75, 1.25, gran);
  return color * brightness * tempBoost * (0.5 + 0.5 * limb);
}

vec3 star_field(vec3 dir, float density, float brightness, float dust_bias) {
  float dens = clamp(density, 0.25, 3.0);
  float scale = mix(120.0, 320.0, dens / 3.0);
  vec3 p = dir * scale;
  vec3 cell = floor(p);
  vec3 f = fract(p) - 0.5;
  vec3 col = vec3(0.0);
  float prob = mix(0.06, 0.18, dens / 3.0);
  prob = mix(prob * 0.7, prob * 1.4, dust_bias);

  for (int z = -1; z <= 1; z++) {
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec3 c = cell + vec3(float(x), float(y), float(z));
        float rnd = hash31(c);
        if (rnd < prob) {
          vec3 jitter = hash33(c + 7.1) - 0.5;
          vec3 d = f - vec3(float(x), float(y), float(z)) - jitter;
          float size = mix(0.12, 0.35, pow(hash31(c + 3.3), 2.2));
          float dist = length(d);
          float star = exp(-dist * dist / (size * size));
          float power = mix(0.5, 2.2, hash31(c + 12.1));
          float temp = mix(2500.0, 12000.0, hash31(c + 9.9));
          vec3 color = kelvin_to_rgb(temp);
          col += color * star * power;
        }
      }
    }
  }

  return col * brightness;
}

vec3 background(vec3 dir, float grid_strength, float star_density, float dust_density, float glow, float time) {
  vec3 d = normalize(dir);
  vec3 band_axis = normalize(vec3(0.1, 0.7, 1.0));
  float band_lat = dot(d, band_axis);
  float band = exp(-pow(abs(band_lat) / 0.18, 2.0));

  vec3 core_dir = normalize(vec3(0.2, 0.05, -1.0));
  float core_angle = acos(clamp(dot(d, core_dir), -1.0, 1.0));
  float core = exp(-pow(core_angle / 0.45, 2.0));

  float density = mix(0.35, 1.6, star_density) * (0.35 + 1.6 * band + 2.2 * core);
  float brightness = mix(0.6, 1.6, glow);
  float dust_bias = clamp(dust_density, 0.0, 1.0);

  vec3 stars = star_field(d, density, brightness, dust_bias);
  vec3 stars2 = star_field(rotate_y(d, 1.7), density * 0.6, brightness * 1.1, dust_bias * 0.7);

  float dust = fbm(d.xy * 3.2 + d.zy * 2.1 + vec2(time * 0.02, 0.0));
  float dust_lanes = smoothstep(0.15, 0.85, dust);

  float neb = fbm(d.xy * 2.6 + d.zy * 1.4);
  vec3 neb_color = vec3(0.08, 0.05, 0.04) * neb * 0.8;

  vec3 milky = vec3(1.0, 0.9, 0.8) * (0.15 + 0.85 * band) * (0.35 + core * 1.4);
  milky *= mix(1.0, 0.55, dust_lanes);

  return stars + stars2 + neb_color + milky;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float min_res = min(u_resolution.x, u_resolution.y);
  vec2 centered = frag - 0.5 * u_resolution;
  vec2 uv = (centered - u_camOffset) / min_res;
  float zoom = max(u_zoom, 0.000001);
  float zoom_cam = max(pow(zoom, 3.0), 0.000000001);
  float fov = 1.0;
  vec2 uv_zoom = uv;
  float aspect = u_resolution.x / u_resolution.y;

  vec3 dir = normalize(vec3(uv_zoom.x * aspect * 0.9, uv_zoom.y * 0.9, -1.2));
  dir = rotate_y(dir, u_camYaw);
  dir = rotate_x(dir, u_inclination);

  float mass_scale = clamp(log2(max(u_mass, 1.0)) / 24.0, 0.35, 1.8);
  float rs = 2.0 * mass_scale;
  float cam_dist = (18.0 * mass_scale + 6.0) / zoom_cam;
  vec3 pos = vec3(0.0, 0.0, cam_dist);
  pos = rotate_y(pos, u_camYaw);
  pos = rotate_x(pos, u_inclination);
  pos += u_camPos;

  if (u_isPulsar > 0.5) {
    vec3 dir_p = normalize(vec3(uv_zoom.x * aspect * 0.9, uv_zoom.y * 0.9, -1.2));
    dir_p = rotate_y(dir_p, u_camYaw);
    dir_p = rotate_x(dir_p, u_inclination);

    float mass_scale_p = clamp(log2(max(u_mass, 1.0)) / 24.0, 0.35, 1.8);
    float rs_p = 2.0 * mass_scale_p;
    float cam_dist_p = (16.0 * mass_scale_p + 5.0) / zoom_cam;
    vec3 pos_p = vec3(0.0, 0.0, cam_dist_p);
    pos_p = rotate_y(pos_p, u_camYaw);
    pos_p = rotate_x(pos_p, u_inclination);
    pos_p += u_camPos;

    float b = length(cross(pos_p, dir_p));
    float alpha = (2.0 * rs_p) / max(b, rs_p * 1.4);
    alpha = clamp(alpha, 0.0, 1.1);
    vec3 n = normalize(cross(dir_p, cross(pos_p, dir_p)));
    vec3 dir_bent = normalize(dir_p + alpha * n);

    vec3 bg = background(dir_bent, u_gridStrength, u_starDensity, u_dustDensity, u_backgroundGlow, u_time);

    float r = length(uv_zoom);
    float pulse = 0.5 + 0.5 * sin(u_time * (6.0 + 14.0 * u_spin));
    vec3 glow = vec3(0.2, 0.6, 1.0) * exp(-r * 6.0) * (0.7 + u_pulse * 1.2);
    vec3 core = vec3(0.6, 0.9, 1.0) * exp(-r * 26.0) * (0.6 + 0.4 * pulse);

    float tilt = mix(0.15, 0.7, u_pulse);
    float omega = mix(4.0, 26.0, u_spin);
    vec3 mag_world = normalize(
      vec3(
        sin(tilt) * cos(u_time * omega),
        cos(tilt),
        sin(tilt) * sin(u_time * omega)
      )
    );

    float theta1 = acos(clamp(dot(mag_world, -dir_bent), -1.0, 1.0));
    float theta2 = acos(clamp(dot(-mag_world, -dir_bent), -1.0, 1.0));
    float sigma_angle = mix(0.06, 0.24, u_jetWidth);
    float beam_lighthouse =
      exp(-(theta1 * theta1) / (2.0 * sigma_angle * sigma_angle)) +
      exp(-(theta2 * theta2) / (2.0 * sigma_angle * sigma_angle));

    vec3 mag_view = rotate_x(rotate_y(mag_world, -u_camYaw), -u_inclination);
    float mag_len = length(mag_view.xy);
    vec2 beam_dir = mag_len < 0.002 ? vec2(1.0, 0.0) : mag_view.xy / mag_len;
    float dist_line = abs(beam_dir.y * uv_zoom.x - beam_dir.x * uv_zoom.y);
    float beam_sigma = mix(0.012, 0.08, u_jetWidth);
    float beam_line = exp(-(dist_line * dist_line) / (2.0 * beam_sigma * beam_sigma));
    float along = abs(dot(uv_zoom, beam_dir));
    float beam_len = mix(0.9, 2.8, u_jetPower);
    float beam_falloff = exp(-pow(along / beam_len, 1.4));
    float beam_screen = beam_line * beam_falloff;
    if (mag_len < 0.02) {
      beam_screen = exp(-r * 3.5);
    }

    float pulse_mod = 0.35 + 0.65 * pulse;
    float beam_strength = (0.6 + 2.0 * u_jetPower) * (0.4 + 0.6 * beam_lighthouse);
    vec3 beam_color = vec3(0.55, 0.85, 1.0) * beam_screen * beam_strength * pulse_mod;
    float beam_core =
      exp(-(dist_line * dist_line) / (2.0 * beam_sigma * beam_sigma * 0.2));
    beam_color += vec3(0.85, 0.95, 1.0) * beam_core * beam_falloff *
      (0.3 + 0.9 * u_jetPower) * (0.3 + 0.7 * pulse);

    outColor = vec4(bg + glow + core + beam_color, 1.0);
    return;
  }

  float isco_rg = isco_radius_rg(u_spin, u_diskSense);
  float disk_inner = max(u_diskInner * rs * 1.6, isco_rg * rs);
  float disk_outer = u_diskOuter * rs * 1.6;
  float disk_half = max(u_diskThickness * rs * 0.45, rs * 0.02);

  vec3 radiance = vec3(0.0);
  float trans = 1.0;
  float ring_accum = 0.0;
  bool swallowed = false;
  bool hitStar = false;
  bool hitPlanet = false;
  vec3 starShade = vec3(0.0);
  vec3 planetShade = vec3(0.0);
  vec3 orbitGlow = vec3(0.0);
  float min_r = 1e9;
  float min_shadow = 1e9;
  int orbitPasses = 0;

  const int STEPS = 900;
  float max_dist = max(cam_dist * 1.4, cam_dist + u_sceneRadius * 2.6);
  float step_len = max_dist / float(STEPS);
  int diskHits = 0;
  const int MAX_DISK_HITS = 4;

  for (int i = 0; i < STEPS; i++) {
    float r = length(pos);
    min_r = min(min_r, r);
    for (int b = 0; b < MAX_BH; b++) {
      if (b >= u_bhCount) break;
      vec3 bPos = u_bhPosRs[b].xyz;
      float bRs = u_bhPosRs[b].w;
      vec3 rel = pos - bPos;
      float rbh = length(rel);
      min_shadow = min(min_shadow, rbh / max(bRs, 1e-4));
      if (rbh < bRs * 1.01) {
        swallowed = true;
      }
    }
    if (swallowed) {
      break;
    }
    if (r > max_dist * 1.2) {
      break;
    }

    float hitT = step_len + 1.0;
    int hitPlanetIndex = -1;
    int hitStarIndex = -1;
    for (int p = 0; p < MAX_PLANETS; p++) {
      if (p >= u_planetCount) break;
      vec3 pPos = u_planets[p].xyz;
      float pr = u_planets[p].w;
      vec3 oc = pos - pPos;
      float b = dot(oc, dir);
      float c = dot(oc, oc) - pr * pr;
      float h = b * b - c;
      if (h > 0.0) {
        float tHit = -b - sqrt(h);
        if (tHit >= 0.0 && tHit <= step_len && tHit < hitT) {
          hitT = tHit;
          hitPlanetIndex = p;
          hitStarIndex = -1;
        }
      }
    }
    for (int s = 0; s < MAX_STARS; s++) {
      if (s >= u_starCount) break;
      vec3 sPos = u_stars[s].xyz;
      float sr = u_stars[s].w;
      vec3 oc = pos - sPos;
      float b = dot(oc, dir);
      float c = dot(oc, oc) - sr * sr;
      float h = b * b - c;
      if (h > 0.0) {
        float tHit = -b - sqrt(h);
        if (tHit >= 0.0 && tHit <= step_len && tHit < hitT) {
          hitT = tHit;
          hitStarIndex = s;
          hitPlanetIndex = -1;
        }
      }
    }
    if (hitStarIndex >= 0) {
      vec3 hitPos = pos + dir * hitT;
      vec3 normal = normalize(hitPos - u_stars[hitStarIndex].xyz);
      float tempK = u_starProps[hitStarIndex].x;
      float seed = u_starProps[hitStarIndex].z;
      vec3 surface = star_surface_color(normal, tempK, seed);
      float intensity = u_starProps[hitStarIndex].y;
      float limb = pow(max(dot(normal, -dir), 0.0), 0.3);
      starShade = surface * (0.6 + 0.4 * limb) * (0.8 + intensity * 0.4);
      hitStar = true;
      break;
    }
    if (hitPlanetIndex >= 0) {
      vec3 hitPos = pos + dir * hitT;
      vec3 normal = normalize(hitPos - u_planets[hitPlanetIndex].xyz);
      vec3 base = u_planetColors[hitPlanetIndex].rgb;
      vec4 props = u_planetProps[hitPlanetIndex];
      float tempK = props.x;
      float seed = props.y;
      float typeId = props.z;
      vec3 surf = planet_surface_color(normal, tempK, seed, typeId, base);
      vec3 lightDir = normalize(vec3(0.35, 0.2, -0.9));
      vec3 lightColor = vec3(1.0);
      float lightBoost = 0.6;
      if (u_starCount > 0) {
        float bestWeight = 0.0;
        for (int s = 0; s < MAX_STARS; s++) {
          if (s >= u_starCount) break;
          vec3 toStar = u_stars[s].xyz - hitPos;
          float d2 = dot(toStar, toStar) + 0.0005;
          float weight = u_starProps[s].y / d2;
          if (weight > bestWeight) {
            bestWeight = weight;
            lightDir = normalize(toStar);
            lightColor = kelvin_to_rgb(u_starProps[s].x);
          }
        }
        if (bestWeight > 0.0) {
          lightBoost = clamp(bestWeight * 16.0, 0.35, 1.6);
        }
      }
      float ndl = max(dot(normal, lightDir), 0.0);
      float rim = pow(1.0 - max(dot(normal, -dir), 0.0), 2.0);
      float spec = pow(max(dot(reflect(-lightDir, normal), -dir), 0.0), 32.0);
      float emissive = smoothstep(900.0, 2000.0, tempK);
      vec3 emitColor = kelvin_to_rgb(max(tempK, 1200.0)) * emissive * 0.35;
      vec3 lit = surf * (0.15 + 0.85 * ndl) * lightColor * lightBoost;
      lit += surf * rim * 0.2;
      lit += lightColor * spec * 0.18;
      lit += emitColor;
      planetShade = lit;
      hitPlanet = true;
      break;
    }

    if (u_orbitEnabled > 0) {
      vec3 n = normalize(cross(u_orbitP, u_orbitQ));
      float denom = dot(dir, n);
      if (abs(denom) > 1e-5) {
        float d0 = dot(pos, n);
        float d1 = dot(pos + dir * step_len, n);
        if (d0 * d1 <= 0.0) {
          float tHit = -d0 / denom;
          if (tHit >= 0.0 && tHit <= step_len) {
            vec3 hitPos = pos + dir * tHit;
            orbitPasses += 1;
            float x = dot(hitPos, u_orbitP);
            float y = dot(hitPos, u_orbitQ);
            float rHit = length(vec2(x, y));
            float nu = atan(y, x);
            float rExpected = (u_orbitE < 1e-4)
              ? u_orbitPparam
              : (u_orbitPparam / (1.0 + u_orbitE * cos(nu)));
            float delta = abs(rHit - rExpected);
            float glow = smoothstep(u_orbitThickness, 0.0, delta);
            if (glow > 0.0) {
              float passWeight = (orbitPasses == 1) ? 0.55 : ((orbitPasses == 2) ? 1.0 : 0.45);
              float boost = 1.25 + passWeight * 0.7;
              orbitGlow += u_orbitColor * glow * boost;
            }
          }
        }
      }
    }

    if (diskHits < MAX_DISK_HITS && abs(dir.y) > 1e-5) {
      float y0 = pos.y;
      float y1 = pos.y + dir.y * step_len;
      if ((y0 <= 0.0 && y1 >= 0.0) || (y0 >= 0.0 && y1 <= 0.0)) {
        float tHit = -y0 / dir.y;
        if (tHit >= 0.0 && tHit <= step_len) {
          vec3 hitPos = pos + dir * tHit;
          float rHit = length(hitPos.xz);
          if (rHit >= disk_inner && rHit <= disk_outer) {
            vec4 disk_sample_data = disk_sample_thin(
              hitPos,
              dir,
              rs,
              u_accretion,
              u_spin,
              u_diskSense,
              u_diskHue,
              u_mass,
              disk_inner,
              disk_outer,
              disk_half,
              u_time
            );
            float orderAtten = pow(0.6, float(diskHits));
            disk_sample_data.rgb *= orderAtten;
            float dtau = disk_sample_data.a * orderAtten;
            float atten = exp(-dtau);
            radiance = radiance * atten + disk_sample_data.rgb * (1.0 - atten);
            trans *= atten;
            diskHits += 1;
          }
        }
      }
    }

    float ring_weight = exp(-pow((r - rs * 1.5) / (rs * 0.25), 2.0));
    ring_accum += ring_weight * step_len;

    float haze = u_dustDensity * exp(-r / (rs * 10.0)) * exp(-abs(pos.y) / (disk_half * 2.5));
    if (haze > 0.0001) {
      vec3 haze_color = vec3(0.08, 0.06, 0.05) * haze;
      radiance += haze_color * step_len * trans;
    }

    vec3 grav = vec3(0.0);
    vec3 drag = vec3(0.0);
    for (int b = 0; b < MAX_BH; b++) {
      if (b >= u_bhCount) break;
      vec3 bPos = u_bhPosRs[b].xyz;
      float bRs = u_bhPosRs[b].w;
      vec3 rel = pos - bPos;
      float rbh = length(rel);
      float invr3 = 1.0 / (rbh * rbh * rbh + 0.0001);
      float Mb = bRs * 0.5;
      grav += -1.1 * u_lensing * Mb * rel * invr3;
      float frame = 1.2 * u_lensing * u_spin * Mb * Mb * invr3;
      drag += frame * cross(vec3(0.0, 1.0, 0.0), dir);
    }
    dir = normalize(dir + (grav + drag) * step_len * 0.65);
    pos += dir * step_len;
  }

  vec3 color;
  if (hitStar) {
    color = radiance + orbitGlow + starShade * trans;
  } else if (hitPlanet) {
    color = radiance + orbitGlow + planetShade * trans;
  } else {
    vec3 bg = background(dir, u_gridStrength, u_starDensity, u_dustDensity, u_backgroundGlow, u_time);
    color = radiance + orbitGlow + bg * trans;
    if (swallowed) {
      // Rays captured by the horizon still keep disk light gathered before capture.
      color = radiance + orbitGlow;
    }
  }

  if (!swallowed && !hitPlanet && !hitStar) {
    float diskPresence = clamp(float(diskHits) * 0.35 + (1.0 - trans) * 0.65, 0.0, 1.0);
    float shadow_mask = smoothstep(1.02, 1.25, min_shadow);
    shadow_mask = mix(shadow_mask, 1.0, diskPresence * 0.7);
    color *= shadow_mask;

    float ring_temp = mix(2600.0, 14000.0, clamp(u_diskHue / 60.0, 0.0, 1.0));
    vec3 ring_tint = kelvin_to_rgb(ring_temp);
    ring_tint = mix(ring_tint, vec3(1.0), 0.25);
    float ring = ring_accum * u_ringBrightness * mix(0.25, 0.1, diskPresence);
    color += ring_tint * ring;

    float halo = exp(-pow((min_r / rs - 1.5) / 0.55, 2.0));
    halo *= mix(1.0, 0.35, diskPresence);
    color += vec3(1.0, 0.85, 0.65) * halo * 0.025;
  }

  if (!swallowed && !hitPlanet && !hitStar) {
    float jet = exp(-pow(length(cross(normalize(dir), vec3(0.0, 1.0, 0.0))) / max(u_jetWidth, 0.1), 2.0));
    color += vec3(1.0, 0.85, 0.7) * u_jetPower * jet * 0.18;
  }

  float exposure = mix(2.0, 0.95, clamp(u_accretion / 1.6, 0.0, 1.0));
  float mass_dim = clamp(log2(max(u_mass, 1.0)) / 26.0, 0.0, 1.0);
  exposure *= mix(1.15, 0.85, mass_dim);
  color *= exposure;

  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float bloom = smoothstep(1.1, 3.2, luma) * 0.25;
  color += bloom * vec3(1.0, 0.95, 0.88);

  color = (color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14);
  color = pow(color, vec3(1.0 / 2.2));
  outColor = vec4(color, 1.0);
}
`;

function createShader(glContext, type, source) {
  const shader = glContext.createShader(type);
  glContext.shaderSource(shader, source);
  glContext.compileShader(shader);
  if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
    const info = glContext.getShaderInfoLog(shader) || 'Unknown shader error';
    lastShaderError = info;
    console.error(info);
    glContext.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(glContext, vsSource, fsSource) {
  const vs = createShader(glContext, glContext.VERTEX_SHADER, vsSource);
  const fs = createShader(glContext, glContext.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) return null;
  const program = glContext.createProgram();
  glContext.attachShader(program, vs);
  glContext.attachShader(program, fs);
  glContext.linkProgram(program);
  if (!glContext.getProgramParameter(program, glContext.LINK_STATUS)) {
    console.error(glContext.getProgramInfoLog(program));
    glContext.deleteProgram(program);
    return null;
  }
  glContext.deleteShader(vs);
  glContext.deleteShader(fs);
  return program;
}

function initGL() {
  if (!gl) {
    statusValue.textContent = 'WebGL2 is required for the renderer.';
    return { ready: false };
  }

  const program = createProgram(gl, VERT_SRC, FRAG_SRC);
  if (!program) {
    statusValue.textContent = lastShaderError
      ? `Shader compilation failed: ${lastShaderError.split('\n')[0]}`
      : 'Shader compilation failed.';
    return { ready: false };
  }

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.useProgram(program);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);

  return {
    ready: true,
    program,
    vao,
    uniforms: {
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      time: gl.getUniformLocation(program, 'u_time'),
      mass: gl.getUniformLocation(program, 'u_mass'),
      spin: gl.getUniformLocation(program, 'u_spin'),
      accretion: gl.getUniformLocation(program, 'u_accretion'),
      inclination: gl.getUniformLocation(program, 'u_inclination'),
      diskInner: gl.getUniformLocation(program, 'u_diskInner'),
      diskOuter: gl.getUniformLocation(program, 'u_diskOuter'),
      diskThickness: gl.getUniformLocation(program, 'u_diskThickness'),
      diskHue: gl.getUniformLocation(program, 'u_diskHue'),
      ringBrightness: gl.getUniformLocation(program, 'u_ringBrightness'),
      gridStrength: gl.getUniformLocation(program, 'u_gridStrength'),
      lensing: gl.getUniformLocation(program, 'u_lensing'),
      zoom: gl.getUniformLocation(program, 'u_zoom'),
      camYaw: gl.getUniformLocation(program, 'u_camYaw'),
      camOffset: gl.getUniformLocation(program, 'u_camOffset'),
      camPos: gl.getUniformLocation(program, 'u_camPos'),
      starDensity: gl.getUniformLocation(program, 'u_starDensity'),
      dustDensity: gl.getUniformLocation(program, 'u_dustDensity'),
      backgroundGlow: gl.getUniformLocation(program, 'u_backgroundGlow'),
      jetPower: gl.getUniformLocation(program, 'u_jetPower'),
      jetWidth: gl.getUniformLocation(program, 'u_jetWidth'),
      pulse: gl.getUniformLocation(program, 'u_pulse'),
      diskSense: gl.getUniformLocation(program, 'u_diskSense'),
      isPulsar: gl.getUniformLocation(program, 'u_isPulsar'),
      planetCount: gl.getUniformLocation(program, 'u_planetCount'),
      planets: gl.getUniformLocation(program, 'u_planets[0]'),
      planetColors: gl.getUniformLocation(program, 'u_planetColors[0]'),
      planetProps: gl.getUniformLocation(program, 'u_planetProps[0]'),
      starCount: gl.getUniformLocation(program, 'u_starCount'),
      stars: gl.getUniformLocation(program, 'u_stars[0]'),
      starProps: gl.getUniformLocation(program, 'u_starProps[0]'),
      bhCount: gl.getUniformLocation(program, 'u_bhCount'),
      bhPosRs: gl.getUniformLocation(program, 'u_bhPosRs[0]'),
      orbitEnabled: gl.getUniformLocation(program, 'u_orbitEnabled'),
      orbitP: gl.getUniformLocation(program, 'u_orbitP'),
      orbitQ: gl.getUniformLocation(program, 'u_orbitQ'),
      orbitE: gl.getUniformLocation(program, 'u_orbitE'),
      orbitPparam: gl.getUniformLocation(program, 'u_orbitPparam'),
      orbitThickness: gl.getUniformLocation(program, 'u_orbitThickness'),
      orbitColor: gl.getUniformLocation(program, 'u_orbitColor'),
      sceneRadius: gl.getUniformLocation(program, 'u_sceneRadius')
    }
  };
}

glState = initGL();

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function massToLog(mass) {
  const clamped = clamp(mass, MASS_MIN, MASS_MAX);
  const logValue = (Math.log10(clamped) - MASS_LOG_MIN) / (MASS_LOG_MAX - MASS_LOG_MIN);
  return logValue * 100;
}

function logToMass(logValue) {
  const logMass = MASS_LOG_MIN + (clamp(logValue, 0, 100) / 100) * (MASS_LOG_MAX - MASS_LOG_MIN);
  return Math.pow(10, logMass);
}

function formatCompact(value) {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}b`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}m`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}k`;
  return value.toFixed(0);
}

function formatParam(name, value) {
  switch (name) {
    case 'mass':
      return `${formatCompact(value)} Msun`;
    case 'spin':
      return value.toFixed(3);
    case 'inclination':
      return `${value.toFixed(0)} deg`;
    case 'accretion':
      return `${value.toFixed(2)} L/Ledd`;
    case 'diskInnerFactor':
    case 'diskOuterFactor':
      return `${value.toFixed(2)}x`;
    case 'diskHue':
      return `${Math.round(2500 + (value / 60) * 9500)} K`;
    case 'lensing':
    case 'gridStrength':
      return `${Math.round(value * 100)}%`;
    case 'zoom':
    case 'animationSpeed':
      if (value < 0.01) return `${value.toFixed(4)}x`;
      return `${value.toFixed(2)}x`;
    case 'simSpeed':
      if (value < 0.01) return `${value.toFixed(3)}x`;
      return `${value.toFixed(2)}x`;
    case 'planetMass':
      return `${value.toFixed(1)} Mearth`;
    case 'planetTemp':
      return `${value.toFixed(0)} K`;
    case 'starMass':
      return `${value.toFixed(2)} Msun`;
    case 'starTemp':
      return `${value.toFixed(0)} K`;
    default:
      if (typeof value === 'number') return value.toFixed(2);
      return value;
  }
}

function formatDistanceKm(km) {
  const AU = 149597870.7;
  if (km >= AU * 50) return `${(km / AU).toFixed(2)} AU`;
  if (km >= 1e9) return `${(km / 1e9).toFixed(2)} billion km`;
  if (km >= 1e6) return `${(km / 1e6).toFixed(2)} million km`;
  if (km >= 1e3) return `${(km / 1e3).toFixed(2)}k km`;
  return `${km.toFixed(0)} km`;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '--';
  if (seconds < 1) return `${(seconds * 1000).toFixed(1)} ms`;
  if (seconds < 60) return `${seconds.toFixed(2)} s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(2)} min`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(2)} hr`;
  return `${(seconds / 86400).toFixed(2)} days`;
}

function formatLuminosity(watts) {
  if (!Number.isFinite(watts)) return '--';
  const L_SUN = 3.828e26;
  const inLsun = watts / L_SUN;
  if (inLsun >= 1e6) return `${inLsun.toExponential(2)} Lsun`;
  if (inLsun >= 1e2) return `${inLsun.toFixed(0)} Lsun`;
  return `${inLsun.toFixed(2)} Lsun`;
}

function updateDerivedUI() {
  radiusValue.textContent = formatDistanceKm(derived.rs / 1000);
  horizonValue.textContent = formatDistanceKm(derived.rPlus / 1000);
  iscoValue.textContent = formatDistanceKm(derived.risco / 1000);
  photonValue.textContent = `${formatDistanceKm(derived.rPhotonPro / 1000)} / ${formatDistanceKm(derived.rPhotonRetro / 1000)}`;
  shadowValue.textContent = formatDistanceKm((derived.shadowRadiusRg * derived.rg * 2) / 1000);
  eddingtonValue.textContent = formatLuminosity(derived.eddington);
  periodValue.textContent = formatTime(derived.iscoPeriod);
}

function schedulePhysicsUpdate(immediate = false) {
  if (physicsTimer) clearTimeout(physicsTimer);
  const delay = immediate ? 0 : 100;
  physicsTimer = setTimeout(fetchPhysics, delay);
}

async function fetchPhysics() {
  physicsTimer = null;
  const requestId = ++physicsRequestId;
  const params = new URLSearchParams({
    mass: state.params.mass.toFixed(6),
    spin: state.params.spin.toFixed(6),
    inclination: state.params.inclination.toFixed(3),
    disk_sense: state.params.diskSense
  });

  try {
    statusValue.textContent = 'Physics: updating...';
    const response = await fetch(`/api/metrics?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    if (requestId !== physicsRequestId) return;

    derived.rg = data.rg_m;
    derived.rs = data.rs_m;
    derived.rPlus = data.r_plus_m;
    derived.risco = data.isco_m;
    derived.riscoRg = data.isco_m / data.rg_m;
    derived.rPhotonPro = data.photon_pro_m;
    derived.rPhotonRetro = data.photon_retro_m;
    derived.shadowRadiusRg = data.shadow_radius_rg;
    derived.shadowPath = data.shadow_path || [];
    derived.eddington = data.eddington_w;
    derived.iscoPeriod = data.isco_period_s;

    updateDerivedUI();
    statusValue.textContent = state.mode === 'pulsar' ? 'Mode: Pulsar (neutron star)' : 'Mode: Black hole (Kerr)';
  } catch (error) {
    statusValue.textContent = 'Physics: offline (start the local server)';
    console.error(error);
  }
}

function setParam(name, value, options = {}) {
  if (paramRanges[name]) {
    const [min, max] = paramRanges[name];
    state.params[name] = clamp(value, min, max);
  } else {
    state.params[name] = value;
  }

  syncInputs(name);
  syncValues(name);

  if (name === 'starDensity') regenerateStars();
  if (name === 'dustDensity') regenerateDust();

  if (['mass', 'spin', 'inclination', 'diskSense'].includes(name)) {
    schedulePhysicsUpdate();
  }

  if (!options.silent) {
    setPreset('Custom', true);
  }
}

function syncInputs(name) {
  const inputs = document.querySelectorAll(`[data-param="${name}"]`);
  inputs.forEach((input) => {
    if (input.tagName === 'SELECT') {
      input.value = state.params[name];
      return;
    }
    if (input.type === 'range' && input.dataset.scale === 'log') {
      input.value = massToLog(state.params.mass).toFixed(2);
      return;
    }
    if (input.type === 'number') {
      input.value = Math.round(state.params[name]);
      return;
    }
    input.value = state.params[name];
  });
}

function syncValues(name) {
  const valueElement = document.querySelector(`[data-value="${name}"]`);
  if (valueElement) {
    valueElement.textContent = formatParam(name, state.params[name]);
  }
}

function updateAllValues() {
  Object.keys(state.params).forEach((name) => {
    syncInputs(name);
    syncValues(name);
  });
}

function updatePlanetUi() {
  if (!placePlanetBtn || !planetHint) return;
  placePlanetBtn.textContent = nbody.placing ? 'Click to place...' : 'Place planet';
  placePlanetBtn.classList.toggle('active', nbody.placing);
  planetHint.textContent = nbody.placing
    ? 'Click the scene to place a planet (disk plane).'
    : 'Click the scene to place a planet on the disk plane.';
  refreshPlanetList();
  updatePlanetEditor();
}

function getSelectedPlanet() {
  if (!state.selectedPlanetId) return null;
  return nbody.planets.find((planet) => planet.id === state.selectedPlanetId) || null;
}

function selectPlanet(planet) {
  state.selectedPlanetId = planet ? planet.id : null;
  refreshPlanetList();
  updatePlanetEditor();
}

function updatePlanetEditor() {
  if (!planetEditor) return;
  const planet = getSelectedPlanet();
  if (!planet) {
    planetEditor.classList.add('hidden');
    return;
  }
  planetEditor.classList.remove('hidden');
  refreshPlanetList();
  if (planetMassEdit) planetMassEdit.value = planet.massEarth?.toFixed(1) || '1.0';
  if (planetDistanceEdit) planetDistanceEdit.value = planet.orbitDistance?.toFixed(2) || '5.0';
  if (planetSpeedEdit) planetSpeedEdit.value = planet.orbitSpeedScale?.toFixed(2) || '1.0';
  if (planetTiltEdit) planetTiltEdit.value = planet.orbitTilt?.toFixed(0) || '0';
  if (planetEccEdit) planetEccEdit.value = planet.orbitEcc?.toFixed(2) || '0.00';
  if (planetTempEdit) planetTempEdit.value = planet.tempK?.toFixed(0) || '280';
  if (planetMassValue) planetMassValue.textContent = `${(planet.massEarth || 1).toFixed(1)} Mearth`;
  if (planetDistanceValue) planetDistanceValue.textContent = `${(planet.orbitDistance || 0).toFixed(2)} rg`;
  if (planetSpeedValue) planetSpeedValue.textContent = `${(planet.orbitSpeedScale || 1).toFixed(2)}x`;
  if (planetTiltValue) planetTiltValue.textContent = `${(planet.orbitTilt || 0).toFixed(0)} deg`;
  if (planetEccValue) planetEccValue.textContent = `${(planet.orbitEcc || 0).toFixed(2)}`;
  if (planetTempValue) planetTempValue.textContent = `${(planet.tempK || 280).toFixed(0)} K`;
  syncManualInputs(planetEditor);
}

function refreshPlanetList() {
  if (!planetSelect) return;
  planetSelect.innerHTML = '';
  if (!nbody.planets.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No planets';
    planetSelect.appendChild(option);
    planetSelect.disabled = true;
    return;
  }
  planetSelect.disabled = false;
  nbody.planets.forEach((planet, index) => {
    if (!planet.label) {
      planet.label = `Planet ${index + 1}`;
    }
    const option = document.createElement('option');
    option.value = planet.id;
    option.textContent = planet.label;
    planetSelect.appendChild(option);
  });
  const existing = nbody.planets.find((p) => p.id === state.selectedPlanetId);
  if (!existing) {
    state.selectedPlanetId = nbody.planets[0].id;
  }
  planetSelect.value = state.selectedPlanetId || nbody.planets[0].id;
}

function updateStarUi() {
  if (!placeStarBtn || !starHint) return;
  placeStarBtn.textContent = nbody.placingStar ? 'Click to place...' : 'Place star';
  placeStarBtn.classList.toggle('active', nbody.placingStar);
  starHint.textContent = nbody.placingStar
    ? 'Click the scene to place a star.'
    : 'Click the scene to place a star.';
  refreshStarList();
  updateStarEditor();
}

function getSelectedStar() {
  if (!state.selectedStarId) return null;
  return nbody.stars.find((star) => star.id === state.selectedStarId) || null;
}

function selectStar(star) {
  state.selectedStarId = star ? star.id : null;
  refreshStarList();
  updateStarEditor();
}

function updateStarEditor() {
  if (!starEditor) return;
  const star = getSelectedStar();
  if (!star) {
    starEditor.classList.add('hidden');
    return;
  }
  starEditor.classList.remove('hidden');
  refreshStarList();
  if (starMassEdit) starMassEdit.value = star.massMsun?.toFixed(2) || '1.0';
  if (starTempEdit) starTempEdit.value = star.tempK?.toFixed(0) || '5800';
  if (starDistanceEdit) starDistanceEdit.value = star.orbitDistance?.toFixed(2) || '5.0';
  if (starSpeedEdit) starSpeedEdit.value = star.orbitSpeedScale?.toFixed(2) || '1.0';
  if (starTiltEdit) starTiltEdit.value = star.orbitTilt?.toFixed(0) || '0';
  if (starEccEdit) starEccEdit.value = star.orbitEcc?.toFixed(2) || '0.00';
  if (starMassValue) starMassValue.textContent = `${(star.massMsun || 1).toFixed(2)} Msun`;
  if (starTempValue) starTempValue.textContent = `${(star.tempK || 5800).toFixed(0)} K`;
  if (starDistanceValue) starDistanceValue.textContent = `${(star.orbitDistance || 0).toFixed(2)} rg`;
  if (starSpeedValue) starSpeedValue.textContent = `${(star.orbitSpeedScale || 1).toFixed(2)}x`;
  if (starTiltValue) starTiltValue.textContent = `${(star.orbitTilt || 0).toFixed(0)} deg`;
  if (starEccValue) starEccValue.textContent = `${(star.orbitEcc || 0).toFixed(2)}`;
  syncManualInputs(starEditor);
}

function refreshStarList() {
  if (!starSelect) return;
  starSelect.innerHTML = '';
  if (!nbody.stars.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No stars';
    starSelect.appendChild(option);
    starSelect.disabled = true;
    return;
  }
  starSelect.disabled = false;
  nbody.stars.forEach((star, index) => {
    if (!star.label) {
      star.label = `Star ${index + 1}`;
    }
    const option = document.createElement('option');
    option.value = star.id;
    option.textContent = star.label;
    starSelect.appendChild(option);
  });
  const existing = nbody.stars.find((s) => s.id === state.selectedStarId);
  if (!existing) {
    state.selectedStarId = nbody.stars[0].id;
  }
  starSelect.value = state.selectedStarId || nbody.stars[0].id;
}

function findPlanetAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) * pixelRatio;
  const y = (clientY - rect.top) * pixelRatio;
  const { bary } = getBarycenterData();
  let closest = null;
  let closestDist = Infinity;
  nbody.planets.forEach((planet) => {
    const proj = projectWorld(sub3(planet.pos, bary));
    if (!proj) return;
    const dx = proj.x - x;
    const dy = proj.y - y;
    const dist = Math.hypot(dx, dy);
    if (dist < closestDist) {
      closestDist = dist;
      closest = planet;
    }
  });
  if (closestDist < 18 * (pixelRatio || 1)) return closest;
  return null;
}

function findStarAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) * pixelRatio;
  const y = (clientY - rect.top) * pixelRatio;
  const { bary } = getBarycenterData();
  let closest = null;
  let closestDist = Infinity;
  nbody.stars.forEach((star) => {
    const proj = projectWorld(sub3(star.pos, bary));
    if (!proj) return;
    const dx = proj.x - x;
    const dy = proj.y - y;
    const dist = Math.hypot(dx, dy);
    if (dist < closestDist) {
      closestDist = dist;
      closest = star;
    }
  });
  if (closestDist < 22 * (pixelRatio || 1)) return closest;
  return null;
}

function setPreset(name, silent) {
  if (name === 'Custom') {
    state.preset = 'Custom';
    presetSelect.value = 'Custom';
    presetDescription.textContent = 'Custom mix of parameters.';
    if (!silent) updateAllValues();
    return;
  }

  const preset = presets.find((item) => item.name === name);
  if (!preset) return;

  state.mode = preset.mode;
  state.preset = preset.name;
  state.lastPreset = preset.name;
  state.params = { ...defaultParams, ...preset.params };

  presetSelect.value = preset.name;
  presetDescription.textContent = preset.note;

  updateAllValues();
  regenerateStars();
  regenerateDust();
  resetNBody();
  schedulePhysicsUpdate(true);
}

function populatePresets() {
  presets.forEach((preset) => {
    const option = document.createElement('option');
    option.value = preset.name;
    option.textContent = preset.name;
    presetSelect.appendChild(option);
  });

  const customOption = document.createElement('option');
  customOption.value = 'Custom';
  customOption.textContent = 'Custom';
  presetSelect.appendChild(customOption);
}

function addManualNumberInputs() {
  document.querySelectorAll('input[type="range"]').forEach((range) => {
    const row = range.closest('.row');
    if (!row) return;
    if (row.querySelector('input[type="number"]')) return;

    const manual = document.createElement('input');
    manual.type = 'number';
    manual.className = 'manual-input';
    if (range.min !== '') manual.min = range.min;
    if (range.max !== '') manual.max = range.max;
    if (range.step !== '') manual.step = range.step;
    manual.value = range.value;

    if (range.dataset.param) {
      manual.dataset.param = range.dataset.param;
    } else {
      range._manualInput = manual;
      const syncFromRange = () => {
        manual.value = range.value;
      };
      range.addEventListener('input', syncFromRange);
      manual.addEventListener('input', () => {
        const raw = parseFloat(manual.value);
        if (!Number.isFinite(raw)) return;
        let clamped = raw;
        const min = range.min !== '' ? parseFloat(range.min) : null;
        const max = range.max !== '' ? parseFloat(range.max) : null;
        if (Number.isFinite(min)) clamped = Math.max(clamped, min);
        if (Number.isFinite(max)) clamped = Math.min(clamped, max);
        range.value = `${clamped}`;
        range.dispatchEvent(new Event('input', { bubbles: true }));
      });
      manual.addEventListener('change', () => {
        if (manual.value === '') {
          syncFromRange();
        }
      });
    }

    const valueSpan = row.querySelector('.value');
    if (valueSpan) {
      row.insertBefore(manual, valueSpan);
    } else {
      row.appendChild(manual);
    }
  });
}

function syncManualInputs(container) {
  if (!container) return;
  container.querySelectorAll('input[type="range"]').forEach((range) => {
    const manual = range._manualInput;
    if (manual) {
      manual.value = range.value;
    }
  });
}

function registerInputs() {
  document.querySelectorAll('[data-param]').forEach((input) => {
    input.addEventListener('input', (event) => {
      const param = event.target.dataset.param;
      if (event.target.tagName === 'SELECT') {
        setParam(param, event.target.value);
        return;
      }

      let value = parseFloat(event.target.value);
      if (param === 'mass' && event.target.dataset.scale === 'log') {
        value = logToMass(value);
      }
      setParam(param, value);
    });
  });
}

function randomize() {
  Object.keys(paramRanges).forEach((param) => {
    const [min, max] = paramRanges[param];
    let value;
    if (param === 'mass') {
      const logMin = Math.log10(min);
      const logMax = Math.log10(max);
      value = Math.pow(10, logMin + Math.random() * (logMax - logMin));
    } else {
      value = min + Math.random() * (max - min);
    }
    setParam(param, value, { silent: true });
  });

  const sense = Math.random() > 0.5 ? 'prograde' : 'retrograde';
  setParam('diskSense', sense, { silent: true });

  setPreset('Custom', true);
  updateAllValues();
  schedulePhysicsUpdate(true);
}

function resizeCanvas() {
  pixelRatio = window.devicePixelRatio || 1;
  const { clientWidth, clientHeight } = canvas;
  canvas.width = clientWidth * pixelRatio;
  canvas.height = clientHeight * pixelRatio;
  if (overlay) {
    overlay.width = canvas.width;
    overlay.height = canvas.height;
  }
  if (glState && glState.ready) {
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  regenerateStars();
  regenerateDust();
}

function getCameraParams() {
  const minRes = Math.min(canvas.width, canvas.height);
  const aspect = canvas.width / canvas.height;
  const camOffsetX = camera.offsetX * pixelRatio;
  const camOffsetY = -camera.offsetY * pixelRatio;
  const massScale = getMassScale();
  const zoom = Math.max(state.params.zoom, 0.000001);
  const zoomCam = Math.max(Math.pow(zoom, 3), 0.000000001);
  const fov = 1;
  const camDist = (18 * massScale + 6) / zoomCam;
  const yaw = camera.rotation;
  const pitch = ((state.params.inclination + camera.pitch + currentAutoPitch) * Math.PI) / 180;
  let basePos = vec3(0, 0, camDist);
  basePos = rotateY(basePos, yaw);
  basePos = rotateX(basePos, pitch);
  const { bary } = getBarycenterData();
  const camPosWorld = add3(basePos, sub3(camera.flyPos || vec3(), bary));
  return { minRes, aspect, camOffsetX, camOffsetY, camDist, yaw, pitch, zoom, fov, camPosWorld, bary };
}

function projectWorld(pos) {
  const { minRes, aspect, camOffsetX, camOffsetY, yaw, pitch, fov, camPosWorld } = getCameraParams();
  let p = sub3(pos, camPosWorld);
  p = rotateY(p, -yaw);
  p = rotateX(p, -pitch);
  if (p.z >= -0.1) return null;
  const t = -1.2 / p.z;
  const x = (p.x * t) / fov;
  const y = (p.y * t) / fov;
  const uvx = x / (0.9 * aspect);
  const uvy = y / 0.9;
  const sx = canvas.width * 0.5 + uvx * minRes + camOffsetX;
  const sy = canvas.height * 0.5 + uvy * minRes + camOffsetY;
  return { x: sx, y: sy, depth: -p.z };
}

function projectWorldNoClip(pos) {
  const { minRes, aspect, camOffsetX, camOffsetY, yaw, pitch, fov, camPosWorld } = getCameraParams();
  let p = sub3(pos, camPosWorld);
  p = rotateY(p, -yaw);
  p = rotateX(p, -pitch);
  if (p.z >= -0.1) {
    p.z = -0.1;
  }
  const t = -1.2 / p.z;
  const x = (p.x * t) / fov;
  const y = (p.y * t) / fov;
  const uvx = x / (0.9 * aspect);
  const uvy = y / 0.9;
  const sx = canvas.width * 0.5 + uvx * minRes + camOffsetX;
  const sy = canvas.height * 0.5 + uvy * minRes + camOffsetY;
  return { x: sx, y: sy, depth: -p.z };
}

function screenToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) * pixelRatio;
  const y = (clientY - rect.top) * pixelRatio;
  const { minRes, aspect, camOffsetX, camOffsetY, yaw, pitch, fov, camPosWorld, bary } = getCameraParams();
  const centeredX = x - canvas.width * 0.5;
  const centeredY = y - canvas.height * 0.5;
  const uvx = (centeredX - camOffsetX) / minRes;
  const uvy = (centeredY - camOffsetY) / minRes;
  let dir = normalize3({ x: uvx * aspect * 0.9 * fov, y: uvy * 0.9 * fov, z: -1.2 });
  dir = rotateY(dir, yaw);
  dir = rotateX(dir, pitch);
  const pos = camPosWorld;

  if (Math.abs(dir.y) < 1e-4) return null;
  const t = -pos.y / dir.y;
  if (t < 0) return null;
  return add3(add3(pos, scale3(dir, t)), bary);
}

function clearCameraFocus() {
  camera.followId = null;
  camera.followKind = null;
}

function updateCameraFollow() {
  if (!camera.followId) return;
  let target = null;
  if (camera.followKind === 'planet') {
    target = nbody.planets.find((p) => p.id === camera.followId);
  } else if (camera.followKind === 'star') {
    target = nbody.stars.find((s) => s.id === camera.followId);
  } else if (camera.followKind === 'bh') {
    target = nbody.bodies.find((b) => b.kind === 'bh' && b.id === camera.followId);
  }
  if (!target) {
    clearCameraFocus();
    return;
  }
  camera.flyPos = vec3(target.pos.x, target.pos.y, target.pos.z);
}

function focusOnBody(body) {
  if (!body) return;
  camera.followId = body.id;
  camera.followKind = body.kind;
  camera.flyPos = vec3(body.pos.x, body.pos.y, body.pos.z);
  camera.offsetX = 0;
  camera.offsetY = 0;

  const massScale = getMassScale();
  const desired = Math.max((body.radius || 0.1) * 75, massScale * 6);
  const zoomTarget = Math.cbrt((18 * massScale + 6) / desired);
  const zoomClamped = clamp(zoomTarget, 0.00001, 8);
  setParam('zoom', zoomClamped, { silent: true });
}

function drawOverlay() {
  if (!overlayCtx) return;
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  drawOrbitPaths();
  drawSelectionMarkers();
  drawCollisionFlashes();
}

function getOrbitElements(body) {
  const { bary, baryVel, totalMass } = getBarycenterData();
  const rel = sub3(body.pos, bary);
  const vel = sub3(body.vel, baryVel);
  const r = len3(rel);
  const mu = Math.max(totalMass, 1e-6);
  const hVec = cross3(rel, vel);
  const hMag = len3(hVec);
  if (hMag < 1e-6 || !Number.isFinite(r)) return null;
  const hHat = scale3(hVec, 1 / hMag);
  const eVec = sub3(scale3(cross3(vel, hVec), 1 / mu), scale3(rel, 1 / r));
  const e = len3(eVec);
  if (!Number.isFinite(e)) return null;
  const p = (hMag * hMag) / mu;
  let pHat;
  if (e > 1e-4) {
    pHat = scale3(eVec, 1 / e);
  } else {
    const ref = Math.abs(hHat.y) < 0.9 ? vec3(0, 1, 0) : vec3(1, 0, 0);
    pHat = normalize3(cross3(ref, hHat));
  }
  const qHat = normalize3(cross3(hHat, pHat));
  return { pHat, qHat, e, p };
}

function drawOrbitPaths() {
  const selectedPlanet = getSelectedPlanet();
  const selectedStar = getSelectedStar();
  const bodies = [...nbody.bodies];
  if (!bodies.length) return;

  const { bary } = getBarycenterData();
  const lensCenter = projectWorldNoClip(vec3(0, 0, 0));
  let lens = null;
  if (lensCenter && state.params.lensing > 0.01) {
    const edge = projectWorldNoClip(vec3(derived.shadowRadiusRg, 0, 0));
    const shadowPx = edge ? Math.hypot(edge.x - lensCenter.x, edge.y - lensCenter.y) : 6;
    const scale = shadowPx / Math.max(derived.shadowRadiusRg, 1e-3);
    lens = getLensModel(scale);
  }

  const lensPoint = (proj) => {
    if (!proj || !lens || !lensCenter) return proj;
    const dx = proj.x - lensCenter.x;
    const dy = proj.y - lensCenter.y;
    const primary = lensPrimary(dx, dy, lens);
    if (!primary) return null;
    return {
      x: lensCenter.x + primary.x,
      y: lensCenter.y + primary.y,
      depth: proj.depth
    };
  };

  overlayCtx.save();
  overlayCtx.globalCompositeOperation = 'screen';
  overlayCtx.lineCap = 'round';
  overlayCtx.lineJoin = 'round';

  const drawPath = (points, rgb, alpha, baseWidth) => {
    overlayCtx.beginPath();
    let started = false;
    points.forEach((pt) => {
      const rel = sub3(pt, bary);
      const proj = projectWorld(rel);
      if (!proj) {
        started = false;
        return;
      }
      const lensed = lensPoint(proj);
      if (!lensed) {
        started = false;
        return;
      }
      if (!started) {
        overlayCtx.moveTo(lensed.x, lensed.y);
        started = true;
      } else {
        overlayCtx.lineTo(lensed.x, lensed.y);
      }
    });
    overlayCtx.strokeStyle = `rgba(${Math.round(rgb.r * 255)}, ${Math.round(rgb.g * 255)}, ${Math.round(
      rgb.b * 255
    )}, ${Math.max(0.18, alpha * 0.4)})`;
    overlayCtx.lineWidth = Math.max(baseWidth * 2.0, pixelRatio * baseWidth * 2.0);
    overlayCtx.stroke();
    overlayCtx.strokeStyle = `rgba(${Math.round(rgb.r * 255)}, ${Math.round(rgb.g * 255)}, ${Math.round(
      rgb.b * 255
    )}, ${alpha})`;
    overlayCtx.lineWidth = Math.max(baseWidth, pixelRatio * baseWidth);
    overlayCtx.stroke();
  };

  const buildOrbitRing = (body) => {
    const elements = getOrbitElements(body);
    if (!elements) return null;
    const { pHat, qHat, e, p } = elements;
    if (e >= 0.95) return null;
    const segments = e > 0.4 ? 320 : 220;
    const points = [];
    for (let i = 0; i <= segments; i += 1) {
      const nu = (i / segments) * Math.PI * 2;
      const r = p / (1.0 + e * Math.cos(nu));
      const rel = add3(scale3(pHat, r * Math.cos(nu)), scale3(qHat, r * Math.sin(nu)));
      points.push(add3(bary, rel));
    }
    return points;
  };

  bodies.forEach((body) => {
    const isSelected = body.id === state.selectedPlanetId || body.id === state.selectedStarId;
    const alpha = isSelected ? 0.95 : 0.6;
    const baseWidth = isSelected ? 4.0 : 3.0;

    let rgb = { r: 0.8, g: 0.85, b: 0.9 };
    if (body.kind === 'planet') {
      rgb = body.colorRgb || parsePlanetColor(body.color);
      body.colorRgb = rgb;
    } else if (body.kind === 'star') {
      rgb = kelvinToRgb(body.tempK || 5800);
    } else if (body.kind === 'bh') {
      rgb = { r: 0.98, g: 0.85, b: 0.6 };
    }

    const ringPoints = buildOrbitRing(body);
    if (ringPoints) {
      drawPath(ringPoints, rgb, Math.max(0.25, alpha * 0.45), Math.max(2.0, baseWidth * 0.6));
    }
    if (body.trail && body.trail.length >= 2) {
      drawPath(body.trail, rgb, alpha, baseWidth);
    }
  });

  overlayCtx.restore();
}

function drawSelectionMarkers() {
  const markers = [];
  const selectedPlanet = getSelectedPlanet();
  const selectedStar = getSelectedStar();
  if (selectedPlanet) {
    markers.push({
      body: selectedPlanet,
      color: selectedPlanet.colorRgb || parsePlanetColor(selectedPlanet.color)
    });
  }
  if (selectedStar) {
    markers.push({
      body: selectedStar,
      color: kelvinToRgb(selectedStar.tempK || 5800)
    });
  }
  if (!markers.length) return;

  const { bary } = getBarycenterData();
  overlayCtx.save();
  overlayCtx.lineWidth = Math.max(1.4, 1.4 * pixelRatio);
  markers.forEach(({ body, color }) => {
    const rel = sub3(body.pos, bary);
    const proj = projectWorld(rel);
    if (!proj) return;
    const size = Math.max(10, 10 * pixelRatio);
    overlayCtx.strokeStyle = `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(
      color.b * 255
    )}, 0.9)`;
    overlayCtx.beginPath();
    overlayCtx.moveTo(proj.x - size, proj.y);
    overlayCtx.lineTo(proj.x + size, proj.y);
    overlayCtx.moveTo(proj.x, proj.y - size);
    overlayCtx.lineTo(proj.x, proj.y + size);
    overlayCtx.stroke();
  });
  overlayCtx.restore();
}

function addCollisionFlash(pos, color = '255,200,140') {
  collisionFlashes.push({ pos: vec3(pos.x, pos.y, pos.z), start: currentTimeSeconds, color });
}

function drawCollisionFlashes() {
  if (!collisionFlashes.length) return;
  const remaining = [];
  collisionFlashes.forEach((flash) => {
    const age = currentTimeSeconds - flash.start;
    if (age > COLLISION_FLASH_DURATION) return;
    const t = age / COLLISION_FLASH_DURATION;
    const proj = projectWorld(flash.pos);
    if (!proj) {
      remaining.push(flash);
      return;
    }
    const radius = (14 + 80 * t) * (1 - t * 0.3);
    const alpha = (1 - t) * 0.6;
    overlayCtx.save();
    overlayCtx.globalCompositeOperation = 'screen';
    const gradient = overlayCtx.createRadialGradient(
      proj.x,
      proj.y,
      radius * 0.1,
      proj.x,
      proj.y,
      radius
    );
    gradient.addColorStop(0, `rgba(${flash.color}, ${0.65 * alpha})`);
    gradient.addColorStop(1, `rgba(${flash.color}, 0)`);
    overlayCtx.fillStyle = gradient;
    overlayCtx.beginPath();
    overlayCtx.arc(proj.x, proj.y, radius, 0, Math.PI * 2);
    overlayCtx.fill();
    overlayCtx.restore();
    remaining.push(flash);
  });
  collisionFlashes.length = 0;
  collisionFlashes.push(...remaining);
}

function updatePlanetUniforms(u) {
  if (!u || !u.planetCount) return;
  const count = Math.min(nbody.planets.length, MAX_PLANETS);
  gl.uniform1i(u.planetCount, count);
  if (!count) return;
  const { bary } = getBarycenterData();
  for (let i = 0; i < count; i += 1) {
    const planet = nbody.planets[i];
    const rel = sub3(planet.pos, bary);
    planetUniformData[i * 4] = rel.x;
    planetUniformData[i * 4 + 1] = rel.y;
    planetUniformData[i * 4 + 2] = rel.z;
    planetUniformData[i * 4 + 3] = planet.radius || 0.08;

    const rgb = planet.colorRgb || parsePlanetColor(planet.color);
    planet.colorRgb = rgb;
    planetColorData[i * 4] = rgb.r;
    planetColorData[i * 4 + 1] = rgb.g;
    planetColorData[i * 4 + 2] = rgb.b;
    planetColorData[i * 4 + 3] = 1.0;

    planetPropData[i * 4] = planet.tempK || 280;
    planetPropData[i * 4 + 1] = planet.seed || 0;
    planetPropData[i * 4 + 2] = planet.type || 0;
    planetPropData[i * 4 + 3] = 1.0;
  }
  gl.uniform4fv(u.planets, planetUniformData);
  gl.uniform4fv(u.planetColors, planetColorData);
  gl.uniform4fv(u.planetProps, planetPropData);
}

function updateStarUniforms(u) {
  if (!u || !u.starCount) return;
  const count = Math.min(nbody.stars.length, MAX_STARS);
  gl.uniform1i(u.starCount, count);
  if (!count) return;
  const { bary } = getBarycenterData();
  for (let i = 0; i < count; i += 1) {
    const star = nbody.stars[i];
    const rel = sub3(star.pos, bary);
    starUniformData[i * 4] = rel.x;
    starUniformData[i * 4 + 1] = rel.y;
    starUniformData[i * 4 + 2] = rel.z;
    starUniformData[i * 4 + 3] = star.radius || 0.2;

    const rgb = star.colorRgb || kelvinToRgb(star.tempK || 5800);
    star.colorRgb = rgb;
    starPropData[i * 4] = star.tempK || 5800;
    starPropData[i * 4 + 1] = star.luminosity || 1;
    starPropData[i * 4 + 2] = star.seed || 0;
    starPropData[i * 4 + 3] = 1.0;
  }
  gl.uniform4fv(u.stars, starUniformData);
  gl.uniform4fv(u.starProps, starPropData);
}

function updateBhUniforms(u) {
  if (!u || !u.bhCount) return;
  const bhBodies = nbody.bodies.filter((body) => body.kind === 'bh');
  const { bary, totalMass } = getBarycenterData();
  const count = Math.min(bhBodies.length, MAX_BH);
  gl.uniform1i(u.bhCount, count);
  if (!count) return;
  const rsVisual = getRsVisual();
  const sorted = bhBodies.slice(0, count).sort((a, b) => b.mass - a.mass);
  for (let i = 0; i < count; i += 1) {
    const body = sorted[i];
    const rel = sub3(body.pos, bary);
    const rs = rsVisual * (body.mass / Math.max(totalMass, 1e-6));
    bhUniformData[i * 4] = rel.x;
    bhUniformData[i * 4 + 1] = rel.y;
    bhUniformData[i * 4 + 2] = rel.z;
    bhUniformData[i * 4 + 3] = Math.max(rs, 0.2);
  }
  gl.uniform4fv(u.bhPosRs, bhUniformData);
}

function updateOrbitUniforms(u) {
  if (!u || !u.orbitEnabled) return;
  const planet = getSelectedPlanet();
  if (!planet) {
    gl.uniform1i(u.orbitEnabled, 0);
    return;
  }
  gl.uniform1i(u.orbitEnabled, 0);
  return;
  const { bary, baryVel, totalMass } = getBarycenterData();
  const rel = sub3(planet.pos, bary);
  const vel = sub3(planet.vel, baryVel);
  const r = len3(rel);
  const mu = Math.max(totalMass, 1e-6);
  const hVec = cross3(rel, vel);
  const hMag = len3(hVec);
  if (hMag < 1e-6) {
    gl.uniform1i(u.orbitEnabled, 0);
    return;
  }
  const hHat = scale3(hVec, 1 / hMag);
  const eVec = sub3(scale3(cross3(vel, hVec), 1 / mu), scale3(rel, 1 / r));
  const e = len3(eVec);
  let a = 1 / Math.max((2 / r) - (dot3(vel, vel) / mu), 1e-6);
  if (!Number.isFinite(a) || a <= 0) {
    a = Math.max(planet.orbitDistance || r, 0.5);
  }
  const p = (hMag * hMag) / mu;
  let pHat;
  if (e > 1e-4) {
    pHat = scale3(eVec, 1 / e);
  } else {
    const ref = Math.abs(hHat.y) < 0.9 ? vec3(0, 1, 0) : vec3(1, 0, 0);
    pHat = normalize3(cross3(ref, hHat));
  }
  const qHat = normalize3(cross3(hHat, pHat));
  gl.uniform1i(u.orbitEnabled, 1);
  gl.uniform3f(u.orbitP, pHat.x, pHat.y, pHat.z);
  gl.uniform3f(u.orbitQ, qHat.x, qHat.y, qHat.z);
  gl.uniform1f(u.orbitE, e);
  gl.uniform1f(u.orbitPparam, e < 1e-4 ? a : p);
  const orbitThickness = Math.max(0.05, Math.min(0.16, (planet.radius || 0.08) * 0.65));
  gl.uniform1f(u.orbitThickness, orbitThickness);
  const rgb = planet.colorRgb || parsePlanetColor(planet.color);
  planet.colorRgb = rgb;
  const bright = {
    r: Math.min(1.0, rgb.r * 0.45 + 0.65),
    g: Math.min(1.0, rgb.g * 0.45 + 0.65),
    b: Math.min(1.0, rgb.b * 0.45 + 0.65)
  };
  gl.uniform3f(u.orbitColor, bright.r, bright.g, bright.b);
}

function regenerateStars() {
  const count = Math.floor(120 + state.params.starDensity * 700);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const spreadX = width * 0.9;
  const spreadY = height * 0.9;
  stars = new Array(count).fill(null).map(() => ({
    x: (Math.random() - 0.5) * (width + spreadX),
    y: (Math.random() - 0.5) * (height + spreadY),
    r: 0.6 + Math.random() * 1.4,
    alpha: 0.3 + Math.random() * 0.7,
    twinkle: Math.random() * Math.PI * 2
  }));
}

function regenerateDust() {
  const count = Math.floor(80 + state.params.dustDensity * 320);
  dust = new Array(count).fill(null).map(() => ({
    radius: 0.4 + Math.random() * 1.0,
    angle: Math.random() * Math.PI * 2,
    speed: 0.2 + Math.random() * 0.9,
    size: 0.8 + Math.random() * 1.6,
    fade: Math.random() * Math.PI * 2
  }));
}

function drawBackground(width, height, time) {
  ctx.clearRect(0, 0, width, height);
  const glow = state.params.backgroundGlow;
  const gradient = ctx.createRadialGradient(width * 0.3, height * 0.2, 40, width * 0.5, height * 0.5, width * 0.6);
  gradient.addColorStop(0, `rgba(50, 120, 255, ${0.12 * glow})`);
  gradient.addColorStop(0.35, `rgba(255, 140, 80, ${0.12 * glow})`);
  gradient.addColorStop(1, 'rgba(2, 4, 10, 1)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const haze = ctx.createLinearGradient(0, 0, width, height);
  haze.addColorStop(0, `rgba(6, 9, 18, ${0.55 + 0.25 * glow})`);
  haze.addColorStop(1, 'rgba(1, 2, 6, 0.95)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = `rgba(255, 200, 120, ${0.04 + 0.02 * glow * Math.sin(time * 0.3)})`;
  ctx.beginPath();
  ctx.arc(width * 0.2, height * 0.8, width * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function getLensModel(scale) {
  const shadowPx = Math.max(derived.shadowRadiusRg * scale, 1);
  const massFactor = clamp(Math.log10(state.params.mass) / 10, 0, 1);
  const strength = state.params.lensing * (0.35 + 0.65 * massFactor);
  const thetaE = strength * 0.9;
  const scaleRef = shadowPx * (1.2 + strength);
  return { shadowPx, strength, thetaE, scaleRef };
}

function lensPrimary(x, y, lens) {
  const r = Math.hypot(x, y);
  if (r < lens.shadowPx * 1.02 || r === 0) return null;
  const beta = r / lens.scaleRef;
  const sqrtTerm = Math.sqrt(beta * beta + 4 * lens.thetaE * lens.thetaE);
  const theta = 0.5 * (beta + sqrtTerm);
  const rImage = theta * lens.scaleRef;
  const scale = rImage / r;
  const magnification =
    lens.thetaE <= 1e-4 ? 1 : 0.5 + 0.8 * (lens.thetaE / (beta + lens.thetaE + 1e-4));
  return { x: x * scale, y: y * scale, magnification };
}

function lensSecondary(x, y, lens) {
  if (lens.thetaE <= 1e-4) return null;
  const r = Math.hypot(x, y);
  if (r < lens.shadowPx * 1.02 || r === 0) return null;
  const beta = r / lens.scaleRef;
  const sqrtTerm = Math.sqrt(beta * beta + 4 * lens.thetaE * lens.thetaE);
  const theta2 = 0.5 * (beta - sqrtTerm);
  if (theta2 >= 0) return null;
  const rImage = Math.abs(theta2) * lens.scaleRef;
  const scale = rImage / r;
  const magnification = 0.25 + 0.5 * (lens.thetaE / (beta + lens.thetaE + 1e-4));
  return { x: -x * scale, y: -y * scale, magnification };
}

function drawSpacetimeGrid(cx, cy, scale, time) {
  if (state.params.gridStrength <= 0.01) return;

  const lens = getLensModel(scale);
  const extent = Math.max(canvas.clientWidth, canvas.clientHeight) * 0.7;
  const spacing = 90 - state.params.gridStrength * 30;
  const steps = 60;
  const baseAlpha = 0.04 + 0.12 * state.params.gridStrength;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(camera.rotation);
  ctx.globalCompositeOperation = 'screen';
  ctx.lineWidth = 1;

  for (let x = -extent; x <= extent; x += spacing) {
    const alpha = baseAlpha * (1 - Math.abs(x) / extent);
    ctx.strokeStyle = `rgba(120, 190, 255, ${alpha})`;
    ctx.beginPath();
    let penDown = false;
    for (let i = 0; i <= steps; i += 1) {
      const y = -extent + (2 * extent * i) / steps;
      const p = lensPrimary(x, y, lens);
      if (!p) {
        penDown = false;
        continue;
      }
      if (!penDown) {
        ctx.moveTo(p.x, p.y);
        penDown = true;
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.stroke();
  }

  for (let y = -extent; y <= extent; y += spacing) {
    const alpha = baseAlpha * (1 - Math.abs(y) / extent);
    ctx.strokeStyle = `rgba(120, 210, 200, ${alpha})`;
    ctx.beginPath();
    let penDown = false;
    for (let i = 0; i <= steps; i += 1) {
      const x = -extent + (2 * extent * i) / steps;
      const p = lensPrimary(x, y, lens);
      if (!p) {
        penDown = false;
        continue;
      }
      if (!penDown) {
        ctx.moveTo(p.x, p.y);
        penDown = true;
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.stroke();
  }

  ctx.restore();
}

function drawStars(time, cx, cy, scale) {
  const lens = getLensModel(scale);
  const cosR = Math.cos(camera.rotation);
  const sinR = Math.sin(camera.rotation);

  ctx.save();
  ctx.fillStyle = '#ffffff';
  stars.forEach((star) => {
    const flicker = 0.5 + 0.5 * Math.sin(time * 1.2 + star.twinkle);
    const rx = star.x * cosR - star.y * sinR;
    const ry = star.x * sinR + star.y * cosR;
    const primary = lensPrimary(rx, ry, lens);
    if (primary) {
      const alpha = star.alpha * (0.55 + 0.45 * flicker) * (0.7 + primary.magnification * 0.3);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(cx + primary.x, cy + primary.y, star.r * (0.9 + primary.magnification * 0.2), 0, Math.PI * 2);
      ctx.fill();
    }

    if (state.params.lensing > 0.15) {
      const secondary = lensSecondary(rx, ry, lens);
      if (secondary && Math.hypot(secondary.x, secondary.y) > lens.shadowPx * 0.9) {
        ctx.globalAlpha = star.alpha * 0.35 * (0.6 + secondary.magnification * 0.4);
        ctx.beginPath();
        ctx.arc(cx + secondary.x, cy + secondary.y, star.r * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
  ctx.restore();
}

function drawJets(cx, cy, scale, time) {
  if (state.params.jetPower <= 0.01) return;

  const power = state.params.jetPower;
  const accretionBoost = 0.4 + state.params.accretion * 0.6;
  const spinBoost = 0.6 + state.params.spin * 0.8;
  const jetIntensity = power * accretionBoost * spinBoost;
  const length = scale * (6 + jetIntensity * 14);
  const width = scale * (0.4 + state.params.jetWidth * 1.0);
  const pulse = 0.7 + 0.3 * Math.sin(time * (2 + jetIntensity * 4));
  const color = `rgba(80, 210, 255, ${0.25 + jetIntensity * 0.5})`;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const gradUp = ctx.createLinearGradient(cx, cy, cx, cy - length);
  gradUp.addColorStop(0, `rgba(255, 210, 160, ${0.3 * jetIntensity})`);
  gradUp.addColorStop(0.4, color);
  gradUp.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = gradUp;
  ctx.beginPath();
  ctx.moveTo(cx - width * pulse, cy);
  ctx.lineTo(cx + width * pulse, cy);
  ctx.lineTo(cx, cy - length);
  ctx.closePath();
  ctx.fill();

  const gradDown = ctx.createLinearGradient(cx, cy, cx, cy + length);
  gradDown.addColorStop(0, `rgba(255, 210, 160, ${0.3 * jetIntensity})`);
  gradDown.addColorStop(0.4, color);
  gradDown.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = gradDown;
  ctx.beginPath();
  ctx.moveTo(cx - width * pulse, cy);
  ctx.lineTo(cx + width * pulse, cy);
  ctx.lineTo(cx, cy + length);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function diskTemperature(r, rIn, mdot) {
  const x = rIn / r;
  const base = mdot * (1 - Math.sqrt(x)) / (r * r * r);
  return Math.pow(Math.max(base, 0), 0.25);
}

function diskColor(tempNorm, hueBase, alpha) {
  const hue = hueBase + (1 - tempNorm) * 30;
  const light = 40 + tempNorm * 45;
  return `hsla(${hue}, 90%, ${light}%, ${alpha})`;
}

function drawDisk(cx, cy, scale, time) {
  if (state.params.accretion <= 0.01) return;

  const rIn = derived.riscoRg * state.params.diskInnerFactor;
  const rOut = rIn * state.params.diskOuterFactor;
  const inclination = (state.params.inclination * Math.PI) / 180;
  const scaleY = Math.max(0.12, Math.cos(inclination));
  const massFactor = Math.pow(state.params.mass, -0.35);
  const rotation = time * (0.2 + state.params.spin * 0.8) * massFactor;
  const sense = state.params.diskSense === 'retrograde' ? -1 : 1;
  const dopplerFactor = Math.sin(inclination) * (0.3 + 0.7 * state.params.spin);
  const hue = state.params.diskHue;

  const rPeak = rIn * 1.36;
  const tPeak = diskTemperature(rPeak, rIn, state.params.accretion + 0.01);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.scale(1, scaleY);
  ctx.globalCompositeOperation = 'screen';

  const layers = 32;
  for (let i = 0; i < layers; i += 1) {
    const t = i / (layers - 1);
    const radius = rIn + (rOut - rIn) * t;
    const temp = diskTemperature(radius, rIn, state.params.accretion + 0.01) / (tPeak || 1);
    const tempNorm = clamp(temp, 0, 1);
    const gravRedshift = Math.sqrt(Math.max(1 - 2 / radius, 0.08));
    const tempAdj = clamp(tempNorm * gravRedshift, 0, 1);
    const alpha = (0.08 + state.params.accretion * 0.5) * (1 - Math.abs(t - 0.5) * 1.6);
    ctx.lineWidth = scale * state.params.diskThickness * (0.25 + (1 - t) * 0.4);
    const bright = clamp(tempAdj * (1 + dopplerFactor * 0.9), 0, 1);
    const dark = clamp(tempAdj * (1 - dopplerFactor * 0.6), 0, 1);
    const gradient = ctx.createLinearGradient(-radius * scale * sense, 0, radius * scale * sense, 0);
    gradient.addColorStop(0, diskColor(dark, hue - 6, alpha * 0.8));
    gradient.addColorStop(0.5, diskColor(tempAdj, hue, alpha));
    gradient.addColorStop(1, diskColor(bright, hue + 6, alpha * 1.15));
    ctx.strokeStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, radius * scale, 0, Math.PI * 2);
    ctx.stroke();
  }

  const glow = ctx.createLinearGradient(-rOut * scale * sense, 0, rOut * scale * sense, 0);
  glow.addColorStop(0, `rgba(255, 170, 120, ${0.05 + dopplerFactor * 0.15})`);
  glow.addColorStop(0.5, `rgba(255, 235, 200, ${0.12 + state.params.accretion * 0.2})`);
  glow.addColorStop(1, `rgba(255, 220, 170, ${0.15 + dopplerFactor * 0.28})`);
  ctx.strokeStyle = glow;
  ctx.lineWidth = scale * state.params.diskThickness * 0.5;
  ctx.beginPath();
  ctx.arc(0, 0, rOut * scale * 0.85, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawShadow(cx, cy, scale) {
  if (state.mode === 'pulsar') return;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  if (derived.shadowPath.length) {
    const first = derived.shadowPath[0];
    ctx.moveTo(first.x * scale, first.y * scale);
    derived.shadowPath.forEach((p) => {
      ctx.lineTo(p.x * scale, p.y * scale);
    });
  } else {
    ctx.arc(0, 0, derived.shadowRadiusRg * scale, 0, Math.PI * 2);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.97)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = scale * 0.8;
  ctx.fill();
  ctx.restore();
}

function drawPhotonRing(cx, cy, scale) {
  if (state.params.ringBrightness <= 0.01 || state.mode === 'pulsar') return;
  if (nbody.binary || nbody.bodies.filter((body) => body.kind === 'bh').length > 1) return;

  const brightness = state.params.ringBrightness;
  const ringWidth = Math.max(1, scale * 0.18 * (0.5 + brightness));
  const radius = derived.shadowRadiusRg * scale;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = 'screen';

  const gradient = ctx.createLinearGradient(-radius, 0, radius, 0);
  gradient.addColorStop(0, `rgba(255, 190, 130, ${0.15 + brightness * 0.3})`);
  gradient.addColorStop(0.5, `rgba(255, 230, 190, ${0.45 * brightness})`);
  gradient.addColorStop(1, `rgba(255, 200, 140, ${0.2 + brightness * 0.3})`);

  ctx.strokeStyle = gradient;
  ctx.lineWidth = ringWidth;
  ctx.beginPath();
  if (derived.shadowPath.length) {
    const first = derived.shadowPath[0];
    ctx.moveTo(first.x * scale, first.y * scale);
    derived.shadowPath.forEach((p) => {
      ctx.lineTo(p.x * scale, p.y * scale);
    });
  } else {
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawDust(cx, cy, scale, time) {
  if (state.params.dustDensity <= 0.01) return;

  const rIn = derived.riscoRg * state.params.diskInnerFactor * 1.2;
  const rOut = rIn * state.params.diskOuterFactor * 1.1;
  const inclination = (state.params.inclination * Math.PI) / 180;
  const scaleY = Math.max(0.18, Math.cos(inclination));
  const rotation = time * (0.12 + state.params.spin * 0.6);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.scale(1, scaleY);
  ctx.globalCompositeOperation = 'lighter';

  dust.forEach((particle) => {
    const radius = rIn + particle.radius * (rOut - rIn);
    const angle = particle.angle + time * particle.speed * (0.4 + state.params.spin);
    const x = Math.cos(angle) * radius * scale;
    const y = Math.sin(angle) * radius * scale;
    const shimmer = 0.4 + 0.6 * Math.sin(angle * 2 + particle.fade);
    ctx.globalAlpha = shimmer * (0.3 + state.params.dustDensity * 0.7);
    ctx.fillStyle = 'rgba(255, 220, 180, 0.8)';
    ctx.fillRect(x, y, particle.size, particle.size);
  });

  ctx.restore();
}

function drawPulsar(cx, cy, scale, time) {
  const radius = scale * 6;
  const pulse = state.params.pulse;
  const spinSpeed = time * (2 + pulse * 4);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const glow = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 3.5);
  glow.addColorStop(0, `rgba(120, 210, 255, ${0.65 + pulse * 0.2})`);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(80, 170, 255, 0.85)';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  const beamLength = radius * (4 + pulse * 5);
  const beamWidth = radius * (0.5 + pulse * 0.6);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(spinSpeed);
  ctx.fillStyle = `rgba(120, 200, 255, ${0.15 + pulse * 0.4})`;
  ctx.beginPath();
  ctx.moveTo(-beamWidth, 0);
  ctx.lineTo(beamWidth, 0);
  ctx.lineTo(0, -beamLength);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-beamWidth, 0);
  ctx.lineTo(beamWidth, 0);
  ctx.lineTo(0, beamLength);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

function render(time) {
  if (!glState || !glState.ready) {
    requestAnimationFrame(render);
    return;
  }

  const dt = lastFrameTime ? Math.min((time - lastFrameTime) * 0.001, 0.05) : 0.0;
  lastFrameTime = time;
  const timeSeconds = time * 0.001;
  currentTimeSeconds = timeSeconds;
  const t = timeSeconds;
  let autoOrbitSpeed = 0.25 * state.params.animationSpeed;
  if (nbody.planets.length) {
    autoOrbitSpeed *= 0.35;
  }
  if (state.selectedPlanetId) {
    autoOrbitSpeed *= 0.2;
  }
  if (!state.cameraAutoOrbit) {
    autoOrbitSpeed = 0;
  }
  if (!isDragging) {
    camera.rotation += autoOrbitSpeed * dt;
  }
  const autoPitch = state.cameraAutoOrbit
    ? Math.sin(timeSeconds * 0.35) * 6.0 * state.params.animationSpeed
    : 0;
  currentAutoPitch = autoPitch;
  updateCameraFollow();

  gl.useProgram(glState.program);
  gl.bindVertexArray(glState.vao);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  const u = glState.uniforms;
  gl.uniform2f(u.resolution, canvas.width, canvas.height);
  gl.uniform1f(u.time, t);
  gl.uniform1f(u.mass, state.params.mass);
  gl.uniform1f(u.spin, state.params.spin);
  gl.uniform1f(u.accretion, state.params.accretion);
  gl.uniform1f(u.inclination, ((state.params.inclination + camera.pitch + autoPitch) * Math.PI) / 180);
  const isBinary = nbody.binary || nbody.bodies.filter((body) => body.kind === 'bh').length > 1;
  const rsVisual = getRsVisual();
  let diskInnerFactor = state.params.diskInnerFactor;
  let diskOuterFactor = state.params.diskOuterFactor;
  if (isBinary) {
    const cavity = Math.max(nbody.separation * 0.8, rsVisual * 2.2);
    const minInnerFactor = cavity / (rsVisual * 1.6);
    diskInnerFactor = Math.max(diskInnerFactor, minInnerFactor);
    diskOuterFactor = Math.max(diskOuterFactor, diskInnerFactor + 2.0);
  }
  gl.uniform1f(u.diskInner, diskInnerFactor);
  gl.uniform1f(u.diskOuter, diskOuterFactor);
  gl.uniform1f(u.diskThickness, state.params.diskThickness);
  gl.uniform1f(u.diskHue, state.params.diskHue);
  const ringBrightness = isBinary ? 0 : state.params.ringBrightness;
  gl.uniform1f(u.ringBrightness, ringBrightness);
  gl.uniform1f(u.gridStrength, state.params.gridStrength);
  gl.uniform1f(u.lensing, state.params.lensing);
  gl.uniform1f(u.zoom, state.params.zoom);
  gl.uniform1f(u.camYaw, camera.rotation);
  gl.uniform2f(u.camOffset, camera.offsetX * pixelRatio, -camera.offsetY * pixelRatio);
  const { bary } = getBarycenterData();
  const camPosRel = sub3(camera.flyPos || vec3(), bary);
  gl.uniform3f(u.camPos, camPosRel.x, camPosRel.y, camPosRel.z);
  gl.uniform1f(u.starDensity, state.params.starDensity);
  gl.uniform1f(u.dustDensity, state.params.dustDensity);
  gl.uniform1f(u.backgroundGlow, state.params.backgroundGlow);
  gl.uniform1f(u.jetPower, state.params.jetPower);
  gl.uniform1f(u.jetWidth, state.params.jetWidth);
  gl.uniform1f(u.pulse, state.params.pulse);
  gl.uniform1f(u.diskSense, state.params.diskSense === 'retrograde' ? -1 : 1);
  gl.uniform1f(u.isPulsar, state.mode === 'pulsar' ? 1 : 0);
  const diskOuter = diskOuterFactor * rsVisual * 1.6;
  let maxOrbit = 0;
  nbody.planets.forEach((planet) => {
    const rel = sub3(planet.pos, bary);
    maxOrbit = Math.max(maxOrbit, len3(rel) + (planet.radius || 0));
  });
  const sceneRadius = Math.max(diskOuter, maxOrbit, derived.shadowRadiusRg * rsVisual * 1.2);
  gl.uniform1f(u.sceneRadius, sceneRadius);
  updatePlanetUniforms(u);
  updateStarUniforms(u);
  updateBhUniforms(u);
  updateOrbitUniforms(u);

  gl.drawArrays(gl.TRIANGLES, 0, 3);

  const timeScale = Math.max(0.1, Math.sqrt(Math.max(state.params.mass, 1)) / 6);
  const simSpeed = Math.max(0, state.params.simSpeed ?? 1);
  const simDt = Math.min(dt * simSpeed * timeScale, 0.05);
  updateNBody(simDt);
  updatePlanetHeating();
  drawOverlay();

  requestAnimationFrame(render);
}

function setPanelCollapsed(collapsed, persist = true) {
  panel.classList.toggle('collapsed', collapsed);
  panelDock.classList.toggle('show', collapsed);
  if (persist) {
    localStorage.setItem('panelCollapsed', collapsed ? '1' : '0');
  }
}

function registerSections() {
  document.querySelectorAll('.section-toggle').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const target = document.getElementById(toggle.dataset.target);
      toggle.classList.toggle('open');
      target.classList.toggle('open');
    });
  });
}

populatePresets();
addManualNumberInputs();
registerInputs();
registerSections();
setPreset(presets[0].name, true);
resetNBody();
updatePlanetUi();
updateStarUi();
if (showAllOrbitsToggle) {
  showAllOrbitsToggle.checked = true;
  showAllOrbitsToggle.disabled = true;
  state.showAllOrbits = true;
}

presetSelect.addEventListener('change', (event) => {
  setPreset(event.target.value, true);
});

randomizeBtn.addEventListener('click', () => {
  randomize();
});

resetBtn.addEventListener('click', () => {
  setPreset(state.lastPreset, true);
});

menuToggle.addEventListener('click', () => {
  const next = !panel.classList.contains('collapsed');
  setPanelCollapsed(next);
});

menuShow.addEventListener('click', () => {
  setPanelCollapsed(false);
});

const storedCollapsed = localStorage.getItem('panelCollapsed');
if (storedCollapsed === '1') {
  setPanelCollapsed(true, false);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
requestAnimationFrame(render);

if (window.location.protocol === 'file:') {
  statusValue.textContent = 'Open via the local server to enable physics.';
} else {
  schedulePhysicsUpdate(true);
}

function resetCamera() {
  camera.offsetX = 0;
  camera.offsetY = 0;
  camera.rotation = 0;
  camera.pitch = 0;
  camera.flyPos = vec3();
  clearCameraFocus();
  setParam('zoom', defaultParams.zoom, { silent: true });
}

canvas.addEventListener('contextmenu', (event) => event.preventDefault());

if (placePlanetBtn) {
  placePlanetBtn.addEventListener('click', () => {
    nbody.placing = !nbody.placing;
    if (nbody.placing) {
      selectPlanet(null);
      nbody.placingStar = false;
    }
    updatePlanetUi();
    updateStarUi();
  });
}

if (clearPlanetsBtn) {
  clearPlanetsBtn.addEventListener('click', () => {
    nbody.planets = [];
    nbody.bodies = nbody.bodies.filter((body) => body.kind !== 'planet');
    selectPlanet(null);
    refreshPlanetList();
  });
}

if (planetMassEdit) {
  planetMassEdit.addEventListener('input', () => {
    const planet = getSelectedPlanet();
    if (!planet) return;
    const value = parseFloat(planetMassEdit.value);
    setPlanetMass(planet, value);
    if (planetMassValue) planetMassValue.textContent = `${value.toFixed(1)} Mearth`;
  });
}

if (planetDistanceEdit) {
  planetDistanceEdit.addEventListener('input', () => {
    const planet = getSelectedPlanet();
    if (!planet) return;
    const distance = parseFloat(planetDistanceEdit.value);
    const speedScale = planet.orbitSpeedScale || 1;
    updatePlanetOrbit(planet, distance, speedScale);
    if (planetDistanceValue) planetDistanceValue.textContent = `${distance.toFixed(2)} rg`;
  });
}

if (planetSpeedEdit) {
  planetSpeedEdit.addEventListener('input', () => {
    const planet = getSelectedPlanet();
    if (!planet) return;
    const speed = parseFloat(planetSpeedEdit.value);
    setBodySpeedScale(planet, speed);
    if (planetSpeedValue) planetSpeedValue.textContent = `${speed.toFixed(2)}x`;
  });
}

if (planetTiltEdit) {
  planetTiltEdit.addEventListener('input', () => {
    const planet = getSelectedPlanet();
    if (!planet) return;
    const tilt = parseFloat(planetTiltEdit.value);
    planet.orbitTilt = tilt;
    updatePlanetOrbit(planet, planet.orbitDistance || 1, planet.orbitSpeedScale || 1);
    if (planetTiltValue) planetTiltValue.textContent = `${tilt.toFixed(0)} deg`;
  });
}

if (planetEccEdit) {
  planetEccEdit.addEventListener('input', () => {
    const planet = getSelectedPlanet();
    if (!planet) return;
    const ecc = parseFloat(planetEccEdit.value);
    planet.orbitEcc = clamp(ecc, 0, 0.85);
    updatePlanetOrbit(planet, planet.orbitDistance || 1, planet.orbitSpeedScale || 1);
    if (planetEccValue) planetEccValue.textContent = `${planet.orbitEcc.toFixed(2)}`;
  });
}

if (planetTempEdit) {
  planetTempEdit.addEventListener('input', () => {
    const planet = getSelectedPlanet();
    if (!planet) return;
    const temp = parseFloat(planetTempEdit.value);
    setPlanetTemperature(planet, temp);
    if (planetTempValue) planetTempValue.textContent = `${planet.tempK.toFixed(0)} K`;
  });
}

if (planetSelect) {
  planetSelect.addEventListener('change', () => {
    const id = planetSelect.value;
    const planet = nbody.planets.find((p) => p.id === id);
    selectPlanet(planet || null);
  });
}

if (autoOrbitToggle) {
  autoOrbitToggle.addEventListener('click', () => {
    state.cameraAutoOrbit = !state.cameraAutoOrbit;
    autoOrbitToggle.textContent = state.cameraAutoOrbit ? 'On' : 'Off';
  });
  autoOrbitToggle.textContent = state.cameraAutoOrbit ? 'On' : 'Off';
}

if (deletePlanetBtn) {
  deletePlanetBtn.addEventListener('click', () => {
    const planet = getSelectedPlanet();
    if (!planet) return;
    nbody.planets = nbody.planets.filter((p) => p.id !== planet.id);
    nbody.bodies = nbody.bodies.filter((b) => b.id !== planet.id);
    selectPlanet(null);
    refreshPlanetList();
  });
}

if (focusPlanetBtn) {
  focusPlanetBtn.addEventListener('click', () => {
    const planet = getSelectedPlanet();
    if (!planet) return;
    focusOnBody(planet);
  });
}

if (placeStarBtn) {
  placeStarBtn.addEventListener('click', () => {
    nbody.placingStar = !nbody.placingStar;
    if (nbody.placingStar) {
      nbody.placing = false;
    }
    updateStarUi();
    updatePlanetUi();
  });
}

if (clearStarsBtn) {
  clearStarsBtn.addEventListener('click', () => {
    nbody.stars = [];
    nbody.bodies = nbody.bodies.filter((b) => b.kind !== 'star');
    selectStar(null);
    updateStarUi();
  });
}

if (starMassEdit) {
  starMassEdit.addEventListener('input', () => {
    const star = getSelectedStar();
    if (!star) return;
    const value = parseFloat(starMassEdit.value);
    setStarMass(star, value);
    if (starMassValue) starMassValue.textContent = `${star.massMsun.toFixed(2)} Msun`;
  });
}

if (starTempEdit) {
  starTempEdit.addEventListener('input', () => {
    const star = getSelectedStar();
    if (!star) return;
    const value = parseFloat(starTempEdit.value);
    setStarTemp(star, value);
    star.colorRgb = kelvinToRgb(star.tempK);
    if (starTempValue) starTempValue.textContent = `${star.tempK.toFixed(0)} K`;
  });
}

if (starDistanceEdit) {
  starDistanceEdit.addEventListener('input', () => {
    const star = getSelectedStar();
    if (!star) return;
    const distance = parseFloat(starDistanceEdit.value);
    const speedScale = star.orbitSpeedScale || 1;
    updateStarOrbit(star, distance, speedScale);
    if (starDistanceValue) starDistanceValue.textContent = `${distance.toFixed(2)} rg`;
  });
}

if (starSpeedEdit) {
  starSpeedEdit.addEventListener('input', () => {
    const star = getSelectedStar();
    if (!star) return;
    const speed = parseFloat(starSpeedEdit.value);
    setBodySpeedScale(star, speed);
    if (starSpeedValue) starSpeedValue.textContent = `${speed.toFixed(2)}x`;
  });
}

if (starTiltEdit) {
  starTiltEdit.addEventListener('input', () => {
    const star = getSelectedStar();
    if (!star) return;
    const tilt = parseFloat(starTiltEdit.value);
    star.orbitTilt = tilt;
    updateStarOrbit(star, star.orbitDistance || 1, star.orbitSpeedScale || 1);
    if (starTiltValue) starTiltValue.textContent = `${tilt.toFixed(0)} deg`;
  });
}

if (starEccEdit) {
  starEccEdit.addEventListener('input', () => {
    const star = getSelectedStar();
    if (!star) return;
    const ecc = parseFloat(starEccEdit.value);
    star.orbitEcc = clamp(ecc, 0, 0.85);
    updateStarOrbit(star, star.orbitDistance || 1, star.orbitSpeedScale || 1);
    if (starEccValue) starEccValue.textContent = `${star.orbitEcc.toFixed(2)}`;
  });
}

if (starSelect) {
  starSelect.addEventListener('change', () => {
    const id = starSelect.value;
    const star = nbody.stars.find((s) => s.id === id);
    selectStar(star || null);
  });
}

if (deleteStarBtn) {
  deleteStarBtn.addEventListener('click', () => {
    const star = getSelectedStar();
    if (!star) return;
    nbody.stars = nbody.stars.filter((s) => s.id !== star.id);
    nbody.bodies = nbody.bodies.filter((b) => b.id !== star.id);
    selectStar(null);
    refreshStarList();
  });
}

if (focusStarBtn) {
  focusStarBtn.addEventListener('click', () => {
    const star = getSelectedStar();
    if (!star) return;
    focusOnBody(star);
  });
}

canvas.addEventListener('click', (event) => {
  if (event.button !== 0) return;
  if (nbody.placingStar) {
    const world = screenToWorld(event.clientX, event.clientY);
    if (world) {
      addStarAt(world);
    }
    nbody.placingStar = false;
    updateStarUi();
    return;
  }
  if (nbody.placing) {
    const world = screenToWorld(event.clientX, event.clientY);
    if (world) {
      addPlanetAt(world);
    }
    nbody.placing = false;
    updatePlanetUi();
    return;
  }

  const hitPlanet = findPlanetAt(event.clientX, event.clientY);
  const hitStar = findStarAt(event.clientX, event.clientY);
  if (hitStar) {
    selectStar(hitStar);
    updateStarUi();
    return;
  }
  selectPlanet(hitPlanet);
  updatePlanetUi();
});

canvas.addEventListener('mousedown', (event) => {
  isDragging = true;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  dragMode = event.button === 2 || event.shiftKey ? 'pan' : 'rotate';
  clearCameraFocus();
});

window.addEventListener('mouseup', () => {
  isDragging = false;
});

window.addEventListener('mousemove', (event) => {
  if (!isDragging) return;
  const dx = event.clientX - lastPointerX;
  const dy = event.clientY - lastPointerY;
  if (dragMode === 'pan') {
    camera.offsetX += dx;
    camera.offsetY += dy;
  } else {
    camera.rotation += dx * 0.007;
    camera.pitch += dy * 0.25;
  }
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
});

canvas.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0015);
    const nextZoom = Math.max(state.params.zoom * factor, 0.00001);
    setParam('zoom', nextZoom, { silent: true });
  },
  { passive: false }
);

// WASD free-fly removed by request.

if (resetCameraBtn) {
  resetCameraBtn.addEventListener('click', resetCamera);
}
