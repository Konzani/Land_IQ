"use client";

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, FeatureGroup } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';

// Required Leaflet CSS
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

// Fix for missing default icon paths in Next.js/Leaflet integrations
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapProps {
  onPolygonComplete: (geoJson: any) => void;
}

export default function Map({ onPolygonComplete }: MapProps) {
  // Prevent SSR crashes by only rendering Leaflet on the client
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const _onCreated = (e: any) => {
    const { layerType, layer } = e;
    if (layerType === 'polygon') {
      const geoJson = layer.toGeoJSON();
      onPolygonComplete(geoJson);
    }
  };

  if (!isMounted) return null;

  return (
    <MapContainer
      center={[-1.2921, 36.8219]} // Centered on Nairobi
      zoom={13}
      style={{ height: '100%', width: '100%', background: '#0f172a' }} // Slate background behind map
      zoomControl={true}
    >
      {/* 
        ACTIVE BASEMAP: Esri World Imagery (High-Res Satellite) 
        Ideal for tracing accurate agricultural parcel boundaries.
      */}
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EAS, and the GIS User Community"
      />

      {/* 
        ALTERNATIVE BASEMAP: CARTO Dark Matter (No API Key Required) 
        Uncomment this and comment out the Esri layer above if you want a strict dark, minimalist look.
        
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        /> 
      */}

      <FeatureGroup>
        <EditControl
          position="topleft"
          onCreated={_onCreated}
          draw={{
            rectangle: false,
            circle: false,
            circlemarker: false,
            marker: false,
            polyline: false,
            polygon: {
              allowIntersection: false,
              drawError: {
                color: '#ef4444', 
                message: '<strong>Error:</strong> Polygon edges cannot cross!',
              },
              shapeOptions: {
                color: '#d4af37', // Brass accent stroke
                fillColor: '#d4af37',
                fillOpacity: 0.2,
                weight: 2,
              },
            },
          }}
        />
      </FeatureGroup>
    </MapContainer>
  );
}
