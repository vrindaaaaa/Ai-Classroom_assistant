import { Link, Outlet } from "react-router-dom";

const navLinks = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/upload", label: "Upload" },
  { to: "/chat", label: "Chat" },
  { to: "/quizzes", label: "Quizzes" },
  { to: "/planner", label: "Planner" },
  { to: "/analytics", label: "Analytics" },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row">
        <aside className="w-full bg-slate-900 p-6 text-white lg:w-64 lg:min-h-screen">
          <h2 className="text-2xl font-semibold">AI Classroom</h2>
          <p className="mt-2 text-sm text-slate-300">Assistant workspace</p>
          <nav className="mt-8 space-y-2">
            {navLinks.map((link) => (
              <Link key={link.to} className="block rounded px-3 py-2 hover:bg-slate-800" to={link.to}>
                {link.label}
              </Link>
            ))}
            <button
              className="mt-6 w-full rounded bg-emerald-500 px-3 py-2 text-left text-sm font-semibold"
              onClick={() => {
                localStorage.removeItem("token");
                window.location.href = "/login";
              }}
            >
              Logout
            </button>
          </nav>
        </aside>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
