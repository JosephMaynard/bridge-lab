import { create } from "zustand"
import { defaultConfig, presets } from "@/features/bridge-sim/config"
import { runSimulation } from "@/features/bridge-sim/engine"
import type { CameraMatrices, SimulationConfig, SimulationRun } from "@/types/simulation"

type SimulationState = {
  config: SimulationConfig
  currentRun?: SimulationRun
  recentRuns: SimulationRun[]
  replayIndex: number
  isPlaying: boolean
  cameraMatrices?: CameraMatrices
  updateConfig: (updater: (config: SimulationConfig) => SimulationConfig) => void
  loadPreset: (presetId: string) => void
  run: () => void
  reset: () => void
  setReplayIndex: (index: number) => void
  setReplayTime: (time: number) => void
  setPlaying: (isPlaying: boolean) => void
  stepFrame: (delta: number) => void
  setCameraMatrices: (matrices: CameraMatrices) => void
}

const cloneConfig = (config: SimulationConfig): SimulationConfig => structuredClone(config)

export const useSimulationStore = create<SimulationState>((set, get) => ({
  config: cloneConfig(defaultConfig),
  recentRuns: [],
  replayIndex: 0,
  isPlaying: false,
  updateConfig: (updater) => set((state) => ({ config: updater(cloneConfig(state.config)) })),
  loadPreset: (presetId) => {
    const preset = presets.find((candidate) => candidate.id === presetId)
    if (preset) set({ config: cloneConfig(preset.config) })
  },
  run: () => {
    const run = runSimulation(get().config)
    set((state) => ({
      currentRun: run,
      recentRuns: [run, ...state.recentRuns.filter((item) => item.id !== run.id)].slice(0, 6),
      replayIndex: 0,
      isPlaying: true,
    }))
  },
  reset: () => {
    set({
      config: cloneConfig(defaultConfig),
      currentRun: undefined,
      replayIndex: 0,
      isPlaying: false,
    })
  },
  setReplayIndex: (index) => {
    const run = get().currentRun
    if (!run) return
    set({ replayIndex: Math.round(Math.max(0, Math.min(run.frames.length - 1, index))) })
  },
  setReplayTime: (time) => {
    const run = get().currentRun
    if (!run) return
    const index = run.frames.findIndex((frame) => frame.time >= time)
    set({ replayIndex: Math.max(0, index === -1 ? run.frames.length - 1 : index) })
  },
  setPlaying: (isPlaying) => set({ isPlaying }),
  stepFrame: (delta) => {
    const run = get().currentRun
    if (!run) return
    const next = Math.max(0, Math.min(run.frames.length - 1, get().replayIndex + delta))
    set({ replayIndex: next, isPlaying: next < run.frames.length - 1 ? get().isPlaying : false })
  },
  setCameraMatrices: (cameraMatrices) => set({ cameraMatrices }),
}))
