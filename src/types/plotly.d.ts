declare module "plotly.js-basic-dist-min" {
  import type * as Plotly from "plotly.js"
  const PlotlyModule: typeof Plotly
  export = PlotlyModule
}

declare module "react-plotly.js" {
  import type * as Plotly from "plotly.js"
  import { PureComponent } from "react"
  import type { CSSProperties, ReactNode } from "react"

  export interface Figure {
    data: Plotly.Data[]
    layout: Partial<Plotly.Layout>
    frames: Plotly.Frame[] | null
  }

  export interface PlotParams {
    data: Plotly.Data[]
    layout: Partial<Plotly.Layout>
    frames?: Plotly.Frame[]
    config?: Partial<Plotly.Config>
    revision?: number
    onInitialized?: (figure: Readonly<Figure>, graphDiv: Readonly<HTMLElement>) => void
    onUpdate?: (figure: Readonly<Figure>, graphDiv: Readonly<HTMLElement>) => void
    onPurge?: (figure: Readonly<Figure>, graphDiv: Readonly<HTMLElement>) => void
    onError?: (err: Readonly<Error>) => void
    divId?: string
    className?: string
    style?: CSSProperties
    debug?: boolean
    useResizeHandler?: boolean
  }

  export default class Plot extends PureComponent<PlotParams> {
    render(): ReactNode
  }
}

declare module "react-plotly.js/factory" {
  import type { ComponentType } from "react"
  import type { PlotParams } from "react-plotly.js"

  export default function createPlotlyComponent(plotly: object): ComponentType<PlotParams>
}
