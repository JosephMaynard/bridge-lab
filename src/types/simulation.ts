export type BridgeType = "suspension" | "arch" | "truss"
export type LoadDistributionMode = "centre" | "even" | "offset" | "random"
export type QuakeDirection = "vertical" | "lateral" | "mixed"
export type QuakeWaveform = "sine" | "pulse" | "saw"
export type StressPalette = "thermal" | "viridis" | "critical"

export type BridgeConfig = {
  type: BridgeType
  spanLength: number
  deckWidth: number
  towerHeight: number
  supports: number
  cableSag: number
  supportSpacing: number
  stiffness: number
  damping: number
  failureThreshold: number
  materialStrength: number
}

export type SimulationTiming = {
  duration: number
  sampleDensity: number
  replaySpeed: number
}

export type LoadConfig = {
  totalWeight: number
  loadPoints: number
  distribution: LoadDistributionMode
  bias: number
  movingLoad: boolean
  movingSpeed: number
}

export type WindConfig = {
  enabled: boolean
  speed: number
  gustiness: number
  direction: number
  turbulence: number
  particleCount: number
  particleSize: number
  particleSpeed: number
  particleTrail: number
  showParticles: boolean
}

export type EarthquakeConfig = {
  enabled: boolean
  intensity: number
  frequency: number
  duration: number
  direction: QuakeDirection
  waveform: QuakeWaveform
}

export type CameraConfig = {
  cinematic: boolean
  autoOrbitSpeed: number
  distance: number
  heightBias: number
}

export type OverlayConfig = {
  showStress: boolean
  opacity: number
  palette: StressPalette
  highlightCritical: boolean
  showSupportLabels: boolean
  showFailureZones: boolean
}

export type SimulationConfig = {
  bridge: BridgeConfig
  timing: SimulationTiming
  load: LoadConfig
  wind: WindConfig
  earthquake: EarthquakeConfig
  camera: CameraConfig
  overlay: OverlayConfig
}

export type BridgeNodeFrame = {
  id: string
  x: number
  y: number
  z: number
  baseX: number
  baseY: number
  baseZ: number
  stress: number
  displacement: number
  failed: boolean
}

export type SimulationFrame = {
  index: number
  time: number
  isStanding: boolean
  failureTime?: number
  failureNodeIndex?: number
  nodes: BridgeNodeFrame[]
  segmentStress: number[]
  supportStress: number[]
  maxStress: number
  centreDisplacement: number
  lateralSway: number
  windSpeed: number
  earthquakeForce: number
  loadProfile: number[]
  damage: number
}

export type SimulationRun = {
  id: string
  createdAt: string
  config: SimulationConfig
  frames: SimulationFrame[]
  failed: boolean
  failureTime?: number
  failureNodeIndex?: number
  peakStress: number
  peakDisplacement: number
  peakSway: number
}

export type PresetScenario = {
  id: string
  name: string
  description: string
  config: SimulationConfig
}

export type CameraMatrices = {
  projection: number[]
  view: number[]
  width: number
  height: number
}
