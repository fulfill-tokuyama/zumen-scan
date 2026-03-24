export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      <header className="flex items-center border-b border-slate-800 px-4 py-3">
        <span className="text-lg font-bold text-slate-100">
          📐 ZumenScan
        </span>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
