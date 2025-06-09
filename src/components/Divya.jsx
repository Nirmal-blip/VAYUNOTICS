"use client";
import React from "react";
import { useState, useEffect } from "react";
import {
  Database,
  Globe,
  Settings,
  Sliders,
  PlayCircle,
  HelpCircle,
  Plane,
  Home,
  Play,
  ArrowUp,
  MapPin,
  Compass,
  Power,
  AlertTriangle,
  BarChart2,
  Layers,
  Clock,
  Shield,
  Zap,
  Cpu,
  Battery,
  BatteryMedium,
  BatteryLow,
  Gauge,
  Moon,
  Sun,
  X,
  Menu,
  Loader2Icon,
  Check,
} from "lucide-react";
import { FaBolt, FaCog, FaEnvelope, FaPlane, FaChartBar } from "react-icons/fa";
import {
  GoogleMap,
  useLoadScript,
  Marker,
  Polyline,
  InfoWindow,
} from "@react-google-maps/api";

// Mock Google Maps API key - in a real app, use environment variables
const googleAPIKey = "AIzaSyD8_dBNCVPuirF2gJf0nb_d-8zGnHrTGfY";

const containerStyle = {
  width: "100%",
  height: "100%",
};

export default function DivyalinkInterface({
  logs,
  telemetry,
  land,
  takeoff,
  changeAltitude,
}) {
  const [darkMode, setDarkMode] = useState(true);
  const [connected, setConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState("00:00:00");
  const [activeTab, setActiveTab] = useState("DATA");
  const [isArmed, setIsArmed] = useState(false);
  const [preflightStatus, setPreflightStatus] = useState("pending");
  const [preflightResults, setPreflightResults] = useState([]);
  const [preflightChecks, setPreflightChecks] = useState([]);

  const [flyHereMode, setFlyHereMode] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [activeTabButton, setActiveTabButton] = useState("Quick");
  const [batteryLevel, setBatteryLevel] = useState(75); // Mock battery level
  const [droneSpeed, setDroneSpeed] = useState(15.3); // Mock drone speed
  const [waypoints, setWaypoints] = useState([]);
  const [selectedWaypoint, setSelectedWaypoint] = useState(null);
  const [currentLocation, setCurrentLocation] = useState({
    lat: 28.6139,
    lng: 77.209,
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [polygonMode, setPolygonMode] = useState(false);
  const [polygonCorners, setPolygonCorners] = useState([]);
  const [missionAltitude, setMissionAltitude] = useState(50);
  const [overlap, setOverlap] = useState(0.3);
  const [defaultLogs] = useState([
    "System initialized successfully",
    "Checking sensors...",
    "All sensors operational",
    "Ready for connection",
  ]);
  const [defaultTelemetry] = useState({
    altitude: 120.5,
    groundSpeed: 15.3,
    verticalSpeed: 1.2,
    yaw: 45.0,
    satellites: 8,
    latitude: 28.6139,
    longitude: 77.209,
    heading: 90,
  });

  // Use provided telemetry or default values
  const [droneData, setDroneData] = useState({
    altitude: telemetry.altitude || defaultTelemetry.altitude,
    groundSpeed: telemetry.groundSpeed || defaultTelemetry.groundSpeed,
    verticalSpeed: telemetry.verticalSpeed || defaultTelemetry.verticalSpeed,
    yaw: telemetry.yaw || defaultTelemetry.yaw,
    satellites: telemetry.satellites || defaultTelemetry.satellites,
    latitude: telemetry.latitude || defaultTelemetry.latitude,
    longitude: telemetry.longitude || defaultTelemetry.longitude,
    heading: telemetry.heading || defaultTelemetry.heading,
  });
  console.log("Helloo");

  // Mock loading script for Google Maps
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: googleAPIKey,
  });

  console.log("Google Maps API Key:", googleAPIKey, "Is loaded ",isLoaded); // Debugging line

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      const date = new Date();
      const time = date.toLocaleTimeString();
      setCurrentTime(time);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Simulate telemetry updates
  useEffect(() => {
    if (connected) {
      const telemetryTimer = setInterval(() => {
        setDroneData((prev) => ({
          ...prev,
          altitude: Math.max(0, prev.altitude + (Math.random() - 0.5) * 2),
          groundSpeed: Math.max(
            0,
            prev.groundSpeed + (Math.random() - 0.5) * 0.5
          ),
          verticalSpeed: prev.verticalSpeed + (Math.random() - 0.5) * 0.3,
          yaw: (prev.yaw + Math.random() * 2) % 360,
          heading: (prev.heading + (Math.random() - 0.5) * 5) % 360,
          latitude: prev.latitude + (Math.random() - 0.5) * 0.0001,
          longitude: prev.longitude + (Math.random() - 0.5) * 0.0001,
        }));

        // Update battery level (slowly decreasing)
        setBatteryLevel((prev) => Math.max(0, prev - 0.1));

        // Update drone speed
        setDroneSpeed((prev) =>
          Math.max(0, prev + (Math.random() - 0.5) * 0.5)
        );
      }, 2000);

      return () => clearInterval(telemetryTimer);
    }
  }, [connected]);

  // Fetch current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({ lat: latitude, lng: longitude });
        },
        () => {
          // Fallback to default location if geolocation fails
          setCurrentLocation({ lat: 28.6139, lng: 77.209 });
        }
      );
    }
  }, []);

  useEffect(() => {
    const fetchChecks = async () => {
      try {
        const response = await fetch("http://localhost:8000/preflight/checks");
        const checks = await response.json();
        setPreflightChecks(checks);
      } catch (error) {
        console.error("Failed to fetch checks:", error);
      }
    };
    fetchChecks();
  }, []);

  const handleRunPreflight = async () => {
    try {
      setPreflightStatus("in_progress");

      const response = await fetch("http://localhost:8000/preflight/execute", {
        method: "POST",
      });
      const results = await response.json();

      setPreflightResults(results);
      setPreflightStatus(
        results.every((r) => r.status) ? "completed" : "failed"
      );
    } catch (error) {
      console.error("Preflight failed:", error);
      setPreflightStatus("failed");
    }
  };

  const confirmManualCheck = async (checkId) => {
    try {
      await fetch(`http://localhost:8000/preflight/confirm/${checkId}`, {
        method: "POST",
      });
      await handleRunPreflight(); // Refresh status after confirmation
    } catch (error) {
      console.error("Confirmation failed:", error);
    }
  };

  // Handle navigation button clicks
  const handleNavClick = (tab) => {
    setActiveTab(tab);

    // Set appropriate activeTabButton based on the main tab
    if (tab === "DATA") {
      setActiveTabButton("Telemetry");
    } else if (tab === "PLAN") {
      setActiveTabButton("FlightPlan");
    } else if (tab === "SETUP") {
      setActiveTabButton("Status");
    } else if (tab === "CONFIG") {
      setActiveTabButton("Settings"); // Assuming you have a Settings subtab
    } else if (tab === "SIMULATION") {
      setActiveTabButton("Actions");
    } else if (tab === "HELP") {
      setActiveTabButton("Messages");
    }else if (tab === "Pre Flight"){
      setActiveTabButton("Pre Flight")
    }

    // Close sidebar on mobile after selection
    setSidebarOpen(false);

    // Optionally add logging
    if (connected) {
      addLog(`Switched to ${tab} view`);
    }

    // Update status message based on the selected tab
    if (tab === "DATA") {
      setStatusMessage("Displaying real-time telemetry data");
    } else if (tab === "PLAN") {
      setStatusMessage("Flight planning mode - add waypoints on map");
    } else if (tab === "SETUP") {
      setStatusMessage("System configuration and status");
    } else if (tab === "CONFIG") {
      setStatusMessage("Advanced drone configuration");
    } else if (tab === "SIMULATION") {
      setStatusMessage("Mission simulation and control");
    } else if (tab === "HELP") {
      setStatusMessage("System messages and help");
    }
  };

  // Handle tab button clicks
  const handleTabButtonClick = (tabName) => {
    setActiveTabButton(tabName);
    setTimeout(() => setStatusMessage(""), 3000);
  };

  // Toggle arm/disarm
  const toggleArmed = () => {
    setIsArmed(!isArmed);
    setStatusMessage(
      isArmed
        ? "Drone disarmed successfully."
        : "Drone armed successfully. Ready for flight."
    );
    setTimeout(() => setStatusMessage(""), 3000);
  };

  // Handle action buttons
  const handleTakeoff = () => {
    if (takeoff) takeoff();
    setStatusMessage("Takeoff initiated. Ascending to 10m altitude.");
    setTimeout(() => setStatusMessage(""), 3000);

    // Add log entry
    defaultLogs.unshift(
      "Takeoff initiated at " + new Date().toLocaleTimeString()
    );
  };

  const handleLand = () => {
    if (land) land();
    setStatusMessage("Landing sequence initiated. Preparing for descent.");
    setTimeout(() => setStatusMessage(""), 3000);

    // Add log entry
    defaultLogs.unshift(
      "Landing sequence initiated at " + new Date().toLocaleTimeString()
    );
  };

  const handleMissionStart = () => {
    setStatusMessage("Mission started. Executing pre-programmed flight plan.");
    setTimeout(() => setStatusMessage(""), 3000);

    // Add log entry
    defaultLogs.unshift(
      "Mission started at " + new Date().toLocaleTimeString()
    );
  };

  const handleReturnHome = () => {
    setStatusMessage("Return to home activated. Returning to launch point.");
    setTimeout(() => setStatusMessage(""), 3000);

    // Add log entry
    defaultLogs.unshift(
      "Return to home activated at " + new Date().toLocaleTimeString()
    );
  };

  const handleChangeAltitude = () => {
    if (changeAltitude) changeAltitude();
    setStatusMessage("Altitude change requested. Adjusting flight level.");
    setTimeout(() => setStatusMessage(""), 3000);

    // Add log entry
    defaultLogs.unshift(
      "Altitude change requested at " + new Date().toLocaleTimeString()
    );
  };

  const toggleFlyHereMode = () => {
    setFlyHereMode(!flyHereMode);
    setStatusMessage(
      flyHereMode
        ? "Fly Here mode deactivated."
        : "Fly Here mode activated. Click on map to set destination."
    );
    setTimeout(() => setStatusMessage(""), 3000);
  };
  const handleGeneratePolygonMission = async () => {
    try {
      // Convert lng -> lon for backend compatibility
      const formattedPolygon = polygonCorners.map(corner => ({
        lat: corner.lat,
        lon: corner.lng // Convert lng to lon
      }));
  
      const response = await fetch(
        "http://localhost:8000/generate_polygon_mission",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            polygon: formattedPolygon,  // Use the converted coordinates
            altitude: parseFloat(missionAltitude),
            overlap: parseFloat(overlap),
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Unknown error");
      }
  
      const data = await response.json();
      alert("Lawnmower mission generated and started!");
      setPolygonCorners([]);
      setPolygonMode(false);
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };
  const handleFlyHere = async (waypoint) => {
    try {
      const response = await fetch("http://localhost:8000/fly_here", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: waypoint.lat,
          lon: waypoint.lng,
          alt: waypoint.alt || missionAltitude,
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      alert("Navigating to waypoint!");
    } catch (error) {
      alert(error.message);
    }
  };

  const handleReturnToHome = async () => {
    try {
      const response = await fetch("http://localhost:8000/returntohome", {
        method: "POST",
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      alert("Returning to home location!");
    } catch (error) {
      alert(error.message);
    }
  };

  const handleStartMission = async () => {
    try {
      const response = await fetch("http://localhost:8000/start_mission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          waypoints.map((wp) => ({
            lat: wp.lat,
            lon: wp.lng,
            alt: wp.alt || missionAltitude,
          }))
        ),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      alert("Mission started!");
    } catch (error) {
      alert(error.message);
    }
  };
  const handleMapClick = (e) => {
    if (polygonMode) {
      if (polygonCorners.length < 4) {
        const newCorner = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        setPolygonCorners([...polygonCorners, newCorner]);
      }
    } else {
      const newWaypoint = {
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
        alt: missionAltitude,
      };
      setWaypoints([...waypoints, newWaypoint]);
    }
  };

  const removeWaypoint = (index) => {
    const updatedWaypoints = waypoints.filter((_, i) => i !== index);
    setWaypoints(updatedWaypoints);

    // Add log entry
    defaultLogs.unshift(`Waypoint ${index + 1} removed`);
  };

  // Battery icon based on level
  const getBatteryIcon = () => {
    if (batteryLevel > 60) return <Battery className="text-emerald-400" />;
    if (batteryLevel > 20) return <BatteryMedium className="text-amber-400" />;
    return <BatteryLow className="text-red-400" />;
  };

  // Battery color based on level
  const getBatteryColor = () => {
    if (batteryLevel > 60) return "text-emerald-400";
    if (batteryLevel > 20) return "text-amber-400";
    return "text-red-400";
  };

  // Get drone icon for map
  const getDroneIcon = () => {
    if (!window.google) return null;
    return {
      url: "https://maps.google.com/mapfiles/kml/shapes/heliport.png",
      scaledSize: new window.google.maps.Size(40, 40),
    };
  };

  // Get waypoint icon for map
  const getWaypointIcon = () => {
    if (!window.google) return null;
    return {
      url: "https://maps.google.com/mapfiles/kml/shapes/placemark_circle.png",
      scaledSize: new window.google.maps.Size(30, 30),
    };
  };

  return (
    <div className={`fixed inset-0 flex flex-col ${darkMode ? "dark" : ""}`}>
      <style jsx global>{`
        @font-face {
          font-family: "Nasalization";
          src: url("https://fonts.cdnfonts.com/css/nasalization")
            format("woff2");
          font-weight: normal;
          font-style: normal;
        }

        body,
        html {
          margin: 0;
          padding: 0;
          font-family: "Nasalization", sans-serif;
        }

        @keyframes progress {
          0% {
            width: 0%;
          }
          100% {
            width: 100%;
          }
        }

        @keyframes pulse-slow {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }

        @keyframes pulse-fast {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.4;
          }
        }

        @keyframes gradient-shift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }

        .animate-pulse-fast {
          animation: pulse-fast 1.5s ease-in-out infinite;
        }

        .animate-gradient-shift {
          background-size: 200% 200%;
          animation: gradient-shift 5s ease infinite;
        }

        .hover-shadow-glow:hover {
          box-shadow: 0 0 15px rgba(56, 189, 248, 0.5);
        }
      `}</style>

      <div className="flex flex-col h-full bg-white text-slate-900 dark:bg-slate-900 dark:text-white select-none font-['Nasalization'] transition-colors duration-300">
        {/* Mobile Menu Button */}
        <div className="md:hidden fixed top-4 left-4 z-50">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-full bg-white/80 dark:bg-slate-800/80 text-slate-900 dark:text-white shadow-lg backdrop-blur-sm"
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Top Navigation Bar */}
        <div className="flex justify-between items-center bg-white dark:bg-gradient-to-r dark:from-slate-900/90 dark:via-gray-900/80 dark:to-slate-800/90 p-4 border-b border-slate-200 dark:border-slate-700/30 shadow-md backdrop-blur-md z-10">
          {/* Left Section: Navigation Buttons - Hidden on Mobile */}
          <div className="hidden md:flex space-x-2 overflow-x-auto">
            <NavButton
              icon={<Database size={22} />}
              label="DATA"
              active={activeTab === "DATA"}
              onClick={() => handleNavClick("DATA")}
              darkMode={darkMode}
            />
            <NavButton
              icon={<Globe size={22} />}
              label="PLAN"
              active={activeTab === "PLAN"}
              onClick={() => handleNavClick("PLAN")}
              darkMode={darkMode}
            />
            <NavButton
              icon={<Settings size={22} />}
              label="SETUP"
              active={activeTab === "SETUP"}
              onClick={() => handleNavClick("SETUP")}
              darkMode={darkMode}
            />
            <NavButton
              icon={<Sliders size={22} />}
              label="CONFIG"
              active={activeTab === "CONFIG"}
              onClick={() => handleNavClick("CONFIG")}
              darkMode={darkMode}
            />
            <NavButton
              icon={<PlayCircle size={22} />}
              label="SIMULATION"
              active={activeTab === "SIMULATION"}
              onClick={() => handleNavClick("SIMULATION")}
              darkMode={darkMode}
            />
            <NavButton
              icon={<HelpCircle size={22} />}
              label="HELP"
              active={activeTab === "HELP"}
              onClick={() => handleNavClick("HELP")}
              darkMode={darkMode}
            />
          </div>

          {/* Center: Branding */}
          <div className="flex-1 md:flex-none flex justify-center">
            <div className="relative text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 via-blue-500 to-teal-500 tracking-tighter animate-gradient-shift">
              DRONE CONTROL SYSTEM
              <span className="absolute -bottom-2 left-0 text-xs text-slate-600 dark:text-slate-300 font-light tracking-widest opacity-90">
                by Vayunotics
              </span>
              <div className="absolute -inset-2 bg-gradient-to-r from-cyan-500/30 via-blue-500/30 to-teal-500/30 blur-xl opacity-70 animate-pulse-slow dark:block hidden"></div>
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-teal-500/20 blur-md opacity-50 animate-pulse-slow dark:block hidden"></div>
            </div>
          </div>

          {/* Right Section: Theme Toggle and Connection Status */}
          <div className="flex items-center space-x-2 md:space-x-6">
            {/* Theme Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div className="hidden md:flex items-center space-x-4 bg-slate-100 dark:bg-gradient-to-br dark:from-slate-900/80 dark:to-gray-950/80 px-3 md:px-5 py-2 md:py-3 rounded-2xl border border-slate-200 dark:border-slate-600/50 shadow-md dark:shadow-xl dark:backdrop-blur-lg dark:hover:shadow-glow transition-all duration-300">
              <select className="bg-transparent text-slate-700 dark:text-slate-100 text-sm font-semibold focus:outline-none cursor-pointer appearance-none pr-8 hover:text-slate-900 dark:hover:text-white transition-colors duration-200">
                <option value="115200">115200</option>
                <option value="57600">57600</option>
                <option value="9600">9600</option>
              </select>
              <div className="h-6 w-px bg-slate-300 dark:bg-gradient-to-b dark:from-cyan-500/60 dark:to-transparent"></div>
              <div
                className="flex items-center space-x-2 cursor-pointer group"
                onClick={() => setConnected(!connected)}
              >
                <div
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    connected
                      ? "bg-emerald-400 dark:animate-pulse-fast dark:shadow-glow"
                      : "bg-red-400 dark:shadow-md"
                  }`}
                ></div>
                <span className="text-sm font-semibold text-slate-700 dark:text-cyan-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors duration-200">
                  {connected ? "LINKED" : "CONNECT"}
                </span>
              </div>
            </div>

            {/* Mobile Connection Button */}
            <button
              className="md:hidden flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700"
              onClick={() => setConnected(!connected)}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  connected ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                }`}
              ></div>
              <span className="text-xs font-semibold">
                {connected ? "ON" : "OFF"}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Sidebar */}
        <div
          className={`fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-slate-900 shadow-xl transform transition-transform duration-300 ease-in-out ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } md:hidden`}
        >
          <div className="flex flex-col h-full pt-16 pb-6 px-4">
            <div className="flex flex-col space-y-2">
              <MobileNavButton
                icon={<Database size={20} />}
                label="DATA"
                active={activeTab === "DATA"}
                onClick={() => handleNavClick("DATA")}
              />
              <MobileNavButton
                icon={<Globe size={20} />}
                label="PLAN"
                active={activeTab === "PLAN"}
                onClick={() => handleNavClick("PLAN")}
              />
              <MobileNavButton
                icon={<Settings size={20} />}
                label="SETUP"
                active={activeTab === "SETUP"}
                onClick={() => handleNavClick("SETUP")}
              />
              <MobileNavButton
                icon={<Sliders size={20} />}
                label="CONFIG"
                active={activeTab === "CONFIG"}
                onClick={() => handleNavClick("CONFIG")}
              />
              <MobileNavButton
                icon={<PlayCircle size={20} />}
                label="SIMULATION"
                active={activeTab === "SIMULATION"}
                onClick={() => handleNavClick("SIMULATION")}
              />
              <MobileNavButton
                icon={<HelpCircle size={20} />}
                label="HELP"
                active={activeTab === "HELP"}
                onClick={() => handleNavClick("HELP")}
              />
            </div>

            <div className="mt-auto">
              <div className="flex items-center justify-between p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <div className="flex items-center space-x-2">
                  <select className="bg-transparent text-slate-700 dark:text-slate-200 text-sm focus:outline-none cursor-pointer appearance-none">
                    <option value="115200">115200</option>
                    <option value="57600">57600</option>
                    <option value="9600">9600</option>
                  </select>
                </div>
                <button
                  className="flex items-center space-x-1 bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-lg"
                  onClick={() => setConnected(!connected)}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      connected ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                    }`}
                  ></div>
                  <span className="text-sm font-semibold">
                    {telemetry.connected ? "CONNECTED" : "CONNECT"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Status Message Bar */}
        {statusMessage && (
          <div className="bg-slate-100 dark:bg-gradient-to-r dark:from-slate-800 dark:to-slate-900 p-2 text-center text-sm font-medium shadow-md">
            <div className="max-w-4xl mx-auto flex items-center justify-center space-x-2">
              <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500/50 animate-[progress_3s_ease-in-out]"></div>
              </div>
              <span className="whitespace-nowrap">{statusMessage}</span>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Hidden on mobile when showing map */}
          <div
            className={`w-full md:w-1/3 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-gradient-to-b dark:from-slate-900/95 dark:via-gray-900/90 dark:to-slate-800/95 ${
              activeTab === "DATA" ? "block" : "hidden md:flex"
            }`}
          >
            {/* Attitude Indicator */}
            <div className="relative h-1/3 md:h-1/2 bg-white dark:bg-gradient-to-b dark:from-slate-900/90 dark:via-gray-900/80 dark:to-slate-800/90 overflow-hidden border-b border-slate-200 dark:border-slate-800">
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="relative w-48 h-48 md:w-72 md:h-72">
                  {/* 3D Sphere Effect */}
                  <div className="absolute inset-0 rounded-full bg-slate-100 dark:bg-gradient-to-br dark:from-slate-800/70 dark:to-slate-900/70 border border-slate-200 dark:border-slate-700/40 backdrop-blur-sm" />

                  {/* Horizon Disk */}
                  <div className="absolute inset-0 rounded-full overflow-hidden transform-gpu">
                    <div className="absolute inset-0 bg-gradient-to-b from-blue-500/40 via-blue-400/20 to-amber-500/40 dark:from-blue-600/40 dark:via-blue-500/20 dark:to-amber-600/40 backdrop-blur-md" />
                    <div className="absolute inset-0 border border-cyan-500/30 rounded-full" />
                  </div>

                  {/* Crosshair */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-0.5 bg-cyan-400 rounded-full animate-pulse-slow" />
                    <div className="h-20 w-0.5 bg-cyan-400 rounded-full animate-pulse-slow" />
                  </div>

                  {/* Pitch Lines */}
                  <div className="absolute top-[40%] inset-x-0 h-px bg-cyan-300/30" />
                  <div className="absolute top-[45%] inset-x-0 h-px bg-cyan-300/50" />
                  <div className="absolute top-[55%] inset-x-0 h-px bg-cyan-300/50" />
                  <div className="absolute top-[60%] inset-x-0 h-px bg-cyan-300/30" />

                  {/* Status Overlay */}
                  <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-slate-100/95 dark:from-slate-900/95 to-transparent backdrop-blur-md">
                    <div className="flex justify-between items-center px-4">
                      <div
                        className={`text-sm font-semibold tracking-wide ${
                          isArmed
                            ? "text-emerald-500 dark:text-emerald-300"
                            : "text-red-500 dark:text-red-300"
                        } flex items-center space-x-2`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${
                            isArmed
                              ? "bg-emerald-500 animate-pulse"
                              : "bg-red-500 animate-pulse"
                          }`}
                        />
                        <span>{isArmed ? "ARMED" : "DISARMED"}</span>
                      </div>
                      <div className="text-sm text-cyan-600 dark:text-cyan-200 font-semibold">
                        {droneData.altitude.toFixed(1)}m
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Telemetry Data */}
            <div className="flex-1 overflow-auto p-4 bg-white dark:bg-gradient-to-b dark:from-slate-900/95 dark:via-gray-900/90 dark:to-slate-800/95">
              {activeTabButton === "Actions" ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <ActionButton
                      icon={
                        <Plane
                          className="transform hover:scale-110 transition-transform"
                          size={24}
                        />
                      }
                      label="TAKEOFF"
                      onClick={takeoff}
                      className="bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 dark:from-emerald-700 dark:to-emerald-800 dark:hover:from-emerald-600 dark:hover:to-emerald-700"
                    />
                    <ActionButton
                      icon={
                        <Plane
                          className="transform rotate-180 hover:scale-110 transition-transform"
                          size={24}
                        />
                      }
                      label="LAND"
                      onClick={land}
                      className="bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 dark:from-amber-700 dark:to-amber-800 dark:hover:from-amber-600 dark:hover:to-amber-700"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <ActionButton
                      icon={
                        <Play
                          className="transform hover:scale-110 transition-transform"
                          size={24}
                        />
                      }
                      label="MISSION START"
                      onClick={handleStartMission}
                      className="bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 dark:from-blue-700 dark:to-blue-800 dark:hover:from-blue-600 dark:hover:to-blue-700"
                    />
                    <ActionButton
                      icon={
                        <Home
                          className="transform hover:scale-110 transition-transform"
                          size={24}
                        />
                      }
                      label="RETURN HOME"
                      onClick={handleReturnToHome}
                      className="bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 dark:from-indigo-700 dark:to-indigo-800 dark:hover:from-indigo-600 dark:hover:to-indigo-700"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <ActionButton
                      icon={
                        <ArrowUp
                          className="transform hover:scale-110 transition-transform"
                          size={24}
                        />
                      }
                      label="CHANGE ALTITUDE"
                      onClick={changeAltitude}
                      className="bg-gradient-to-br from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500 dark:from-violet-700 dark:to-violet-800 dark:hover:from-violet-600 dark:hover:to-violet-700"
                    />
                    <ActionButton
                      icon={
                        <MapPin
                          className="transform hover:scale-110 transition-transform"
                          size={24}
                        />
                      }
                      label="FLY HERE"
                      onClick={handleFlyHere}
                      className={`${
                        flyHereMode
                          ? "bg-gradient-to-br from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 dark:from-pink-700 dark:to-pink-800 dark:hover:from-pink-600 dark:hover:to-pink-700"
                          : "bg-gradient-to-br from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 dark:from-cyan-700 dark:to-cyan-800 dark:hover:from-cyan-600 dark:hover:to-cyan-700"
                      }`}
                    />
                  </div>
                </div>
              ) : activeTabButton === "Messages" ? (
                <div className="flex flex-col h-full">
                  <div className="bg-slate-100 dark:bg-slate-800/90 p-3 text-center font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700/50 backdrop-blur-md flex items-center justify-center space-x-2 mb-4 rounded-lg">
                    <BarChart2
                      size={16}
                      className="text-cyan-500 dark:text-cyan-400"
                    />
                    <span>SYSTEM MESSAGES</span>
                  </div>
                  <div className="space-y-3 flex-1 overflow-auto">
                    {(logs.length > 0 ? logs : defaultLogs).map(
                      (log, index) => (
                        <div
                          key={index}
                          className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700/80 transition-all duration-200 border border-slate-200 dark:border-slate-700/40"
                        >
                          <div className="text-xs text-cyan-500 dark:text-cyan-400 flex items-center space-x-2">
                            <Clock size={12} />
                            <span>{new Date().toLocaleTimeString()}</span>
                          </div>
                          <div className="text-sm text-slate-700 dark:text-slate-200 mt-1">
                            {log}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ) : activeTabButton === "FlightPlan" ? (
                <div className="flex flex-col h-full">
                  <div className="bg-slate-100 dark:bg-slate-800/90 p-3 text-center font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700/50 backdrop-blur-md flex items-center justify-center space-x-2 mb-4 rounded-lg">
                    <Layers
                      size={16}
                      className="text-cyan-500 dark:text-cyan-400"
                    />
                    <span>FLIGHT PLAN EDITOR</span>
                  </div>
                  <div className="space-y-4 flex-1 overflow-auto">
                    <div>
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center space-x-2">
                        <MapPin
                          size={14}
                          className="text-cyan-500 dark:text-cyan-400"
                        />
                        <span>WAYPOINTS</span>
                      </div>
                      <div className="space-y-2">
                        {waypoints.length > 0 ? (
                          waypoints.map((wp, i) => (
                            <div
                              key={i}
                              className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl flex justify-between items-center border border-slate-200 dark:border-slate-700/40 hover:bg-slate-200 dark:hover:bg-slate-700/80 transition-all duration-200"
                            >
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 rounded-full bg-cyan-500 dark:bg-cyan-500/90 flex items-center justify-center text-xs font-bold text-white">
                                  {i + 1}
                                </div>
                                <span className="text-sm text-slate-700 dark:text-slate-200">
                                  {wp.name}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}
                                </span>
                                <button
                                  onClick={() => removeWaypoint(i)}
                                  className="p-1 bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-800/30"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/40 text-center text-slate-500 dark:text-slate-400">
                            No waypoints added. Click on the map to add
                            waypoints.
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center space-x-2">
                        <Settings
                          size={14}
                          className="text-cyan-500 dark:text-cyan-400"
                        />
                        <span>MISSION PARAMETERS</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/40">
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Altitude
                          </div>
                          <div className="text-sm text-slate-700 dark:text-slate-200 flex items-center space-x-1">
                            <ArrowUp
                              size={12}
                              className="text-cyan-500 dark:text-cyan-400"
                            />
                            <span>50 meters</span>
                          </div>
                        </div>
                        <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/40">
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Speed
                          </div>
                          <div className="text-sm text-slate-700 dark:text-slate-200 flex items-center space-x-1">
                            <Zap
                              size={12}
                              className="text-cyan-500 dark:text-cyan-400"
                            />
                            <span>{droneSpeed.toFixed(1)} m/s</span>
                          </div>
                        </div>
                        <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/40">
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Mission Type
                          </div>
                          <div className="text-sm text-slate-700 dark:text-slate-200 flex items-center space-x-1">
                            <Compass
                              size={12}
                              className="text-cyan-500 dark:text-cyan-400"
                            />
                            <span>Survey</span>
                          </div>
                        </div>
                        <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/40">
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Duration
                          </div>
                          <div className="text-sm text-slate-700 dark:text-slate-200 flex items-center space-x-1">
                            <Clock
                              size={12}
                              className="text-cyan-500 dark:text-cyan-400"
                            />
                            <span>~15 minutes</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 dark:from-cyan-700 dark:to-blue-700 dark:hover:from-cyan-600 dark:hover:to-blue-600 rounded-xl text-white font-semibold flex items-center justify-center space-x-2 transition-all duration-300 hover:scale-105"
                      onClick={handleStartMission}
                    >
                      <Shield size={16} />
                      <span>START MISSION</span>
                    </button>
                  </div>
                </div>
              ) : activeTabButton === "Pre Flight" ? (
                <div className="flex flex-col h-full">
                  <div className="bg-slate-100 dark:bg-slate-800/90 p-3 text-center font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700/50 backdrop-blur-md flex items-center justify-center space-x-2 mb-4 rounded-lg">
                    <Shield
                      size={16}
                      className="text-cyan-500 dark:text-cyan-400"
                    />
                    <span>PREFLIGHT CHECKS</span>
                  </div>

                  <div className="space-y-4 flex-1 overflow-auto p-4">
                    {/* Status Banner */}
                    <div
                      className={`p-3 rounded-lg border ${
                        preflightStatus === "completed"
                          ? "bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800/50"
                          : preflightStatus === "failed"
                          ? "bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800/50"
                          : "bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800/50"
                      }`}
                    >
                      <div className="flex items-center justify-center space-x-2 text-sm">
                        {preflightStatus === "in_progress" ? (
                          <Loader2Icon
                            size={16}
                            className="animate-spin text-amber-500"
                          />
                        ) : (
                          <Shield
                            size={16}
                            className={
                              preflightStatus === "completed"
                                ? "text-green-500"
                                : preflightStatus === "failed"
                                ? "text-red-500"
                                : "text-amber-500"
                            }
                          />
                        )}
                        <span className="capitalize">
                          {preflightStatus.replace("_", " ")}
                        </span>
                      </div>
                    </div>

                    {/* Checks List */}
                    <div className="space-y-3">
                      {preflightChecks.map((check, index) => {
                        const result = preflightResults.find(
                          (r) => r.check_id === check.id
                        );
                        return (
                          <div
                            key={check.id}
                            className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/40"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex items-start space-x-3">
                                <div
                                  className={`mt-1 w-5 h-5 rounded-full flex items-center justify-center ${
                                    result?.status
                                      ? "bg-green-500"
                                      : "bg-red-500"
                                  }`}
                                >
                                  {result?.status ? (
                                    <Check size={12} className="text-white" />
                                  ) : (
                                    <X size={12} className="text-white" />
                                  )}
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                    {check.name}
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {check.description}
                                  </div>
                                  {result?.message && (
                                    <div
                                      className={`text-xs mt-1 ${
                                        result.status
                                          ? "text-green-600 dark:text-green-400"
                                          : "text-red-600 dark:text-red-400"
                                      }`}
                                    >
                                      {result.message}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {!result?.status &&
                                check.check_type === "manual" && (
                                  <button
                                    onClick={() => confirmManualCheck(check.id)}
                                    className="px-2 py-1 text-xs bg-cyan-500/10 text-cyan-500 dark:text-cyan-400 rounded-lg hover:bg-cyan-500/20"
                                  >
                                    Confirm
                                  </button>
                                )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="p-4 border-t border-slate-200 dark:border-slate-700/50">
                    <button
                      className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 dark:from-cyan-700 dark:to-blue-700 dark:hover:from-cyan-600 dark:hover:to-blue-600 rounded-xl text-white font-semibold flex items-center justify-center space-x-2 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                      onClick={handleRunPreflight}
                      disabled={preflightStatus === "in_progress"}
                    >
                      {preflightStatus === "in_progress" ? (
                        <Loader2Icon size={16} className="animate-spin" />
                      ) : (
                        <Shield size={16} />
                      )}
                      <span>
                        {preflightStatus === "completed"
                          ? "Checks Passed"
                          : preflightStatus === "failed"
                          ? "Retry Preflight"
                          : "Run Preflight Checks"}
                      </span>
                    </button>
                  </div>
                </div>
              ) : activeTabButton === "Status" ? (
                <div className="flex flex-col h-full">
                  <div className="bg-slate-100 dark:bg-slate-800/90 p-3 text-center font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700/50 backdrop-blur-md flex items-center justify-center space-x-2 mb-4 rounded-lg">
                    <AlertTriangle
                      size={16}
                      className="text-cyan-500 dark:text-cyan-400"
                    />
                    <span>SYSTEM STATUS</span>
                  </div>
                  <div className="space-y-4 flex-1 overflow-auto">
                    <div className="p-4 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/40">
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center space-x-2">
                        <Cpu
                          size={14}
                          className="text-cyan-500 dark:text-cyan-400"
                        />
                        <span>HARDWARE</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center p-2 bg-white/50 dark:bg-slate-700/30 rounded-lg">
                          <span className="text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                            <Cpu size={12} />
                            <span>CPU</span>
                          </span>
                          <span className="text-emerald-500 dark:text-emerald-400 flex items-center space-x-2">
                            <div className="w-16 h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: "32%" }}
                              />
                            </div>
                            <span>32%</span>
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-white/50 dark:bg-slate-700/30 rounded-lg">
                          <span className="text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                            <Layers size={12} />
                            <span>Memory</span>
                          </span>
                          <span className="text-emerald-500 dark:text-emerald-400 flex items-center space-x-2">
                            <div className="w-16 h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: "45%" }}
                              />
                            </div>
                            <span>45%</span>
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-white/50 dark:bg-slate-700/30 rounded-lg">
                          <span className="text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                            <Database size={12} />
                            <span>Storage</span>
                          </span>
                          <span className="text-emerald-500 dark:text-emerald-400">
                            12GB free
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-white/50 dark:bg-slate-700/30 rounded-lg">
                          <span className="text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                            <Zap size={12} />
                            <span>Temperature</span>
                          </span>
                          <span className="text-amber-500 dark:text-amber-400">
                            42°C
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/40">
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center space-x-2">
                        <Settings
                          size={14}
                          className="text-cyan-500 dark:text-cyan-400"
                        />
                        <span>SENSORS</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center p-2 bg-white/50 dark:bg-slate-700/30 rounded-lg">
                          <span className="text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                            <Globe size={12} />
                            <span>GPS</span>
                          </span>
                          <span className="text-emerald-500 dark:text-emerald-400">
                            8 satellites
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-white/50 dark:bg-slate-700/30 rounded-lg">
                          <span className="text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                            <Compass size={12} />
                            <span>IMU</span>
                          </span>
                          <span className="text-emerald-500 dark:text-emerald-400">
                            Calibrated
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-white/50 dark:bg-slate-700/30 rounded-lg">
                          <span className="text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                            <ArrowUp size={12} />
                            <span>Barometer</span>
                          </span>
                          <span className="text-emerald-500 dark:text-emerald-400">
                            Normal
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-white/50 dark:bg-slate-700/30 rounded-lg">
                          <span className="text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                            <Compass size={12} />
                            <span>Compass</span>
                          </span>
                          <span className="text-amber-500 dark:text-amber-400">
                            Needs Calibration
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Battery Status */}
                    <div className="p-4 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/40">
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center space-x-2">
                        <Battery className="text-cyan-500 dark:text-cyan-400" />
                        <span>BATTERY</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center p-2 bg-white/50 dark:bg-slate-700/30 rounded-lg">
                          <span className="text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                            {getBatteryIcon()}
                            <span>Level</span>
                          </span>
                          <span
                            className={`${getBatteryColor()} font-semibold`}
                          >
                            {batteryLevel.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              batteryLevel > 60
                                ? "bg-emerald-500"
                                : batteryLevel > 20
                                ? "bg-amber-500"
                                : "bg-red-500"
                            }`}
                            style={{ width: `${batteryLevel}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center p-2 bg-white/50 dark:bg-slate-700/30 rounded-lg">
                          <span className="text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                            <Clock size={12} />
                            <span>Estimated Time</span>
                          </span>
                          <span className="text-slate-700 dark:text-slate-300">
                            {Math.floor(batteryLevel / 5)} minutes
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <TelemetryItem
                      label="ALTITUDE (m)"
                      value={telemetry.altitude}
                      color="text-cyan-500 dark:text-cyan-400"
                      icon={<ArrowUp size={14} />}
                      darkMode={darkMode}
                    />
                    <TelemetryItem
                      label="GROUNDSPEED (m/s)"
                      value={telemetry.groundSpeed}
                      color="text-blue-500 dark:text-blue-400"
                      icon={<Gauge size={14} />}
                      darkMode={darkMode}
                    />
                    <TelemetryItem
                      label="DIST TO WP (m)"
                      value={waypoints.length > 0 ? "125.4" : "0.00"}
                      color="text-violet-500 dark:text-violet-400"
                      icon={<MapPin size={14} />}
                      darkMode={darkMode}
                    />
                    <TelemetryItem
                      label="YAW (deg)"
                      value={telemetry.yaw}
                      color="text-amber-500 dark:text-amber-400"
                      icon={<Compass size={14} />}
                      darkMode={darkMode}
                    />
                    <TelemetryItem
                      label="VERTICAL SPEED (m/s)"
                      value={telemetry.verticalSpeed}
                      color="text-emerald-500 dark:text-emerald-400"
                      icon={<ArrowUp size={14} />}
                      darkMode={darkMode}
                    />
                    <TelemetryItem
                      label="BATTERY (%)"
                      value={telemetry.battery.percentage}
                      color={getBatteryColor()}
                      icon={getBatteryIcon()}
                      darkMode={darkMode}
                    />
                    <TelemetryItem
                      label="BATTERY Voltage"
                      value={telemetry.battery.voltage}
                      color={getBatteryColor()}
                      icon={getBatteryIcon()}
                      darkMode={darkMode}
                    />
                    <TelemetryItem
                      label="LATITUDE"
                      value={telemetry.latitude}
                      color="text-indigo-500 dark:text-indigo-400"
                      icon={<Globe size={14} />}
                      darkMode={darkMode}
                    />
                    <TelemetryItem
                      label="LONGITUDE"
                      value={telemetry.longitude}
                      color="text-indigo-500 dark:text-indigo-400"
                      icon={<Globe size={14} />}
                      darkMode={darkMode}
                    />
                  </div>
                  <div className="mt-6 flex justify-center">
                    <button
                      className={`px-6 py-3 rounded-xl font-semibold text-white transition-all duration-300 flex items-center space-x-2 hover:scale-105 ${
                        isArmed
                          ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 dark:from-red-700 dark:to-red-800 dark:hover:from-red-600 dark:hover:to-red-700"
                          : "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 dark:from-emerald-700 dark:to-emerald-800 dark:hover:from-emerald-600 dark:hover:to-emerald-700"
                      }`}
                      onClick={toggleArmed}
                    >
                      <Power
                        size={18}
                        className={
                          isArmed ? "text-red-200" : "text-emerald-200"
                        }
                      />
                      <span>{isArmed ? "DISARM" : "ARM"}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Navigation */}
            <div className="bg-white dark:bg-gradient-to-t dark:from-slate-900/95 dark:via-gray-900/90 dark:to-slate-800/95 border-t border-slate-200 dark:border-slate-700/40 py-4 px-6 backdrop-blur-lg">
              <div className="flex justify-around items-center">
                <TabButton
                  label="Quick"
                  icon={<FaBolt size={22} />}
                  active={activeTabButton === "Quick"}
                  onClick={() => handleTabButtonClick("Quick")}
                  darkMode={darkMode}
                />
                <TabButton
                  label="Actions"
                  icon={<FaCog size={22} />}
                  active={activeTabButton === "Actions"}
                  onClick={() => handleTabButtonClick("Actions")}
                  darkMode={darkMode}
                />
                <TabButton
                  label="Messages"
                  icon={<FaEnvelope size={22} />}
                  active={activeTabButton === "Messages"}
                  onClick={() => handleTabButtonClick("Messages")}
                  darkMode={darkMode}
                />
                <TabButton
                  label="FlightPlan"
                  icon={<FaPlane size={22} />}
                  active={activeTabButton === "FlightPlan"}
                  onClick={() => handleTabButtonClick("FlightPlan")}
                  darkMode={darkMode}
                />
                 <TabButton
                  label="Pre Flight"
                  icon={<FaPlane size={22} />}
                  active={activeTabButton === "Pre Flight"}
                  onClick={() => handleTabButtonClick("Pre Flight")}
                  darkMode={darkMode}
                />
                <TabButton
                  label="Status"
                  icon={<FaChartBar size={22} />}
                  active={activeTabButton === "Status"}
                  onClick={() => handleTabButtonClick("Status")}
                  darkMode={darkMode}
                />
              </div>
            </div>
          </div>

          {/* Right Panel - Map */}
          <div
            className={`w-full md:w-2/3 bg-white dark:bg-slate-900 flex flex-col relative ${
              activeTab === "DATA" ? "hidden md:flex" : "flex"
            }`}
          >
            {isLoaded ? (
              <>
                {" "}
                <div className="absolute top-4 left-4 bg-white p-4 rounded-lg shadow-lg space-y-4 z-10">
                  {/* Mission Controls */}
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPolygonMode(!polygonMode)}
                        className={`flex-1 ${
                          polygonMode ? "bg-purple-600" : "bg-purple-500"
                        } hover:bg-purple-600 text-white font-bold py-2 px-4 rounded`}
                      >
                        {polygonMode
                          ? "🚫 Exit Polygon Mode"
                          : "⬛ Draw Polygon"}
                      </button>
                      <button
                        onClick={handleStartMission}
                        className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
                      >
                        🚀 Start Mission
                      </button>
                    </div>

                    {/* Polygon Mission Parameters */}
                    {polygonCorners.length === 4 && (
                      <div className="space-y-2">
                        <input
                          type="number"
                          value={missionAltitude}
                          onChange={(e) => setMissionAltitude(e.target.value)}
                          placeholder="Altitude (meters)"
                          className="w-full p-2 border rounded"
                        />
                        <input
                          type="number"
                          value={overlap}
                          onChange={(e) => setOverlap(e.target.value)}
                          placeholder="Overlap (0-1)"
                          step="0.1"
                          min="0"
                          max="1"
                          className="w-full p-2 border rounded"
                        />
                        <button
                          onClick={handleGeneratePolygonMission}
                          className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
                        >
                          🌱 Generate Lawnmower Mission
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <GoogleMap
                  mapContainerStyle={containerStyle}
                  center={currentLocation}
                  zoom={14}
                  onClick={handleMapClick}
                  options={{
                    styles: darkMode
                      ? [
                          {
                            elementType: "geometry",
                            stylers: [{ color: "#242f3e" }],
                          },
                          {
                            elementType: "labels.text.stroke",
                            stylers: [{ color: "#242f3e" }],
                          },
                          {
                            elementType: "labels.text.fill",
                            stylers: [{ color: "#746855" }],
                          },
                          {
                            featureType: "water",
                            elementType: "geometry",
                            stylers: [{ color: "#17263c" }],
                          },
                          {
                            featureType: "poi",
                            elementType: "geometry",
                            stylers: [{ color: "#283d4a" }],
                          },
                        ]
                      : [],
                  }}
                >
                  {/* Polygon Corners */}
                  {polygonCorners.map((corner, index) => (
                    <Marker
                      key={`corner-${index}`}
                      position={corner}
                      icon={{
                        url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
                        scaledSize: new window.google.maps.Size(32, 32),
                      }}
                      label={{
                        text: `${index + 1}`,
                        color: "white",
                        fontSize: "12px",
                      }}
                    />
                  ))}
                  {/* Connect waypoints with lines */}
                  {waypoints.length > 1 && (
                    <Polyline
                      path={waypoints}
                      options={{
                        strokeColor: "#3B82F6",
                        strokeWeight: 4,
                        strokeOpacity: 0.9,
                        geodesic: true,
                      }}
                    />
                  )}
                  {/* Generated Mission Waypoints */}
                  {waypoints.map((wp, index) => (
                    <Marker
                      key={index}
                      position={wp}
                      icon={{
                        url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                        scaledSize: new window.google.maps.Size(32, 32),
                      }}
                      label={{
                        text: `${index + 1}`,
                        color: "white",
                        fontSize: "12px",
                      }}
                      onClick={() => setSelectedWaypoint(wp)}
                    />
                  ))}

                  {/* Selected Waypoint InfoWindow */}
                  {selectedWaypoint && (
                    <InfoWindow
                      position={selectedWaypoint}
                      onCloseClick={() => setSelectedWaypoint(null)}
                    >
                      <div className="bg-white p-4 rounded-lg shadow-lg max-w-[300px]">
                        <h3 className="font-bold text-lg mb-2">
                          🎯 Waypoint {waypoints.indexOf(selectedWaypoint) + 1}
                        </h3>
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <p className="text-sm">
                              <span className="font-semibold">
                                🌐 Latitude:
                              </span>
                              {selectedWaypoint.lat?.toFixed(6)}
                            </p>
                            <p className="text-sm">
                              <span className="font-semibold">
                                🌐 Longitude:
                              </span>
                              {selectedWaypoint.lng?.toFixed(6)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleFlyHere(selectedWaypoint)}
                            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded w-full"
                          >
                            ✈️ Fly Here
                          </button>
                        </div>
                      </div>
                    </InfoWindow>
                  )}

                  {/* Drone Marker */}
                  <Marker
                    position={{
                      lat: telemetry.latitude,
                      lng: telemetry.longitude,
                    }}
                    icon={{
                      url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
                      scaledSize: new window.google.maps.Size(40, 40),
                    }}
                    title="Drone Location"
                  />
                </GoogleMap>{" "}
              </>
            ) : (
              <div className="flex items-center justify-center h-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <div className="animate-spin mr-2">
                  <Compass size={24} />
                </div>
                <span>LOADING MAP...</span>
              </div>
            )}

            {/* Overlay for battery and speed indicators */}
            <div className="absolute top-4 right-4 bg-white/80 dark:bg-slate-800/80 p-3 rounded-lg shadow-lg backdrop-blur-sm border border-slate-200 dark:border-slate-700 z-10">
              <div className="flex flex-col space-y-2">
                <div className="flex items-center space-x-2">
                  {getBatteryIcon()}
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Battery
                    </span>
                    <span
                      className={`text-sm font-semibold ${getBatteryColor()}`}
                    >
                      {telemetry.battery.percentage}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Gauge
                    className="text-blue-500 dark:text-blue-400"
                    size={16}
                  />
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Speed
                    </span>
                    <span className="text-sm font-semibold text-blue-500 dark:text-blue-400">
                      {droneSpeed.toFixed(1)} m/s
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <ArrowUp
                    className="text-cyan-500 dark:text-cyan-400"
                    size={16}
                  />
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Altitude
                    </span>
                    <span className="text-sm font-semibold text-cyan-500 dark:text-cyan-400">
                      {telemetry.altitude} m
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Waypoints Panel */}
            <div className="md:hidden absolute bottom-4 left-4 right-4 bg-white/90 dark:bg-slate-800/90 p-3 rounded-lg shadow-lg backdrop-blur-sm border border-slate-200 dark:border-slate-700 z-10 max-h-48 overflow-auto">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-sm">Waypoints</h3>
                <button
                  onClick={handleMissionStart}
                  className="bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-1 px-2 rounded"
                >
                  Start Mission
                </button>
              </div>
              {waypoints.length > 0 ? (
                <div className="space-y-1">
                  {waypoints.map((wp, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center bg-slate-100 dark:bg-slate-700 p-1 rounded text-xs"
                    >
                      <span>
                        {index + 1}: {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}
                      </span>
                      <button
                        onClick={() => removeWaypoint(index)}
                        className="bg-red-500 text-white px-1 rounded"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-xs text-slate-500 dark:text-slate-400">
                  Tap on the map to add waypoints
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Component for navigation buttons
function NavButton({ icon, label, active, onClick, darkMode }) {
  "use client";
  return (
    <button
      className={`px-3 md:px-5 py-2 rounded-full flex items-center space-x-1 md:space-x-2 transition-all duration-300 ${
        active
          ? "bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 shadow-md"
          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
      }`}
      onClick={onClick}
    >
      {icon}
      <span className="font-medium text-sm md:text-base">{label}</span>
    </button>
  );
}

// Component for mobile navigation buttons
function MobileNavButton({ icon, label, active, onClick }) {
  "use client";
  return (
    <button
      className={`p-3 rounded-lg flex items-center space-x-3 transition-all duration-300 w-full ${
        active
          ? "bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 shadow-md"
          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
      }`}
      onClick={onClick}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}

// Component for action buttons
function ActionButton({ icon, label, onClick, className }) {
  "use client";
  return (
    <button
      className={`p-4 rounded-xl text-white font-semibold flex flex-col items-center justify-center space-y-2 transition-all duration-300 hover:scale-105 shadow-md ${className}`}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// Component for tab buttons
function TabButton({ label, icon, active, onClick, darkMode }) {
  return (
    <button
      className={`flex flex-col items-center justify-center space-y-1 px-3 py-2 rounded-lg transition-all duration-300 ${
        active
          ? "bg-slate-100 dark:bg-slate-800 text-cyan-500 dark:text-cyan-400 shadow-md"
          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
      }`}
      onClick={onClick}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

// Component for telemetry items
function TelemetryItem({ label, value, color, icon, darkMode }) {
  "use client";
  return (
    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
        {label}
      </div>
      <div
        className={`text-lg font-semibold ${color} flex items-center space-x-2`}
      >
        {icon}
        <span>{value}</span>
      </div>
    </div>
  );
}
