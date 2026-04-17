import { Activity, AlertTriangle, Gauge, Timer, Waves, Wind } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useSimulationStore } from "@/store/simulation-store"

const format = (value: number | undefined, digits = 2) => value === undefined ? "n/a" : value.toFixed(digits)

export function StatusHud() {
  const run = useSimulationStore((state) => state.currentRun)
  const replayIndex = useSimulationStore((state) => state.replayIndex)
  const frame = run?.frames[replayIndex]

  return (
    <div className="pointer-events-none absolute left-4 top-4 z-30 grid w-[min(680px,calc(100%-2rem))] gap-2 sm:grid-cols-3 xl:grid-cols-6">
      <Metric icon={<Activity className="size-4" />} label="State" value={run ? (frame?.isStanding ? "Standing" : "Failed") : "Ready"} tone={frame && !frame.isStanding ? "danger" : "good"} />
      <Metric icon={<Gauge className="size-4" />} label="Max stress" value={format(frame?.maxStress)} />
      <Metric icon={<Waves className="size-4" />} label="Centre sway" value={`${format(frame?.centreDisplacement)}m`} />
      <Metric icon={<Wind className="size-4" />} label="Wind" value={`${format(frame?.windSpeed, 1)}kt`} />
      <Metric icon={<AlertTriangle className="size-4" />} label="Quake" value={format(frame ? Math.abs(frame.earthquakeForce) : undefined)} />
      <Metric icon={<Timer className="size-4" />} label="Time" value={`${format(frame?.time, 1)}s`} />
    </div>
  )
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "good" | "danger" }) {
  return (
    <Card className="rounded-md border-white/15 bg-black/38 text-white shadow-2xl backdrop-blur-md">
      <CardContent className="flex items-center gap-2 p-3">
        <span className={tone === "danger" ? "text-red-300" : tone === "good" ? "text-teal-300" : "text-lime-200"}>{icon}</span>
        <div className="min-w-0">
          <p className="truncate text-[0.65rem] uppercase tracking-[0.08em] text-white/58">{label}</p>
          <p className="truncate text-sm font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
