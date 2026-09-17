'use client'

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet-draw';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import ReportSidebar from './ReportSidebar';

export default function MapCanvas() {
  const mapRef = useRef<HTMLDivElement>(null);
  const workerRef = useRef<Worker | null>(null);
  
  const [metrics, setMetrics] = useState<any>(null);
  const [streamContent, setStreamContent] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const generateReport = async (stats: any, lat: number, lon: number) => {
    setIsGenerating(true);
    setStreamContent('');

    try {
      const response = await fetch('/api/deepseek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stats, lat, lon }),
      });

      if (!response.body) throw new Error('Stream failed');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamComplete = false;

      while (!streamComplete) {
        const { value, done } = await reader.read();
        streamComplete = done;
        if (value) {
          setStreamContent((prev) => prev + decoder.decode(value, { stream: true }));
        }
      }
    } catch (error) {
      setStreamContent('Error: Pipeline execution failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    workerRef.current = new Worker(new URL('../lib/spatial/geoblaze-worker.ts', import.meta.url));
    
    workerRef.current.onmessage = (e) => {
      if (e.data.status === 'success') {
        const stats = e.data.data;
        const lat = e.data.lat; 
        const lon = e.data.lon; 
        
        setMetrics(stats);
        generateReport(stats, lat, lon);
      }
    };

    if (!mapRef.current) return;
    
    const map = L.map(mapRef.current, {
      center: [-0.0236, 37.9062],
      zoom: 6,
      zoomControl: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    
    const drawControl = new L.Control.Draw({
      draw: {
        polyline: false,
        marker: false,
        circlemarker: false,
        circle: false,
        rectangle: false,
        polygon: {
          allowIntersection: false,
          shapeOptions: {
            color: '#ffffff',
            fillColor: '#334155',
            fillOpacity: 0.5,
            weight: 2
          }
        }
      },
      edit: { featureGroup: drawnItems }
    });
    
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, (e: any) => {
      drawnItems.clearLayers();
      drawnItems.addLayer(e.layer);
      
      const geojson = e.layer.toGeoJSON();
      const bounds = e.layer.getBounds();
      const center = bounds.getCenter();
      
      if (workerRef.current) {
        workerRef.current.postMessage({ 
          polygonGeometry: geojson,
          lat: center.lat,
          lon: center.lng
        });
      }
    });

    return () => { 
      map.remove(); 
      workerRef.current?.terminate(); 
    };
  }, []);

  return (
    <div className="flex h-screen w-full bg-slate-900 text-crispWhite font-sans">
      <div className="w-[70%] h-full relative" ref={mapRef} />
      <ReportSidebar 
        metrics={metrics} 
        streamContent={streamContent} 
        isGenerating={isGenerating} 
      />
    </div>
  );
}