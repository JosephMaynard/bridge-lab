import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { defaultConfig, presets } from "@/features/bridge-sim/config"
import { runSimulation } from "@/features/bridge-sim/engine"
import type { CameraMatrices, SimulationConfig, SimulationRun } from "@/types/simulation"

const CONTROL_PANEL_DEFAULT_OPEN = ["bridge", "load", "wind", "environment", "impact", "dinosaur", "overlay"]
const PREFERENCES_STORAGE_KEY = "bridge-lab:preferences"

type SimulationState = {
  config: SimulationConfig
  currentRun?: SimulationRun
  recentRuns: SimulationRun[]
  controlPanelOpen: string[]
  replayIndex: number
  isPlaying: boolean
  cameraMatrices?: CameraMatrices
  updateConfig: (updater: (config: SimulationConfig) => SimulationConfig) => void
  loadPreset: (presetId: string) => void
  setControlPanelOpen: (openItems: string[]) => void
  run: () => void
  reset: () => void
  setReplayIndex: (index: number) => void
  setReplayTime: (time: number) => void
  setPlaying: (isPlaying: boolean) => void
  stepFrame: (delta: number) => void
  setCameraMatrices: (matrices: CameraMatrices) => void
}

const cloneConfig = (config: SimulationConfig): SimulationConfig => structuredClone(config)

const mergeConfig = (stored?: Partial<SimulationConfig>): SimulationConfig => ({
  ...cloneConfig(defaultConfig),
  ...stored,
  bridge: { ...defaultConfig.bridge, ...stored?.bridge, supports: Math.max(2, stored?.bridge?.supports ?? defaultConfig.bridge.supports) },
  timing: { ...defaultConfig.timing, ...stored?.timing },
  load: { ...defaultConfig.load, ...stored?.load },
  wind: { ...defaultConfig.wind, ...stored?.wind },
  earthquake: { ...defaultConfig.earthquake, ...stored?.earthquake },
  impact: { ...defaultConfig.impact, ...stored?.impact },
  dinosaur: { ...defaultConfig.dinosaur, ...stored?.dinosaur },
  environment: { ...defaultConfig.environment, ...stored?.environment },
  camera: { ...defaultConfig.camera, ...stored?.camera },
  overlay: { ...defaultConfig.overlay, ...stored?.overlay },
})

export const useSimulationStore = create<SimulationState>()(
  persist(
    (set, get) => ({
      config: cloneConfig(defaultConfig),
      recentRuns: [],
      controlPanelOpen: CONTROL_PANEL_DEFAULT_OPEN,
      replayIndex: 0,
      isPlaying: false,
      updateConfig: (updater) => set((state) => ({ config: updater(cloneConfig(state.config)) })),
      loadPreset: (presetId) => {
        const preset = presets.find((candidate) => candidate.id === presetId)
        if (preset) set({ config: cloneConfig(preset.config) })
      },
      setControlPanelOpen: (controlPanelOpen) => set({ controlPanelOpen }),
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
    }),
    {
      name: PREFERENCES_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        config: state.config,
        controlPanelOpen: state.controlPanelOpen,
      }),
      migrate: (persisted, version) => {
        const stored = persisted as Partial<SimulationState> | undefined
        if (version < 1 && stored?.config?.camera) {
          return {
            ...stored,
            config: {
              ...stored.config,
              camera: { ...stored.config.camera, cinematic: false },
            },
          }
        }
        return persisted
      },
      merge: (persisted, current) => {
        const stored = persisted as Partial<SimulationState> | undefined
        return {
          ...current,
          config: mergeConfig(stored?.config),
          controlPanelOpen: stored?.controlPanelOpen ?? CONTROL_PANEL_DEFAULT_OPEN,
        }
      },
    },
  ),
)
