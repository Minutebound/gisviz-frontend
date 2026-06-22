'use client'
import React from 'react'
import Map from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

interface MapProps {
  longitude: number
  latitude: number
  interactive?: boolean // <-- Add this optional flag
}

export default function MapComponent({ longitude, latitude, interactive = true }: MapProps) {
  return (
    <div className={`w-full h-full overflow-hidden ${interactive ? '' : 'pointer-events-none'}`}>
      <Map
        initialViewState={{
          longitude: longitude,
          latitude: latitude,
          zoom: 10
        }}
        mapStyle="https://demotiles.maplibre.org/style.json"
        style={{ width: '100%', height: '100%' }}
        // Disable all physical interactions if not interactive
        dragPan={interactive}
        scrollZoom={interactive}
        doubleClickZoom={interactive}
        dragRotate={interactive}
      />
    </div>
  )
}