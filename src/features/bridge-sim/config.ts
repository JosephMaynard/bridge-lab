import type { PresetScenario, SimulationConfig } from "@/types/simulation"

export const defaultConfig: SimulationConfig = {
  bridge: {
    type: "suspension",
    spanLength: 38,
    deckWidth: 5.2,
    towerHeight: 9.5,
    supports: 8,
    cableSag: 0.34,
    supportSpacing: 4.8,
    stiffness: 1.35,
    damping: 0.62,
    failureThreshold: 1.22,
    materialStrength: 1.12,
  },
  timing: {
    duration: 18,
    sampleDensity: 30,
    replaySpeed: 1,
  },
  load: {
    totalWeight: 62,
    loadPoints: 6,
    distribution: "even",
    bias: 0,
    movingLoad: true,
    movingSpeed: 0.42,
  },
  wind: {
    enabled: true,
    speed: 28,
    gustiness: 0.36,
    direction: -18,
    turbulence: 0.42,
    particleCount: 520,
    particleSize: 0.08,
    particleSpeed: 1.25,
    particleTrail: 0.55,
    showParticles: true,
  },
  earthquake: {
    enabled: false,
    intensity: 0.18,
    frequency: 1.8,
    duration: 8,
    direction: "mixed",
    waveform: "sine",
  },
  impact: {
    enabled: false,
    impactTime: 7.5,
    intensity: 0.7,
    radius: 0.24,
    speed: 58,
    angle: -34,
    targetBias: 0.05,
    fragmentCount: 180,
    showEffects: true,
  },
  camera: {
    cinematic: true,
    autoOrbitSpeed: 0.14,
    distance: 48,
    heightBias: 13,
  },
  overlay: {
    showStress: true,
    opacity: 0.54,
    palette: "thermal",
    highlightCritical: true,
    showSupportLabels: true,
    showFailureZones: true,
  },
}

const cloneConfig = (config: SimulationConfig): SimulationConfig =>
  structuredClone(config)

export const presets: PresetScenario[] = [
  {
    id: "calm",
    name: "Calm Conditions",
    description: "A stable baseline run with gentle wind and low live load.",
    config: {
      ...cloneConfig(defaultConfig),
      wind: { ...defaultConfig.wind, speed: 10, gustiness: 0.12, turbulence: 0.14, particleCount: 300 },
      load: { ...defaultConfig.load, totalWeight: 34, loadPoints: 4, movingSpeed: 0.25 },
      bridge: { ...defaultConfig.bridge, stiffness: 1.65, failureThreshold: 1.42 },
    },
  },
  {
    id: "crosswind",
    name: "Crosswind Stress Test",
    description: "Sustained gusts amplify lateral sway before damping recovers.",
    config: {
      ...cloneConfig(defaultConfig),
      wind: { ...defaultConfig.wind, speed: 42, gustiness: 0.62, turbulence: 0.64, direction: -42, particleCount: 860 },
      load: { ...defaultConfig.load, totalWeight: 58, distribution: "offset", bias: 0.22 },
      bridge: { ...defaultConfig.bridge, stiffness: 1.16, damping: 0.48, failureThreshold: 1.18 },
    },
  },
  {
    id: "quake",
    name: "Earthquake Failure",
    description: "A pulsed lateral quake drives a deterministic critical support failure.",
    config: {
      ...cloneConfig(defaultConfig),
      bridge: { ...defaultConfig.bridge, type: "truss", stiffness: 0.95, damping: 0.34, failureThreshold: 1.02, materialStrength: 0.92 },
      wind: { ...defaultConfig.wind, speed: 18, gustiness: 0.24, turbulence: 0.36, particleCount: 420 },
      earthquake: { ...defaultConfig.earthquake, enabled: true, intensity: 0.82, frequency: 2.7, duration: 10.5, direction: "mixed", waveform: "pulse" },
      load: { ...defaultConfig.load, totalWeight: 70, distribution: "centre", movingLoad: false },
    },
  },
  {
    id: "heavy-load",
    name: "Heavy Load",
    description: "Slow moving vehicle load concentrates deck stress near midspan.",
    config: {
      ...cloneConfig(defaultConfig),
      bridge: { ...defaultConfig.bridge, type: "arch", stiffness: 1.28, towerHeight: 7.2, supports: 10 },
      load: { ...defaultConfig.load, totalWeight: 98, loadPoints: 10, distribution: "centre", bias: -0.05, movingLoad: true, movingSpeed: 0.18 },
      wind: { ...defaultConfig.wind, speed: 18, gustiness: 0.22, turbulence: 0.24, particleCount: 380 },
    },
  },
  {
    id: "meteor",
    name: "Meteor Strike",
    description: "A cinematic bolide impact hammers midspan and showers the deck with fragments.",
    config: {
      ...cloneConfig(defaultConfig),
      timing: { ...defaultConfig.timing, duration: 20 },
      bridge: { ...defaultConfig.bridge, stiffness: 1.24, damping: 0.5, failureThreshold: 1.46, materialStrength: 1.08 },
      wind: { ...defaultConfig.wind, speed: 34, gustiness: 0.46, turbulence: 0.62, particleCount: 900, particleTrail: 0.8 },
      impact: { ...defaultConfig.impact, enabled: true, impactTime: 6.8, intensity: 1.05, radius: 0.28, speed: 72, angle: -48, targetBias: 0.02, fragmentCount: 260 },
      load: { ...defaultConfig.load, totalWeight: 66, distribution: "centre" },
    },
  },
  {
    id: "chaos",
    name: "Extreme Chaos",
    description: "Every input is pushed hard enough to produce a collapse sequence.",
    config: {
      ...cloneConfig(defaultConfig),
      bridge: { ...defaultConfig.bridge, type: "suspension", stiffness: 0.82, damping: 0.24, failureThreshold: 0.96, materialStrength: 0.82 },
      wind: { ...defaultConfig.wind, speed: 54, gustiness: 0.82, turbulence: 0.82, direction: 38, particleCount: 1200, particleSpeed: 1.7 },
      earthquake: { ...defaultConfig.earthquake, enabled: true, intensity: 0.74, frequency: 3.2, duration: 12, direction: "mixed", waveform: "saw" },
      impact: { ...defaultConfig.impact, enabled: true, impactTime: 5.4, intensity: 0.78, radius: 0.32, speed: 66, angle: 42, targetBias: -0.18, fragmentCount: 240 },
      load: { ...defaultConfig.load, totalWeight: 118, loadPoints: 12, distribution: "random", movingLoad: true, movingSpeed: 0.58 },
    },
  },
]

export const bridgeTypeLabels = {
  suspension: "Suspension",
  arch: "Arch",
  truss: "Beam / Truss",
} as const
