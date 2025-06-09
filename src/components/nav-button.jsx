"use client"

export default function NavButton({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1 transition-all ${
        active
          ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-blue-700/20"
          : "text-slate-300 hover:bg-slate-800 hover:text-white"
      }`}
    >
      <span className={active ? "text-cyan-200" : "text-slate-400"}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

