import dynamic from 'next/dynamic'

const MapCanvas = dynamic(() => import('../components/MapCanvas'), {
  ssr: false,
  loading: () => (
    <div className="h-screen w-full bg-slate-900 flex items-center justify-center">
      <p className="text-brass font-mono text-sm tracking-widest uppercase">Initializing Engine...</p>
    </div>
  )
})

export default function Home() {
  return (
    <main className="h-screen w-full overflow-hidden bg-slate-900">
      <MapCanvas />
    </main>
  )
}