'use client'

import { useState, useEffect, useRef } from 'react'
import { MapPin, ExternalLink } from 'lucide-react'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

const DTC_OFFICES = [
  {
    name: 'Legazpi City, Albay',
    address: '2/F Post Telecom Bldg., Lapu Lapu St.',
    coords: [123.7443, 13.1391] as [number, number],
    isMain: true,
  },
  {
    name: 'Camarines Sur',
    address: 'P. Bustamante Rd., Sto. Domingo, Camaligan',
    coords: [123.1667, 13.6333] as [number, number],
    isMain: false,
  },
  {
    name: 'Camarines Norte',
    address: 'DICT Bldg., Carlos II Rd., Brgy. III, Daet',
    coords: [122.9547, 14.1119] as [number, number],
    isMain: false,
  },
  {
    name: 'Catanduanes',
    address: 'Catnet Bldg., San Isidro Village, Virac',
    coords: [124.2311, 13.5833] as [number, number],
    isMain: false,
  },
  {
    name: 'Masbate City',
    address: 'Post Office Compound, Brgy. Bagumbayan',
    coords: [123.6178, 12.3686] as [number, number],
    isMain: false,
  },
  {
    name: 'Sorsogon City',
    address: '2/F SNGC Bldg., Flores St., Capitol Compound',
    coords: [124.0003, 12.9742] as [number, number],
    isMain: false,
  },
]

export function DTCOffices() {
  const [selectedOffice, setSelectedOffice] = useState<typeof DTC_OFFICES[0] | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [MapLib, setMapLib] = useState<any>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])

  // Load Mapbox
  useEffect(() => {
    if (!MAPBOX_TOKEN) return
    import('react-map-gl').then((m) => {
      setMapLib(m)
      setMapReady(true)
    })
  }, [])

  // Add markers when map is ready
  useEffect(() => {
    if (!mapReady || !mapRef.current || !MapLib) return

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove())
    markersRef.current = []

    // Add markers for each office
    DTC_OFFICES.forEach((office) => {
      const el = document.createElement('div')
      el.className = 'custom-marker'
      el.style.cssText = `
        width: ${office.isMain ? '32px' : '24px'};
        height: ${office.isMain ? '32px' : '24px'};
        background: ${office.isMain ? '#3b82f6' : '#06b6d4'};
        border: 3px solid white;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        transition: all 0.2s;
      `
      
      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.2)'
      })
      
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)'
      })

      el.addEventListener('click', () => {
        setSelectedOffice(office)
        mapRef.current?.flyTo({
          center: office.coords,
          zoom: 13,
          duration: 1000,
        })
      })

      const marker = new (MapLib as any).Marker({ element: el })
        .setLngLat(office.coords)
        .addTo(mapRef.current.getMap())

      markersRef.current.push(marker)
    })

    return () => {
      markersRef.current.forEach(marker => marker.remove())
      markersRef.current = []
    }
  }, [mapReady, MapLib])

  const handleOfficeClick = (office: typeof DTC_OFFICES[0]) => {
    setSelectedOffice(office)
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: office.coords,
        zoom: 13,
        duration: 1000,
      })
    }
  }

  const openInGoogleMaps = (coords: [number, number]) => {
    window.open(`https://www.google.com/maps?q=${coords[1]},${coords[0]}`, '_blank')
  }

  if (!MapLib || !mapReady) {
    return (
      <section 
        id="offices" 
        className="py-16 sm:py-20 px-4 sm:px-6 border-t border-white/[.04]" 
        style={{ background: 'rgba(255,255,255,.01)' }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-cyan-400 text-[10px] font-black uppercase tracking-[.35em] mb-4">Find Us</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white">DTC Offices in Bicol Region</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {DTC_OFFICES.map((office) => (
              <div 
                key={office.name}
                className={`rounded-xl p-4 border flex gap-3 transition-colors ${
                  office.isMain 
                    ? 'border-blue-500/25 bg-blue-500/5' 
                    : 'border-white/[.07] hover:bg-white/[.04]'
                }`}
              >
                <span className="text-base flex-shrink-0 mt-0.5">{office.isMain ? '📍' : '🏢'}</span>
                <div>
                  <p className={`font-bold text-sm mb-0.5 ${office.isMain ? 'text-blue-300' : 'text-white'}`}>
                    {office.name}
                    {office.isMain && (
                      <span className="ml-2 text-[9px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded-full uppercase">
                        Main Office
                      </span>
                    )}
                  </p>
                  <p className="text-gray-500 text-xs">{office.address}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  const { Map, NavigationControl } = MapLib

  return (
    <section 
      id="offices" 
      className="py-16 sm:py-20 px-4 sm:px-6 border-t border-white/[.04]" 
      style={{ background: 'rgba(255,255,255,.01)' }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-cyan-400 text-[10px] font-black uppercase tracking-[.35em] mb-4">Find Us</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white">DTC Offices in Bicol Region</h2>
          <p className="text-gray-500 text-sm mt-2">Click on any office or map marker to view location details</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Office List */}
          <div className="space-y-3">
            {DTC_OFFICES.map((office) => (
              <button
                key={office.name}
                onClick={() => handleOfficeClick(office)}
                className={`w-full rounded-xl p-4 border flex gap-3 transition-all text-left ${
                  office.isMain 
                    ? 'border-blue-500/25 bg-blue-500/5' 
                    : 'border-white/[.07] hover:bg-white/[.04]'
                } ${
                  selectedOffice?.name === office.name 
                    ? 'ring-2 ring-cyan-400/50 scale-[1.02]' 
                    : ''
                }`}
              >
                <span className="text-base flex-shrink-0 mt-0.5">{office.isMain ? '📍' : '🏢'}</span>
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-sm mb-0.5 ${office.isMain ? 'text-blue-300' : 'text-white'}`}>
                    {office.name}
                    {office.isMain && (
                      <span className="ml-2 text-[9px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded-full uppercase">
                        Main Office
                      </span>
                    )}
                  </p>
                  <p className="text-gray-500 text-xs mb-2">{office.address}</p>
                  {selectedOffice?.name === office.name && (
                    <div className="flex items-center gap-2 text-[10px] text-cyan-400">
                      <MapPin className="w-3 h-3" />
                      <span className="font-mono">
                        {office.coords[1].toFixed(4)}, {office.coords[0].toFixed(4)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openInGoogleMaps(office.coords)
                        }}
                        className="ml-auto flex items-center gap-1 hover:text-cyan-300 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open in Maps</span>
                      </button>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Map */}
          <div className="relative rounded-2xl overflow-hidden border border-white/10 h-[500px] lg:sticky lg:top-8">
            <Map
              ref={mapRef}
              mapboxAccessToken={MAPBOX_TOKEN}
              initialViewState={{
                longitude: 123.5,
                latitude: 13.0,
                zoom: 7.5,
              }}
              style={{ width: '100%', height: '100%' }}
              mapStyle="mapbox://styles/mapbox/dark-v11"
            >
              <NavigationControl position="top-right" />
            </Map>

            {/* Selected Office Info Overlay */}
            {selectedOffice && (
              <div className="absolute bottom-4 left-4 right-4 bg-[#0d1117]/95 backdrop-blur-md border border-cyan-400/30 rounded-xl p-4 shadow-lg">
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">{selectedOffice.isMain ? '📍' : '🏢'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm mb-1">{selectedOffice.name}</p>
                    <p className="text-gray-400 text-xs mb-2">{selectedOffice.address}</p>
                    <div className="flex items-center gap-2 text-[10px] text-cyan-400 font-mono">
                      <MapPin className="w-3 h-3" />
                      <span>{selectedOffice.coords[1].toFixed(4)}, {selectedOffice.coords[0].toFixed(4)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => openInGoogleMaps(selectedOffice.coords)}
                    className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors px-2 py-1 rounded bg-cyan-400/10 border border-cyan-400/20"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Maps</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
