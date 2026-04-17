import { useEffect, useRef, useState } from "react"
import { BarChart3, Bolt, Menu, Moon, Play, RotateCcw, Sun } from "lucide-react"
import logoUrl from "@/assets/bridge-lab-logo.svg"
import { AnalysisModal } from "@/components/analysis/AnalysisModal"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { TooltipProvider } from "@/components/ui/tooltip"
import { BridgeScene } from "@/features/bridge-sim/scene/BridgeScene"
import { StressOverlay } from "@/features/bridge-sim/StressOverlay"
import { bridgeTypeLabels } from "@/features/bridge-sim/config"
import { useTheme } from "@/hooks/use-theme"
import { useSimulationStore } from "@/store/simulation-store"
import { ControlPanel } from "@/components/simulation/ControlPanel"
import { ReplayBar } from "@/components/simulation/ReplayBar"
import { StatusHud } from "@/components/simulation/StatusHud"

function useReplayClock() {
  const run = useSimulationStore((state) => state.currentRun)
  const isPlaying = useSimulationStore((state) => state.isPlaying)
  const speed = useSimulationStore((state) => state.config.timing.replaySpeed)
  const stepFrame = useSimulationStore((state) => state.stepFrame)
  const accumulator = useRef(0)

  useEffect(() => {
    let animation = 0
    let previous = performance.now()

    const tick = (now: number) => {
      const deltaSeconds = (now - previous) / 1000
      previous = now
      if (run && isPlaying) {
        accumulator.current += deltaSeconds * speed * run.config.timing.sampleDensity
        const steps = Math.floor(accumulator.current)
        if (steps > 0) {
          accumulator.current -= steps
          stepFrame(steps)
        }
      }
      animation = requestAnimationFrame(tick)
    }

    animation = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animation)
  }, [isPlaying, run, speed, stepFrame])
}

export function AppShell() {
  const { theme, toggleTheme } = useTheme()
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const config = useSimulationStore((state) => state.config)
  const run = useSimulationStore((state) => state.currentRun)
  const runSimulation = useSimulationStore((state) => state.run)
  const reset = useSimulationStore((state) => state.reset)
  const replayIndex = useSimulationStore((state) => state.replayIndex)
  const frame = run?.frames[replayIndex]
  useReplayClock()

  return (
    <TooltipProvider>
      <div className="noise-overlay" />
      <div className="min-h-dvh overflow-hidden bg-background text-foreground">
        <div className="app-backdrop fixed inset-0 -z-10" />
        <header className="flex h-16 items-center justify-between border-b border-border/70 bg-background/88 px-3 backdrop-blur-xl sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <img src={logoUrl} alt="BridgeLab logo" className="size-10 rounded-lg dark:shadow-xl dark:shadow-slate-500/20 " />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight">BridgeLab</h1>
            </div>
            <Badge variant="secondary" className="hidden rounded-sm md:inline-flex">{bridgeTypeLabels[config.bridge.type]}</Badge>
            <Badge className={frame && !frame.isStanding ? "hidden rounded-sm bg-red-500/90 text-white md:inline-flex" : "hidden rounded-sm bg-teal-500/90 text-[#08110f] md:inline-flex"}>
              {run ? (frame?.isStanding ? "standing" : "failed") : "ready"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon-sm" className="lg:hidden"><Menu className="size-4" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[88vw] p-0 sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Simulation controls</SheetTitle>
                </SheetHeader>
                <div className="min-h-0 flex-1"><ControlPanel /></div>
              </SheetContent>
            </Sheet>
            <Button onClick={runSimulation} className="bg-teal-400 text-[#08110f] hover:bg-teal-300">
              <Play className="size-4" />
              <span className="hidden sm:inline">Run simulation</span>
              <span className="sm:hidden">Run</span>
            </Button>
            <Button variant="outline" onClick={reset}>
              <RotateCcw className="size-4" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
            <Button variant="outline" disabled={!run} onClick={() => setAnalysisOpen(true)}>
              <BarChart3 className="size-4" />
              <span className="hidden sm:inline">Analysis</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </div>
        </header>
        <main className="grid h-[calc(100dvh-4rem)] min-h-0 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="hidden min-h-0 lg:block">
            <ControlPanel />
          </aside>
          <section className="relative min-h-0 overflow-hidden bg-black">
            <BridgeScene className="absolute inset-0" />
            <StressOverlay />
            <StatusHud />
            {!run && (
              <div className="pointer-events-none absolute bottom-5 left-5 z-30 max-w-md rounded-md border border-white/15 bg-black/42 p-4 text-white shadow-2xl backdrop-blur-xl">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Bolt className="size-4 text-teal-300" /> Ready to simulate</div>
                <p className="text-sm text-white/72">Choose a preset or tune the controls, then run the deterministic model to unlock replay, VTK stress overlay data, and Plotly analysis.</p>
              </div>
            )}
            <ReplayBar />
            {frame?.failureTime !== undefined && !frame.isStanding && (
              <div className="pointer-events-none absolute right-4 top-4 z-30 rounded-md border border-red-300/40 bg-red-950/60 px-4 py-3 text-sm text-red-50 shadow-2xl backdrop-blur-xl">
                Collapse replay active. Stress overlay is frozen at the last intact frame.
              </div>
            )}
          </section>
        </main>
        <AnalysisModal open={analysisOpen} onOpenChange={setAnalysisOpen} />
      </div>
    </TooltipProvider>
  )
}
