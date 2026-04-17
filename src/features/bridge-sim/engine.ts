import type {
  BridgeNodeFrame,
  LoadDistributionMode,
  SimulationConfig,
  SimulationFrame,
  SimulationRun,
} from "@/types/simulation"

const NODE_COUNT = 33

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const bell = (x: number, centre: number, width: number) =>
  Math.exp(-Math.pow((x - centre) / width, 2))

const seededNoise = (seed: number) => {
  const wave = Math.sin(seed * 12.9898) * 43758.5453
  return wave - Math.floor(wave)
}

const waveformValue = (type: SimulationConfig["earthquake"]["waveform"], phase: number) => {
  if (type === "pulse") {
    return Math.sign(Math.sin(phase)) * Math.pow(Math.abs(Math.sin(phase)), 0.42)
  }

  if (type === "saw") {
    const cycle = phase / (Math.PI * 2)
    return 2 * (cycle - Math.floor(cycle + 0.5))
  }

  return Math.sin(phase)
}

const loadCentreFor = (mode: LoadDistributionMode, bias: number, time: number, config: SimulationConfig) => {
  if (config.load.movingLoad) {
    const travel = (time * config.load.movingSpeed * 0.16) % 1.4
    return clamp(-0.7 + travel + bias * 0.42, -0.62, 0.62)
  }

  if (mode === "offset") return clamp(bias, -0.55, 0.55)
  if (mode === "random") return clamp((seededNoise(config.load.totalWeight * 0.13) - 0.5) * 0.92 + bias * 0.2, -0.55, 0.55)
  return clamp(bias * 0.2, -0.35, 0.35)
}

const loadAt = (normalized: number, time: number, config: SimulationConfig) => {
  const loadScale = config.load.totalWeight / 100
  const points = Math.max(1, config.load.loadPoints)
  const centre = loadCentreFor(config.load.distribution, config.load.bias, time, config)

  if (config.load.distribution === "even") {
    return loadScale * (0.52 + 0.48 * Math.sin(Math.PI * normalized))
  }

  if (config.load.distribution === "random") {
    let value = 0
    for (let point = 0; point < points; point += 1) {
      const position = seededNoise(point * 8.13 + config.load.totalWeight * 0.07) * 2 - 1
      value += bell(normalized * 2 - 1, position * 0.78 + centre * 0.22, 0.16)
    }
    return loadScale * value / Math.max(1, points * 0.34)
  }

  const width = config.load.distribution === "centre" ? 0.32 : 0.24
  return loadScale * bell(normalized * 2 - 1, centre, width) * (1.1 + points * 0.025)
}

const supportStressFor = (frameStress: number[], supports: number) => {
  const result: number[] = []
  const count = Math.max(2, supports)
  for (let index = 0; index < count; index += 1) {
    const at = Math.round((index / (count - 1)) * (frameStress.length - 1))
    const left = frameStress[Math.max(0, at - 1)] ?? 0
    const centre = frameStress[at] ?? 0
    const right = frameStress[Math.min(frameStress.length - 1, at + 1)] ?? 0
    result.push((left + centre * 1.5 + right) / 3.5)
  }
  return result
}

const impactPulseFor = (time: number, config: SimulationConfig) => {
  if (!config.impact.enabled) return 0
  if (time < config.impact.impactTime) return 0
  const width = clamp(0.24 + config.impact.radius * 0.62 + 42 / Math.max(32, config.impact.speed) * 0.08, 0.18, 0.58)
  return Math.exp(-Math.pow((time - config.impact.impactTime) / width, 2))
}

export const runSimulation = (config: SimulationConfig): SimulationRun => {
  const frameCount = Math.max(60, Math.round(config.timing.duration * config.timing.sampleDensity))
  const dt = config.timing.duration / (frameCount - 1)
  const threshold = config.bridge.failureThreshold * config.bridge.materialStrength
  const span = config.bridge.spanLength
  const nodesBase = Array.from({ length: NODE_COUNT }, (_, index) => {
    const normalized = index / (NODE_COUNT - 1)
    return {
      id: `N-${index + 1}`,
      baseX: (normalized - 0.5) * span,
      baseY: 0,
      baseZ: 0,
    }
  })

  let failureTime: number | undefined
  let failureNodeIndex: number | undefined
  let accumulatedDamage = 0
  const frames: SimulationFrame[] = []

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const time = frameIndex * dt
    const gustPhase = time * (0.92 + config.wind.turbulence * 0.55)
    const windBase = config.wind.enabled ? config.wind.speed : 0
    const windNoise = seededNoise(frameIndex * 0.37 + config.wind.direction * 0.03) - 0.5
    const windSpeed = Math.max(0, windBase * (1 + config.wind.gustiness * Math.sin(gustPhase) + config.wind.turbulence * 0.34 * windNoise))
    const quakeActive = config.earthquake.enabled && time <= config.earthquake.duration
    const quakeEnvelope = quakeActive ? Math.sin(Math.PI * clamp(time / config.earthquake.duration, 0, 1)) : 0
    const quakeWave = waveformValue(config.earthquake.waveform, time * config.earthquake.frequency * Math.PI * 2)
    const earthquakeForce = quakeActive ? config.earthquake.intensity * quakeEnvelope * quakeWave : 0
    const impactPulse = impactPulseFor(time, config)
    const impactEnergy = config.impact.enabled ? impactPulse * config.impact.intensity * (0.55 + config.impact.speed / 82) : 0
    const impactX = clamp(config.impact.targetBias, -0.9, 0.9) * span * 0.48
    const stiffness = Math.max(0.2, config.bridge.stiffness)
    const damping = clamp(config.bridge.damping, 0.1, 1.4)
    const bridgeFactor = config.bridge.type === "arch" ? 0.86 : config.bridge.type === "truss" ? 0.94 : 1.08
    const failureProgress = failureTime === undefined ? 0 : clamp((time - failureTime) / 3.4, 0, 1)

    const loadProfile = nodesBase.map((_, index) => loadAt(index / (NODE_COUNT - 1), time, config))
    const segmentStress: number[] = []

    const nodes: BridgeNodeFrame[] = nodesBase.map((node, index) => {
      const normalized = index / (NODE_COUNT - 1)
      const shape = Math.sin(Math.PI * normalized)
      const edgeRelief = 0.3 + shape * 0.7
      const modal = Math.sin(time * (1.7 + windSpeed / 80) + normalized * Math.PI * 2)
      const torsion = Math.sin(time * 2.3 + index * 0.62)
      const loadInfluence = loadProfile[index] ?? 0
      const impactInfluence = bell(normalized * 2 - 1, clamp(config.impact.targetBias, -0.9, 0.9), Math.max(0.09, config.impact.radius))
      const verticalDirection = config.earthquake.direction === "lateral" ? 0.35 : 1
      const lateralDirection = config.earthquake.direction === "vertical" ? 0.35 : 1
      const verticalDeflection = -shape * (loadInfluence * 1.7 + (windSpeed / 60) * 0.42) / stiffness
      const windSway = shape * (windSpeed / 52) * (0.45 + config.wind.gustiness) * Math.sin(time * 1.2 + normalized * 2.5) / damping
      const quakeVertical = earthquakeForce * verticalDirection * shape * 0.9 / stiffness
      const quakeLateral = earthquakeForce * lateralDirection * edgeRelief * 1.45 / damping
      const impactVertical = -impactEnergy * impactInfluence * (2.1 + config.impact.radius * 2.8) / stiffness
      const impactLateral = impactEnergy * impactInfluence * Math.sin((config.impact.angle * Math.PI) / 180) * 1.8 / damping
      const oscillation = modal * shape * (0.18 + windSpeed / 260) / damping
      const collapsePull = failureProgress > 0 ? Math.pow(failureProgress, 1.45) * (1.2 + shape * 7.8) : 0
      const snapSide = failureProgress > 0 && failureNodeIndex !== undefined ? Math.sign(index - failureNodeIndex || 1) : 1
      const x = node.baseX + failureProgress * snapSide * shape * 2.1
      const y = node.baseY + verticalDeflection + quakeVertical + impactVertical + oscillation - collapsePull
      const z = node.baseZ + windSway + quakeLateral + impactLateral + torsion * shape * 0.16 + failureProgress * snapSide * shape * 3.1
      const stress =
        bridgeFactor *
        edgeRelief *
        (0.18 +
          loadInfluence * 0.66 +
          windSpeed / 118 +
          Math.abs(earthquakeForce) * 0.72 +
          impactEnergy * impactInfluence * 1.38 +
          Math.abs(windSway) * 0.18 +
          Math.abs(verticalDeflection) * 0.22)
      const distance = Math.sqrt(Math.pow(x - node.baseX, 2) + Math.pow(y - node.baseY, 2) + Math.pow(z - node.baseZ, 2))

      return {
        ...node,
        x,
        y,
        z,
        stress,
        displacement: distance,
        failed: failureProgress > 0 && (Math.abs(index - (failureNodeIndex ?? index)) < 3 || stress > threshold),
      }
    })

    for (let index = 0; index < nodes.length - 1; index += 1) {
      const stress = (nodes[index].stress + nodes[index + 1].stress) / 2
      segmentStress.push(stress)
    }

    const maxStress = Math.max(...nodes.map((node) => node.stress), ...segmentStress)
    accumulatedDamage = clamp(accumulatedDamage + Math.max(0, maxStress - threshold * 0.86) * dt * 0.13 + impactEnergy * dt * 0.16, 0, 1)

    const beforeMeteorStrike = config.impact.enabled && time < config.impact.impactTime
    const stressFailureLimit = beforeMeteorStrike ? threshold * (1.55 + config.impact.intensity * 0.18) : threshold
    const damageFailureLimit = beforeMeteorStrike ? 0.98 : 0.82

    if (failureTime === undefined && (maxStress > stressFailureLimit || accumulatedDamage > damageFailureLimit)) {
      failureTime = time
      failureNodeIndex = nodes.reduce((bestIndex, node, index, list) => (node.stress > list[bestIndex].stress ? index : bestIndex), 0)
    }

    const centreNode = nodes[Math.floor(nodes.length / 2)]
    frames.push({
      index: frameIndex,
      time,
      isStanding: failureTime === undefined || time < failureTime,
      failureTime,
      failureNodeIndex,
      nodes,
      segmentStress,
      supportStress: supportStressFor(segmentStress, config.bridge.supports),
      maxStress,
      centreDisplacement: centreNode.displacement,
      lateralSway: centreNode.z,
      windSpeed,
      earthquakeForce,
      impactForce: impactEnergy,
      impactX,
      loadProfile,
      damage: accumulatedDamage,
    })
  }

  const peakStress = Math.max(...frames.map((frame) => frame.maxStress))
  const peakDisplacement = Math.max(...frames.map((frame) => frame.centreDisplacement))
  const peakSway = Math.max(...frames.map((frame) => Math.abs(frame.lateralSway)))

  return {
    id: `run-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    config: structuredClone(config),
    frames,
    failed: failureTime !== undefined,
    failureTime,
    failureNodeIndex,
    peakStress,
    peakDisplacement,
    peakSway,
  }
}

export const getLastIntactFrame = (run: SimulationRun, frameIndex: number) => {
  if (!run.failed || run.failureTime === undefined) {
    return run.frames[frameIndex] ?? run.frames.at(-1)
  }

  const current = run.frames[frameIndex] ?? run.frames.at(-1)
  if (current?.isStanding) return current

  return [...run.frames].reverse().find((frame) => frame.isStanding) ?? run.frames[0]
}
