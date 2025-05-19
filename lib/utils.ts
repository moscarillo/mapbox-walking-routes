import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import * as turf from "@turf/turf"
import type { Polygon } from "geojson"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Function to generate random points within a polygon
export function generateRandomPointsInPolygon(polygon: Polygon, count: number): [number, number][] {
  const points: [number, number][] = []
  const turfPolygon = turf.polygon(polygon.coordinates)
  const bbox = turf.bbox(turfPolygon)

  while (points.length < count) {
    // Generate a random point within the bounding box
    const lng = bbox[0] + Math.random() * (bbox[2] - bbox[0])
    const lat = bbox[1] + Math.random() * (bbox[3] - bbox[1])
    const point = turf.point([lng, lat])

    // Check if the point is within the polygon
    if (turf.booleanPointInPolygon(point, turfPolygon)) {
      points.push([lng, lat])
    }
  }

  return points
}

// Function to convert kilometers to miles
export function kmToMiles(km: number): number {
  return km * 0.621371
}

// Function to convert meters to feet
export function metersToFeet(meters: number): number {
  return meters * 3.28084
}

// Function to estimate elevation difference based on route distance
// This is a fallback when actual elevation data isn't available
export function estimateElevationDifference(distanceInMeters: number): number {
  // A very rough estimate: assume 10m elevation change per km
  return (distanceInMeters / 1000) * 10
}
