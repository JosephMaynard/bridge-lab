import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Environment, Line, OrbitControls, Sky, Stars, useAnimations, useGLTF } from "@react-three/drei"
import { Suspense, useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import trexUrl from "@/assets/T-Rex.glb?url"
import { createPreviewFrame } from "@/features/bridge-sim/engine"
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

const smoothStep = (value: number) => value * value * (3 - 2 * value)

const perlinNoise1d = (value: number, seed: number) => {
  const base = Math.floor(value)
  const fraction = value - base
  const leftGradient = seededParticle(base + seed * 101, 17.17 + seed) * 2 - 1
  const rightGradient = seededParticle(base + 1 + seed * 101, 17.17 + seed) * 2 - 1
  return THREE.MathUtils.lerp(leftGradient * fraction, rightGradient * (fraction - 1), smoothStep(fraction)) * 2
}

const layeredIslandNoise = (angle: number, seed: number) => {
  const u = (angle + Math.PI) / (Math.PI * 2)
  return (
    perlinNoise1d(u * 5 + 11, seed) * 0.5 +
    perlinNoise1d(u * 11 + 3, seed + 7) * 0.32 +
    perlinNoise1d(u * 19 + 29, seed + 13) * 0.18
  )
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
    fogNear: 82,
    fogFar: 190,
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
    fogNear: 62,
    fogFar: 150,
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
      camera.updateProjectionMatrix()
      camera.updateMatrixWorld()
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

function CameraHome({ cinematic }: { cinematic: boolean }) {
  const { camera } = useThree()

  useEffect(() => {
    if (cinematic) return
    camera.position.set(0, 10, 48)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
  }, [camera, cinematic])

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
      <hemisphereLight color="#b9f3df" groundColor="#12302a" intensity={0.34} />
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
      <Suspense fallback={null}>
        <Environment preset={preset.environmentPreset} />
      </Suspense>
    </>
  )
}

type IslandPoint = {
  x: number
  z: number
}

const baseIslandProfile: IslandPoint[] = [
  { x: 8.8, z: -3.35 },
  { x: 9.45, z: -1.8 },
  { x: 9.3, z: 1.9 },
  { x: 8.45, z: 3.55 },
  { x: 5.4, z: 5.85 },
  { x: 0.2, z: 7.25 },
  { x: -5.9, z: 6.35 },
  { x: -10.85, z: 3.55 },
  { x: -12.15, z: 0.2 },
  { x: -11.1, z: -3.6 },
  { x: -6.1, z: -6.55 },
  { x: -0.9, z: -7.35 },
  { x: 4.7, z: -6.05 },
]

const sampleIslandProfile = (seed: number, scale: number, roughness: number) =>
  baseIslandProfile.map((point, index): IslandPoint => {
    const angle = Math.atan2(point.z, point.x)
    const frontPad = point.x > 7.7
    const noise = frontPad ? 0 : layeredIslandNoise(angle, seed + index * 0.41) * roughness
    const outward = frontPad ? 1 : 1 + noise
    const belowWaterPush = scale > 1.08 && point.x < 8 ? 0.34 * (scale - 1) : 0
    return {
      x: point.x * scale * outward - belowWaterPush,
      z: point.z * scale * (frontPad ? 1 : 1 + noise * 0.58),
    }
  })

const createIslandBodyGeometry = (seed: number) => {
  const top = sampleIslandProfile(seed, 1, 0.1)
  const mid = sampleIslandProfile(seed + 4, 1.08, 0.13)
  const waterline = sampleIslandProfile(seed + 9, 1.16, 0.15)
  const base = sampleIslandProfile(seed + 14, 1.24, 0.11)
  const rings = [
    { y: -0.2, points: top },
    { y: -1.75, points: mid },
    { y: -3.95, points: waterline },
    { y: -4.9, points: base },
  ]
  const vertices: number[] = []
  const indices: number[] = []
  const segments = top.length

  rings.forEach((ring, ringIndex) => {
    ring.points.forEach((point, index) => {
      const angle = (index / segments) * Math.PI * 2
      const y = ring.y + (ringIndex === 0 ? 0 : layeredIslandNoise(angle + ringIndex * 0.37, seed + 23) * 0.08)
      vertices.push(point.x, y, point.z)
    })
  })

  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    const current = ringIndex * segments
    const next = (ringIndex + 1) * segments
    for (let index = 0; index < segments; index += 1) {
      const a = current + index
      const b = current + ((index + 1) % segments)
      const c = next + index
      const d = next + ((index + 1) % segments)
      indices.push(a, b, c, b, d, c)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

const createIslandTopGeometry = (seed: number) => {
  const ring = sampleIslandProfile(seed, 0.99, 0.08)
  const vertices = [-1.5, -0.18, 0]
  const indices: number[] = []

  ring.forEach((point) => vertices.push(point.x, -0.18, point.z))
  for (let index = 0; index < ring.length; index += 1) {
    indices.push(0, ((index + 1) % ring.length) + 1, index + 1)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function Landmass({ x, mirrored = false }: { x: number; mirrored?: boolean }) {
  const seed = mirrored ? 19 : 7
  const cliffGeometry = useMemo(() => createIslandBodyGeometry(seed), [seed])
  const topGeometry = useMemo(() => createIslandTopGeometry(seed), [seed])
  const shorelineRocks = useMemo(
    () =>
      Array.from({ length: 10 }, (_, index) => {
        const ring = sampleIslandProfile(seed + 5, 1.18, 0.12)[Math.floor((index / 10) * baseIslandProfile.length)]
        const outward = 0.9 + seededParticle(index, seed + 8.1) * 0.08
        return {
          position: [ring.x * outward, -3.86 + seededParticle(index, seed + 3.2) * 0.34, ring.z * outward] as [number, number, number],
          rotation: [
            seededParticle(index, seed + 2.1) * Math.PI,
            seededParticle(index, seed + 0.4) * Math.PI * 2,
            seededParticle(index, seed + 4.7) * Math.PI,
          ] as [number, number, number],
          scale: [
            0.88 + seededParticle(index, seed + 1.2) * 1.08,
            0.42 + seededParticle(index, seed + 6.6) * 0.72,
            0.74 + seededParticle(index, seed + 9.4) * 0.92,
          ] as [number, number, number],
        }
      }),
    [seed],
  )

  return (
    <group position={[x, 0, 0]} rotation={[0, mirrored ? Math.PI : 0, 0]}>
      <mesh castShadow receiveShadow geometry={cliffGeometry}>
        <meshStandardMaterial color="#2d4035" roughness={0.94} metalness={0.04} flatShading />
      </mesh>
      <mesh receiveShadow geometry={topGeometry}>
        <meshStandardMaterial color="#5f7b60" roughness={0.9} metalness={0.02} flatShading />
      </mesh>
      {shorelineRocks.map((rock, index) => (
        <mesh key={`shore-rock-${index}`} castShadow receiveShadow position={rock.position} rotation={rock.rotation} scale={rock.scale}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={index % 3 === 0 ? "#1e2e28" : "#34463b"} roughness={0.96} flatShading />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-1.4, -3.78, 0]} scale={[11, 5.8, 1]}>
        <circleGeometry args={[1, 36]} />
        <meshBasicMaterial color="#b9d8d0" transparent opacity={0.035} depthWrite={false} />
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
  const baseY = -4.25
  const legHeight = height - baseY
  const legCentreY = baseY + legHeight / 2
  return (
    <group position={[x, 0, 0]}>
      {[-1, 1].map((side) => (
        <mesh key={side} castShadow receiveShadow position={[0, legCentreY, side * width * 0.54]}>
          <boxGeometry args={[0.62, legHeight, 0.54]} />
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

function SupportPier({ node, color }: { node: BridgeNodeFrame; color: string }) {
  const bottom = -4.2
  const top = node.y - 0.18
  const height = Math.max(0.4, top - bottom)

  return (
    <mesh castShadow receiveShadow position={[node.x, bottom + height / 2, node.z]}>
      <cylinderGeometry args={[0.18, 0.24, height, 12]} />
      <meshStandardMaterial color={color} metalness={0.26} roughness={0.48} />
    </mesh>
  )
}

const renderLoadCentreFor = (config: SimulationConfig, time: number) => {
  if (config.load.movingLoad) {
    const travel = (time * config.load.movingSpeed * 0.16) % 1.4
    return clamp(-0.7 + travel + config.load.bias * 0.42, -0.62, 0.62)
  }

  if (config.load.distribution === "offset") return clamp(config.load.bias, -0.55, 0.55)
  if (config.load.distribution === "random") return clamp((seededParticle(Math.round(config.load.totalWeight * 13), 9.77) - 0.5) * 0.92 + config.load.bias * 0.2, -0.55, 0.55)
  return clamp(config.load.bias * 0.2, -0.35, 0.35)
}

function nodeAtNormalized(nodes: BridgeNodeFrame[], normalized: number) {
  const target = clamp(normalized, 0, 1) * (nodes.length - 1)
  const leftIndex = Math.floor(target)
  const rightIndex = Math.min(nodes.length - 1, leftIndex + 1)
  const blend = target - leftIndex
  const left = nodes[leftIndex]
  const right = nodes[rightIndex]
  return {
    x: THREE.MathUtils.lerp(left.x, right.x, blend),
    y: THREE.MathUtils.lerp(left.y, right.y, blend),
    z: THREE.MathUtils.lerp(left.z, right.z, blend),
  }
}

function LoadTruck({ config, frame, failureProgress }: { config: SimulationConfig; frame: SimulationFrame; failureProgress: number }) {
  if (config.load.totalWeight <= 0) return null

  const centre = renderLoadCentreFor(config, frame.time)
  const position = nodeAtNormalized(frame.nodes, (centre + 1) / 2)
  const weightScale = clamp(config.load.totalWeight / 110, 0.55, 1.35)
  const length = 1.65 + weightScale * 1.08
  const width = clamp(config.bridge.deckWidth * 0.28, 1.25, 1.95)
  const fall = failureProgress > 0 ? Math.pow(failureProgress, 1.4) : 0
  const side = centre >= 0 ? 1 : -1
  const truckY = position.y + 0.48 - fall * 7.4
  const truckZ = position.z + side * fall * 2.2

  return (
    <group position={[position.x + side * fall * 1.4, truckY, truckZ]} rotation={[fall * 1.25, 0, side * fall * 1.8]} scale={[1, 1, 1]}>
      <mesh castShadow receiveShadow position={[0, 0.22, 0]}>
        <boxGeometry args={[length, 0.48, width]} />
        <meshStandardMaterial color="#d7cc78" roughness={0.44} metalness={0.18} />
      </mesh>
      <mesh castShadow receiveShadow position={[length * 0.34, 0.64, 0]}>
        <boxGeometry args={[0.78, 0.78, width * 0.86]} />
        <meshStandardMaterial color="#7edfd0" roughness={0.38} metalness={0.24} />
      </mesh>
      <mesh castShadow receiveShadow position={[-length * 0.22, 0.62, 0]}>
        <boxGeometry args={[length * 0.68, 0.62, width * 0.92]} />
        <meshStandardMaterial color="#d0d8c8" roughness={0.52} metalness={0.12} />
      </mesh>
      {[-1, 1].flatMap((zSide) =>
        [-0.34, 0.28].map((xOffset) => (
          <mesh key={`${zSide}-${xOffset}`} castShadow receiveShadow position={[xOffset * length, -0.08, zSide * width * 0.46]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.16, 14]} />
            <meshStandardMaterial color="#101816" roughness={0.7} />
          </mesh>
        )),
      )}
    </group>
  )
}

function DinosaurAttack({ config, frame }: { config: SimulationConfig; frame?: SimulationFrame }) {
  const group = useRef<THREE.Group>(null)
  const gltf = useGLTF(trexUrl)
  const { actions, mixer } = useAnimations(gltf.animations, group)
  const enabled = config.dinosaur.enabled && config.dinosaur.showEffects

  useEffect(() => {
    const attack = actions["Armature|TRex_Attack"] ?? Object.values(actions)[0]
    if (!attack) return undefined
    if (!enabled) {
      attack.stop()
      return undefined
    }
    attack.reset().play()
    attack.paused = true
    return () => {
      attack.stop()
    }
  }, [actions, enabled])

  useFrame(() => {
    if (!group.current || !enabled) return
    const timelineTime = frame?.time ?? 0
    const activeTime = Math.max(0, timelineTime - config.dinosaur.attackTime)
    const cycle = (activeTime * config.dinosaur.biteFrequency) % 1
    const bitePulse = activeTime > 0 ? Math.exp(-Math.pow((cycle - 0.18) / 0.12, 2)) : 0
    const lunge = bitePulse * 0.28
    const sideDirection = config.dinosaur.side === "near" ? -1 : 1
    const attack = actions["Armature|TRex_Attack"] ?? Object.values(actions)[0]
    if (attack) {
      attack.paused = true
      attack.time = activeTime > 0 ? activeTime % attack.getClip().duration : 0
      mixer.update(0)
    }
    group.current.position.z = sideDirection * (config.bridge.deckWidth / 2 + 5.6 - lunge)
    group.current.position.y = -4.18 + Math.sin(timelineTime * 1.8) * 0.08
  })

  if (!enabled) return null

  const sideDirection = config.dinosaur.side === "near" ? -1 : 1
  const x = (frame?.dinosaurX ?? config.dinosaur.targetBias * config.bridge.spanLength * 0.48)
  const biteForce = frame?.dinosaurForce ?? 0
  const modelScale = config.dinosaur.scale * 0.1
  const bitePosition: [number, number, number] = [x, 0.45, sideDirection * (config.bridge.deckWidth / 2 + 0.28)]

  return (
    <group>
      <primitive
        ref={group}
        object={gltf.scene}
        position={[x, -4.18, sideDirection * (config.bridge.deckWidth / 2 + 5.6)]}
        rotation={[0, sideDirection < 0 ? 0 : Math.PI, 0]}
        scale={modelScale}
      />
      {biteForce > 0.04 && (
        <>
          <mesh position={bitePosition}>
            <sphereGeometry args={[0.34 + biteForce * 0.2, 18, 10]} />
            <meshBasicMaterial color="#ffdd73" transparent opacity={Math.min(0.45, biteForce * 0.35)} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <Line
            points={[
              [x - 0.9, 0.84, bitePosition[2]],
              [x - 0.36, 0.18, bitePosition[2] - sideDirection * 0.24],
              [x + 0.08, 0.78, bitePosition[2]],
              [x + 0.56, 0.14, bitePosition[2] - sideDirection * 0.22],
              [x + 1.04, 0.66, bitePosition[2]],
            ]}
            color="#f7e6a7"
            lineWidth={2.2}
            transparent
            opacity={Math.min(0.85, biteForce * 0.65)}
          />
          <pointLight position={bitePosition} color="#ffce6e" intensity={biteForce * 12} distance={7} />
        </>
      )}
    </group>
  )
}

useGLTF.preload(trexUrl)

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
  const bridgeSides = [-1, 1] as const
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
          {bridgeSides.map((side) => {
            const archZ = side * (config.bridge.deckWidth / 2 + 0.12)
            return (
              <group key={`arch-side-${side}`}>
                <Line
                  points={nodes.map((node) => {
                    const shape = Math.sin(Math.PI * ((node.baseX / config.bridge.spanLength) + 0.5))
                    return [node.x, node.y - 3.15 + shape * config.bridge.towerHeight * 0.72, archZ] as [number, number, number]
                  })}
                  color="#f0d27a"
                  lineWidth={3.2}
                  transparent
                  opacity={fractureFade}
                />
                {nodes.filter((_, index) => index % 3 === 0).map((node) => {
                  const shape = Math.sin(Math.PI * ((node.baseX / config.bridge.spanLength) + 0.5))
                  return (
                    <Line
                      key={`arch-post-${side}-${node.id}`}
                      points={[[node.x, node.y - 0.18, archZ], [node.x, node.y - 2.9 + shape * config.bridge.towerHeight * 0.72, archZ]]}
                      color="#d4e1d8"
                      lineWidth={0.95}
                      transparent
                      opacity={fractureFade}
                    />
                  )
                })}
              </group>
            )
          })}
        </>
      )}
      {config.bridge.type === "truss" && (
        <>
          {bridgeSides.map((side) => {
            const trussZ = side * (config.bridge.deckWidth / 2 + 0.24)
            const topChord = nodes.map((node) => nodeTuple(node, 1.58, trussZ))
            const lowerChord = nodes.map((node) => nodeTuple(node, 0.52, trussZ))
            return (
              <group key={`truss-side-${side}`}>
                <Line points={topChord} color="#d8e8df" lineWidth={1.7} transparent opacity={fractureFade} />
                <Line points={lowerChord} color="#a7ded3" lineWidth={1.5} transparent opacity={fractureFade} />
                {nodes.filter((_, index) => index % 4 === 0).map((node) => (
                  <Line key={`truss-vertical-${side}-${node.id}`} points={[nodeTuple(node, 0.52, trussZ), nodeTuple(node, 1.58, trussZ)]} color="#cbdad2" lineWidth={1} transparent opacity={0.84 * fractureFade} />
                ))}
                {nodes.slice(0, -2).filter((_, index) => index % 2 === 0).map((node, index) => {
                  const nodeIndex = index * 2
                  const next = nodes[Math.min(nodes.length - 1, nodeIndex + 2)]
                  const flip = nodeIndex % 4 === 0
                  return (
                    <Line
                      key={`truss-diagonal-${side}-${node.id}`}
                      points={flip ? [nodeTuple(node, 0.52, trussZ), nodeTuple(next, 1.58, trussZ)] : [nodeTuple(node, 1.58, trussZ), nodeTuple(next, 0.52, trussZ)]}
                      color={flip ? "#e8d26a" : "#a7ded3"}
                      lineWidth={1.15}
                      transparent
                      opacity={0.82 * fractureFade}
                    />
                  )
                })}
              </group>
            )
          })}
        </>
      )}
      {Array.from({ length: Math.max(2, config.bridge.supports) }).map((_, index, supports) => {
        const nodeIndex = Math.round((index / Math.max(1, supports.length - 1)) * (nodes.length - 1))
        const node = nodes[nodeIndex]
        return <SupportPier key={`support-${node.id}`} node={node} color={stressColor(frame.supportStress[index] ?? node.stress, threshold)} />
      })}
      <LoadTruck config={config} frame={frame} failureProgress={failureProgress} />
      {config.dinosaur.enabled && config.dinosaur.showEffects && (
        <Suspense fallback={null}>
          <DinosaurAttack config={config} frame={frame} />
        </Suspense>
      )}
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
  const frame = useMemo(() => createPreviewFrame(config), [config])

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
    const fieldLength = 118
    const fieldWidth = 72
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
      const y = -2.4 + seed[1] * 17 + Math.sin(clock.elapsedTime * 1.7 + index) * config.wind.turbulence * 0.52
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
      <CameraHome cinematic={config.camera.cinematic} />
      <Suspense fallback={null}>
        <Atmosphere config={config} />
      </Suspense>
      <Suspense fallback={null}>
        <BridgeModel config={config} frame={frame} />
      </Suspense>
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
      <Canvas
        camera={{ position: [0, 10, 48], fov: 42, near: 0.1, far: 220 }}
        shadows="basic"
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        resize={{ scroll: false, debounce: { scroll: 50, resize: 0 } }}
      >
        <SceneContents />
      </Canvas>
    </div>
  )
}
