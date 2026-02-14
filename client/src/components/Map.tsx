import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface MapViewProps {
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  onMapReady?: (map: mapboxgl.Map) => void;
}

export function MapView({
  initialCenter = { lat: 0, lng: 0 },
  initialZoom = 10,
  onMapReady,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;
    if (map.current) return; // Initialize map only once

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [initialCenter.lng, initialCenter.lat],
      zoom: initialZoom,
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Notify parent when map is ready
    map.current.on("load", () => {
      if (onMapReady && map.current) {
        onMapReady(map.current);
      }
    });

    // Cleanup
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapboxToken]); // Only run once on mount

  // Update map center and marker when initialCenter changes
  useEffect(() => {
    if (!map.current) return;

    // Update center
    map.current.setCenter([initialCenter.lng, initialCenter.lat]);

    // Remove old marker
    if (marker.current) {
      marker.current.remove();
      marker.current = null;
    }

    // Add new marker if not at 0,0 (default/invalid location)
    if (initialCenter.lat !== 0 || initialCenter.lng !== 0) {
      marker.current = new mapboxgl.Marker({ color: "#ef4444" }) // red marker
        .setLngLat([initialCenter.lng, initialCenter.lat])
        .addTo(map.current);
    }
  }, [initialCenter.lat, initialCenter.lng]);

  if (!mapboxToken) {
    return (
      <div className="flex items-center justify-center h-full bg-muted">
        <p className="text-muted-foreground">Mapbox token not configured</p>
      </div>
    );
  }

  return <div ref={mapContainer} className="w-full h-full" />;
}
