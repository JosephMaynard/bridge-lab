# BridgeLab

BridgeLab is a single page React + TypeScript bridge simulation demo built with Vite, Tailwind CSS v4, shadcn/ui, React Three Fiber, vtk.js, Plotly, Lucide React, and Zustand.

## Run locally

```bash
pnpm install
pnpm dev
```

The app runs at the Vite local URL, usually `http://localhost:5173/`.

## Project structure

- `src/components/layout/` contains the app shell, header, responsive layout, and replay clock.
- `src/components/simulation/` contains the control panel, status HUD, and replay timeline.
- `src/components/analysis/` contains the Plotly analysis dialog and chart tabs.
- `src/components/ui/` contains shadcn/ui components copied into the project.
- `src/features/bridge-sim/config.ts` contains defaults, presets, labels, and scenario configuration.
- `src/features/bridge-sim/engine.ts` contains the deterministic simulation model and replay frame generation.
- `src/features/bridge-sim/scene/` contains the React Three Fiber scene and procedural bridge rendering.
- `src/features/bridge-sim/StressOverlay.tsx` contains the vtk.js scalar overlay canvas.
- `src/store/simulation-store.ts` contains the Zustand state and public actions for configuration, run, reset, and replay.
- `src/types/` contains the shared simulation, VTK, and Plotly types.

## Simulation model

The model is a deterministic, physics-inspired approximation rather than a full finite element solver. `runSimulation(config)` builds a bridge as a set of deck nodes and segment/support stress arrays, then samples a run into replay frames.

Each frame stores:

- node positions and displacements
- segment stress
- support stress
- max stress
- centre deck displacement
- lateral sway
- wind speed
- earthquake force
- load distribution
- accumulated damage
- failure metadata when thresholds are exceeded

Stress is driven by load profile, wind gusts, earthquake waveform, bridge stiffness, damping, material strength, and bridge type. When max stress or accumulated damage crosses the configured threshold, the engine records a failure time and critical node. Later frames keep replaying the collapse deformation in the Three.js layer.

## R3F and VTK overlay synchronisation

React Three Fiber owns the main cinematic scene: bridge geometry, landmasses, water, particles, camera motion, manual orbit controls, and collapse animation.

The VTK overlay uses the same replay frame. `StressOverlay.tsx` converts the current intact bridge frame into a vtk.js `PolyData` scalar dataset, then draws stress-coloured bridge segments onto an absolutely positioned canvas over the R3F canvas. The R3F camera publishes projection and view matrices through Zustand, so the overlay projects the same 3D node positions into the same viewport.

After failure, the overlay intentionally freezes on the last intact frame while the R3F layer continues showing the collapse. This keeps stress analysis readable without hiding the cinematic failure replay.

## Presets and controls

Adjust presets in `src/features/bridge-sim/config.ts`. The exported `presets` array includes:

- Calm Conditions
- Crosswind Stress Test
- Earthquake Failure
- Heavy Load
- Extreme Chaos

Add or tune controls by extending `SimulationConfig` in `src/types/simulation.ts`, updating defaults/presets in `config.ts`, and wiring UI bindings in `src/components/simulation/ControlPanel.tsx`.

Useful store actions are in `src/store/simulation-store.ts`:

- `run()`
- `reset()`
- `setReplayIndex(index)`
- `setReplayTime(time)`
- `setPlaying(isPlaying)`
- `loadPreset(presetId)`
- `updateConfig(updater)`
