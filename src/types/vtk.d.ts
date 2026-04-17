declare module "vtk.js/Sources/Common/DataModel/PolyData" {
  const vtkPolyData: {
    newInstance: () => {
      setPoints: (points: unknown) => void
      getPointData: () => {
        setScalars: (scalars: unknown) => void
        getScalars: () => { getRange: () => [number, number] }
      }
    }
  }
  export default vtkPolyData
}

declare module "vtk.js/Sources/Common/Core/Points" {
  const vtkPoints: {
    newInstance: () => {
      setData: (data: Float32Array, components: number) => void
    }
  }
  export default vtkPoints
}

declare module "vtk.js/Sources/Common/Core/DataArray" {
  const vtkDataArray: {
    newInstance: (options: { name: string; values: Float32Array }) => unknown
  }
  export default vtkDataArray
}
