import {
  BarChart3,
  BrainCircuit,
  Database,
  GitBranch,
  Home,
  ShieldCheck
} from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/", label: "Explorer", icon: Home },
  { to: "/analytics", label: "Analytics Lab", icon: BrainCircuit },
  { to: "/pipeline", label: "CI/CD Pipeline", icon: GitBranch },
  { to: "/release", label: "Release Center", icon: ShieldCheck }
];

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-ink">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <Link
            to="/"
            className="flex items-center gap-3 rounded-md transition hover:opacity-90"
            aria-label="Go to Texas School Performance Explorer home"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-public-blue-700 text-white">
              <BarChart3 aria-hidden="true" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-public-blue-800">
                Public Reporting Demo
              </p>
              <p className="text-base font-bold text-ink">
                Texas School Performance Explorer
              </p>
            </div>
          </Link>
          <nav className="flex gap-2 overflow-x-auto" aria-label="Primary">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition",
                      isActive
                        ? "bg-public-blue-50 text-public-blue-800"
                        : "text-slate-600 hover:bg-slate-100 hover:text-ink"
                    ].join(" ")
                  }
                >
                  <Icon aria-hidden="true" className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
            <span className="hidden items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 sm:inline-flex">
              <Database aria-hidden="true" className="h-4 w-4" />
              Public aggregate seed
            </span>
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
