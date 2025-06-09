"use client"
import { useState, useEffect } from 'react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Moon, Sun, DrillIcon as Drone, Wifi, Server, ChevronDown, Loader2 } from 'lucide-react';

const DRONE_TYPES = {
  Keypilot: {
    defaultEndpoint: 'tcp:127.0.0.1:5760',
    ports: [5760, 14550],
  },
  ArduPilot: {
    defaultEndpoint: 'udp:127.0.0.1:14550',
    ports: [14550, 14551],
  },
  PXHawk: {
    defaultEndpoint: 'udp:127.0.0.1:14550',
    ports: [14550, 14560],
  },
};

export default function DroneConnector({ onConnect }) {
  const [selectedType, setSelectedType] = useState('PXHawk');
  const [connectionString, setConnectionString] = useState(
    DRONE_TYPES.PXHawk.defaultEndpoint
  );
  const [darkMode, setDarkMode] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isValidConnectionString, setIsValidConnectionString] = useState(true);
  const navigate = useNavigate();

  // Initialize theme based on user preference
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }
  }, []);

  // Apply theme class to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

  const validateConnectionString = (value) => {
    const regex = /^(tcp|udp):\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{1,5}$/;
    return regex.test(value);
  };

  const connect = async () => {
    if (!validateConnectionString(connectionString)) {
      setIsValidConnectionString(false);
      return;
    }

    setIsConnecting(true);
    try {
      const response = await fetch('/connect-drone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drone_type: selectedType,
          connection_string: connectionString,
        }),
      });

      const result = await response.json();
      onConnect(result.status === 'connected');

      if (result.status === 'connected') {
        navigate('/');
      } else {
        showNotification('Connection failed', 'error');
      }
    } catch (error) {
      showNotification('Connection failed', 'error');
      console.error(error);
    } finally {
      setIsConnecting(false);
    }
  };

  const showNotification = (message, type) => {
    // Simple notification implementation
    alert(message);
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'dark bg-slate-900' : 'bg-gradient-to-br from-blue-50 to-purple-50'} flex items-center justify-center p-4`}>
      {/* Theme toggle button */}
      <button 
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-3 rounded-full bg-white dark:bg-slate-800 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 active:scale-95"
        aria-label="Toggle theme"
      >
        {darkMode ? (
          <Sun className="h-5 w-5 text-yellow-500" />
        ) : (
          <Moon className="h-5 w-5 text-slate-700" />
        )}
      </button>

      <div className="relative w-full max-w-md">
        {/* 3D decorative elements */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-blue-500 dark:bg-blue-600 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-purple-500 dark:bg-purple-600 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-cyan-500 dark:bg-cyan-600 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>

        <div className="bg-white/80 dark:bg-slate-800/80 rounded-2xl shadow-2xl dark:shadow-blue-900/20 p-8 backdrop-blur-sm bg-opacity-90 dark:bg-opacity-90 relative z-10 border border-gray-100/20 dark:border-slate-700/20">
          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-full shadow-lg">
            <Drone className="h-8 w-8 text-white" />
          </div>

          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 text-center mt-4">Drone Connection</h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-8">Connect to your drone using the settings below</p>

          <div className="space-y-6">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Drone Type
              </label>
              <div className="relative">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50/50 dark:bg-slate-700/50 border border-gray-300/50 dark:border-slate-600/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-slate-600/50"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  <div className="flex items-center">
                    <Server className="h-5 w-5 mr-2 text-blue-500 dark:text-blue-400" />
                    <span>{selectedType}</span>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'transform rotate-180' : ''}`} />
                </button>

                {isDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-white/80 dark:bg-slate-700/80 shadow-lg rounded-xl border border-gray-200/20 dark:border-slate-600/20 py-1 max-h-60 overflow-auto custom-scrollbar">
                    {Object.keys(DRONE_TYPES).map((type) => (
                      <div
                        key={type}
                        className={`px-4 py-2 cursor-pointer hover:bg-gray-100/50 dark:hover:bg-slate-600/50 transition-colors duration-200 ${selectedType === type ? 'bg-blue-50/50 dark:bg-slate-600/50 text-blue-600 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'}`}
                        onClick={() => {
                          setSelectedType(type);
                          setConnectionString(DRONE_TYPES[type].defaultEndpoint);
                          setIsDropdownOpen(false);
                        }}
                      >
                        {type}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Connection String
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Wifi className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                </div>
                <input
                  type="text"
                  value={connectionString}
                  onChange={(e) => {
                    setConnectionString(e.target.value);
                    setIsValidConnectionString(validateConnectionString(e.target.value));
                  }}
                  placeholder="Connection string"
                  className={`w-full pl-10 pr-4 py-3 bg-gray-50/50 dark:bg-slate-700/50 border ${isValidConnectionString ? 'border-gray-300/50 dark:border-slate-600/50' : 'border-red-500'} rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-700 dark:text-gray-200`}
                />
              </div>
              {!isValidConnectionString && (
                <p className="mt-2 text-xs text-red-500 dark:text-red-400">
                  Invalid connection string format
                </p>
              )}
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Default port for {selectedType}: {DRONE_TYPES[selectedType].ports.join(', ')}
              </p>
            </div>

            <button
              onClick={connect}
              disabled={isConnecting || !isValidConnectionString}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 px-4 rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnecting ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              ) : (
                'Connect to Drone'
              )}
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Make sure your drone is powered on and within range
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 4px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
      `}</style>
    </div>
  );
}