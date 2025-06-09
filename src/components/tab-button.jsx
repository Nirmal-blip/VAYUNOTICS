"use client"

export default function TabButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition-all ${
        active ? "border-b-2 border-cyan-500 text-cyan-400" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
      }`}
    >
      {label}
    </button>
  )
}

