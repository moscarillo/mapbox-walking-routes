"use client"

import { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Loader2, MapPin, Clock, ArrowUpDown } from "lucide-react"
import { generateRandomPointsInPolygon, kmToMiles, metersToFeet, estimateElevationDifference } from "@/lib/utils"
import { getIsochrone, getDirections } from "@/lib/mapbox-api"
import type { Route } from "@/lib/types"
import type { FeatureCollection, Polygon } from "geojson"

// Initialize mapbox
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || ""

// Route colors
const ROUTE_COLORS = ["#ff6b6b", "#48dbfb", "#1dd1a1"]

export default function MapComponent() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)
  const waypointMarkersRef = useRef<mapboxgl.Marker[]>([])
  const [lng, setLng] = useState(-74.006)
  const [lat, setLat] = useState(40.7128)
  const [zoom, setZoom] = useState(12)
  const [loading, setLoading] = useState(false)
  const [isochroneData, setIsochroneData] = useState<FeatureCollection | null>(null)
  const [routes, setRoutes] = useState<Route[]>([])
  const [activeRouteIndex, setActiveRouteIndex] = useState<string>("0")
  const [error, setError] = useState<string | null>(null)
  const [walkDuration, setWalkDuration] = useState(30) // Default to 30 minutes
  const [mapInitialized, setMapInitialized] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const [useImperial, setUseImperial] = useState(false) // Default to metric

  // Initialize map
  useEffect(() => {
    if (map.current || !mapContainer.current) return

    try {
      console.log("Initializing map with token:", mapboxgl.accessToken ? "Token exists" : "No token")

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [lng, lat],
        zoom: zoom,
      })

      map.current.on("load", () => {
        console.log("Map loaded successfully")
        setMapInitialized(true)

        // Add click event to map
        map.current!.on("click", handleMapClick)

        // Add initial marker
        markerRef.current = new mapboxgl.Marker({ color: "#FF0000" }).setLngLat([lng, lat]).addTo(map.current!)
      })

      map.current.on("error", (e) => {
        console.error("Mapbox error:", e)
        setError("Failed to initialize map. Please check your Mapbox token.")
      })
    } catch (err) {
      console.error("Error initializing map:", err)
      setError("Failed to initialize map. Please try again.")
    }

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [lng, lat, zoom])

  // Handle map click
  const handleMapClick = (e: mapboxgl.MapMouseEvent) => {
    const { lng, lat } = e.lngLat
    setLng(lng)
    setLat(lat)

    // Update marker position
    if (markerRef.current) {
      markerRef.current.setLngLat([lng, lat])
    }

    // Clear previous data
    clearMapLayers()
    setIsochroneData(null)
    setRoutes([])
  }

  // Clear map layers
  const clearMapLayers = () => {
    if (!map.current) return

    // Remove isochrone layer and source
    if (map.current.getLayer("isochrone-fill")) {
      map.current.removeLayer("isochrone-fill")
    }
    if (map.current.getLayer("isochrone-line")) {
      map.current.removeLayer("isochrone-line")
    }
    if (map.current.getSource("isochrone")) {
      map.current.removeSource("isochrone")
    }

    // Remove all possible route layers and sources
    for (let i = 0; i < 10; i++) {
      if (map.current.getLayer(`route-${i}`)) {
        map.current.removeLayer(`route-${i}`)
      }
      if (map.current.getSource(`route-${i}`)) {
        map.current.removeSource(`route-${i}`)
      }
    }

    // Remove all waypoint markers
    waypointMarkersRef.current.forEach((marker) => marker.remove())
    waypointMarkersRef.current = []
  }

  // Show only the active route
  const showActiveRoute = (routeIndex: string) => {
    if (!map.current) return

    const index = Number.parseInt(routeIndex)

    // Hide all routes first
    routes.forEach((_, i) => {
      if (map.current!.getLayer(`route-${i}`)) {
        map.current!.setLayoutProperty(`route-${i}`, "visibility", "none")
      }

      // Hide all waypoint markers
      waypointMarkersRef.current.forEach((marker, markerIndex) => {
        const markerElement = marker.getElement()
        if (Math.floor(markerIndex / 2) === i) {
          markerElement.style.display = "none"
        }
      })
    })

    // Show only the active route
    if (map.current.getLayer(`route-${index}`)) {
      map.current.setLayoutProperty(`route-${index}`, "visibility", "visible")
    }

    // Show only the active route's waypoint markers
    waypointMarkersRef.current.forEach((marker, markerIndex) => {
      const markerElement = marker.getElement()
      if (Math.floor(markerIndex / 2) === index) {
        markerElement.style.display = "block"
      }
    })
  }

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveRouteIndex(value)
    showActiveRoute(value)
  }

  // Handle walk duration change
  const handleWalkDurationChange = (value: number[]) => {
    setWalkDuration(value[0])
  }

  // Handle unit system toggle
  const handleUnitToggle = () => {
    setUseImperial(!useImperial)
  }

  // Format distance based on selected unit system
  const formatDistance = (distanceInMeters: number) => {
    const distanceInKm = distanceInMeters / 1000

    if (useImperial) {
      const distanceInMiles = kmToMiles(distanceInKm)
      return `${distanceInMiles.toFixed(2)} mi`
    } else {
      return `${distanceInKm.toFixed(2)} km`
    }
  }

  // Format elevation based on selected unit system
  const formatElevation = (elevationInMeters: number) => {
    if (useImperial) {
      const elevationInFeet = metersToFeet(elevationInMeters)
      return `${Math.round(elevationInFeet)} ft`
    } else {
      return `${Math.round(elevationInMeters)} m`
    }
  }

  // Filter routes that exceed the user's specified duration
  const filterRoutesByDuration = (routes: Route[], maxDuration: number) => {
    // Convert maxDuration from minutes to seconds for comparison
    const maxDurationSeconds = maxDuration * 60

    return routes.filter((route) => route.duration <= maxDurationSeconds)
  }

  // Generate isochrone and routes
  const generateRoutes = async () => {
    if (!map.current) {
      setError("Map is not initialized. Please refresh the page and try again.")
      return
    }

    setLoading(true)
    setError(null)
    setDebugInfo(null)

    // Clear previous routes from state first
    setRoutes([])
    setActiveRouteIndex("0")

    // Then clear map layers
    clearMapLayers()

    try {
      // Calculate half duration for the isochrone boundary
      // This ensures the round trip will match the total desired duration
      const halfDuration = Math.max(Math.floor(walkDuration / 2), 5) // Ensure minimum of 5 minutes

      console.log(`User selected ${walkDuration} minutes total, using ${halfDuration} minutes for isochrone`)
      setDebugInfo(`Using ${halfDuration} min isochrone for ${walkDuration} min total walk`)

      // Get isochrone data using HALF of the user-specified walk duration
      const isochroneResponse = await getIsochrone(lng, lat, halfDuration)
      setIsochroneData(isochroneResponse)

      // Add isochrone to map
      map.current.addSource("isochrone", {
        type: "geojson",
        data: isochroneResponse,
      })

      map.current.addLayer({
        id: "isochrone-fill",
        type: "fill",
        source: "isochrone",
        layout: {},
        paint: {
          "fill-color": "#5a3fc0",
          "fill-opacity": 0.2,
        },
      })

      map.current.addLayer({
        id: "isochrone-line",
        type: "line",
        source: "isochrone",
        layout: {},
        paint: {
          "line-color": "#5a3fc0",
          "line-width": 2,
        },
      })

      // Generate random points within the isochrone polygon
      const polygon = isochroneResponse.features[0].geometry as Polygon

      // Generate more points than needed to allow for filtering
      const randomPoints = generateRandomPointsInPolygon(polygon, 12)

      // Group points into pairs for potential routes
      const routeWaypoints: [number, number][][] = []
      for (let i = 0; i < randomPoints.length; i += 2) {
        if (i + 1 < randomPoints.length) {
          routeWaypoints.push([randomPoints[i], randomPoints[i + 1]])
        }
      }

      // Get directions for each route with multiple waypoints
      const routePromises = []
      for (const waypoints of routeWaypoints) {
        try {
          const result = await getDirections([lng, lat], waypoints, "walking")
          routePromises.push(result)
        } catch (err) {
          console.error("Error getting directions for waypoints:", waypoints, err)
          // Continue with other waypoints
        }
      }

      // Process all successful routes
      const allRoutes: Route[] = []

      routePromises.forEach((response, index) => {
        const route = response.routes[0]
        const coordinates = route.geometry.coordinates as [number, number][]

        // Estimate elevation difference based on distance
        const elevationDifference = estimateElevationDifference(route.distance)

        allRoutes.push({
          id: index,
          distance: route.distance,
          duration: route.duration,
          coordinates: coordinates,
          waypoints: routeWaypoints[index],
          elevationDifference: elevationDifference,
        })
      })

      // Filter routes to only include those that are within the user's specified duration
      const filteredRoutes = filterRoutesByDuration(allRoutes, walkDuration)

      // If we don't have enough routes, show an error
      if (filteredRoutes.length < 1) {
        setError(
          `Could not find any routes within ${walkDuration} minutes. Try increasing the duration or selecting a different starting point.`,
        )
      } else if (filteredRoutes.length < 3) {
        setError(
          `Could only find ${filteredRoutes.length} routes within ${walkDuration} minutes. Try increasing the duration.`,
        )
        // Show what we have
        addRoutesToMap(filteredRoutes)
      } else {
        // Take the first 3 routes that meet our criteria
        addRoutesToMap(filteredRoutes.slice(0, 3))
      }

      // Fit map to bounds
      const bounds = new mapboxgl.LngLatBounds()
      ;(isochroneResponse.features[0].geometry as Polygon).coordinates[0].forEach((coord: number[]) => {
        bounds.extend([coord[0], coord[1]])
      })
      map.current.fitBounds(bounds, { padding: 50 })
    } catch (err) {
      console.error("Error generating routes:", err)
      setError(`Failed to generate routes: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  // Add routes to the map
  const addRoutesToMap = (routesToAdd: Route[]) => {
    if (!map.current) return

    // Add routes to map
    const newRoutes = routesToAdd.map((route, index) => {
      // Add source and layer for this route
      map.current!.addSource(`route-${index}`, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: route.coordinates,
          },
        },
      })

      map.current!.addLayer({
        id: `route-${index}`,
        type: "line",
        source: `route-${index}`,
        layout: {
          "line-join": "round",
          "line-cap": "round",
          visibility: index === Number.parseInt(activeRouteIndex) ? "visible" : "none",
        },
        paint: {
          "line-color": ROUTE_COLORS[index],
          "line-width": 5,
          "line-opacity": 0.8,
        },
      })

      // Add waypoint markers
      const waypoint1 = route.waypoints![0]
      const waypoint2 = route.waypoints![1]

      const marker1 = new mapboxgl.Marker({ color: ROUTE_COLORS[index] }).setLngLat(waypoint1).addTo(map.current!)

      const marker2 = new mapboxgl.Marker({ color: ROUTE_COLORS[index] }).setLngLat(waypoint2).addTo(map.current!)

      // Store markers for later reference
      waypointMarkersRef.current.push(marker1, marker2)

      // Hide markers for inactive routes
      if (index !== Number.parseInt(activeRouteIndex)) {
        marker1.getElement().style.display = "none"
        marker2.getElement().style.display = "none"
      }

      return route
    })

    setRoutes(newRoutes)
  }

  return (
    <div className="relative w-full h-full">
      {/* Map container with explicit height */}
      <div
        ref={mapContainer}
        className="w-full h-full"
        style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
      />

      {/* Error message if map fails to load */}
      {error && !mapInitialized && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md">
            <h2 className="text-xl font-bold text-red-600 mb-2">Map Error</h2>
            <p>{error}</p>
            <p className="mt-2 text-sm text-gray-600">
              Please check that your Mapbox access token is correctly configured.
            </p>
          </div>
        </div>
      )}

      <div className="absolute top-4 right-4 z-10">
        <Card className="w-80">
          <CardHeader>
            <CardTitle>Walking Routes Generator</CardTitle>
            <CardDescription>
              Click on the map to set a starting point, adjust your walk duration, then generate three unique round-trip
              routes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="h-5 w-5 text-red-500" />
              <span>
                Starting point: {lng.toFixed(4)}, {lat.toFixed(4)}
              </span>
            </div>

            {/* Units toggle */}
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <Label htmlFor="units-toggle" className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4" />
                <span>Units:</span>
              </Label>
              <div className="flex items-center gap-2">
                <span className={!useImperial ? "font-medium" : "text-muted-foreground"}>Metric</span>
                <Switch id="units-toggle" checked={useImperial} onCheckedChange={handleUnitToggle} />
                <span className={useImperial ? "font-medium" : "text-muted-foreground"}>Imperial</span>
              </div>
            </div>

            <div className="mb-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-medium">Total Walk Duration:</span>
                </div>
                <span className="font-medium">{walkDuration} minutes</span>
              </div>

              <Slider
                defaultValue={[30]}
                min={10}
                max={90}
                step={5}
                value={[walkDuration]}
                onValueChange={handleWalkDurationChange}
                className="w-full"
              />

              <div className="flex justify-between text-xs text-muted-foreground">
                <span>10 min</span>
                <span>90 min</span>
              </div>
            </div>

            <Button onClick={generateRoutes} disabled={loading || !mapInitialized} className="w-full mb-4">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Round-Trip Routes"
              )}
            </Button>

            {debugInfo && <p className="text-xs text-blue-600 mb-2">{debugInfo}</p>}
            {error && mapInitialized && <p className="text-red-500 mt-2 text-sm mb-2">{error}</p>}

            {routes.length > 0 && (
              <Tabs value={activeRouteIndex} onValueChange={handleTabChange} className="mt-4">
                <TabsList className="grid grid-cols-3 mb-2">
                  {routes.map((_, index) => (
                    <TabsTrigger key={index} value={index.toString()} className="relative">
                      <div
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                        style={{ backgroundColor: ROUTE_COLORS[index] }}
                      />
                      Route {index + 1}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {routes.map((route, index) => (
                  <TabsContent key={index} value={index.toString()} className="space-y-2">
                    <div className="p-3 bg-muted rounded-md">
                      <div className="font-medium">Route {index + 1} Details:</div>
                      <div className="text-sm mt-1 space-y-1">
                        <div className="flex justify-between">
                          <span>Distance:</span>
                          <span className="font-medium">{formatDistance(route.distance)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Duration:</span>
                          <span className="font-medium">{Math.floor(route.duration / 60)} minutes</span>
                        </div>
                        {route.elevationDifference && route.elevationDifference > 0 && (
                          <div className="flex justify-between">
                            <span>Elevation Change:</span>
                            <span className="font-medium">{formatElevation(route.elevationDifference)}</span>
                          </div>
                        )}
                        <div className="mt-2 text-xs text-muted-foreground">
                          This is a unique round-trip route that starts and ends at your selected point.
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
