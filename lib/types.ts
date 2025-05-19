export interface RouteStep {
  distance: number
  duration: number
  name: string
  maneuver: {
    instruction: string
    type: string
    location: [number, number]
    [key: string]: any
  }
  [key: string]: any
}
export interface Route {
  id: number
  distance: number
  duration: number
  coordinates: [number, number][] // [lng, lat]
  waypoints?: [number, number][]
  elevationDifference?: number,
  steps?: RouteStep[]
}
