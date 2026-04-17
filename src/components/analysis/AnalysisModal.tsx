import createPlotlyComponentModule from "react-plotly.js/factory"
import Plotly from "plotly.js-basic-dist-min"
import { Activity, BarChart3, PawPrint, Wind } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { bridgeTypeLabels } from "@/features/bridge-sim/config"
import { useSimulationStore } from "@/store/simulation-store"
import type { SimulationRun } from "@/types/simulation"

const createPlotlyComponent = (
  (createPlotlyComponentModule as unknown as { default?: typeof createPlotlyComponentModule }).default ?? createPlotlyComponentModule
) as typeof createPlotlyComponentModule
const Plot = createPlotlyComponent(Plotly)

type AnalysisModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const chartColors = {
  stress: "#ff5b5f",
  threshold: "#f2cc5c",
  sway: "#40d4be",
  wind: "#75a7ff",
  quake: "#e58b4c",
  impact: "#ff9f43",
  dinosaur: "#8ee66f",
  load: "#9fd95a",
}

const baseLayout = (title: string, currentTime?: number): Partial<Plotly.Layout> => ({
  title: { text: title, font: { size: 15, color: "currentColor" } },
  autosize: true,
  margin: { l: 48, r: 24, t: 52, b: 44 },
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor: "rgba(0,0,0,0)",
  font: { color: "currentColor", family: "Geist Variable, sans-serif" },
  xaxis: { gridcolor: "rgba(128, 155, 145, 0.18)", zerolinecolor: "rgba(128, 155, 145, 0.22)" },
  yaxis: { gridcolor: "rgba(128, 155, 145, 0.18)", zerolinecolor: "rgba(128, 155, 145, 0.22)" },
  shapes:
    currentTime !== undefined
      ? [
          {
            type: "line" as const,
            x0: currentTime,
            x1: currentTime,
            y0: 0,
            y1: 1,
            yref: "paper" as const,
            line: { color: "rgba(255, 255, 255, 0.45)", width: 1, dash: "dot" as const },
          },
        ]
      : [],
  showlegend: true,
  legend: { orientation: "h", y: -0.2 },
})

const plotConfig = {
  responsive: true,
  displayModeBar: false,
}

function EmptyState() {
  return (
    <div className="grid h-[420px] place-items-center rounded-md border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
      Run a simulation to unlock analysis.
    </div>
  )
}

function PlotPanel({ data, layout }: { data: Plotly.Data[]; layout: Partial<Plotly.Layout> }) {
  return (
    <div className="h-[430px] min-h-0 rounded-md border border-border/70 bg-background/60 p-2">
      <Plot data={data} layout={layout} config={plotConfig} useResizeHandler className="h-full w-full" />
    </div>
  )
}

const getCurrentTime = (run: SimulationRun | undefined, replayIndex: number) => run?.frames[replayIndex]?.time

export function AnalysisModal({ open, onOpenChange }: AnalysisModalProps) {
  const run = useSimulationStore((state) => state.currentRun)
  const recentRuns = useSimulationStore((state) => state.recentRuns)
  const replayIndex = useSimulationStore((state) => state.replayIndex)

  if (!run) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100vw-2rem)] rounded-md sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Analysis</DialogTitle>
            <DialogDescription>No run data is available yet.</DialogDescription>
          </DialogHeader>
          <EmptyState />
        </DialogContent>
      </Dialog>
    )
  }

  const frames = run.frames
  const time = frames.map((frame) => frame.time)
  const threshold = run.config.bridge.failureThreshold * run.config.bridge.materialStrength
  const currentTime = getCurrentTime(run, replayIndex)
  const peakSupport = run.frames[run.frames.length - 1]?.supportStress.map((_, index) => Math.max(...frames.map((frame) => frame.supportStress[index] ?? 0))) ?? []
  const peakSegment = run.frames[run.frames.length - 1]?.segmentStress.map((_, index) => Math.max(...frames.map((frame) => frame.segmentStress[index] ?? 0))) ?? []
  const comparisonRuns = recentRuns.length > 1 ? recentRuns.slice(0, 5) : [run]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] overflow-hidden rounded-md p-0 sm:max-w-[1120px]">
        <DialogHeader className="border-b border-border/70 px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="size-5 text-teal-400" />
            Analysis
          </DialogTitle>
          <DialogDescription>
            {bridgeTypeLabels[run.config.bridge.type]} run, {frames.length} frames, peak stress {run.peakStress.toFixed(2)}.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="stress" className="min-h-0 px-5 pb-5">
          <TabsList className="my-4 flex h-auto flex-wrap justify-start gap-1 bg-muted/40">
            <TabsTrigger value="stress">Stress</TabsTrigger>
            <TabsTrigger value="motion">Displacement</TabsTrigger>
            <TabsTrigger value="supports">Supports</TabsTrigger>
            <TabsTrigger value="wind">Wind</TabsTrigger>
            <TabsTrigger value="quake">Earthquake</TabsTrigger>
            <TabsTrigger value="impact">Impact</TabsTrigger>
            <TabsTrigger value="dinosaur">Dinosaur</TabsTrigger>
            <TabsTrigger value="load">Load</TabsTrigger>
            <TabsTrigger value="compare">Compare</TabsTrigger>
          </TabsList>
          <TabsContent value="stress">
            <PlotPanel
              data={[
                { x: time, y: frames.map((frame) => frame.maxStress), type: "scatter", mode: "lines", name: "Max stress", line: { color: chartColors.stress, width: 3 } },
                { x: [time[0], time[time.length - 1]], y: [threshold, threshold], type: "scatter", mode: "lines", name: "Failure threshold", line: { color: chartColors.threshold, width: 2, dash: "dash" } },
              ]}
              layout={baseLayout("Maximum bridge stress over time", currentTime)}
            />
          </TabsContent>
          <TabsContent value="motion">
            <PlotPanel
              data={[
                { x: time, y: frames.map((frame) => frame.centreDisplacement), type: "scatter", mode: "lines", name: "Centre displacement", line: { color: chartColors.sway, width: 3 } },
                { x: time, y: frames.map((frame) => frame.lateralSway), type: "scatter", mode: "lines", name: "Lateral sway", line: { color: chartColors.wind, width: 2 } },
              ]}
              layout={baseLayout("Displacement and sway of the bridge deck", currentTime)}
            />
          </TabsContent>
          <TabsContent value="supports">
            <PlotPanel
              data={[
                { x: peakSupport.map((_, index) => `S${index + 1}`), y: peakSupport, type: "bar", name: "Peak support stress", marker: { color: peakSupport.map((value) => (value > threshold ? chartColors.stress : chartColors.sway)) } },
              ]}
              layout={baseLayout("Peak stress per support or cable")}
            />
          </TabsContent>
          <TabsContent value="wind">
            <PlotPanel
              data={[
                { x: frames.map((frame) => frame.windSpeed), y: frames.map((frame) => Math.abs(frame.lateralSway)), type: "scatter", mode: "markers", name: "Wind vs sway", marker: { color: chartColors.wind, size: 6, opacity: 0.72 } },
                { x: time, y: frames.map((frame) => frame.windSpeed / 20), type: "scatter", mode: "lines", name: "Scaled wind trace", line: { color: chartColors.sway, width: 2 } },
              ]}
              layout={baseLayout("Wind speed vs bridge movement", currentTime)}
            />
          </TabsContent>
          <TabsContent value="quake">
            <PlotPanel
              data={[
                { x: time, y: frames.map((frame) => Math.abs(frame.earthquakeForce)), type: "scatter", mode: "lines", name: "Quake contribution", line: { color: chartColors.quake, width: 3 } },
                { x: time, y: frames.map((frame) => frame.damage), type: "scatter", mode: "lines", name: "Accumulated damage", line: { color: chartColors.stress, width: 3 } },
              ]}
              layout={baseLayout("Earthquake intensity vs damage", currentTime)}
            />
          </TabsContent>
          <TabsContent value="impact">
            <PlotPanel
              data={[
                { x: time, y: frames.map((frame) => frame.impactForce), type: "scatter", mode: "lines", name: "Meteor impact force", line: { color: chartColors.impact, width: 3 } },
                { x: time, y: frames.map((frame) => frame.damage), type: "scatter", mode: "lines", name: "Accumulated damage", line: { color: chartColors.stress, width: 3 } },
              ]}
              layout={baseLayout("Meteor impact force vs damage", currentTime)}
            />
          </TabsContent>
          <TabsContent value="dinosaur">
            <PlotPanel
              data={[
                { x: time, y: frames.map((frame) => frame.dinosaurForce), type: "scatter", mode: "lines", name: "Bite force", line: { color: chartColors.dinosaur, width: 3 } },
                { x: time, y: frames.map((frame) => Math.abs(frame.lateralSway)), type: "scatter", mode: "lines", name: "Deck side movement", line: { color: chartColors.sway, width: 2 } },
                { x: time, y: frames.map((frame) => frame.damage), type: "scatter", mode: "lines", name: "Accumulated damage", line: { color: chartColors.stress, width: 3 } },
              ]}
              layout={baseLayout("T-Rex bite force vs bridge response", currentTime)}
            />
          </TabsContent>
          <TabsContent value="load">
            <PlotPanel
              data={[
                { x: peakSegment.map((_, index) => index + 1), y: peakSegment, type: "scatter", mode: "lines+markers", name: "Peak segment stress", line: { color: chartColors.load, width: 3 } },
                { x: run.frames[replayIndex]?.loadProfile.map((_, index) => index + 1), y: run.frames[replayIndex]?.loadProfile, type: "scatter", mode: "lines", name: "Current load profile", line: { color: chartColors.threshold, width: 2 } },
              ]}
              layout={baseLayout("Load distribution along the bridge span")}
            />
          </TabsContent>
          <TabsContent value="compare">
            <PlotPanel
              data={comparisonRuns.map((item) => ({
                x: ["Peak stress", "Peak displacement", "Peak sway"],
                y: [item.peakStress, item.peakDisplacement, item.peakSway],
                type: "bar",
                name: `${bridgeTypeLabels[item.config.bridge.type]} ${item.failed ? "failed" : "held"}`,
              }))}
              layout={baseLayout(recentRuns.length > 1 ? "Comparison between recent bridge designs" : "Current design stress categories")}
            />
            <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
              <span className="flex items-center gap-2"><Activity className="size-3.5 text-red-400" /> Stress is normalized against material strength.</span>
              <span className="flex items-center gap-2"><Wind className="size-3.5 text-blue-400" /> Wind data uses replay frames.</span>
              <span className="flex items-center gap-2"><PawPrint className="size-3.5 text-lime-400" /> Dinosaur attack is replay-frame data.</span>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
