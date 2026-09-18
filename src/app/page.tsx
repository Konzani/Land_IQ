import dynamic from 'next/dynamic'

const Workspace = dynamic(() => import('../components/Workspace'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-canvas">
      <p className="font-sheet text-lg text-linen/70">Loading the workspace…</p>
    </div>
  ),
})

export default function Page() {
  return <Workspace />
}
