import React from "react";
const TelemetryItem = ({ label, value, color, icon, className }) => (
  <div className={`p-3 bg-slate-800/80 rounded-lg border border-slate-700/40 shadow-md ${className}`}>
    <div className="text-xs text-slate-400">{label}</div>
    <div className={`text-lg font-bold ${color} flex items-center space-x-1 mt-1`}>
      {icon}
      <span>{value}</span>
    </div>
  </div>
);

export default TelemetryItem; 