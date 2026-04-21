import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import vtkDataArray from "vtk.js/Sources/Common/Core/DataArray"
import vtkPoints from "vtk.js/Sources/Common/Core/Points"
import vtkPolyData from "vtk.js/Sources/Common/DataModel/PolyData"
import { getLastIntactFrame } from "@/features/bridge-sim/engine"
import { useSimulationStore } from "@/store/simulation-store"
import type { CameraMatrices, SimulationConfig, SimulationFrame } from "@/types/simulation"

const colorFor = (value: number, threshold: number, config: SimulationConfig) => {
  const ratio = value / threshold
  if (config.overlay.palette === "viridis") {
    if (ratio < 0.45) return "#2eb7a0"
    if (ratio < 0.75) return "#8bd15f"
    if (ratio < 1) return "#e6d450"
    return "#f27742"
  }

  if (config.overlay.palette === "critical") {
    if (ratio < 0.65) return "rgba(164, 231, 211, 0.55)"
    if (ratio < 0.95) return "#ffe15a"
    return "#ff3459"
  }

  if (ratio < 0.48) return "#38d3c0"
  if (ratio < 0.72) return "#a7d95b"
  if (ratio < 0.92) return "#f1c84b"
  if (ratio < 1.08) return "#f1763e"
  return "#ff315e"
}

const project = (point: [number, number, number], matrices: CameraMatrices) => {
  const projection = new THREE.Matrix4().fromArray(matrices.projection)
  const view = new THREE.Matrix4().fromArray(matrices.view)
  const vector = new THREE.Vector3(...point)
  vector.applyMatrix4(view).applyMatrix4(projection)
  return {
    x: (vector.x * 0.5 + 0.5) * matrices.width,
    y: (-vector.y * 0.5 + 0.5) * matrices.height,
    visible: vector.z > -1 && vector.z < 1,
  }
}

const buildVtkStressDataset = (frame: SimulationFrame) => {
  const polyData = vtkPolyData.newInstance()
  const points = vtkPoints.newInstance()
  const coordinates = new Float32Array(frame.nodes.length * 3)
  frame.nodes.forEach((node, index) => {
    coordinates[index * 3] = node.x
    coordinates[index * 3 + 1] = node.y
    coordinates[index * 3 + 2] = node.z
  })
  points.setData(coordinates, 3)
  polyData.setPoints(points)
  polyData.getPointData().setScalars(vtkDataArray.newInstance({ name: "stress", values: Float32Array.from(frame.nodes.map((node) => node.stress)) }))
  return polyData
}

export function StressOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [highlightTick, setHighlightTick] = useState(0)
  const config = useSimulationStore((state) => state.config)
  const run = useSimulationStore((state) => state.currentRun)
  const replayIndex = useSimulationStore((state) => state.replayIndex)
  const cameraMatrices = useSimulationStore((state) => state.cameraMatrices)
  const frame = run ? getLastIntactFrame(run, replayIndex) : undefined
  const vtkDataset = useMemo(() => (frame ? buildVtkStressDataset(frame) : undefined), [frame])

  useEffect(() => {
    if (!config.overlay.highlightCritical || !config.overlay.showStress) return undefined

    let animation = 0
    const tick = () => {
      setHighlightTick(performance.now())
      animation = requestAnimationFrame(tick)
    }

    animation = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animation)
  }, [config.overlay.highlightCritical, config.overlay.showStress])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return

    const resize = () => {
      const rect = parent.getBoundingClientRect()
      const scale = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.floor(rect.width * scale))
      canvas.height = Math.max(1, Math.floor(rect.height * scale))
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d")
    if (!canvas || !context) return

    context.clearRect(0, 0, canvas.width, canvas.height)
    if (!run || !frame || !config.overlay.showStress || !cameraMatrices) return

    const scale = window.devicePixelRatio || 1
    context.save()
    context.scale(scale, scale)
    context.globalAlpha = config.overlay.opacity
    context.lineCap = "round"
    context.lineJoin = "round"
    context.shadowColor = "rgba(0, 0, 0, 0.38)"
    context.shadowBlur = 12
    const threshold = config.bridge.failureThreshold * config.bridge.materialStrength
    const scalarRange = vtkDataset?.getPointData().getScalars().getRange() ?? [0, threshold]

    for (let index = 0; index < frame.nodes.length - 1; index += 1) {
      const start = project([frame.nodes[index].x, frame.nodes[index].y + 0.18, frame.nodes[index].z], cameraMatrices)
      const end = project([frame.nodes[index + 1].x, frame.nodes[index + 1].y + 0.18, frame.nodes[index + 1].z], cameraMatrices)
      if (!start.visible || !end.visible) continue
      const stress = frame.segmentStress[index] ?? frame.nodes[index].stress
      context.strokeStyle = colorFor(stress, threshold, config)
      context.lineWidth = 4 + Math.min(6, (stress / threshold) * 4)
      context.beginPath()
      context.moveTo(start.x, start.y)
      context.lineTo(end.x, end.y)
      context.stroke()
    }

    if (config.overlay.highlightCritical) {
      const criticalIndex = frame.nodes.reduce((best, node, index, list) => (node.stress > list[best].stress ? index : best), 0)
      const node = frame.nodes[criticalIndex]
      const point = project([node.x, node.y + 0.38, node.z], cameraMatrices)
      context.globalAlpha = Math.min(1, config.overlay.opacity + 0.18)
      context.fillStyle = colorFor(node.stress, threshold, config)
      context.beginPath()
      context.arc(point.x, point.y, 9 + Math.sin(highlightTick * 0.006) * 2, 0, Math.PI * 2)
      context.fill()
    }

    if (config.overlay.showSupportLabels) {
      context.globalAlpha = 0.84
      context.shadowBlur = 0
      context.font = "11px Geist Variable, sans-serif"
      context.fillStyle = "rgba(241, 248, 244, 0.92)"
      frame.supportStress.forEach((stress, index) => {
        const nodeIndex = Math.round((index / Math.max(1, frame.supportStress.length - 1)) * (frame.nodes.length - 1))
        const node = frame.nodes[nodeIndex]
        const point = project([node.x, node.y + 1.1, node.z], cameraMatrices)
        context.fillText(`S${index + 1} ${(stress / threshold).toFixed(2)}x`, point.x + 8, point.y - 8)
      })
    }

    context.globalAlpha = 0.88
    context.fillStyle = run.failed && !run.frames[replayIndex]?.isStanding ? "rgba(255, 55, 90, 0.9)" : "rgba(197, 255, 238, 0.86)"
    context.font = "12px Geist Variable, sans-serif"
    const message = run.failed && !run.frames[replayIndex]?.isStanding
      ? "VTK overlay frozen at last intact frame"
      : `VTK scalar range ${scalarRange[0].toFixed(2)}-${scalarRange[1].toFixed(2)}`
    context.fillText(message, 18, 28)
    context.restore()
  }, [cameraMatrices, config, frame, highlightTick, replayIndex, run, vtkDataset])

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-20 mix-blend-screen" aria-hidden="true" />
}
