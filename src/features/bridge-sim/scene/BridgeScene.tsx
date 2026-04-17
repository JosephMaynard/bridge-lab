import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Environment, Line, OrbitControls, PerspectiveCamera } from "@react-three/drei"
import { useMemo, useRef } from "react"
import * as THREE from "three"
import { useSimulationStore } from "@/store/simulation-store"
import type { BridgeNodeFrame, CameraMatrices, SimulationConfig, SimulationFrame } from "@/types/simulation"

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

const seededParticle = (index: number, salt: number) => {
  const value = Math.sin((index + 1) * salt) * 43758.5453
  return value - Math.floor(value)
}

const nodeTuple = (node: BridgeNodeFrame, yOffset = 0, zOffset = 0): [number, number, number] => [
  node.x,
  node.y + yOffset,
  node.z + zOffset,
]

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

function Atmosphere() {
  const water = useRef<THREE.MeshStandardMaterial>(null)

  useFrame(({ clock }) => {
    if (water.current) {
      water.current.normalScale.setScalar(0.25 + Math.sin(clock.elapsedTime * 0.7) * 0.05)
      water.current.opacity = 0.64 + Math.sin(clock.elapsedTime * 0.5) * 0.04
    }
  })

  return (
    <>
      <color attach="background" args={["#07100f"]} />
      <fog attach="fog" args={["#0a1613", 38, 94]} />
      <ambientLight intensity={0.58} />
      <directionalLight position={[14, 22, 8]} intensity={2.4} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <pointLight position={[-16, 9, 16]} intensity={18} color="#51d6c3" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -4.15, 0]} receiveShadow>
        <planeGeometry args={[140, 80, 48, 24]} />
        <meshStandardMaterial ref={water} color="#0c6f7f" metalness={0.15} roughness={0.18} transparent opacity={0.66} />
      </mesh>
      <Landmass x={-27} />
      <Landmass x={27} mirrored />
      <Environment preset="night" />
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
}: {
  start: BridgeNodeFrame
  end: BridgeNodeFrame
  width: number
  color: string
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
      position={[(start.x + end.x) / 2, (start.y + end.y) / 2, (start.z + end.z) / 2]}
      rotation={[0, yaw, pitch]}
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
        />
      ))}
      <Line points={railLeft} color="#dce9df" lineWidth={1.4} transparent opacity={0.92} />
      <Line points={railRight} color="#dce9df" lineWidth={1.4} transparent opacity={0.92} />
      {config.bridge.type === "suspension" && (
        <>
          <Tower x={-towerX} height={config.bridge.towerHeight} width={config.bridge.deckWidth} stress={frame.maxStress} />
          <Tower x={towerX} height={config.bridge.towerHeight} width={config.bridge.deckWidth} stress={frame.maxStress} />
          <Line points={nodes.map((node) => [node.x, cableY(node), node.z] as [number, number, number])} color="#f3e9bd" lineWidth={2.2} />
          {nodes.filter((_, index) => index % 2 === 0).map((node) => (
            <Line key={`hanger-${node.id}`} points={[[node.x, node.y + 0.22, node.z], [node.x, cableY(node), node.z]]} color="#b7c9c2" lineWidth={0.7} transparent opacity={0.72} />
          ))}
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
          />
          {nodes.filter((_, index) => index % 3 === 0).map((node) => (
            <Line key={`arch-post-${node.id}`} points={[[node.x, node.y - 0.25, node.z], [node.x, node.y - 2.9 + Math.sin(Math.PI * ((node.baseX / config.bridge.spanLength) + 0.5)) * config.bridge.towerHeight * 0.72, node.z]]} color="#d4e1d8" lineWidth={0.9} />
          ))}
        </>
      )}
      {config.bridge.type === "truss" && (
        <>
          {nodes.slice(0, -2).map((node, index) => (
            <Line key={`truss-${node.id}`} points={[nodeTuple(node, 0.42, -config.bridge.deckWidth / 2), nodeTuple(nodes[index + 2], 1.8, config.bridge.deckWidth / 2)]} color={index % 2 === 0 ? "#e8d26a" : "#a7ded3"} lineWidth={1.2} transparent opacity={0.8} />
          ))}
          <Line points={nodes.map((node) => nodeTuple(node, 1.85, 0))} color="#d8e8df" lineWidth={1.6} />
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
    loadProfile: nodes.map(() => 0.12),
    damage: 0,
  }

  return <BridgeModel config={config} frame={frame} />
}

function WindParticles({ config, frame }: { config: SimulationConfig; frame?: SimulationFrame }) {
  const pointsRef = useRef<THREE.Points>(null)
  const positionsRef = useRef(new Float32Array(0))
  const count = Math.min(1600, Math.max(0, config.wind.particleCount))
  if (positionsRef.current.length !== count * 3) {
    positionsRef.current = new Float32Array(count * 3)
  }
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
    if (!pointsRef.current || !config.wind.enabled || !config.wind.showParticles) return
    const speed = (frame?.windSpeed ?? config.wind.speed) * 0.012 * config.wind.particleSpeed
    const direction = (config.wind.direction * Math.PI) / 180
    const positions = positionsRef.current
    for (let index = 0; index < count; index += 1) {
      const seed = seeds[index]
      const travel = (seed[0] + clock.elapsedTime * speed + seed[3] * 0.2) % 1
      positions[index * 3] = -31 + travel * 62
      positions[index * 3 + 1] = -1.5 + seed[1] * 13 + Math.sin(clock.elapsedTime * 1.7 + index) * config.wind.turbulence * 0.18
      positions[index * 3 + 2] = (seed[2] - 0.5) * 26 + Math.sin(direction) * travel * 10
    }
    const attribute = pointsRef.current.geometry.getAttribute("position") as THREE.BufferAttribute
    attribute.needsUpdate = true
  })

  if (!config.wind.enabled || !config.wind.showParticles || count === 0) return null

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positionsRef.current, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#c9fff1" size={config.wind.particleSize} transparent opacity={0.36 + config.wind.particleTrail * 0.32} depthWrite={false} />
    </points>
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
      <Atmosphere />
      <BridgeModel config={config} frame={frame} />
      <WindParticles config={config} frame={frame} />
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
