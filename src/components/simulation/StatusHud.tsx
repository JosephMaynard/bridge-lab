import { useState, type ReactNode } from "react"
import { Activity, AlertTriangle, ChevronRight, CircleGauge, Flame, PawPrint, Timer, Waves, Wind } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSimulationStore } from "@/store/simulation-store"

const format = (value: number | undefined, digits = 2) => value === undefined ? "n/a" : value.toFixed(digits)
const formatUnit = (value: number | undefined, unit: string, digits = 2) => value === undefined ? "n/a" : `${value.toFixed(digits)}${unit}`

export function StatusHud() {
  const [open, setOpen] = useState(false)
  const run = useSimulationStore((state) => state.currentRun)
  const replayIndex = useSimulationStore((state) => state.replayIndex)
  const frame = run?.frames[replayIndex]
  const standing = run ? frame?.isStanding : undefined
  const status = run ? (standing ? "Standing" : "Failed") : "Ready"
  const metrics = [
    { icon: <Activity className="size-4" />, label: "State", value: status, tone: standing === false ? "danger" : "good" },
    { icon: <CircleGauge className="size-4" />, label: "Max stress", value: format(frame?.maxStress) },
    { icon: <Waves className="size-4" />, label: "Centre sway", value: formatUnit(frame?.centreDisplacement, "m") },
    { icon: <Wind className="size-4" />, label: "Wind", value: formatUnit(frame?.windSpeed, "kt", 1) },
    { icon: <AlertTriangle className="size-4" />, label: "Quake", value: format(frame ? Math.abs(frame.earthquakeForce) : undefined) },
    { icon: <Flame className="size-4" />, label: "Impact", value: format(frame?.impactForce), tone: frame && frame.impactForce > 0.2 ? "danger" : undefined },
    { icon: <PawPrint className="size-4" />, label: "Dino", value: format(frame?.dinosaurForce), tone: frame && frame.dinosaurForce > 0.2 ? "danger" : undefined },
    { icon: <Timer className="size-4" />, label: "Time", value: formatUnit(frame?.time, "s", 1) },
  ] satisfies Array<{ icon: ReactNode; label: string; value: string; tone?: "good" | "danger" }>

  return (
    <div className="pointer-events-none absolute right-3 top-4 z-40 flex max-w-[calc(100%-1.5rem)] items-start justify-end sm:right-4">
      <div className="pointer-events-auto flex items-start">
        <aside
          aria-hidden={!open}
          className={cn(
            "overflow-hidden transition-[width,opacity] duration-200 ease-out",
            open ? "w-[min(18rem,calc(100vw-5rem))] opacity-100" : "w-0 opacity-0",
          )}
        >
          <div className="max-h-[calc(100dvh-9rem)] overflow-y-auto rounded-l-md border border-r-0 border-white/16 bg-black/46 p-3 text-white shadow-2xl backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.65rem] uppercase leading-none text-white/55">Live status</p>
                <p className="mt-1 text-sm font-semibold leading-tight text-white">{status}</p>
              </div>
              <span className={cn("rounded-sm px-2 py-1 text-[0.65rem] font-semibold uppercase", standing === false ? "bg-red-400/18 text-red-200" : "bg-teal-300/18 text-teal-200")}>
                {run ? (standing ? "stable" : "alert") : "idle"}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {metrics.map((metric) => (
                <Metric key={metric.label} {...metric} />
              ))}
            </div>
          </div>
        </aside>
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? "Collapse status panel" : "Open status panel"}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            "group flex h-12 w-12 items-center justify-center border border-white/16 bg-black/46 text-lime-200 shadow-2xl backdrop-blur-xl transition hover:bg-black/58 hover:text-teal-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300",
            open ? "rounded-r-md border-l-white/10" : "rounded-md",
          )}
        >
          {open ? <ChevronRight className="size-5" /> : <CircleGauge className="size-6" />}
        </button>
      </div>
    </div>
  )
}

function Metric({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone?: "good" | "danger" }) {
  return (
    <div className="flex items-start gap-3 rounded-sm border border-white/10 bg-white/[0.06] px-3 py-2">
      <span className={cn("mt-0.5 shrink-0", tone === "danger" ? "text-red-300" : tone === "good" ? "text-teal-300" : "text-lime-200")}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.65rem] uppercase leading-none text-white/58">{label}</p>
        <p className="mt-1 break-words text-sm font-semibold leading-tight text-white">{value}</p>
      </div>
    </div>
  )
}
