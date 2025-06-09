import React, { useState, useEffect } from 'react';
import { Shield, Check, X, Loader2 as Loader2Icon } from 'lucide-react';

const PreflightChecks = ({ telemetry}) => {
  // State Management
  const [preflightChecks, setPreflightChecks] = useState([]);
  const [preflightResults, setPreflightResults] = useState([]);
  const [preflightStatus, setPreflightStatus] = useState('pending');

  // Fetch Initial Checks and Set Up Status Polling
  useEffect(() => {
    // Fetch preflight checks on mount
    fetch('http://localhost:8000/preflight/checks')
      .then((response) => response.json())
      .then((data) => setPreflightChecks(data))
      .catch((error) => console.error('Error fetching checks:', error));

    // Poll preflight status every second878
    const statusInterval = setInterval(() => {
      fetch('http://localhost:8000/preflight/status')
        .then((response) => response.json())
        .then((data) => setPreflightStatus(data))
        .catch((error) => console.error('Error fetching status:', error));
    }, 1000);

    // Cleanup on unmount
    return () => {
      clearInterval(statusInterval);
    };
  }, []);

  // Handle Running Preflight Checks (unchanged)
  const handleRunPreflight = async () => {
    setPreflightStatus('in_progress');
    try {
      const response = await fetch('http://localhost:8000/preflight/execute', {
        method: 'POST',
      });
      const data = await response.json();
      setPreflightResults(data);
    } catch (error) {
      console.error('Error executing checks:', error);
      setPreflightStatus('failed');
    }
  };

  // Handle Manual Check Confirmation (unchanged)
  const confirmManualCheck = async (checkId) => {
    try {
      const response = await fetch(`http://localhost:8000/preflight/confirm/${checkId}`, {
        method: 'POST',
      });
      const result = await response.json();
      setPreflightResults((prev) => [
        ...prev.filter((r) => r.check_id !== checkId),
        result,
      ]);
    } catch (error) {
      console.error('Error confirming manual check:', error);
    }
  };

  // Modified renderCheck to use telemetry prop
  const renderCheck = (check) => {
    const result = preflightResults.find((r) => r.check_id === check.id);
    let value = '';
    let isPassed = false;
    // console.log(check.name)
    // console.log(preflightChecks)

    // Determine real-time sensor values using telemetry prop
    switch (check.name) {
      case 'Verify GPS':
        value = `${telemetry.gps?.fix_type || 0} >= 3`;
        isPassed = (telemetry.gps?.fix_type || 0) >= 3;
        break;
      case 'Gps Sat Count':
        value = `${telemetry.gps?.satellites || 0} Sats`;
        isPassed = (telemetry.gps?.satellites || 0) >= 6;
        break;
      case 'Telemetry Signal':
        value = `${telemetry.radio?.link_quality || 0}%`;
        isPassed = (telemetry.radio?.link_quality || 0) > 60;
        break;
      case 'Battery Level':
        value = `${telemetry.battery_voltage || 0} V, ${telemetry.battery_remaining || 0}%`;
        isPassed =
          (telemetry.battery_voltage || 0) >= 0.5 &&
          (telemetry.battery_remaining || 0) >= 20;
        break;
      default:
        value = 'N/A';
        isPassed = false;
        break;
    }

    return (
      <div
        key={check.id}
        className="p-3 bg-white rounded-xl border border-[#E0E0E0] shadow-sm"
      >
        <div className="flex justify-between items-start">
          <div className="flex items-start space-x-3">
            <div
              className={`mt-1 w-5 h-5 rounded-full flex items-center justify-center ${
                result?.status ? 'bg-green-500' : 'bg-red-500'
              }`}
            >
              {result?.status ? (
                <Check size={12} className="text-white" />
              ) : (
                <X size={12} className="text-white" />
              )}
            </div>
            <div>
              <div className="text-sm font-medium text-[#333333]">{check.name}</div>
              <div className="text-xs text-[#666666]">{check.description}</div>
              {result?.message && (
                <div
                  className={`text-xs mt-1 ${
                    result.status ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {result.message}
                </div>
              )}
              <div
                className={`text-xs mt-1 ${isPassed ? 'text-green-600' : 'text-red-600'}`}
              >
                {value}
              </div>
            </div>
          </div>
          {!result?.status && check.check_type === 'manual' && (
            <button
              onClick={() => confirmManualCheck(check.id)}
              className="px-2 py-1 text-xs bg-[#1E90FF]/10 text-[#1E90FF] rounded-lg hover:bg-[#1E90FF]/20"
            >
              Confirm
            </button>
          )}
        </div>
      </div>
    );
  };

  // Main Component Layout (unchanged)
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white p-3 text-center font-semibold text-[#333333] border-b border-[#E0E0E0] flex items-center justify-center space-x-2 mb-4 rounded-lg shadow-sm">
        <Shield size={16} className="text-[#1E90FF]" />
        <span>PREFLIGHT CHECKS</span>
      </div>

      {/* Status and Checks List */}
      <div className="space-y-4 flex-1 overflow-auto p-4">
        <div
          className={`p-3 rounded-lg border shadow-sm ${
            preflightStatus === 'completed'
              ? 'bg-green-100 border-green-200'
              : preflightStatus === 'failed'
              ? 'bg-red-100 border-red-200'
              : 'bg-amber-100 border-amber-200'
          }`}
        >
          <div className="flex items-center justify-center space-x-2 text-sm">
            {preflightStatus === 'in_progress' ? (
              <Loader2Icon size={16} className="animate-spin text-amber-500" />
            ) : (
              <Shield
                size={16}
                className={
                  preflightStatus === 'completed'
                    ? 'text-green-500'
                    : preflightStatus === 'failed'
                    ? 'text-red-500'
                    : 'text-amber-500'
                }
              />
            )}
            <span className="capitalize">{preflightStatus.replace('_', ' ')}</span>
          </div>
        </div>
        <div className="space-y-3">{preflightChecks.map(renderCheck)}</div>
      </div>

      {/* Run Button */}
      <div className="p-4 border-t border-[#E0E0E0]">
        <button
          className="w-full py-3 bg-gradient-to-r from-[#1E90FF] to-[#6A5ACD] hover:from-[#1C86EE] hover:to-[#5D52B1] rounded-xl text-white font-semibold flex items-center justify-center space-x-2 transition-all duration-300 hover:scale-105 shadow-md disabled:opacity-50 disabled:hover:scale-100"
          onClick={handleRunPreflight}
          disabled={preflightStatus === 'in_progress'}
        >
          {preflightStatus === 'in_progress' ? (
            <Loader2Icon size={16} className="animate-spin" />
          ) : (
            <Shield size={16} />
          )}
          <span>
            {preflightStatus === 'completed'
              ? 'Checks Passed'
              : preflightStatus === 'failed'
              ? 'Retry Preflight'
              : 'Run Preflight Checks'}
          </span>
        </button>
      </div>
    </div>
  );
};

export default PreflightChecks;