import React from "react";

export default function NavButton({ icon, label, active = false, onClick }) {
  return (
    <button
      className={`flex flex-col items-center justify-center gap-1 p-3 rounded-lg transition-all duration-300 
      ${active ? "bg-gradient-to-b from-blue-500 to-blue-700 shadow-lg shadow-blue-500/40 border-b-2 border-blue-300" 
               : "bg-blue-900 hover:bg-blue-700 hover:shadow-md hover:shadow-blue-500/50"}`
      }
      onClick={onClick}
    >
      {/* Icon with Hover Animation */}
      <div className="text-2xl transition-transform duration-200 hover:scale-110">
        {icon}
      </div>

      {/* Label with Stylish Font & Glow Effect */}
      <div
        className="text-[12px] font-semibold text-white tracking-wide uppercase drop-shadow-md"
        style={{ fontFamily: "'NASALIZATION', sans-serif" }}
      >
        {label}
      </div>
    </button>
  );
}
