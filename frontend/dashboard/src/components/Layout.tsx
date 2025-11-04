import { NavLink } from "react-router-dom";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <nav className="border-b border-slate-200 bg-white">
        <div className="container h-14 flex items-center gap-4">
          <div className="font-semibold">Trading Pairs</div>
          <div className="text-xs text-slate-500">
            API: {import.meta.env.VITE_API_BASE_URL} · SSE: {import.meta.env.VITE_REALTIME_URL}
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <NavLink to="/" end className={({ isActive }) => `px-2 py-1 rounded ${isActive ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}>Dashboard</NavLink>
            <NavLink
              to="/symbols"
              className={({ isActive }) =>
                `px-2 py-1 rounded ${isActive ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`
              }
            >
              Symbols
            </NavLink>
            <NavLink to="/health" className={({ isActive }) => `px-2 py-1 rounded ${isActive ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}>Health</NavLink>
          </div>
        </div>
      </nav>
      <main className="container py-6">{children}</main>
    </div>
  );
}