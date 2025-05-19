import type * as GeoJSON from "geojson"

// Function to get isochrone data from Mapbox API
export async function getIsochrone(lng: number, lat: number, minutes: number): Promise<GeoJSON.FeatureCollection> {
  const profile = "walking"
  const url = `https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${lng},${lat}?contours_minutes=${minutes}&polygons=true&access_token=${process.env.MAPBOX_ACCESS_TOKEN}`

  try {
    const response = await fetch(url)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to fetch isochrone: ${response.status} ${response.statusText} - ${errorText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Isochrone API error:", error)
    throw new Error(`Failed to fetch isochrone: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// Update the getDirections function to properly handle errors
export async function getDirections(
  start: [number, number],
  waypoints: [number, number][],
  profile: "walking" | "cycling" | "driving" = "walking",
) {
  // Create a coordinates string with start, all waypoints, and start again
  const coordinates = [
    `${start[0]},${start[1]}`,
    ...waypoints.map((wp) => `${wp[0]},${wp[1]}`),
    `${start[0]},${start[1]}`,
  ].join(";")

  // Use standard parameters without tidy=false
  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}?geometries=geojson&steps=true&alternatives=false&access_token=${process.env.MAPBOX_ACCESS_TOKEN}`

  try {
    const response = await fetch(url)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to fetch directions: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()

    // Check if routes array exists and has at least one route
    if (!data.routes || data.routes.length === 0) {
      throw new Error("No routes found for the given waypoints")
    }

    return data
  } catch (error) {
    console.error("Directions API error:", error)
    throw new Error(`Failed to fetch directions: ${error instanceof Error ? error.message : String(error)}`)
  }
}
