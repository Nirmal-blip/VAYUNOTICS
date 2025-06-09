"use client"

const ActionButton = ({ icon, label, onClick, className }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center p-4 text-white rounded-lg transition-all duration-300 ${className}`}
  >
    {icon}
    <span className="text-sm font-medium mt-2">{label}</span>
  </button>
);


export default ActionButton;

