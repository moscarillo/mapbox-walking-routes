export interface Route {
  id: number
  distance: number
  duration: number
  coordinates: [number, number][] // [lng, lat]
  waypoints?: [number, number][]
  elevationDifference?: number
}
