import { Pause, Play, RotateCcw, SkipBack, SkipForward, StepBack, StepForward, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useSimulationStore } from "@/store/simulation-store"

export function ReplayBar() {
  const run = useSimulationStore((state) => state.currentRun)
  const replayIndex = useSimulationStore((state) => state.replayIndex)
  const isPlaying = useSimulationStore((state) => state.isPlaying)
  const setPlaying = useSimulationStore((state) => state.setPlaying)
  const setReplayIndex = useSimulationStore((state) => state.setReplayIndex)
  const stepFrame = useSimulationStore((state) => state.stepFrame)
  const setReplaySpeed = useSimulationStore((state) => state.setReplaySpeed)
  const speed = useSimulationStore((state) => state.config.timing.replaySpeed)

  if (!run || run.frames.length === 0) return null

  const maxIndex = run.frames.length - 1
  const safeReplayIndex = Math.min(maxIndex, Math.max(0, replayIndex))
  const frame = run.frames[safeReplayIndex]
  const failureIndex = run.failureTime !== undefined ? run.frames.findIndex((candidate) => candidate.time >= run.failureTime!) : undefined

  return (
    <div className="absolute bottom-4 left-4 right-4 z-30 rounded-md border border-white/15 bg-black/48 p-3 text-white shadow-2xl backdrop-blur-xl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="icon-sm" aria-label="Jump to start" onClick={() => setReplayIndex(0)}><SkipBack className="size-4" /></Button>
          <Button variant="secondary" size="icon-sm" aria-label="Step backward" onClick={() => stepFrame(-1)}><StepBack className="size-4" /></Button>
          <Button className="bg-teal-400 text-[#08110f] hover:bg-teal-300" size="sm" aria-label={isPlaying ? "Pause replay" : "Play replay"} onClick={() => setPlaying(!isPlaying)}>
            {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
            {isPlaying ? "Pause" : "Play"}
          </Button>
          <Button variant="secondary" size="icon-sm" aria-label="Step forward" onClick={() => stepFrame(1)}><StepForward className="size-4" /></Button>
          <Button variant="secondary" size="icon-sm" aria-label="Jump to end" onClick={() => setReplayIndex(maxIndex)}><SkipForward className="size-4" /></Button>
          {failureIndex !== undefined && failureIndex >= 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="destructive" size="icon-sm" aria-label="Jump to failure moment" onClick={() => setReplayIndex(failureIndex)}><Zap className="size-4" /></Button>
              </TooltipTrigger>
              <TooltipContent>Jump to failure moment</TooltipContent>
            </Tooltip>
          )}
          <Button variant="ghost" size="icon-sm" className="text-white hover:bg-white/10 hover:text-white" aria-label="Reset replay to start" onClick={() => setReplayIndex(0)}><RotateCcw className="size-4" /></Button>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between text-xs text-white/70">
            <span>{frame.time.toFixed(2)}s</span>
            <span>{run.failed ? `Failure ${run.failureTime?.toFixed(2)}s` : "Bridge held"}</span>
          </div>
          <Slider aria-label="Replay position" value={[safeReplayIndex]} min={0} max={maxIndex} step={1} onValueChange={(next) => setReplayIndex(next[0] ?? 0)} />
        </div>
        <div className="flex min-w-48 items-center gap-3">
          <span className="w-14 text-xs text-white/68">{speed.toFixed(2)}x</span>
          <Slider aria-label="Playback speed" value={[speed]} min={0.25} max={3} step={0.05} onValueChange={(next) => setReplaySpeed(next[0] ?? speed)} />
        </div>
      </div>
    </div>
  )
}
