import { CloudSun, Flame, Gauge, Layers, Mountain, PawPrint, Route, ShieldAlert, Wind } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { bridgeTypeLabels, presets, timeOfDayLabels } from "@/features/bridge-sim/config"
import { useSimulationStore } from "@/store/simulation-store"
import type { BridgeType, DinosaurSide, LoadDistributionMode, QuakeDirection, QuakeWaveform, StressPalette, TimeOfDay } from "@/types/simulation"

type SliderRowProps = {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (value: number) => void
}

function SliderRow({ label, value, min, max, step, unit = "", onChange }: SliderRowProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="font-mono text-xs text-foreground">{value.toFixed(step >= 1 ? 0 : 2)}{unit}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(next) => onChange(next[0] ?? value)} />
    </div>
  )
}

function SwitchRow({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/45 p-3">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

const timeOfDayOptions = Object.keys(timeOfDayLabels) as TimeOfDay[]

function TimeOfDaySlider({ value, onChange }: { value: TimeOfDay; onChange: (value: TimeOfDay) => void }) {
  const currentIndex = Math.max(0, timeOfDayOptions.indexOf(value))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-xs text-muted-foreground">Time of day</Label>
        <span className="text-xs font-medium text-foreground">{timeOfDayLabels[value]}</span>
      </div>
      <Slider
        value={[currentIndex]}
        min={0}
        max={timeOfDayOptions.length - 1}
        step={1}
        onValueChange={(next) => onChange(timeOfDayOptions[next[0] ?? currentIndex] ?? value)}
      />
      <div className="grid grid-cols-5 gap-1 text-center text-[10px] leading-tight text-muted-foreground">
        {timeOfDayOptions.map((option) => (
          <span key={option} className={option === value ? "font-medium text-foreground" : undefined}>
            {timeOfDayLabels[option]}
          </span>
        ))}
      </div>
    </div>
  )
}

export function ControlPanel() {
  const config = useSimulationStore((state) => state.config)
  const updateConfig = useSimulationStore((state) => state.updateConfig)
  const loadPreset = useSimulationStore((state) => state.loadPreset)
  const controlPanelOpen = useSimulationStore((state) => state.controlPanelOpen)
  const setControlPanelOpen = useSimulationStore((state) => state.setControlPanelOpen)

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-border/70 bg-card/76 backdrop-blur-xl">
      <div className="space-y-3 border-b border-border/70 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Scenario</p>
          </div>
        </div>
        <Select onValueChange={loadPreset}>
          <SelectTrigger>
            <SelectValue placeholder="Choose preset" />
          </SelectTrigger>
          <SelectContent>
            {presets.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                {preset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <Accordion type="multiple" value={controlPanelOpen} onValueChange={setControlPanelOpen} className="px-4">
          <AccordionItem value="bridge">
            <AccordionTrigger><span className="flex items-center gap-2"><Mountain className="size-4 text-lime-500" /> Bridge</span></AccordionTrigger>
            <AccordionContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Bridge type</Label>
                <Select value={config.bridge.type} onValueChange={(value) => updateConfig((draft) => ({ ...draft, bridge: { ...draft.bridge, type: value as BridgeType } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(bridgeTypeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <SliderRow label="Span length" value={config.bridge.spanLength} min={28} max={52} step={1} unit="m" onChange={(value) => updateConfig((draft) => ({ ...draft, bridge: { ...draft.bridge, spanLength: value } }))} />
              <SliderRow label="Deck width" value={config.bridge.deckWidth} min={3.2} max={8} step={0.1} unit="m" onChange={(value) => updateConfig((draft) => ({ ...draft, bridge: { ...draft.bridge, deckWidth: value } }))} />
              <SliderRow label="Tower height" value={config.bridge.towerHeight} min={4} max={15} step={0.1} unit="m" onChange={(value) => updateConfig((draft) => ({ ...draft, bridge: { ...draft.bridge, towerHeight: value } }))} />
              <SliderRow label="Structural supports" value={config.bridge.supports} min={2} max={14} step={1} onChange={(value) => updateConfig((draft) => ({ ...draft, bridge: { ...draft.bridge, supports: value } }))} />
              <SliderRow label="Cable sag / tension" value={config.bridge.cableSag} min={0.12} max={0.62} step={0.01} onChange={(value) => updateConfig((draft) => ({ ...draft, bridge: { ...draft.bridge, cableSag: value } }))} />
              <SliderRow label="Support spacing" value={config.bridge.supportSpacing} min={2.5} max={8} step={0.1} unit="m" onChange={(value) => updateConfig((draft) => ({ ...draft, bridge: { ...draft.bridge, supportSpacing: value } }))} />
              <SliderRow label="Stiffness" value={config.bridge.stiffness} min={0.55} max={2.2} step={0.01} onChange={(value) => updateConfig((draft) => ({ ...draft, bridge: { ...draft.bridge, stiffness: value } }))} />
              <SliderRow label="Damping" value={config.bridge.damping} min={0.18} max={1.25} step={0.01} onChange={(value) => updateConfig((draft) => ({ ...draft, bridge: { ...draft.bridge, damping: value } }))} />
              <SliderRow label="Failure threshold" value={config.bridge.failureThreshold} min={0.72} max={1.8} step={0.01} onChange={(value) => updateConfig((draft) => ({ ...draft, bridge: { ...draft.bridge, failureThreshold: value } }))} />
              <SliderRow label="Material strength" value={config.bridge.materialStrength} min={0.65} max={1.7} step={0.01} onChange={(value) => updateConfig((draft) => ({ ...draft, bridge: { ...draft.bridge, materialStrength: value } }))} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="load">
            <AccordionTrigger><span className="flex items-center gap-2"><Gauge className="size-4 text-amber-500" /> Load</span></AccordionTrigger>
            <AccordionContent className="space-y-4">
              <SliderRow label="Total load" value={config.load.totalWeight} min={8} max={140} step={1} unit="t" onChange={(value) => updateConfig((draft) => ({ ...draft, load: { ...draft.load, totalWeight: value } }))} />
              <SliderRow label="Load points" value={config.load.loadPoints} min={1} max={16} step={1} onChange={(value) => updateConfig((draft) => ({ ...draft, load: { ...draft.load, loadPoints: value } }))} />
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Distribution</Label>
                <Select value={config.load.distribution} onValueChange={(value) => updateConfig((draft) => ({ ...draft, load: { ...draft.load, distribution: value as LoadDistributionMode } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="centre">Centre</SelectItem>
                    <SelectItem value="even">Even</SelectItem>
                    <SelectItem value="offset">Offset</SelectItem>
                    <SelectItem value="random">Random</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <SliderRow label="Position bias" value={config.load.bias} min={-0.7} max={0.7} step={0.01} onChange={(value) => updateConfig((draft) => ({ ...draft, load: { ...draft.load, bias: value } }))} />
              <SwitchRow label="Moving load" checked={config.load.movingLoad} onCheckedChange={(checked) => updateConfig((draft) => ({ ...draft, load: { ...draft.load, movingLoad: checked } }))} />
              <SliderRow label="Moving speed" value={config.load.movingSpeed} min={0.05} max={1} step={0.01} onChange={(value) => updateConfig((draft) => ({ ...draft, load: { ...draft.load, movingSpeed: value } }))} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="wind">
            <AccordionTrigger><span className="flex items-center gap-2"><Wind className="size-4 text-cyan-500" /> Wind</span></AccordionTrigger>
            <AccordionContent className="space-y-4">
              <SwitchRow label="Wind enabled" checked={config.wind.enabled} onCheckedChange={(checked) => updateConfig((draft) => ({ ...draft, wind: { ...draft.wind, enabled: checked } }))} />
              <SliderRow label="Wind speed" value={config.wind.speed} min={0} max={70} step={1} unit="kt" onChange={(value) => updateConfig((draft) => ({ ...draft, wind: { ...draft.wind, speed: value } }))} />
              <SliderRow label="Gustiness" value={config.wind.gustiness} min={0} max={1} step={0.01} onChange={(value) => updateConfig((draft) => ({ ...draft, wind: { ...draft.wind, gustiness: value } }))} />
              <SliderRow label="Direction" value={config.wind.direction} min={-90} max={90} step={1} unit="deg" onChange={(value) => updateConfig((draft) => ({ ...draft, wind: { ...draft.wind, direction: value } }))} />
              <SliderRow label="Turbulence" value={config.wind.turbulence} min={0} max={1} step={0.01} onChange={(value) => updateConfig((draft) => ({ ...draft, wind: { ...draft.wind, turbulence: value } }))} />
              <Separator />
              <SwitchRow label="Show particles" checked={config.wind.showParticles} onCheckedChange={(checked) => updateConfig((draft) => ({ ...draft, wind: { ...draft.wind, showParticles: checked } }))} />
              <SliderRow label="Particle count" value={config.wind.particleCount} min={0} max={1600} step={20} onChange={(value) => updateConfig((draft) => ({ ...draft, wind: { ...draft.wind, particleCount: value } }))} />
              <SliderRow label="Particle size" value={config.wind.particleSize} min={0.05} max={0.28} step={0.005} onChange={(value) => updateConfig((draft) => ({ ...draft, wind: { ...draft.wind, particleSize: value } }))} />
              <SliderRow label="Speed multiplier" value={config.wind.particleSpeed} min={0.25} max={2.4} step={0.01} onChange={(value) => updateConfig((draft) => ({ ...draft, wind: { ...draft.wind, particleSpeed: value } }))} />
              <SliderRow label="Trail persistence" value={config.wind.particleTrail} min={0.1} max={1} step={0.01} onChange={(value) => updateConfig((draft) => ({ ...draft, wind: { ...draft.wind, particleTrail: value } }))} />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Particles visualize the same wind speed, gust, direction, and turbulence used by the simulation. Individual particles do not apply separate forces.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="earthquake">
            <AccordionTrigger><span className="flex items-center gap-2"><ShieldAlert className="size-4 text-red-500" /> Earthquake</span></AccordionTrigger>
            <AccordionContent className="space-y-4">
              <SwitchRow label="Earthquake enabled" checked={config.earthquake.enabled} onCheckedChange={(checked) => updateConfig((draft) => ({ ...draft, earthquake: { ...draft.earthquake, enabled: checked } }))} />
              <SliderRow label="Intensity" value={config.earthquake.intensity} min={0} max={1.2} step={0.01} onChange={(value) => updateConfig((draft) => ({ ...draft, earthquake: { ...draft.earthquake, intensity: value } }))} />
              <SliderRow label="Frequency" value={config.earthquake.frequency} min={0.4} max={5} step={0.1} unit="Hz" onChange={(value) => updateConfig((draft) => ({ ...draft, earthquake: { ...draft.earthquake, frequency: value } }))} />
              <SliderRow label="Duration" value={config.earthquake.duration} min={1} max={18} step={0.5} unit="s" onChange={(value) => updateConfig((draft) => ({ ...draft, earthquake: { ...draft.earthquake, duration: value } }))} />
              <div className="grid grid-cols-2 gap-3">
                <Select value={config.earthquake.direction} onValueChange={(value) => updateConfig((draft) => ({ ...draft, earthquake: { ...draft.earthquake, direction: value as QuakeDirection } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vertical">Vertical</SelectItem>
                    <SelectItem value="lateral">Lateral</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={config.earthquake.waveform} onValueChange={(value) => updateConfig((draft) => ({ ...draft, earthquake: { ...draft.earthquake, waveform: value as QuakeWaveform } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sine">Sine</SelectItem>
                    <SelectItem value="pulse">Pulse</SelectItem>
                    <SelectItem value="saw">Saw</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="environment">
            <AccordionTrigger><span className="flex items-center gap-2"><CloudSun className="size-4 text-sky-500" /> Sky</span></AccordionTrigger>
            <AccordionContent className="space-y-4">
              <TimeOfDaySlider
                value={config.environment.timeOfDay}
                onChange={(value) => updateConfig((draft) => ({ ...draft, environment: { ...draft.environment, timeOfDay: value } }))}
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Time of day adjusts the sky tone, sun and moon light, fog colour, water tint, stars, and bridge lights.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="impact">
            <AccordionTrigger><span className="flex items-center gap-2"><Flame className="size-4 text-orange-500" /> Asteroid / Meteor</span></AccordionTrigger>
            <AccordionContent className="space-y-4">
              <SwitchRow label="Meteor impact enabled" checked={config.impact.enabled} onCheckedChange={(checked) => updateConfig((draft) => ({ ...draft, impact: { ...draft.impact, enabled: checked } }))} />
              <SwitchRow label="Show impact effects" checked={config.impact.showEffects} onCheckedChange={(checked) => updateConfig((draft) => ({ ...draft, impact: { ...draft.impact, showEffects: checked } }))} />
              <SliderRow label="Impact time" value={config.impact.impactTime} min={0.8} max={config.timing.duration} step={0.1} unit="s" onChange={(value) => updateConfig((draft) => ({ ...draft, impact: { ...draft.impact, impactTime: value } }))} />
              <SliderRow label="Impact intensity" value={config.impact.intensity} min={0.1} max={1.8} step={0.01} onChange={(value) => updateConfig((draft) => ({ ...draft, impact: { ...draft.impact, intensity: value } }))} />
              <SliderRow label="Blast radius" value={config.impact.radius} min={0.08} max={0.55} step={0.01} onChange={(value) => updateConfig((draft) => ({ ...draft, impact: { ...draft.impact, radius: value } }))} />
              <SliderRow label="Entry speed" value={config.impact.speed} min={24} max={120} step={1} unit="km/s" onChange={(value) => updateConfig((draft) => ({ ...draft, impact: { ...draft.impact, speed: value } }))} />
              <SliderRow label="Entry angle" value={config.impact.angle} min={-85} max={85} step={1} unit="deg" onChange={(value) => updateConfig((draft) => ({ ...draft, impact: { ...draft.impact, angle: value } }))} />
              <SliderRow label="Target bias" value={config.impact.targetBias} min={-0.9} max={0.9} step={0.01} onChange={(value) => updateConfig((draft) => ({ ...draft, impact: { ...draft.impact, targetBias: value } }))} />
              <SliderRow label="Fragment count" value={config.impact.fragmentCount} min={24} max={420} step={4} onChange={(value) => updateConfig((draft) => ({ ...draft, impact: { ...draft.impact, fragmentCount: value } }))} />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Impact force is applied around the target point during the simulation, then replayed with a meteor trail, flash, shockwave, and fragment spray.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="dinosaur">
            <AccordionTrigger><span className="flex items-center gap-2"><PawPrint className="size-4 text-emerald-500" /> Giant Dinosaur</span></AccordionTrigger>
            <AccordionContent className="space-y-4">
              <SwitchRow label="T-Rex attack enabled" checked={config.dinosaur.enabled} onCheckedChange={(checked) => updateConfig((draft) => ({ ...draft, dinosaur: { ...draft.dinosaur, enabled: checked } }))} />
              <SwitchRow label="Show dinosaur" checked={config.dinosaur.showEffects} onCheckedChange={(checked) => updateConfig((draft) => ({ ...draft, dinosaur: { ...draft.dinosaur, showEffects: checked } }))} />
              <SliderRow label="Attack time" value={config.dinosaur.attackTime} min={0} max={config.timing.duration} step={0.1} unit="s" onChange={(value) => updateConfig((draft) => ({ ...draft, dinosaur: { ...draft.dinosaur, attackTime: value } }))} />
              <SliderRow label="Bite intensity" value={config.dinosaur.intensity} min={0.1} max={1.8} step={0.01} onChange={(value) => updateConfig((draft) => ({ ...draft, dinosaur: { ...draft.dinosaur, intensity: value } }))} />
              <SliderRow label="Bite position" value={config.dinosaur.targetBias} min={-0.75} max={0.75} step={0.01} onChange={(value) => updateConfig((draft) => ({ ...draft, dinosaur: { ...draft.dinosaur, targetBias: value } }))} />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Attack side</Label>
                  <Select value={config.dinosaur.side} onValueChange={(value) => updateConfig((draft) => ({ ...draft, dinosaur: { ...draft.dinosaur, side: value as DinosaurSide } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="near">Near side</SelectItem>
                      <SelectItem value="far">Far side</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <SliderRow label="Scale" value={config.dinosaur.scale} min={3.2} max={8} step={0.1} onChange={(value) => updateConfig((draft) => ({ ...draft, dinosaur: { ...draft.dinosaur, scale: value } }))} />
              </div>
              <SliderRow label="Bite frequency" value={config.dinosaur.biteFrequency} min={0.35} max={2.4} step={0.05} unit="Hz" onChange={(value) => updateConfig((draft) => ({ ...draft, dinosaur: { ...draft.dinosaur, biteFrequency: value } }))} />
              <p className="text-xs leading-relaxed text-muted-foreground">
                The T-Rex applies pulsed lateral and downward force near the bite point, using the same replay data that drives the bridge deformation.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="camera">
            <AccordionTrigger><span className="flex items-center gap-2"><Route className="size-4 text-blue-500" /> Camera</span></AccordionTrigger>
            <AccordionContent className="space-y-4">
              <SwitchRow label="Cinematic camera" checked={config.camera.cinematic} onCheckedChange={(checked) => updateConfig((draft) => ({ ...draft, camera: { ...draft.camera, cinematic: checked } }))} />
              <SliderRow label="Auto orbit speed" value={config.camera.autoOrbitSpeed} min={0.02} max={0.42} step={0.01} onChange={(value) => updateConfig((draft) => ({ ...draft, camera: { ...draft.camera, autoOrbitSpeed: value } }))} />
              <SliderRow label="Camera distance" value={config.camera.distance} min={26} max={76} step={1} unit="m" onChange={(value) => updateConfig((draft) => ({ ...draft, camera: { ...draft.camera, distance: value } }))} />
              <SliderRow label="Height bias" value={config.camera.heightBias} min={4} max={24} step={0.5} unit="m" onChange={(value) => updateConfig((draft) => ({ ...draft, camera: { ...draft.camera, heightBias: value } }))} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="overlay">
            <AccordionTrigger><span className="flex items-center gap-2"><Layers className="size-4 text-teal-500" /> Analysis / Overlay</span></AccordionTrigger>
            <AccordionContent className="space-y-4 pb-6">
              <SwitchRow label="Show stress overlay" checked={config.overlay.showStress} onCheckedChange={(checked) => updateConfig((draft) => ({ ...draft, overlay: { ...draft.overlay, showStress: checked } }))} />
              <SliderRow label="Overlay opacity" value={config.overlay.opacity} min={0.08} max={0.9} step={0.01} onChange={(value) => updateConfig((draft) => ({ ...draft, overlay: { ...draft.overlay, opacity: value } }))} />
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Stress palette</Label>
                <Select value={config.overlay.palette} onValueChange={(value) => updateConfig((draft) => ({ ...draft, overlay: { ...draft.overlay, palette: value as StressPalette } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="thermal">Thermal</SelectItem>
                    <SelectItem value="viridis">Viridis</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <SwitchRow label="Highlight critical zones" checked={config.overlay.highlightCritical} onCheckedChange={(checked) => updateConfig((draft) => ({ ...draft, overlay: { ...draft.overlay, highlightCritical: checked } }))} />
              <SwitchRow label="Show support labels" checked={config.overlay.showSupportLabels} onCheckedChange={(checked) => updateConfig((draft) => ({ ...draft, overlay: { ...draft.overlay, showSupportLabels: checked } }))} />
              <SwitchRow label="Show failure zones" checked={config.overlay.showFailureZones} onCheckedChange={(checked) => updateConfig((draft) => ({ ...draft, overlay: { ...draft.overlay, showFailureZones: checked } }))} />
              <Separator />
              <SliderRow label="Duration" value={config.timing.duration} min={6} max={30} step={1} unit="s" onChange={(value) => updateConfig((draft) => ({ ...draft, timing: { ...draft.timing, duration: value } }))} />
              <SliderRow label="Sample density" value={config.timing.sampleDensity} min={12} max={60} step={1} unit="fps" onChange={(value) => updateConfig((draft) => ({ ...draft, timing: { ...draft.timing, sampleDensity: value } }))} />
              <SliderRow label="Replay speed" value={config.timing.replaySpeed} min={0.25} max={3} step={0.05} unit="x" onChange={(value) => updateConfig((draft) => ({ ...draft, timing: { ...draft.timing, replaySpeed: value } }))} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </ScrollArea>
    </div>
  )
}
