export default function TelemetryItem({ label, value, color, icon }) {
    return (
      <div className="bg-slate-800/70 p-3 rounded-lg border border-slate-700/50 shadow-md hover:shadow-lg hover:border-slate-600/50 transition-all">
        <div className="text-xs text-slate-400 mb-1 flex items-center space-x-1">
          <span className={color}>{icon}</span>
          <span>{label}</span>
        </div>
        <div className="text-xl font-bold">{typeof value === "number" ? value.toFixed(2) : value}</div>
      </div>
    )
  }
  
  