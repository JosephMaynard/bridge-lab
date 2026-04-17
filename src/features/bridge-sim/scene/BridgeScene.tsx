import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Environment, Line, OrbitControls, PerspectiveCamera, Sky, Stars } from "@react-three/drei"
import { useMemo, useRef } from "react"
import * as THREE from "three"
import { useSimulationStore } from "@/store/simulation-store"
import type { BridgeNodeFrame, CameraMatrices, SimulationConfig, SimulationFrame, TimeOfDay } from "@/types/simulation"

type BridgeSceneProps = {
  className?: string
}

const stressColor = (stress: number, threshold: number) => {
  const value = Math.min(1.4, stress / threshold)
  if (value < 0.55) return "#41d6b1"
  if (value < 0.82) return "#d5d74c"
  if (value < 1) return "#f4a43a"
  if (value < 1.18) return "#ee5b3f"
  return "#ff2f5f"
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const seededParticle = (index: number, salt: number) => {
  const value = Math.sin((index + 1) * salt) * 43758.5453
  return value - Math.floor(value)
}

const nodeTuple = (node: BridgeNodeFrame, yOffset = 0, zOffset = 0): [number, number, number] => [
  node.x,
  node.y + yOffset,
  node.z + zOffset,
]

type AtmospherePreset = {
  background: string
  fog: string
  fogNear: number
  fogFar: number
  sunPosition: [number, number, number]
  skyEnabled: boolean
  sky: {
    turbidity: number
    rayleigh: number
    mieCoefficient: number
    mieDirectionalG: number
  }
  ambientColor: string
  ambientIntensity: number
  directionalColor: string
  directionalIntensity: number
  waterColor: string
  waterOpacity: number
  rimColor: string
  rimIntensity: number
  stars: boolean
  moon: boolean
  bridgeLights: boolean
  environmentPreset: "sunset" | "dawn" | "night" | "city" | "park" | "studio"
}

const atmospherePresets: Record<TimeOfDay, AtmospherePreset> = {
  dawn: {
    background: "#c8ddeb",
    fog: "#c7d8d5",
    fogNear: 34,
    fogFar: 105,
    sunPosition: [-24, 14, -18],
    skyEnabled: false,
    sky: { turbidity: 4.2, rayleigh: 1.1, mieCoefficient: 0.002, mieDirectionalG: 0.66 },
    ambientColor: "#c9e4de",
    ambientIntensity: 0.6,
    directionalColor: "#ffb587",
    directionalIntensity: 1.55,
    waterColor: "#0f7280",
    waterOpacity: 0.62,
    rimColor: "#ff946d",
    rimIntensity: 13,
    stars: false,
    moon: false,
    bridgeLights: false,
    environmentPreset: "dawn",
  },
  day: {
    background: "#95c7ec",
    fog: "#4a7f87",
    fogNear: 46,
    fogFar: 122,
    sunPosition: [24, 34, 18],
    skyEnabled: true,
    sky: { turbidity: 2.1, rayleigh: 0.7, mieCoefficient: 0.0012, mieDirectionalG: 0.58 },
    ambientColor: "#d9f1ee",
    ambientIntensity: 0.6,
    directionalColor: "#fff6dd",
    directionalIntensity: 1.85,
    waterColor: "#0d7888",
    waterOpacity: 0.64,
    rimColor: "#69dfcf",
    rimIntensity: 9,
    stars: false,
    moon: false,
    bridgeLights: false,
    environmentPreset: "park",
  },
  golden: {
    background: "#07100f",
    fog: "#0a1613",
    fogNear: 38,
    fogFar: 94,
    sunPosition: [14, 22, 8],
    skyEnabled: false,
    sky: { turbidity: 3, rayleigh: 0.9, mieCoefficient: 0.001, mieDirectionalG: 0.58 },
    ambientColor: "#ffffff",
    ambientIntensity: 0.58,
    directionalColor: "#fff7df",
    directionalIntensity: 2.4,
    waterColor: "#0c6f7f",
    waterOpacity: 0.66,
    rimColor: "#51d6c3",
    rimIntensity: 18,
    stars: false,
    moon: false,
    bridgeLights: false,
    environmentPreset: "night",
  },
  sunset: {
    background: "#182d35",
    fog: "#102622",
    fogNear: 34,
    fogFar: 94,
    sunPosition: [-24, 10, -18],
    skyEnabled: false,
    sky: { turbidity: 4, rayleigh: 0.8, mieCoefficient: 0.003, mieDirectionalG: 0.72 },
    ambientColor: "#b9d8d2",
    ambientIntensity: 0.48,
    directionalColor: "#ff7a38",
    directionalIntensity: 1.85,
    waterColor: "#064d5c",
    waterOpacity: 0.68,
    rimColor: "#ff6d3f",
    rimIntensity: 16,
    stars: false,
    moon: false,
    bridgeLights: true,
    environmentPreset: "sunset",
  },
  night: {
    background: "#040b0c",
    fog: "#061111",
    fogNear: 24,
    fogFar: 78,
    sunPosition: [-16, -8, 24],
    skyEnabled: false,
    sky: { turbidity: 1.8, rayleigh: 0.26, mieCoefficient: 0.001, mieDirectionalG: 0.5 },
    ambientColor: "#8db9cf",
    ambientIntensity: 0.42,
    directionalColor: "#9fd7ff",
    directionalIntensity: 1.05,
    waterColor: "#063f49",
    waterOpacity: 0.69,
    rimColor: "#58d7ff",
    rimIntensity: 14,
    stars: true,
    moon: true,
    bridgeLights: true,
    environmentPreset: "night",
  },
}

function CameraDirector({ config, frame }: { config: SimulationConfig; frame?: SimulationFrame }) {
  const { camera, size } = useThree()
  const setCameraMatrices = useSimulationStore((state) => state.setCameraMatrices)
  const lastSync = useRef(0)

  useFrame(({ clock }) => {
    if (config.camera.cinematic) {
      const elapsed = clock.getElapsedTime()
      const angle = elapsed * config.camera.autoOrbitSpeed + (frame?.time ?? 0) * 0.018
      const distance = config.camera.distance
      const target = new THREE.Vector3(0, frame ? Math.max(-1.2, -frame.centreDisplacement * 0.25) : 0, 0)
      camera.position.set(Math.sin(angle) * distance, config.camera.heightBias + Math.sin(angle * 0.7) * 3.2, Math.cos(angle) * distance)
      camera.lookAt(target)
    }

    const now = performance.now()
    if (now - lastSync.current > 80) {
      lastSync.current = now
      const matrices: CameraMatrices = {
        projection: camera.projectionMatrix.elements.slice(),
        view: camera.matrixWorldInverse.elements.slice(),
        width: size.width,
        height: size.height,
      }
      setCameraMatrices(matrices)
    }
  })

  return null
}

function BridgeLights({ spanLength, enabled }: { spanLength: number; enabled: boolean }) {
  if (!enabled) return null

  return (
    <group>
      {Array.from({ length: 11 }, (_, index) => {
        const normal = index / 10
        const x = (normal - 0.5) * spanLength
        return (
          <group key={`bridge-light-${index}`} position={[x, 0.78, -3.05]}>
            <mesh>
              <sphereGeometry args={[0.08, 10, 8]} />
              <meshBasicMaterial color="#ffd975" />
            </mesh>
            <pointLight color="#ffc35a" intensity={index % 2 === 0 ? 1.8 : 1.2} distance={5.8} decay={2} />
          </group>
        )
      })}
      {Array.from({ length: 11 }, (_, index) => {
        const normal = index / 10
        const x = (normal - 0.5) * spanLength
        return (
          <group key={`bridge-light-r-${index}`} position={[x, 0.78, 3.05]}>
            <mesh>
              <sphereGeometry args={[0.08, 10, 8]} />
              <meshBasicMaterial color="#ffd975" />
            </mesh>
            <pointLight color="#ffc35a" intensity={index % 2 === 0 ? 1.8 : 1.2} distance={5.8} decay={2} />
          </group>
        )
      })}
    </group>
  )
}

function Atmosphere({ config }: { config: SimulationConfig }) {
  const water = useRef<THREE.MeshStandardMaterial>(null)
  const preset = atmospherePresets[config.environment.timeOfDay]

  useFrame(({ clock }) => {
    if (water.current) {
      water.current.normalScale.setScalar(0.25 + Math.sin(clock.elapsedTime * 0.7) * 0.05)
      water.current.opacity = preset.waterOpacity + Math.sin(clock.elapsedTime * 0.5) * 0.035
    }
  })

  return (
    <>
      <color attach="background" args={[preset.background]} />
      <fog attach="fog" args={[preset.fog, preset.fogNear, preset.fogFar]} />
      {preset.skyEnabled && (
        <Sky
          distance={450000}
          sunPosition={preset.sunPosition}
          turbidity={preset.sky.turbidity}
          rayleigh={preset.sky.rayleigh}
          mieCoefficient={preset.sky.mieCoefficient}
          mieDirectionalG={preset.sky.mieDirectionalG}
        />
      )}
      {preset.stars && <Stars radius={110} depth={56} count={2600} factor={4.2} saturation={0.18} fade speed={0.28} />}
      {preset.moon && (
        <group position={[-28, 32, -48]}>
          <mesh>
            <sphereGeometry args={[1.35, 32, 16]} />
            <meshBasicMaterial color="#d7f0ff" />
          </mesh>
          <pointLight color="#bfe7ff" intensity={12} distance={68} />
        </group>
      )}
      <ambientLight color={preset.ambientColor} intensity={preset.ambientIntensity} />
      <directionalLight
        position={preset.sunPosition}
        color={preset.directionalColor}
        intensity={preset.directionalIntensity}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[-16, 9, 16]} intensity={preset.rimIntensity} color={preset.rimColor} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -4.15, 0]} receiveShadow>
        <planeGeometry args={[140, 80, 48, 24]} />
        <meshStandardMaterial ref={water} color={preset.waterColor} metalness={0.15} roughness={0.18} transparent opacity={preset.waterOpacity} />
      </mesh>
      <Landmass x={-27} />
      <Landmass x={27} mirrored />
      <BridgeLights spanLength={config.bridge.spanLength} enabled={preset.bridgeLights} />
      <Environment preset={preset.environmentPreset} />
    </>
  )
}

function Landmass({ x, mirrored = false }: { x: number; mirrored?: boolean }) {
  return (
    <group position={[x, -2.85, 0]} rotation={[0, mirrored ? Math.PI : 0, 0]}>
      <mesh castShadow receiveShadow position={[0, 0, 0]} scale={[13, 3.1, 15]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#385044" roughness={0.92} />
      </mesh>
      <mesh castShadow receiveShadow position={[-4.4, 1.35, -2.1]} rotation={[0.1, 0.34, -0.08]} scale={[8.5, 3.6, 9]}>
        <dodecahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#536c5e" roughness={0.94} />
      </mesh>
      <mesh castShadow receiveShadow position={[4.8, 1.1, 2.7]} rotation={[0.2, -0.24, 0.1]} scale={[7.8, 2.8, 8.2]}>
        <dodecahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#24362f" roughness={0.9} />
      </mesh>
      <mesh receiveShadow position={[0, 3.05, 0]} scale={[13.5, 0.16, 15.4]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#5e7f64" roughness={0.88} />
      </mesh>
    </group>
  )
}

function DeckSegment({
  start,
  end,
  width,
  color,
  fracture,
}: {
  start: BridgeNodeFrame
  end: BridgeNodeFrame
  width: number
  color: string
  fracture?: {
    offset: [number, number, number]
    rotation: [number, number, number]
  }
}) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const dz = end.z - start.z
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz)
  const yaw = Math.atan2(dz, dx)
  const pitch = -Math.atan2(dy, Math.sqrt(dx * dx + dz * dz))

  return (
    <mesh
      castShadow
      receiveShadow
      position={[
        (start.x + end.x) / 2 + (fracture?.offset[0] ?? 0),
        (start.y + end.y) / 2 + (fracture?.offset[1] ?? 0),
        (start.z + end.z) / 2 + (fracture?.offset[2] ?? 0),
      ]}
      rotation={[
        fracture?.rotation[0] ?? 0,
        yaw + (fracture?.rotation[1] ?? 0),
        pitch + (fracture?.rotation[2] ?? 0),
      ]}
    >
      <boxGeometry args={[length + 0.04, 0.28, width]} />
      <meshStandardMaterial color={color} metalness={0.48} roughness={0.36} emissive={color} emissiveIntensity={0.06} />
    </mesh>
  )
}

function Tower({ x, height, width, stress }: { x: number; height: number; width: number; stress: number }) {
  const color = stressColor(stress, 1.15)
  return (
    <group position={[x, 0, 0]}>
      {[-1, 1].map((side) => (
        <mesh key={side} castShadow receiveShadow position={[0, height / 2 - 0.15, side * width * 0.54]}>
          <boxGeometry args={[0.55, height, 0.48]} />
          <meshStandardMaterial color={color} metalness={0.42} roughness={0.4} />
        </mesh>
      ))}
      <mesh castShadow receiveShadow position={[0, height - 0.1, 0]}>
        <boxGeometry args={[1, 0.42, width * 1.24]} />
        <meshStandardMaterial color="#d6e2d5" metalness={0.3} roughness={0.34} />
      </mesh>
    </group>
  )
}

function BridgeModel({ config, frame }: { config: SimulationConfig; frame?: SimulationFrame }) {
  const threshold = config.bridge.failureThreshold * config.bridge.materialStrength
  const nodes = frame?.nodes

  if (!nodes) {
    return <IdleBridge config={config} />
  }

  const towerX = config.bridge.spanLength * 0.32
  const railLeft = nodes.map((node) => nodeTuple(node, 0.54, -config.bridge.deckWidth / 2 - 0.18))
  const railRight = nodes.map((node) => nodeTuple(node, 0.54, config.bridge.deckWidth / 2 + 0.18))
  const suspensionCableSides = [-1, 1] as const
  const failureProgress =
    frame.failureTime === undefined
      ? 0
      : clamp(frame.isStanding ? (frame.time - frame.failureTime) / 3.1 : Math.max(0.42, (frame.time - frame.failureTime) / 3.1), 0, 1)
  const fractureFade = failureProgress > 0 ? clamp(1 - failureProgress * 1.35, 0, 1) : 1
  const criticalSegment = clamp(frame.failureNodeIndex ?? Math.floor(nodes.length / 2), 0, nodes.length - 2)
  const fragmentForSegment = (index: number) => {
    if (failureProgress <= 0) return undefined

    const distance = Math.abs(index - criticalSegment)
    const influence = clamp(1 - distance / 14, 0.08, 1)
    const side = index < criticalSegment ? -1 : 1
    const launch = 1 - Math.pow(1 - failureProgress, 3)
    const seed = seededParticle(index, 44.7) - 0.5
    const cross = seededParticle(index, 91.2) - 0.5
    const upwardKick = Math.sin(failureProgress * Math.PI) * 2.8 * influence
    const fall = Math.pow(failureProgress, 1.4) * (1.2 + influence * 2.1)

    return {
      offset: [
        side * launch * influence * (2.4 + distance * 0.24),
        upwardKick - fall,
        launch * influence * (side * 7.2 + cross * 8.4),
      ] as [number, number, number],
      rotation: [
        launch * influence * (1.1 + seed * 2.4),
        launch * influence * side * (0.32 + distance * 0.055),
        launch * influence * side * (0.9 + seed * 1.4),
      ] as [number, number, number],
    }
  }
  const cableY = (node: BridgeNodeFrame) => {
    const shape = Math.sin(Math.PI * ((node.baseX / config.bridge.spanLength) + 0.5))
    return config.bridge.towerHeight + 0.4 - shape * config.bridge.towerHeight * config.bridge.cableSag
  }

  return (
    <group>
      {nodes.slice(0, -1).map((node, index) => (
        <DeckSegment
          key={node.id}
          start={node}
          end={nodes[index + 1]}
          width={config.bridge.deckWidth}
          color={stressColor(frame.segmentStress[index] ?? node.stress, threshold)}
          fracture={fragmentForSegment(index)}
        />
      ))}
      <Line points={railLeft} color="#dce9df" lineWidth={1.4} transparent opacity={0.92 * fractureFade} />
      <Line points={railRight} color="#dce9df" lineWidth={1.4} transparent opacity={0.92 * fractureFade} />
      {config.bridge.type === "suspension" && (
        <>
          <Tower x={-towerX} height={config.bridge.towerHeight} width={config.bridge.deckWidth} stress={frame.maxStress} />
          <Tower x={towerX} height={config.bridge.towerHeight} width={config.bridge.deckWidth} stress={frame.maxStress} />
          {suspensionCableSides.map((side) => {
            const cableZ = side * (config.bridge.deckWidth / 2 + 0.2)
            return (
              <group key={`suspension-side-${side}`}>
                <Line points={nodes.map((node) => [node.x, cableY(node), cableZ] as [number, number, number])} color="#f3e9bd" lineWidth={2.2} transparent opacity={fractureFade} />
                {nodes.filter((_, index) => index % 2 === 0).map((node) => (
                  <Line
                    key={`hanger-${side}-${node.id}`}
                    points={[[node.x, node.y + 0.24, cableZ], [node.x, cableY(node), cableZ]]}
                    color="#cfe0da"
                    lineWidth={0.78}
                    transparent
                    opacity={0.78 * fractureFade}
                  />
                ))}
              </group>
            )
          })}
        </>
      )}
      {config.bridge.type === "arch" && (
        <>
          <Line
            points={nodes.map((node) => {
              const shape = Math.sin(Math.PI * ((node.baseX / config.bridge.spanLength) + 0.5))
              return [node.x, node.y - 3.2 + shape * config.bridge.towerHeight * 0.72, node.z] as [number, number, number]
            })}
            color="#f0d27a"
            lineWidth={4}
            transparent
            opacity={fractureFade}
          />
          {nodes.filter((_, index) => index % 3 === 0).map((node) => (
            <Line key={`arch-post-${node.id}`} points={[[node.x, node.y - 0.25, node.z], [node.x, node.y - 2.9 + Math.sin(Math.PI * ((node.baseX / config.bridge.spanLength) + 0.5)) * config.bridge.towerHeight * 0.72, node.z]]} color="#d4e1d8" lineWidth={0.9} transparent opacity={fractureFade} />
          ))}
        </>
      )}
      {config.bridge.type === "truss" && (
        <>
          {nodes.slice(0, -2).map((node, index) => (
            <Line key={`truss-${node.id}`} points={[nodeTuple(node, 0.42, -config.bridge.deckWidth / 2), nodeTuple(nodes[index + 2], 1.8, config.bridge.deckWidth / 2)]} color={index % 2 === 0 ? "#e8d26a" : "#a7ded3"} lineWidth={1.2} transparent opacity={0.8 * fractureFade} />
          ))}
          <Line points={nodes.map((node) => nodeTuple(node, 1.85, 0))} color="#d8e8df" lineWidth={1.6} transparent opacity={fractureFade} />
        </>
      )}
      {Array.from({ length: config.bridge.supports }).map((_, index) => {
        const nodeIndex = Math.round((index / Math.max(1, config.bridge.supports - 1)) * (nodes.length - 1))
        const node = nodes[nodeIndex]
        return <Line key={`support-${node.id}`} points={[[node.x, node.y - 0.2, node.z], [node.x, -4, node.z]]} color={stressColor(frame.supportStress[index] ?? node.stress, threshold)} lineWidth={2.4} />
      })}
      {frame.failureNodeIndex !== undefined && config.overlay.showFailureZones && !frame.isStanding && (
        <mesh position={[nodes[frame.failureNodeIndex].x, nodes[frame.failureNodeIndex].y + 1.1, nodes[frame.failureNodeIndex].z]}>
          <sphereGeometry args={[1.1, 24, 16]} />
          <meshBasicMaterial color="#ff335c" transparent opacity={0.34} />
        </mesh>
      )}
    </group>
  )
}

function IdleBridge({ config }: { config: SimulationConfig }) {
  const nodes = useMemo<BridgeNodeFrame[]>(
    () =>
      Array.from({ length: 33 }, (_, index) => {
        const normal = index / 32
        return {
          id: `idle-${index}`,
          x: (normal - 0.5) * config.bridge.spanLength,
          y: Math.sin(index * 0.4) * 0.03,
          z: 0,
          baseX: (normal - 0.5) * config.bridge.spanLength,
          baseY: 0,
          baseZ: 0,
          stress: 0.22 + Math.sin(Math.PI * normal) * 0.2,
          displacement: 0,
          failed: false,
        }
      }),
    [config.bridge.spanLength],
  )
  const frame: SimulationFrame = {
    index: 0,
    time: 0,
    isStanding: true,
    nodes,
    segmentStress: nodes.slice(0, -1).map((node) => node.stress),
    supportStress: Array.from({ length: config.bridge.supports }, () => 0.28),
    maxStress: 0.42,
    centreDisplacement: 0,
    lateralSway: 0,
    windSpeed: config.wind.enabled ? config.wind.speed : 0,
    earthquakeForce: 0,
    impactForce: 0,
    impactX: config.impact.targetBias * config.bridge.spanLength * 0.48,
    loadProfile: nodes.map(() => 0.12),
    damage: 0,
  }

  return <BridgeModel config={config} frame={frame} />
}

function WindParticles({ config, frame }: { config: SimulationConfig; frame?: SimulationFrame }) {
  const pointsRef = useRef<THREE.Points>(null)
  const trailsRef = useRef<THREE.LineSegments>(null)
  const count = Math.min(1600, Math.max(0, config.wind.particleCount))
  const positions = useMemo(() => new Float32Array(count * 3), [count])
  const trailPositions = useMemo(() => new Float32Array(count * 6), [count])
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => [
        seededParticle(index, 12.31),
        seededParticle(index, 31.77),
        seededParticle(index, 57.19),
        index / Math.max(1, count),
      ]),
    [count],
  )

  useFrame(({ clock }) => {
    if (!pointsRef.current || !trailsRef.current || !config.wind.enabled || !config.wind.showParticles) return
    const speed = (frame?.windSpeed ?? config.wind.speed) * 0.01 * config.wind.particleSpeed
    const angle = (config.wind.direction * Math.PI) / 180
    const alongX = Math.cos(angle)
    const alongZ = Math.sin(angle)
    const crossX = -alongZ
    const crossZ = alongX
    const fieldLength = 72
    const fieldWidth = 34
    const trailLength = 1.8 + config.wind.particleTrail * 8.5 + speed * 1.4
    for (let index = 0; index < count; index += 1) {
      const seed = seeds[index]
      const travel = (seed[0] + clock.elapsedTime * speed + seed[3] * 0.2) % 1
      const along = (travel - 0.5) * fieldLength
      const cross = (seed[2] - 0.5) * fieldWidth
      const turbulence =
        Math.sin(clock.elapsedTime * 1.7 + index * 0.37) * config.wind.turbulence * 1.4 +
        Math.cos(clock.elapsedTime * 0.9 + index * 0.19) * config.wind.gustiness * 0.7
      const x = alongX * along + crossX * cross + crossX * turbulence
      const y = -1.5 + seed[1] * 13 + Math.sin(clock.elapsedTime * 1.7 + index) * config.wind.turbulence * 0.36
      const z = alongZ * along + crossZ * cross + crossZ * turbulence
      const base = index * 3
      positions[base] = x
      positions[base + 1] = y
      positions[base + 2] = z
      const trailBase = index * 6
      trailPositions[trailBase] = x
      trailPositions[trailBase + 1] = y
      trailPositions[trailBase + 2] = z
      trailPositions[trailBase + 3] = x - alongX * trailLength
      trailPositions[trailBase + 4] = y - turbulence * 0.06
      trailPositions[trailBase + 5] = z - alongZ * trailLength
    }
    ;(pointsRef.current.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true
    ;(trailsRef.current.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true
  })

  if (!config.wind.enabled || !config.wind.showParticles || count === 0) return null

  return (
    <group>
      <lineSegments ref={trailsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailPositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#c9fff1" transparent opacity={0.12 + config.wind.particleTrail * 0.46} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#e6fff8" size={config.wind.particleSize} transparent opacity={0.6 + config.wind.particleTrail * 0.22} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  )
}

function MeteorImpact({ config, frame }: { config: SimulationConfig; frame?: SimulationFrame }) {
  const impact = config.impact
  const data = useMemo(() => {
    if (!frame || !impact.enabled || !impact.showEffects) return null

    const localTime = frame.time - impact.impactTime
    const approachDuration = clamp(3.8 - impact.speed / 70, 1.6, 3.2)
    if (localTime < -approachDuration || localTime > 5.5) return null

    const angle = (impact.angle * Math.PI) / 180
    const impactPoint = new THREE.Vector3(frame.impactX, -0.1, 0)
    const incomingOffset = new THREE.Vector3(-Math.cos(angle) * 28, 24, -Math.sin(angle) * 24)
    const incomingStart = impactPoint.clone().add(incomingOffset)
    const incomingProgress = clamp((localTime + approachDuration) / approachDuration, 0, 1)
    const meteorPosition = incomingStart.clone().lerp(impactPoint, incomingProgress)
    const tailEnd = meteorPosition.clone().add(incomingOffset.clone().normalize().multiplyScalar(8 + impact.speed * 0.12))
    const trailDirection = tailEnd.clone().sub(meteorPosition).normalize()
    const trailRight = new THREE.Vector3(0, 1, 0).cross(trailDirection).normalize()
    const trailUp = trailDirection.clone().cross(trailRight).normalize()
    const trailPuffs = localTime < 0
      ? Array.from({ length: 34 }, (_, index) => {
          const t = index / 33
          const swirl = seededParticle(index, 64.4) * Math.PI * 2 + frame.time * 2.8
          const radius = (0.22 + t * 1.8) * (0.8 + seededParticle(index, 13.8) * 0.7)
          const centre = meteorPosition.clone().lerp(tailEnd, t)
          centre.add(trailRight.clone().multiplyScalar(Math.cos(swirl) * radius))
          centre.add(trailUp.clone().multiplyScalar(Math.sin(swirl) * radius * 0.72))
          return {
            position: centre.toArray() as [number, number, number],
            scale: 0.34 + t * 2.1 + seededParticle(index, 24.1) * 0.65,
            opacity: (1 - t) * 0.42 + 0.08,
            color: t < 0.28 ? "#fff1a6" : t < 0.62 ? "#ff8c2e" : "#70483c",
          }
        })
      : []
    const blastProgress = clamp(localTime / 4.2, 0, 1)
    const flash = localTime >= 0 && localTime < 0.85 ? 1 - localTime / 0.85 : 0
    const fragmentCount = localTime >= 0 ? Math.min(420, Math.max(24, Math.round(impact.fragmentCount))) : 0
    const debris = new Float32Array(fragmentCount * 3)

    for (let index = 0; index < fragmentCount; index += 1) {
      const radial = seededParticle(index, 21.9) * Math.PI * 2
      const spread = 3 + seededParticle(index, 73.1) * 18 * impact.radius + impact.intensity * 6.5
      const lift = 3.8 + seededParticle(index, 11.6) * 10.5 * impact.intensity
      const speed = blastProgress * (0.6 + seededParticle(index, 41.4) * 1.4)
      const fall = Math.pow(blastProgress, 1.55) * (0.3 + seededParticle(index, 55.5) * 3.2)
      const x = impactPoint.x + Math.cos(radial) * spread * speed
      const y = impactPoint.y + lift * Math.sin(blastProgress * Math.PI) - fall
      const z = impactPoint.z + Math.sin(radial) * spread * speed
      const base = index * 3
      debris[base] = x
      debris[base + 1] = y
      debris[base + 2] = z
    }

    return {
      localTime,
      meteorPosition,
      tailEnd,
      impactPoint,
      blastProgress,
      flash,
      trailPuffs,
      debris,
    }
  }, [
    frame,
    impact.angle,
    impact.enabled,
    impact.fragmentCount,
    impact.impactTime,
    impact.intensity,
    impact.radius,
    impact.showEffects,
    impact.speed,
  ])

  if (!data) return null

  const meteorVisible = data.localTime < 0
  const shockVisible = data.localTime >= 0 && data.blastProgress < 1
  const shockRadius = 1.8 + data.blastProgress * (15 + config.impact.radius * 24)
  const shockOpacity = Math.max(0, 0.88 - data.blastProgress * 0.82)

  return (
    <group>
      {meteorVisible && (
        <>
          <Line points={[data.meteorPosition.toArray(), data.tailEnd.toArray()]} color="#ff8a2d" lineWidth={11} transparent opacity={0.88} />
          <Line points={[data.meteorPosition.toArray(), data.tailEnd.clone().add(new THREE.Vector3(0, 1.6, 0)).toArray()]} color="#fff0bd" lineWidth={2.4} transparent opacity={0.72} />
          {data.trailPuffs.map((puff, index) => (
            <mesh key={`meteor-puff-${index}`} position={puff.position} scale={puff.scale}>
              <sphereGeometry args={[1, 12, 8]} />
              <meshBasicMaterial color={puff.color} transparent opacity={puff.opacity} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
          ))}
          <mesh position={data.meteorPosition.toArray()} castShadow>
            <icosahedronGeometry args={[0.55 + config.impact.radius * 1.5, 2]} />
            <meshStandardMaterial color="#2a211f" emissive="#ff6a22" emissiveIntensity={2.8} roughness={0.7} />
          </mesh>
          <pointLight position={data.meteorPosition.toArray()} color="#ff7a2f" intensity={40 * config.impact.intensity} distance={26} />
        </>
      )}
      {data.flash > 0 && (
        <>
          <mesh position={[data.impactPoint.x, data.impactPoint.y + 0.7, data.impactPoint.z]}>
            <sphereGeometry args={[2 + config.impact.radius * 8, 32, 16]} />
            <meshBasicMaterial color="#fff3b0" transparent opacity={data.flash * 0.62} blending={THREE.AdditiveBlending} />
          </mesh>
          <pointLight position={[data.impactPoint.x, data.impactPoint.y + 3, data.impactPoint.z]} color="#ffb43f" intensity={90 * data.flash * config.impact.intensity} distance={36} />
        </>
      )}
      {shockVisible && (
        <mesh position={[data.impactPoint.x, data.impactPoint.y + 0.42, data.impactPoint.z]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[shockRadius, 0.1 + config.impact.intensity * 0.08, 12, 128]} />
          <meshBasicMaterial color="#ffdf72" transparent opacity={shockOpacity} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
      {data.debris.length > 0 && (
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[data.debris, 3]} />
          </bufferGeometry>
          <pointsMaterial color="#ffe176" size={0.2 + config.impact.radius * 0.45} transparent opacity={0.92} depthWrite={false} blending={THREE.AdditiveBlending} />
        </points>
      )}
    </group>
  )
}

function SceneContents() {
  const config = useSimulationStore((state) => state.config)
  const run = useSimulationStore((state) => state.currentRun)
  const replayIndex = useSimulationStore((state) => state.replayIndex)
  const frame = run?.frames[replayIndex]

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 12, 48]} fov={42} near={0.1} far={220} />
      <Atmosphere config={config} />
      <BridgeModel config={config} frame={frame} />
      <WindParticles config={config} frame={frame} />
      <MeteorImpact config={config} frame={frame} />
      <CameraDirector config={config} frame={frame} />
      <OrbitControls enabled={!config.camera.cinematic} enableDamping dampingFactor={0.08} minDistance={20} maxDistance={90} maxPolarAngle={Math.PI * 0.49} />
    </>
  )
}

export function BridgeScene({ className }: BridgeSceneProps) {
  return (
    <div className={className}>
      <Canvas shadows="basic" dpr={[1, 2]} gl={{ antialias: true, alpha: true }} resize={{ scroll: false, debounce: { scroll: 50, resize: 0 } }}>
        <SceneContents />
      </Canvas>
    </div>
  )
}
