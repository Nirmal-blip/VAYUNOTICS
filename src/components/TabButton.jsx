import React from "react";

const TabButton = ({ icon, label, active, onClick, className }) => (
  <button
  onClick={onClick}
  className={`relative flex flex-col items-center px-4 py-2.5 rounded-xl transition-all duration-300 ${
    active
      ? "text-cyan-300 bg-gradient-to-br from-cyan-900/90 to-cyan-800/80 animate-pulse-slow"
      : "text-slate-300 bg-gradient-to-br from-slate-800/70 to-slate-900/70 hover:bg-gradient-to-br hover:from-slate-700/80 hover:to-slate-600/80 hover:text-white"
  }`}
>
  <span className={`text-xl ${active ? "scale-110" : "scale-100"} transition-transform duration-300`}>
    {icon}
  </span>
  <span className={`text-xs font-semibold mt-1 tracking-wide ${active ? "text-cyan-200" : "text-slate-300"}`}>
    {label}
  </span>
  {active && (
    <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
  )}
</button>
);

export default TabButton;