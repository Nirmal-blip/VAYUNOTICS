import React from "react";

export default function ActionButton({ icon, label, onClick, color = "bg-purple-600" }) {
  return (
    <button
      className={`${color} hover:opacity-90 text-white p-3 rounded-lg flex flex-col items-center justify-center w-full transition-all duration-200 transform hover:scale-105`}
      onClick={onClick}
    >
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-sm font-medium" style={{ fontFamily: "'NASALIZATION', sans-serif" }}>
        {label}
      </div>
    </button>
  );
}
