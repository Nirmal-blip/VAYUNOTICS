"use client";
import { useState, useEffect, useMemo } from "react";
import React from "react";

import axios from "axios";
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
  X,
  Menu,
  Loader2Icon,
  Check,
  AlertCircle,
  Ruler,
} from "lucide-react";
import { FaBolt, FaCog, FaEnvelope, FaPlane, FaChartBar } from "react-icons/fa";
import {
  GoogleMap,
  useLoadScript,
  InfoWindow,
} from "@react-google-maps/api";
import VideoFeed from "./VideoFeed";
import PreflightChecks from "./Preflight";

import { MapContainer, TileLayer, Marker, Polyline, Polygon, useMapEvents, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const droneIcon = new L.Icon({
  iconUrl: 'https://maps.google.com/mapfiles/kml/shapes/heliport.png',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

// Waypoint icon
const waypointIcon = new L.Icon({
  iconUrl: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// Mock Google Maps API key - in a real app, use environment variables
const googleAPIKey = "AIzaSyD8_dBNCVPuirF2gJf0nb_d-8zGnHrTGfY";
// const googleAPIKey = "AIzaSyBzN-QQm82VLEp30jxV2UvNCA3k8C0Hnak";


const containerStyle = {
  width: "100%",
  height: "100%",
};
function MapClickHandler({ handleMapClick, isFlightPlan }) {
  useMapEvents({
    click(e) {
      if (isFlightPlan) {
        handleMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });
  return null;
}

export default function DivyalinkInterface() {
  const [currentTime, setCurrentTime] = useState("00:00:00");
  const [isFlightPlan, setIsFlightPlan] = useState(false);
  const [activeTab, setActiveTab] = useState("DATA");
  const [isArmed, setIsArmed] = useState(false);
  const [preflightStatus, setPreflightStatus] = useState("pending");
  const [preflightResults, setPreflightResults] = useState([]);
  const [preflightChecks, setPreflightChecks] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [flyHereMode, setFlyHereMode] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [activeTabButton, setActiveTabButton] = useState("Quick");
  const [batteryLevel, setBatteryLevel] = useState(75); // Mock battery level
  const [droneSpeed, setDroneSpeed] = useState(15.3); // Mock drone speed
  const [waypoints, setWaypoints] = useState([]);
  const [selectedWaypoint, setSelectedWaypoint] = useState(null);
  const [currentLocation, setCurrentLocation] = useState({
    lat: 13.44,
    lng: 79.47,
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [polygonMode, setPolygonMode] = useState(false);
  const [polygonCorners, setPolygonCorners] = useState([]);
  const [selectedPolygonPoint, setSelectedPolygonPoint] = useState(null);
  const [missionAltitude, setMissionAltitude] = useState(50);
  const [overlap, setOverlap] = useState(0.3);
  const [defaultLogs] = useState([]);
  const [mapZoom, setMapZoom] = useState(14);

  const [connected, setConnected] = useState(false);
  const [telemetry, setTelemetryData] = useState({
    status_messages: [],
    altitude: 0,
    ground_speed: 0,
    vertical_speed: 0,
    heading: 0,
    latitude: 0,
    longitude: 0,
    gps: { fix_type: 0, satellites: 0 },
    battery_voltage: null,
    battery_current: null,
    battery_remaining: null,
    yaw: 0,
    compass: { calibrated: false },
    arming: { armed: false },
    radio: {}
  });
  const [altitude, setAltitude] = useState(10); // Default takeoff altitude
  const [ws, setWs] = useState(null);
  const [flightModes, setFlightModes] = useState({
    mode1: "Stabilize",
    mode2: "AltHold",
    mode3: "Loiter",
  });

  // Failsafe Settings State
  const [failsafeSettings, setFailsafeSettings] = useState({
    battery: "RTL",
    rc: "RTL",
    gcs: "Enabled",
  });

  // Mapping constants
  const FLIGHT_MODE_MAP = {
    Stabilize: 0,
    AltHold: 1,
    Loiter: 2,
    RTL: 3,
    Auto: 4,
  };

  const FAILSAFE_MAP = {
    RTL: 0,
    Land: 1,
    SmartRTL: 2,
    Disabled: 3,
    Enabled: 1,
  };

  // Frame Configuration
  const configureFrame = async () => {
    try {
      const frameTypeResponse = await fetch("http://localhost:8000/set_frame_type/0", {
        method: "POST",
      });
      if (!frameTypeResponse.ok) throw new Error("Failed to set frame type");

      const frameClassResponse = await fetch("http://localhost:8000/set_parameter/FRAME_CLASS/1", {
        method: "POST",
      });
      if (!frameClassResponse.ok) throw new Error("Failed to set frame class");

      alert("Frame configuration applied successfully");
    } catch (error) {
      alert(`Frame configuration failed: ${error.message}`);
    }
  };

  // Flight Modes Handler
  const saveFlightModes = async () => {
    try {
      const responses = await Promise.all([
        fetch(`http://localhost:8000/set_flight_mode/1/${FLIGHT_MODE_MAP[flightModes.mode1]}`, {
          method: "POST",
        }),
        fetch(`http://localhost:8000/set_flight_mode/2/${FLIGHT_MODE_MAP[flightModes.mode2]}`, {
          method: "POST",
        }),
        fetch(`http://localhost:8000/set_flight_mode/3/${FLIGHT_MODE_MAP[flightModes.mode3]}`, {
          method: "POST",
        }),
      ]);

      for (const response of responses) {
        if (!response.ok) throw new Error("Failed to set flight mode");
      }
      alert("Flight modes saved successfully");
    } catch (error) {
      alert(`Failed to save flight modes: ${error.message}`);
    }
  };

  // Failsafe Settings Handler
  const saveFailsafeSettings = async () => {
    try {
      const responses = await Promise.all([
        fetch(
          `http://localhost:8000/set_parameter/FS_BATT_ACTION/${FAILSAFE_MAP[failsafeSettings.battery]
          }`,
          { method: "POST" }
        ),
        fetch(
          `http://localhost:8000/set_parameter/FS_RC_ACTION/${FAILSAFE_MAP[failsafeSettings.rc]}`,
          { method: "POST" }
        ),
        fetch(
          `http://localhost:8000/set_parameter/FS_GCS_ENABLE/${FAILSAFE_MAP[failsafeSettings.gcs]}`,
          { method: "POST" }
        ),
      ]);

      for (const response of responses) {
        if (!response.ok) throw new Error("Failed to set failsafe parameter");
      }
      alert("Failsafe settings saved successfully");
    } catch (error) {
      alert(`Failed to save failsafe settings: ${error.message}`);
    }
  };

  // Set up WebSocket connection
  useEffect(() => {

    const websocket = new WebSocket("ws://localhost:8000/ws");

    websocket.onopen = () => console.log("WebSocket connected");

    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log(message);
      if (message.type === "connection") {
        setConnected(message.connected);
      } else if (message.type === "telemetry") {
        setTelemetryData(prev => ({
          ...prev,  // Preserve existing data
          ...message.data,
          // Maintain status messages if not in new data
        }))
      }
    };

    websocket.onerror = (error) => console.error("WebSocket error:", error);

    websocket.onclose = () => {
      console.log("WebSocket closed");
      setConnected(false);
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };

  }, []);

  useEffect(() => {
    console.log(telemetry);

  }, [telemetry])

  // Send takeoff command
  const sendTakeoff = () => {
    const altitude = prompt("Enter new altitude in meters:");
    if (altitude && !isNaN(altitude)) {
      fetch(`http://localhost:8000/takeoff/${altitude}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
        .then((response) => response.json())
        .then((data) => alert(data.message))
        .catch((error) => alert("Error during takeoff: " + error));
    }
  };

  // Send land command
  const sendLand = () => {
    fetch("http://localhost:8000/land", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then((response) => response.json())
      .then((data) => alert(data.message))
      .catch((error) => alert("Error during landing: " + error));
  };

  // Use provided telemetry or default values

  // Mock loading script for Google Maps
  const isLoaded = true;

  // Calculate distances between polygon points
  const calculateDistances = useMemo(() => {
    const distances = [];

    if (polygonCorners.length < 2) return distances;

    for (let i = 0; i < polygonCorners.length; i++) {
      const nextIndex = (i + 1) % polygonCorners.length;
      const point1 = polygonCorners[i];
      const point2 = polygonCorners[nextIndex];

      // Haversine formula to calculate distance between two coordinates
      const R = 6371000; // Earth radius in meters
      const lat1 = (point1.lat * Math.PI) / 180;
      const lat2 = (point2.lat * Math.PI) / 180;
      const deltaLat = ((point2.lat - point1.lat) * Math.PI) / 180;
      const deltaLng = ((point2.lng - point1.lng) * Math.PI) / 180;

      const a =
        Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLng / 2) *
        Math.sin(deltaLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      distances.push({
        from: i,
        to: nextIndex,
        distance: distance.toFixed(2),
      });
    }

    return distances;
  }, [polygonCorners]);

  // Calculate total distance between waypoints
  const totalWaypointDistance = useMemo(() => {
    let total = 0;

    if (waypoints.length < 2) return total;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const point1 = waypoints[i];
      const point2 = waypoints[i + 1];

      // Haversine formula
      const R = 6371000; // Earth radius in meters
      const lat1 = (point1.lat * Math.PI) / 180;
      const lat2 = (point2.lat * Math.PI) / 180;
      const deltaLat = ((point2.lat - point1.lat) * Math.PI) / 180;
      const deltaLng = ((point2.lng - point1.lng) * Math.PI) / 180;

      const a =
        Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLng / 2) *
        Math.sin(deltaLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      total += distance;
    }

    return total.toFixed(2);
  }, [waypoints]);

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

  // Update battery level (slowly decreasing)

  // Fetch current location
  // useEffect(() => {
  //   if (navigator.geolocation) {
  //     navigator.geolocation.getCurrentPosition(
  //       (position) => {
  //         const { latitude, longitude } = position.coords;
  //         setCurrentLocation({ lat: latitude, lng: longitude });
  //       },
  //       () => {
  //         // Fallback to default location if geolocation fails
  //         setCurrentLocation({ lat: 28.6139, lng: 77.209 });
  //       }
  //     );
  //   }
  // }, []);

  useEffect(() => {
    if (telemetry.latitude && telemetry.longitude && !isNaN(telemetry.latitude) && !isNaN(telemetry.longitude)) {
      setCurrentLocation({
        lat: telemetry.latitude,
        lng: telemetry.longitude,
      });
    }
  }, [telemetry.latitude, telemetry.longitude]);

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
    } else if (tab === "Pre Flight") {
      setActiveTabButton("Pre Flight");
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

  const handleGeneratePolygonMission = async () => {
    try {
      // Convert lng -> lon for backend compatibility
      const formattedPolygon = polygonCorners.map((corner) => ({
        lat: corner.lat,
        lon: corner.lng, // Convert lng to lon
      }));

      const response = await fetch(
        "http://localhost:8000/generate_polygon_mission",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            polygon: formattedPolygon, // Use the converted coordinates
            altitude: Number.parseFloat(missionAltitude),
            overlap: Number.parseFloat(overlap),
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

  // const handleMapClick = (e) => {
  //   if (activeTabButton === "FlightPlan") {
  //     if (polygonMode) {
  //       const newCorner = {
  //         lat: e.latLng.lat(),
  //         lng: e.latLng.lng(),
  //         alt: missionAltitude,
  //       };
  //       setPolygonCorners([...polygonCorners, newCorner]);
  //     } else {
  //       const newWaypoint = {
  //         lat: e.latLng.lat(),
  //         lng: e.latLng.lng(),
  //         alt: missionAltitude,
  //       };
  //       setWaypoints([...waypoints, newWaypoint]);
  //     }
  //   }
  // };
  const handleMapClick = (coords) => {
    if (isFlightPlan) {
      const newPoint = { lat: coords.lat, lng: coords.lng }; // Keep as object for state
      if (activeTabButton === 'FlightPlan' && !polygonMode) {
        setWaypoints([...waypoints, newPoint]);
      } else if (polygonMode) {
        setPolygonCorners([...polygonCorners, newPoint]);
      }
    }
  };

  const removeWaypoint = (index) => {
    const updatedWaypoints = waypoints.filter((_, i) => i !== index);
    setWaypoints(updatedWaypoints);

    // Add log entry
    defaultLogs.unshift(`Waypoint ${index + 1} removed`);
  };

  const removePolygonPoint = (index) => {
    const updatedPoints = polygonCorners.filter((_, i) => i !== index);
    setPolygonCorners(updatedPoints);
    setSelectedPolygonPoint(null);

    // Add log entry
    defaultLogs.unshift(`Polygon point ${index + 1} removed`);
  };

  // Battery icon based on level
  const getBatteryIcon = () => {
    if (batteryLevel > 60) return <Battery className="text-emerald-500" />;
    if (batteryLevel > 20) return <BatteryMedium className="text-amber-500" />;
    return <BatteryLow className="text-red-500" />;
  };

  // Battery color based on level
  const getBatteryColor = () => {
    if (batteryLevel > 60) return "text-emerald-500";
    if (batteryLevel > 20) return "text-amber-500";
    return "text-red-500";
  };

  // Get drone icon for map
  const getDroneIcon = () => {
    if (!window.google) return null;
    return {
      url: "https://maps.google.com/mapfiles/kml/shapes/heliport.png",
      scaledSize: new window.google.maps.Size(60, 60), // Increased size for better visibility
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

  // Focus on drone location
  const focusOnDrone = () => {
    setMapZoom(18); // Zoom in closer
    setCurrentLocation({
      lat: telemetry.latitude,
      lng: telemetry.longitude,
    });
    setStatusMessage("Focusing on drone location");
    setTimeout(() => setStatusMessage(""), 3000);
  };

  const [addLog] = useState((logMessage) => {
    console.log("Log:", logMessage);
  });

  return (
    <div className="fixed inset-0 flex flex-col">
      <style>{`
        @import "tailwindcss";
        @import 'leaflet/dist/leaflet.css';

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
          from { width: 100%; }
          to { width: 0%; }
        }
        
        .shadow-glow {
          filter: drop-shadow(0 0 6px currentColor);
        }
        
        .animate-progress {
          animation: progress 3s linear forwards;
        }
        
        .backdrop-blur-sm {
          backdrop-filter: blur(4px);
        }
        
        .accent-purple-500 {
          accent-color: #a855f7;
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
        
        /* Responsive fixes */
        @media (max-width: 640px) {
          .mobile-hidden {
            display: none;
          }
          
          .mobile-full {
            width: 100%;
          }
          
          .mobile-text-sm {
            font-size: 0.875rem;
          }
          
          .mobile-p-2 {
            padding: 0.5rem;
          }
        }
      `}</style>

      <div className="flex flex-col min-h-screen bg-white text-[#333333] select-none font-['Nasalization'] transition-colors duration-300">
        {/* Mobile Menu Button */}
        <div className="fixed top-4 left-4 z-50">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-full bg-white/80 text-slate-900 shadow-lg backdrop-blur-sm"
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Top Navigation Bar */}
        <div className="flex justify-between items-center bg-white p-4 border-b border-[#E0E0E0] z-10">
          {/* Center: Branding */}
          <div className="flex-1 flex justify-center">
            <div className="relative text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#1E90FF] to-[#6A5ACD] tracking-tighter">
              DRONE CONTROL SYSTEM
              <span className="absolute -bottom-2 left-0 text-xs text-[#666666] font-light tracking-widest opacity-90">
                by Vayunotics
              </span>
            </div>
          </div>

          {/* Right Section: Connection Status */}
          <div className="flex items-center space-x-2 md:space-x-6">
            {/* Desktop Connection Status */}
            <div className="hidden md:flex items-center space-x-4 bg-white px-3 md:px-5 py-2 md:py-3 rounded-2xl border border-[#E0E0E0] shadow-sm hover:shadow-md transition-shadow duration-300">
              <select className="bg-transparent text-[#333333] text-sm font-semibold focus:outline-none cursor-pointer appearance-none pr-8 hover:text-[#1E90FF] transition-colors duration-200">

                <option value="57600">57600</option>

              </select>
              <div className="h-6 w-px bg-[#E0E0E0]"></div>
              <div
                className="flex items-center space-x-2 cursor-pointer group"
                onClick={() => setConnected(!connected)}
              >
                <div
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${connected ? "bg-[#1E90FF] animate-pulse" : "bg-red-500"
                    }`}
                ></div>
                <span
                  className={`text-sm font-semibold transition-colors duration-200 ${connected
                    ? "text-[#1E90FF] group-hover:text-[#1C86EE]"
                    : "text-[#333333] group-hover:text-red-600"
                    }`}
                >
                  {connected ? "LINKED" : "CONNECT"}
                </span>
              </div>
            </div>

            {/* Mobile Connection Button */}
            <button
              className="md:hidden flex items-center space-x-1 bg-white px-2 py-1 rounded-lg border border-[#E0E0E0] hover:bg-[#E6F0FA] transition-colors duration-300"
              onClick={() => setConnected(!connected)}
            >
              <div
                className={`w-2 h-2 rounded-full ${connected ? "bg-[#1E90FF] animate-pulse" : "bg-red-500"
                  }`}
              ></div>
              <span
                className={`text-xs font-semibold ${connected ? "text-[#1E90FF]" : "text-[#333333]"
                  }`}
              >
                {connected ? "ON" : "OFF"}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Sidebar */}
        <div
          className={`fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
        >
          <div className="flex flex-col h-full pt-16 pb-6 px-4">
            <div className="flex flex-col space-y-2">
              <MobileNavButton
                icon={
                  <Database
                    size={20}
                    className={
                      activeTab === "DATA" ? "text-[#1E90FF]" : "text-[#666666]"
                    }
                  />
                }
                label="DATA"
                active={activeTab === "DATA"}
                onClick={() => handleNavClick("DATA")}
              />
              <MobileNavButton
                icon={
                  <Globe
                    size={20}
                    className={
                      activeTab === "PLAN" ? "text-[#1E90FF]" : "text-[#666666]"
                    }
                  />
                }
                label="PLAN"
                active={activeTab === "PLAN"}
                onClick={() => handleNavClick("PLAN")}
              />
              <MobileNavButton
                icon={
                  <Settings
                    size={20}
                    className={
                      activeTab === "SETUP"
                        ? "text-[#1E90FF]"
                        : "text-[#666666]"
                    }
                  />
                }
                label="SETUP"
                active={activeTab === "SETUP"}
                onClick={() => handleNavClick("SETUP")}
              />
              <MobileNavButton
                icon={
                  <Sliders
                    size={20}
                    className={
                      activeTab === "CONFIG"
                        ? "text-[#1E90FF]"
                        : "text-[#666666]"
                    }
                  />
                }
                label="CONFIG"
                active={activeTab === "CONFIG"}
                onClick={() => handleNavClick("CONFIG")}
              />
              <MobileNavButton
                icon={
                  <PlayCircle
                    size={20}
                    className={
                      activeTab === "SIMULATION"
                        ? "text-[#1E90FF]"
                        : "text-[#666666]"
                    }
                  />
                }
                label="SIMULATION"
                active={activeTab === "SIMULATION"}
                onClick={() => handleNavClick("SIMULATION")}
              />
              <MobileNavButton
                icon={
                  <HelpCircle
                    size={20}
                    className={
                      activeTab === "HELP" ? "text-[#1E90FF]" : "text-[#666666]"
                    }
                  />
                }
                label="HELP"
                active={activeTab === "HELP"}
                onClick={() => handleNavClick("HELP")}
              />
            </div>

            <div className="mt-auto">
              <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm">
                <div className="flex items-center space-x-2">
                  <select className="bg-white text-[#333333] text-sm border border-[#E0E0E0] rounded-lg px-2 py-1 focus:outline-none cursor-pointer">
                    <option value="115200">115200</option>
                    <option value="57600">57600</option>
                    <option value="9600">9600</option>
                  </select>
                </div>
                <button
                  className="flex items-center space-x-1 bg-gradient-to-r from-[#1E90FF] to-[#6A5ACD] px-3 py-1 rounded-lg text-white font-semibold transition-all duration-200 hover:from-[#1C86EE] hover:to-[#5D52B1]"
                  onClick={() => setConnected(!connected)}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                      }`}
                  ></div>
                  <span className="text-sm">
                    {telemetry.connected ? "CONNECTED" : "CONNECT"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Status Message Bar */}
        {statusMessage && (
          <div className="bg-white p-2 text-center text-sm font-medium shadow-md">
            <div className="max-w-4xl mx-auto flex items-center justify-center space-x-2">
              <div className="h-1.5 w-full bg-[#E0E0E0] rounded-full overflow-hidden">
                <div className="h-full bg-[#1E90FF]/50 animate-progress"></div>
              </div>
              <span className="whitespace-nowrap text-[#333333]">
                {statusMessage}
              </span>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Hidden on mobile when showing map */}
          <div
            className={`border-r border-[#E0E0E0] flex flex-col bg-white ${activeTab === "DATA" ? "block" : "hidden md:flex"
              }`}
          >
            <div className="flex-1 overflow-auto bg-white">
              {/* Dialog Popup */}
              {isDialogOpen && (
                <div className="fixed inset-0 z-50 flex">
                  {/* Overlay */}
                  <div
                    className="absolute inset-0 bg-black opacity-50"
                    onClick={() => setIsDialogOpen(false)}
                  ></div>

                  {/* Dialog Content */}
                  <div className="relative w-full md:w-1/3 h-full bg-white border-r border-[#E0E0E0] p-4 overflow-y-auto">
                    <button
                      className="absolute top-2 right-2 text-[#666666] hover:text-[#333333] z-10"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      ✕
                    </button>
                    <div className="flex flex-col h-full">
                      {/* Attitude Indicator */}
                      <div className="w-full h-72 flex-shrink-0 bg-gradient-to-b from-[#B3D4FF] to-[#7DA8E6] border-b border-[#D1D5DB]">
                        <div className="relative h-full flex items-center justify-center">
                          <div className="relative w-80 h-64">
                            {/* Background Frame */}
                            <div className="absolute inset-0 rounded-xl bg-[#1F2A44] border-2 border-[#334155] shadow-xl" />

                            {/* Horizon Disk (Sky and Ground) */}
                            <div className="absolute inset-2 rounded-lg overflow-hidden">
                              <div className="absolute inset-0 bg-gradient-to-b from-[#60A5FA] to-[#2D8652] transform rotate-0" />
                              <div className="absolute inset-0 border border-[#60A5FA]/40 rounded-lg" />
                            </div>

                            {/* Pitch Lines and Markings */}
                            <div className="absolute inset-2">
                              {/* Horizon Line */}
                              <div className="absolute top-1/2 w-full h-0.5 bg-white/95 shadow-sm" />

                              {/* Pitch Markings Above Horizon */}
                              <div className="absolute top-[30%] w-full flex justify-between px-10">
                                <div className="flex items-center space-x-1">
                                  <span className="text-white text-xs font-mono font-medium">
                                    10°
                                  </span>
                                  <div className="w-6 h-0.5 bg-white/95" />
                                </div>
                                <div className="flex items-center space-x-1">
                                  <div className="w-6 h-0.5 bg-white/95" />
                                  <span className="text-white text-xs font-mono font-medium">
                                    10°
                                  </span>
                                </div>
                              </div>
                              <div className="absolute top-[15%] w-full flex justify-between px-8">
                                <div className="flex items-center space-x-1">
                                  <span className="text-white text-xs font-mono font-medium">
                                    20°
                                  </span>
                                  <div className="w-8 h-0.5 bg-white/95" />
                                </div>
                                <div className="flex items-center space-x-1">
                                  <div className="w-8 h-0.5 bg-white/95" />
                                  <span className="text-white text-xs font-mono font-medium">
                                    20°
                                  </span>
                                </div>
                              </div>

                              {/* Pitch Markings Below Horizon */}
                              <div className="absolute top-[70%] w-full flex justify-between px-10">
                                <div className="flex items-center space-x-1">
                                  <span className="text-white text-xs font-mono font-medium">
                                    -10°
                                  </span>
                                  <div className="w-6 h-0.5 bg-white/95" />
                                </div>
                                <div className="flex items-center space-x-1">
                                  <div className="w-6 h-0.5 bg-white/95" />
                                  <span className="text-white text-xs font-mono font-medium">
                                    -10°
                                  </span>
                                </div>
                              </div>
                              <div className="absolute top-[85%] w-full flex justify-between px-8">
                                <div className="flex items-center space-x-1">
                                  <span className="text-white text-xs font-mono font-medium">
                                    -20°
                                  </span>
                                  <div className="w-8 h-0.5 bg-white/95" />
                                </div>
                                <div className="flex items-center space-x-1">
                                  <div className="w-8 h-0.5 bg-white/95" />
                                  <span className="text-white text-xs font-mono font-medium">
                                    -20°
                                  </span>
                                </div>
                              </div>

                              {/* Roll Markings (Top Arc) */}
                              <div className="absolute top-0 left-1/2 transform -translate-x-1/2">
                                <div className="relative w-72 h-20">
                                  {/* Center Marker (0°) */}
                                  <div className="absolute top-0 left-1/2 w-0.5 h-6 bg-white/95 transform -translate-x-1/2">
                                    <span className="absolute top-6 left-1/2 transform -translate-x-1/2 text-white text-xs font-mono">
                                      0°
                                    </span>
                                  </div>
                                  {/* 15° Markers */}
                                  <div className="absolute top-0 left-[40%] w-0.5 h-4 bg-white/95 transform -translate-x-1/2 rotate-[15deg]">
                                    <span className="absolute top-5 left-1/2 transform -translate-x-1/2 text-white text-xs font-mono">
                                      15°
                                    </span>
                                  </div>
                                  <div className="absolute top-0 right-[40%] w-0.5 h-4 bg-white/95 transform -translate-x-1/2 -rotate-[15deg]">
                                    <span className="absolute top-5 left-1/2 transform -translate-x-1/2 text-white text-xs font-mono">
                                      15°
                                    </span>
                                  </div>
                                  {/* 30° Markers */}
                                  <div className="absolute top-0 left-[30%] w-0.5 h-5 bg-white/95 transform -translate-x-1/2 rotate-[30deg]">
                                    <span className="absolute top-6 left-1/2 transform -translate-x-1/2 text-white text-xs font-mono">
                                      30°
                                    </span>
                                  </div>
                                  <div className="absolute top-0 right-[30%] w-0.5 h-5 bg-white/95 transform -translate-x-1/2 -rotate-[30deg]">
                                    <span className="absolute top-6 left-1/2 transform -translate-x-1/2 text-white text-xs font-mono">
                                      30°
                                    </span>
                                  </div>
                                  {/* 45° Markers */}
                                  <div className="absolute top-0 left-[20%] w-0.5 h-4 bg-white/95 transform -translate-x-1/2 rotate-[45deg]">
                                    <span className="absolute top-5 left-1/2 transform -translate-x-1/2 text-white text-xs font-mono">
                                      45°
                                    </span>
                                  </div>
                                  <div className="absolute top-0 right-[20%] w-0.5 h-4 bg-white/95 transform -translate-x-1/2 -rotate-[45deg]">
                                    <span className="absolute top-5 left-1/2 transform -translate-x-1/2 text-white text-xs font-mono">
                                      45°
                                    </span>
                                  </div>
                                  {/* Directional Labels */}
                                  <div className="absolute top-0 left-0 transform -translate-x-1/2">
                                    <span className="text-white text-xs font-mono font-medium">
                                      NW 330° 345°
                                    </span>
                                  </div>
                                  <div className="absolute top-0 right-0 transform translate-x-1/2">
                                    <span className="text-white text-xs font-mono font-medium">
                                      15° 30° NE
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Improved Crosshair */}
                            {/* Improved Crosshair */}
                            <div className="absolute inset-0 flex items-center justify-center">
                              {/* Crosshair Container */}
                              <div className="relative w-24 h-24">
                                {/* Vertical Line with Arrows */}
                                <div className="absolute left-1/2 top-0 w-0.5 h-24 bg-[#FF6B6B] rounded-full transform -translate-x-1/2 flex flex-col justify-between items-center">
                                  <div className="absolute top-[-12px] w-0 h-0 border-l-[6px] border-r-[6px] border-l-transparent border-r-transparent border-b-[8px] border-b-[#FF6B6B]" />
                                  <div className="absolute bottom-[-12px] w-0 h-0 border-l-[6px] border-r-[6px] border-l-transparent border-r-transparent border-t-[8px] border-t-[#FF6B6B]" />
                                </div>

                                {/* Horizontal Line with Arrows */}
                                <div className="absolute top-1/2 left-0 w-24 h-0.5 bg-[#FF6B6B] rounded-full transform -translate-y-1/2 flex items-center justify-between">
                                  <div className="absolute left-[-12px] w-0 h-0 border-t-[6px] border-b-[6px] border-t-transparent border-b-transparent border-r-[8px] border-r-[#FF6B6B]" />
                                  <div className="absolute right-[-12px] w-0 h-0 border-t-[6px] border-b-[6px] border-t-transparent border-b-transparent border-l-[8px] border-l-[#FF6B6B]" />
                                </div>
                              </div>
                            </div>

                            {/* Left Sidebar (Airspeed Tape) */}
                            <div className="absolute left-[-48px] top-2 bottom-2 w-12 bg-[#2A3A3B]/95 border border-[#3A4A4B] rounded-lg shadow-md flex flex-col items-center">
                              <div className="relative h-full w-full flex flex-col items-center justify-center">
                                <span className="absolute top-3 text-white/85 text-xs font-mono font-medium">
                                  10
                                </span>
                                <span className="absolute top-1/4 text-white/85 text-xs font-mono font-medium">
                                  5
                                </span>
                                <span className="absolute top-1/2 text-white/85 text-xs font-mono font-medium">
                                  0 m/s
                                </span>
                                <span className="absolute bottom-1/4 text-white/85 text-xs font-mono font-medium">
                                  -5
                                </span>
                                <span className="absolute bottom-3 text-white/85 text-xs font-mono font-medium">
                                  -10
                                </span>
                                <div className="absolute top-1/2 w-5 h-0.5 bg-white/85" />
                                <div className="absolute top-1/4 w-3 h-0.5 bg-white/85" />
                                <div className="absolute bottom-1/4 w-3 h-0.5 bg-white/85" />
                                <span className="absolute bottom-[-24px] text-white/85 text-xs font-mono font-medium">
                                  AS: {telemetry.ground_speed?.toFixed(1) || "0.0"} m/s
                                </span>
                              </div>
                            </div>

                            {/* Right Sidebar (Altitude Tape) */}
                            <div className="absolute right-[-48px] top-2 bottom-2 w-12 bg-[#2A3A3B]/95 border border-[#3A4A4B] rounded-lg shadow-md flex flex-col items-center">
                              <div className="relative h-full w-full flex flex-col items-center justify-center">
                                <span className="absolute top-3 text-white/85 text-xs font-mono font-medium">
                                  10
                                </span>
                                <span className="absolute top-1/4 text-white/85 text-xs font-mono font-medium">
                                  5
                                </span>
                                <span className="absolute top-1/2 text-white/85 text-xs font-mono font-medium">
                                  0 m
                                </span>
                                <span className="absolute bottom-1/4 text-white/85 text-xs font-mono font-medium">
                                  -5
                                </span>
                                <span className="absolute bottom-3 text-white/85 text-xs font-mono font-medium">
                                  -10
                                </span>
                                <div className="absolute top-1/2 w-5 h-0.5 bg-white/85" />
                                <div className="absolute top-1/4 w-3 h-0.5 bg-white/85" />
                                <div className="absolute bottom-1/4 w-3 h-0.5 bg-white/85" />
                                <span className="absolute bottom-[-24px] text-white/85 text-xs font-mono font-medium">
                                  ALT:  {telemetry.altitude?.toFixed(1) || "0.0"} m
                                </span>
                              </div>
                            </div>

                            {/* Telemetry Bar */}
                            <div className="absolute bottom-0 inset-x-0 p-2 bg-[#2A3A3B]/95 border-t border-[#3A4A4B] rounded-b-xl shadow-md">
                              <div className="flex justify-between items-center text-xs font-mono font-medium text-white/85">
                                <div>
                                  AS: {telemetry.ground_speed?.toFixed(1) || "0.0"} m/s | Elev:{" "}
                                  {telemetry.altitude?.toFixed(1) || "0.0"} m
                                </div>
                                <div className="flex flex-col items-center">
                                  <div
                                    className={`font-bold ${telemetry.arming?.armed ? "text-emerald-400" : "text-red-400"
                                      }`}
                                  >
                                    {isArmed ? "ARMED" : "DISARMED"}
                                  </div>
                                  <div
                                    className={`${telemetry.gps?.fix_type >= 3 ? "text-emerald-400" : "text-red-400"
                                      } font-bold`}
                                  >
                                    {telemetry.gps?.fix_type >= 3 ? "READY" : "NOT READY"}
                                  </div>
                                </div>
                                <div>
                                  {telemetry.altitude?.toFixed(1) || "0"} m | {telemetry.heading || "0"}° |
                                  GPS:{" "}
                                  {telemetry.gps?.fix_type >= 3
                                    ? `${telemetry.gps.satellites} Sats`
                                    : "No Fix"}
                                </div>
                              </div>
                              <div className="flex justify-center items-center text-xs font-mono font-medium text-white/85 mt-1">
                                <div>
                                  {telemetry.battery_voltage?.toFixed(2) || "0.00"}V |{" "}
                                  {telemetry.battery_current?.toFixed(1) || "0.0"}A |{" "}
                                  {telemetry.battery_remaining || "0"}% | EKF Vibe
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Tab Content */}
                      <div className="flex-1 mt-4">
                        {activeTabButton === "Actions" ? (
                          <div className="space-y-6 px-4">
                            {/* Header */}
                            <div className="bg-white p-3 rounded-lg shadow-sm border border-[#E0E0E0] flex items-center justify-center space-x-2">
                              <Settings size={16} className="text-[#1E90FF]" />
                              <span className="text-[#333333] font-semibold">
                                DRONE ACTIONS
                              </span>
                            </div>

                            {/* Flight Controls Section */}
                            <div className="space-y-2">
                              <div className="text-sm font-semibold text-[#333333] flex items-center space-x-2">
                                <Plane size={14} className="text-[#1E90FF]" />
                                <span>FLIGHT CONTROLS</span>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="group relative">
                                  <ActionButton
                                    icon={
                                      <Plane
                                        className="transform group-hover:scale-110 transition-transform"
                                        size={24}
                                      />
                                    }
                                    label="TAKEOFF"
                                    onClick={sendTakeoff}
                                    className="bg-gradient-to-r from-[#1E90FF] to-[#6A5ACD] hover:from-[#1C86EE] hover:to-[#5D52B1] shadow-md hover:shadow-lg transition-all duration-300"
                                  />
                                  <div className="absolute bottom-full mb-2 hidden group-hover:block w-max px-2 py-1 bg-[#333333] text-white text-xs rounded-lg">
                                    Initiate takeoff sequence
                                  </div>
                                </div>
                                <div className="group relative">
                                  <ActionButton
                                    icon={
                                      <Plane
                                        className="transform rotate-180 group-hover:scale-110 transition-transform"
                                        size={24}
                                      />
                                    }
                                    label="LAND"
                                    onClick={sendLand}
                                    className="bg-gradient-to-r from-[#1E90FF] to-[#6A5ACD] hover:from-[#1C86EE] hover:to-[#5D52B1] shadow-md hover:shadow-lg transition-all duration-300"
                                  />
                                  <div className="absolute bottom-full mb-2 hidden group-hover:block w-max px-2 py-1 bg-[#333333] text-white text-xs rounded-lg">
                                    Initiate landing sequence
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Mission Controls Section */}
                            <div className="space-y-2">
                              <div className="text-sm font-semibold text-[#333333] flex items-center space-x-2">
                                <Play size={14} className="text-[#1E90FF]" />
                                <span>MISSION CONTROLS</span>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="group relative">
                                  <ActionButton
                                    icon={
                                      <Play
                                        className="transform group-hover:scale-110 transition-transform"
                                        size={24}
                                      />
                                    }
                                    label="MISSION START"
                                    onClick={handleStartMission}
                                    className="bg-gradient-to-r from-[#1E90FF] to-[#6A5ACD] hover:from-[#1C86EE] hover:to-[#5D52B1] shadow-md hover:shadow-lg transition-all duration-300"
                                  />
                                  <div className="absolute bottom-full mb-2 hidden group-hover:block w-max px-2 py-1 bg-[#333333] text-white text-xs rounded-lg">
                                    Start the pre-programmed mission
                                  </div>
                                </div>
                                <div className="group relative">
                                  <ActionButton
                                    icon={
                                      <Home
                                        className="transform group-hover:scale-110 transition-transform"
                                        size={24}
                                      />
                                    }
                                    label="RETURN HOME"
                                    onClick={handleReturnToHome}
                                    className="bg-gradient-to-r from-[#1E90FF] to-[#6A5ACD] hover:from-[#1C86EE] hover:to-[#5D52B1] shadow-md hover:shadow-lg transition-all duration-300"
                                  />
                                  <div className="absolute bottom-full mb-2 hidden group-hover:block w-max px-2 py-1 bg-[#333333] text-white text-xs rounded-lg">
                                    Return to the home position
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Navigation Controls Section */}
                            <div className="space-y-2">
                              <div className="text-sm font-semibold text-[#333333] flex items-center space-x-2">
                                <MapPin size={14} className="text-[#1E90FF]" />
                                <span>NAVIGATION CONTROLS</span>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="group relative">
                                  <ActionButton
                                    icon={
                                      <ArrowUp
                                        className="transform group-hover:scale-110 transition-transform"
                                        size={24}
                                      />
                                    }
                                    label="CHANGE ALTITUDE"
                                    onClick={async () => {
                                      const altitude = prompt(
                                        "Enter new altitude in meters:"
                                      );
                                      if (altitude && !isNaN(altitude)) {
                                        try {
                                          const response = await fetch(
                                            `http://localhost:8000/change_altitude/${altitude}`,
                                            { method: "POST" }
                                          );
                                          if (!response.ok)
                                            throw new Error(
                                              "Altitude change failed"
                                            );
                                          alert(
                                            `Altitude changed to ${altitude}m!`
                                          );
                                        } catch (error) {
                                          alert(error.message);
                                        }
                                      }
                                    }}
                                    className="bg-gradient-to-r from-[#1E90FF] to-[#6A5ACD] hover:from-[#1C86EE] hover:to-[#5D52B1] shadow-md hover:shadow-lg transition-all duration-300"
                                  />
                                  <div className="absolute bottom-full mb-2 hidden group-hover:block w-max px-2 py-1 bg-[#333333] text-white text-xs rounded-lg">
                                    Adjust the drone's altitude
                                  </div>
                                </div>
                                <div className="group relative">
                                  <ActionButton
                                    icon={
                                      <MapPin
                                        className="transform group-hover:scale-110 transition-transform"
                                        size={24}
                                      />
                                    }
                                    label="FLY HERE"
                                    onClick={handleFlyHere}
                                    className={`${flyHereMode
                                      ? "bg-gradient-to-r from-[#FF69B4] to-[#FF1493] hover:from-[#FF69B4] hover:to-[#FF1493] shadow-md hover:shadow-lg"
                                      : "bg-gradient-to-r from-[#1E90FF] to-[#6A5ACD] hover:from-[#1C86EE] hover:to-[#5D52B1] shadow-md hover:shadow-lg"
                                      } transition-all duration-300`}
                                  />
                                  <div className="absolute bottom-full mb-2 hidden group-hover:block w-max px-2 py-1 bg-[#333333] text-white text-xs rounded-lg">
                                    {flyHereMode
                                      ? "Cancel fly-to-point mode"
                                      : "Fly to a selected point on the map"}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : activeTabButton === "Messages" ? (
                          <div className="flex flex-col h-full px-4">
                            <div className="bg-white p-3 text-center font-semibold text-[#333333] border-b border-[#E0E0E0] flex items-center justify-center space-x-2 mb-4 rounded-lg shadow-sm">
                              <BarChart2 size={16} className="text-[#1E90FF]" />
                              <span>SYSTEM MESSAGES</span>
                            </div>
                            <div className="space-y-3 flex-1 overflow-auto">
                              {telemetry.status_messages?.map((msg, index) => (
                                <div
                                  key={index}
                                  className={`p-2 rounded-lg text-sm ${msg.severity >= 4
                                    ? 'bg-red-100 text-red-700'
                                    : msg.severity >= 3
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-blue-100 text-blue-700'
                                    }`}
                                >
                                  <div className="flex justify-between items-center">
                                    <span className="flex-1 truncate">{msg.text}</span>
                                    <span className="text-xs opacity-75 ml-2 whitespace-nowrap">
                                      {new Date(msg.timestamp).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  </div>
                                </div>
                              ))}
                              {telemetry.status_messages?.length === 0 && (
                                <div className="text-center text-gray-500 text-sm py-4">
                                  No system messages available
                                </div>
                              )}
                            </div>
                          </div>
                        ) : activeTabButton === "FlightPlan" ? (
                          <div className="flex flex-col h-full px-4">
                            <div className="bg-white p-3 text-center font-semibold text-[#333333] border-b border-[#E0E0E0] flex items-center justify-center space-x-2 mb-4 rounded-lg shadow-sm">
                              <Layers size={16} className="text-[#1E90FF]" />
                              <span>FLIGHT PLAN EDITOR</span>
                            </div>
                            <div className="space-y-4 flex-1 overflow-auto">
                              <div>
                                <div className="text-sm font-semibold text-[#333333] mb-2 flex items-center space-x-2">
                                  <MapPin
                                    size={14}
                                    className="text-[#1E90FF]"
                                  />
                                  <span>WAYPOINTS</span>
                                </div>
                                <div className="space-y-2">
                                  {waypoints.length > 0 ? (
                                    waypoints.map((wp, i) => (
                                      <div
                                        key={i}
                                        className="p-3 bg-white rounded-xl flex justify-between items-center border border-[#E0E0E0] hover:bg-[#E6F0FA] transition-all duration-200 shadow-sm"
                                      >
                                        <div className="flex items-center space-x-2">
                                          <div className="w-6 h-6 rounded-full bg-[#1E90FF] flex items-center justify-center text-xs font-bold text-white">
                                            {i + 1}
                                          </div>
                                          <span className="text-sm text-[#333333]">
                                            {wp.name || `Waypoint ${i + 1}`}
                                          </span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                          <span className="text-xs text-[#666666]">
                                            {wp.lat.toFixed(4)},{" "}
                                            {wp.lng.toFixed(4)}
                                          </span>
                                          <button
                                            onClick={() => removeWaypoint(i)}
                                            className="p-1 bg-red-100 text-red-500 rounded hover:bg-red-200"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="p-3 bg-white rounded-xl border border-[#E0E0E0] text-center text-[#666666] shadow-sm">
                                      No waypoints added. Click on the map to
                                      add waypoints.
                                    </div>
                                  )}
                                </div>

                                {/* Total Distance */}
                                {waypoints.length >= 2 && (
                                  <div className="mt-4 p-3 bg-white rounded-xl border border-[#E0E0E0] shadow-sm">
                                    <div className="text-sm font-semibold text-[#333333] flex items-center space-x-2">
                                      <Ruler
                                        size={14}
                                        className="text-[#1E90FF]"
                                      />
                                      <span>TOTAL DISTANCE</span>
                                    </div>
                                    <div className="mt-2 text-sm">
                                      <span className="font-semibold">
                                        {totalWaypointDistance} meters
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Polygon Points Section */}
                              {polygonMode && (
                                <div>
                                  <div className="text-sm font-semibold text-[#333333] mb-2 flex items-center space-x-2">
                                    <Layers
                                      size={14}
                                      className="text-[#1E90FF]"
                                    />
                                    <span>POLYGON POINTS</span>
                                  </div>
                                  <div className="space-y-2">
                                    {polygonCorners.length > 0 ? (
                                      polygonCorners.map((point, i) => (
                                        <div
                                          key={i}
                                          className="p-3 bg-white rounded-xl flex justify-between items-center border border-[#E0E0E0] hover:bg-[#E6F0FA] transition-all duration-200 shadow-sm"
                                        >
                                          <div className="flex items-center space-x-2">
                                            <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-xs font-bold text-white">
                                              {i + 1}
                                            </div>
                                            <span className="text-sm text-[#333333]">
                                              Point {i + 1}
                                            </span>
                                          </div>
                                          <div className="flex flex-col items-end">
                                            <span className="text-xs text-[#666666]">
                                              Lat: {point.lat.toFixed(6)}, Lng:{" "}
                                              {point.lng.toFixed(6)}
                                            </span>
                                            <span className="text-xs text-[#666666]">
                                              Alt: {point.alt}m
                                            </span>
                                            <button
                                              onClick={() =>
                                                removePolygonPoint(i)
                                              }
                                              className="mt-1 p-1 bg-red-100 text-red-500 rounded hover:bg-red-200"
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="p-3 bg-white rounded-xl border border-[#E0E0E0] text-center text-[#666666] shadow-sm">
                                        No polygon points added. Click on the
                                        map to add points.
                                      </div>
                                    )}

                                    {/* Distance Information */}
                                    {calculateDistances.length > 0 && (
                                      <div className="mt-4 p-3 bg-white rounded-xl border border-[#E0E0E0] shadow-sm">
                                        <div className="text-sm font-semibold text-[#333333] mb-2 flex items-center space-x-2">
                                          <Ruler
                                            size={14}
                                            className="text-[#1E90FF]"
                                          />
                                          <span>DISTANCES</span>
                                        </div>
                                        <div className="space-y-2 max-h-40 overflow-y-auto">
                                          {calculateDistances.map((dist, i) => (
                                            <div
                                              key={i}
                                              className="text-xs flex justify-between items-center p-2 bg-[#F5F7FA] rounded-lg"
                                            >
                                              <span>
                                                Point {dist.from + 1} to Point{" "}
                                                {dist.to + 1}:
                                              </span>
                                              <span className="font-semibold">
                                                {dist.distance} m
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              <div>
                                <div className="text-sm font-semibold text-[#333333] mb-2 flex items-center space-x-2">
                                  <Settings
                                    size={14}
                                    className="text-[#1E90FF]"
                                  />
                                  <span>MISSION PARAMETERS</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="p-3 bg-white rounded-xl border border-[#E0E0E0] shadow-sm">
                                    <div className="text-xs text-[#666666]">
                                      Altitude
                                    </div>
                                    <div className="text-sm text-[#333333] flex items-center space-x-1">
                                      <ArrowUp
                                        size={12}
                                        className="text-[#1E90FF]"
                                      />
                                      <input
                                        type="number"
                                        value={missionAltitude}
                                        onChange={(e) =>
                                          setMissionAltitude(e.target.value)
                                        }
                                        className="w-full p-1 border border-[#E0E0E0] rounded text-sm"
                                      />
                                    </div>
                                  </div>
                                  <div className="p-3 bg-white rounded-xl border border-[#E0E0E0] shadow-sm">
                                    <div className="text-xs text-[#666666]">
                                      Speed
                                    </div>
                                    <div className="text-sm text-[#333333] flex items-center space-x-1">
                                      <Zap
                                        size={12}
                                        className="text-[#1E90FF]"
                                      />
                                      <span>{telemetry.ground_speed} m/s</span>
                                    </div>
                                  </div>
                                  <div className="p-3 bg-white rounded-xl border border-[#E0E0E0] shadow-sm">
                                    <div className="text-xs text-[#666666]">
                                      Mission Type
                                    </div>
                                    <div className="text-sm text-[#333333] flex items-center space-x-1">
                                      <Compass
                                        size={12}
                                        className="text-[#1E90FF]"
                                      />
                                      <span>
                                        {polygonMode ? "Polygon" : "Waypoint"}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="p-3 bg-white rounded-xl border border-[#E0E0E0] shadow-sm">
                                    <div className="text-xs text-[#666666]">
                                      Duration
                                    </div>
                                    <div className="text-sm text-[#333333] flex items-center space-x-1">
                                      <Clock
                                        size={12}
                                        className="text-[#1E90FF]"
                                      />
                                      <span>~15 minutes</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <button
                                className="w-full py-3 bg-gradient-to-r from-[#1E90FF] to-[#6A5ACD] hover:from-[#1C86EE] hover:to-[#5D52B1] rounded-xl text-white font-semibold flex items-center justify-center space-x-2 transition-all duration-300 hover:scale-105 shadow-md"
                                onClick={
                                  polygonMode
                                    ? handleGeneratePolygonMission
                                    : handleStartMission
                                }
                              >
                                <Shield size={16} />
                                <span>
                                  {polygonMode
                                    ? "GENERATE POLYGON MISSION"
                                    : "START MISSION"}
                                </span>
                              </button>
                            </div>
                          </div>
                        ) : activeTabButton === "Pre Flight" ? (
                          <>
                            {/*<div className="flex flex-col h-full">
                            <div className="bg-white p-3 text-center font-semibold text-[#333333] border-b border-[#E0E0E0] flex items-center justify-center space-x-2 mb-4 rounded-lg shadow-sm">
                              <Shield size={16} className="text-[#1E90FF]" />
                              <span>PREFLIGHT CHECKS</span>
                            </div>
                            <div className="space-y-4 flex-1 overflow-auto p-4">
                              <div
                                className={`p-3 rounded-lg border shadow-sm ${
                                  preflightStatus === "completed"
                                    ? "bg-green-100 border-green-200"
                                    : preflightStatus === "failed"
                                    ? "bg-red-100 border-red-200"
                                    : "bg-amber-100 border-amber-200"
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
                              <div className="space-y-3">
                                {preflightChecks.map((check, index) => {
                                  const result = preflightResults.find(
                                    (r) => r.check_id === check.id
                                  );
                                  return (
                                    <div
                                      key={check.id}
                                      className="p-3 bg-white rounded-xl border border-[#E0E0E0] shadow-sm"
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
                                              <Check
                                                size={12}
                                                className="text-white"
                                              />
                                            ) : (
                                              <X
                                                size={12}
                                                className="text-white"
                                              />
                                            )}
                                          </div>
                                          <div>
                                            <div className="text-sm font-medium text-[#333333]">
                                              {check.name}
                                            </div>
                                            <div className="text-xs text-[#666666]">
                                              {check.description}
                                            </div>
                                            {result?.message && (
                                              <div
                                                className={`text-xs mt-1 ${
                                                  result.status
                                                    ? "text-green-600"
                                                    : "text-red-600"
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
                                              onClick={() =>
                                                confirmManualCheck(check.id)
                                              }
                                              className="px-2 py-1 text-xs bg-[#1E90FF]/10 text-[#1E90FF] rounded-lg hover:bg-[#1E90FF]/20"
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
                            <div className="p-4 border-t border-[#E0E0E0]">
                              <button
                                className="w-full py-3 bg-gradient-to-r from-[#1E90FF] to-[#6A5ACD] hover:from-[#1C86EE] hover:to-[#5D52B1] rounded-xl text-white font-semibold flex items-center justify-center space-x-2 transition-all duration-300 hover:scale-105 shadow-md disabled:opacity-50 disabled:hover:scale-100"
                                onClick={handleRunPreflight}
                                disabled={preflightStatus === "in_progress"}
                              >
                                {preflightStatus === "in_progress" ? (
                                  <Loader2Icon
                                    size={16}
                                    className="animate-spin"
                                  />
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
                          </div>*/}
                            <PreflightChecks telemetry={telemetry} /></>
                        ) : activeTabButton === "Status" ? (
                          <div className="flex flex-col h-full px-4">
                            {/* Header */}
                            <div className="bg-white p-3 text-center font-semibold text-[#333333] border-b border-[#E0E0E0] rounded-lg shadow-sm flex items-center justify-center space-x-2">
                              <AlertTriangle
                                size={16}
                                className="text-[#1E90FF]"
                              />
                              <span>SYSTEM STATUS</span>
                            </div>

                            <div className="space-y-4 flex-1 py-4">
                              {/* Hardware Section */}
                              <div className="p-4 bg-white rounded-xl border border-[#E0E0E0] shadow-sm hover:shadow-md transition-shadow duration-300">
                                <div className="text-sm font-semibold text-[#333333] mb-3 flex items-center space-x-2">
                                  <Cpu size={14} className="text-[#1E90FF]" />
                                  <span>HARDWARE</span>
                                </div>
                                <div className="space-y-3">
                                  <div className="group flex justify-between items-center p-2 bg-white/50 rounded-lg hover:bg-[#E6F0FA] transition-all duration-200">
                                    <span className="text-[#333333] flex items-center space-x-1">
                                      <Cpu size={12} />
                                      <span>CPU</span>
                                    </span>
                                    <span className="text-emerald-500 flex items-center space-x-2">
                                      <div className="w-16 h-2 bg-[#E0E0E0] rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-500"
                                          style={{ width: "32%" }}
                                        />
                                      </div>
                                      <span>32%</span>
                                      <Check
                                        size={12}
                                        className="text-emerald-500"
                                      />
                                    </span>
                                    <div className="absolute right-0 mr-2 hidden group-hover:block w-max px-2 py-1 bg-[#333333] text-white text-xs rounded-lg">
                                      CPU usage is normal
                                    </div>
                                  </div>
                                  <div className="group flex justify-between items-center p-2 bg-white/50 rounded-lg hover:bg-[#E6F0FA] transition-all duration-200">
                                    <span className="text-[#333333] flex items-center space-x-1">
                                      <Layers size={12} />
                                      <span>Memory</span>
                                    </span>
                                    <span className="text-emerald-500 flex items-center space-x-2">
                                      <div className="w-16 h-2 bg-[#E0E0E0] rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-500"
                                          style={{ width: "45%" }}
                                        />
                                      </div>
                                      <span>45%</span>
                                      <Check
                                        size={12}
                                        className="text-emerald-500"
                                      />
                                    </span>
                                    <div className="absolute right-0 mr-2 hidden group-hover:block w-max px-2 py-1 bg-[#333333] text-white text-xs rounded-lg">
                                      Memory usage is normal
                                    </div>
                                  </div>
                                  <div className="group flex justify-between items-center p-2 bg-white/50 rounded-lg hover:bg-[#E6F0FA] transition-all duration-200">
                                    <span className="text-[#333333] flex items-center space-x-1">
                                      <Database size={12} />
                                      <span>Storage</span>
                                    </span>
                                    <span className="text-emerald-500 flex items-center space-x-2">
                                      <span>12GB free</span>
                                      <Check
                                        size={12}
                                        className="text-emerald-500"
                                      />
                                    </span>
                                    <div className="absolute right-0 mr-2 hidden group-hover:block w-max px-2 py-1 bg-[#333333] text-white text-xs rounded-lg">
                                      Sufficient storage available
                                    </div>
                                  </div>
                                  <div className="group flex justify-between items-center p-2 bg-white/50 rounded-lg hover:bg-[#E6F0FA] transition-all duration-200">
                                    <span className="text-[#333333] flex items-center space-x-1">
                                      <Zap size={12} />
                                      <span>Temperature</span>
                                    </span>
                                    <span className="text-amber-500 flex items-center space-x-2">
                                      <span>42°C</span>
                                      <AlertTriangle
                                        size={12}
                                        className="text-amber-500"
                                      />
                                    </span>
                                    <div className="absolute right-0 mr-2 hidden group-hover:block w-max px-2 py-1 bg-[#333333] text-white text-xs rounded-lg">
                                      Temperature is slightly elevated
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Sensors Section */}
                              <div className="p-4 bg-white rounded-xl border border-[#E0E0E0] shadow-sm hover:shadow-md transition-shadow duration-300">
                                <div className="text-sm font-semibold text-[#333333] mb-3 flex items-center space-x-2">
                                  <Settings
                                    size={14}
                                    className="text-[#1E90FF]"
                                  />
                                  <span>SENSORS</span>
                                </div>
                                <div className="space-y-3">
                                  <div className="group flex justify-between items-center p-2 bg-white/50 rounded-lg hover:bg-[#E6F0FA] transition-all duration-200">
                                    <span className="text-[#333333] flex items-center space-x-1">
                                      <Globe size={12} />
                                      <span>GPS</span>
                                    </span>
                                    <span className="text-emerald-500 flex items-center space-x-2">
                                      <span>8 satellites</span>
                                      <Check
                                        size={12}
                                        className="text-emerald-500"
                                      />
                                    </span>
                                    <div className="absolute right-0 mr-2 hidden group-hover:block w-max px-2 py-1 bg-[#333333] text-white text-xs rounded-lg">
                                      GPS signal is strong
                                    </div>
                                  </div>
                                  <div className="group flex justify-between items-center p-2 bg-white/50 rounded-lg hover:bg-[#E6F0FA] transition-all duration-200">
                                    <span className="text-[#333333] flex items-center space-x-1">
                                      <Compass size={12} />
                                      <span>IMU</span>
                                    </span>
                                    <span className="text-emerald-500 flex items-center space-x-2">
                                      <span>Calibrated</span>
                                      <Check
                                        size={12}
                                        className="text-emerald-500"
                                      />
                                    </span>
                                    <div className="absolute right-0 mr-2 hidden group-hover:block w-max px-2 py-1 bg-[#333333] text-white text-xs rounded-lg">
                                      IMU is fully calibrated
                                    </div>
                                  </div>
                                  <div className="group flex justify-between items-center p-2 bg-white/50 rounded-lg hover:bg-[#E6F0FA] transition-all duration-200">
                                    <span className="text-[#333333] flex items-center space-x-1">
                                      <ArrowUp size={12} />
                                      <span>Barometer</span>
                                    </span>
                                    <span className="text-emerald-500 flex items-center space-x-2">
                                      <span>Normal</span>
                                      <Check
                                        size={12}
                                        className="text-emerald-500"
                                      />
                                    </span>
                                    <div className="absolute right-0 mr-2 hidden group-hover:block w-max px-2 py-1 bg-[#333333] text-white text-xs rounded-lg">
                                      Barometer is functioning normally
                                    </div>
                                  </div>
                                  <div className="group flex justify-between items-center p-2 bg-white/50 rounded-lg hover:bg-[#E6F0FA] transition-all duration-200">
                                    <span className="text-[#333333] flex items-center space-x-1">
                                      <Compass size={12} />
                                      <span>Compass</span>
                                    </span>
                                    <span className="text-amber-500 flex items-center space-x-2">
                                      <span>Needs Calibration</span>
                                      <AlertTriangle
                                        size={12}
                                        className="text-amber-500"
                                      />
                                    </span>
                                    <div className="absolute right-0 mr-2 hidden group-hover:block w-max px-2 py-1 bg-[#333333] text-white text-xs rounded-lg">
                                      Compass requires calibration
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Battery Section */}
                              <div className="p-4 bg-white rounded-xl border border-[#E0E0E0] shadow-sm hover:shadow-md transition-shadow duration-300">
                                <div className="text-sm font-semibold text-[#333333] mb-3 flex items-center space-x-2">
                                  <Battery className="text-[#1E90FF]" />
                                  <span>BATTERY</span>
                                </div>
                                <div className="space-y-3">
                                  <div className="group flex justify-between items-center p-2 bg-white/50 rounded-lg hover:bg-[#E6F0FA] transition-all duration-200">
                                    <span className="text-[#333333] flex items-center space-x-1">
                                      {getBatteryIcon()}
                                      <span>Level</span>
                                    </span>
                                    <span
                                      className={`${getBatteryColor()} font-semibold flex items-center space-x-2`}
                                    >
                                      <span>{telemetry.battery_voltage}V</span>
                                      {batteryLevel > 60 ? (
                                        <Check
                                          size={12}
                                          className="text-emerald-500"
                                        />
                                      ) : batteryLevel > 20 ? (
                                        <AlertTriangle
                                          size={12}
                                          className="text-amber-500"
                                        />
                                      ) : (
                                        <AlertCircle
                                          size={12}
                                          className="text-red-500"
                                        />
                                      )}
                                    </span>
                                    <div className="absolute right-0 mr-2 hidden group-hover:block w-max px-2 py-1 bg-[#333333] text-white text-xs rounded-lg">
                                      {telemetry.battery_remaining > 60
                                        ? "Battery level is good"
                                        : telemetry.battery_remaining > 20
                                          ? "Battery level is moderate"
                                          : "Battery level is critically low"}
                                    </div>
                                  </div>
                                  <div className="w-full h-3 bg-[#E0E0E0] rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-500 ${telemetry.battery_remaining > 60
                                        ? "bg-gradient-to-r from-emerald-400 to-emerald-600"
                                        : telemetry.battery_remaining > 20
                                          ? "bg-gradient-to-r from-amber-400 to-amber-600"
                                          : "bg-gradient-to-r from-red-400 to-red-600"
                                        }`}
                                      style={{
                                        width: `${telemetry.battery_remaining}%`,
                                      }}
                                    />
                                  </div>
                                  <div className="group flex justify-between items-center p-2 bg-white/50 rounded-lg hover:bg-[#E6F0FA] transition-all duration-200">
                                    <span className="text-[#333333] flex items-center space-x-1">
                                      <Clock size={12} />
                                      <span>Estimated Time</span>
                                    </span>
                                    <span className="text-[#333333]">
                                      {Math.floor(
                                        telemetry.battery_remaining / 5
                                      )}{" "}
                                      minutes
                                    </span>
                                    <div className="absolute right-0 mr-2 hidden group-hover:block w-max px-2 py-1 bg-[#333333] text-white text-xs rounded-lg">
                                      Estimated flight time remaining
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : activeTabButton === "Setup" ? (
                          <div className="flex flex-col h-full px-4">
                            <div className="bg-white p-3 text-center font-semibold text-[#333333] border-b border-[#E0E0E0] flex items-center justify-center space-x-2 mb-4 rounded-lg shadow-sm">
                              <Settings size={16} className="text-[#1E90FF]" />
                              <span>DRONE SETUP & CALIBRATION</span>
                            </div>
                            <div className="space-y-4 flex-1 overflow-auto">
                              {/* Frame Setup */}
                              <div className="p-4 bg-white rounded-xl border border-[#E0E0E0] shadow-sm hover:shadow-md transition-shadow duration-300">
                                <div className="text-sm font-semibold text-[#333333] mb-3 flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <Sliders
                                      size={14}
                                      className="text-[#1E90FF]"
                                    />
                                    <span>FRAME SETUP</span>
                                  </div>
                                  <button
                                    onClick={configureFrame}
                                    className="px-3 py-1 bg-[#1E90FF] text-white text-xs rounded-lg hover:bg-[#1C86EE]"
                                  >
                                    Configure
                                  </button>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="p-2 bg-[#F5F7FA] rounded-lg text-center">
                                    <div className="text-xs text-[#666666]">
                                      Frame Type
                                    </div>
                                    <div className="text-sm font-medium">
                                      Quadcopter
                                    </div>
                                  </div>
                                  <div className="p-2 bg-[#F5F7FA] rounded-lg text-center">
                                    <div className="text-xs text-[#666666]">
                                      Frame Class
                                    </div>
                                    <div className="text-sm font-medium">
                                      X Configuration
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Accelerometer Calibration */}
                              <div className="p-4 bg-white rounded-xl border border-[#E0E0E0] shadow-sm hover:shadow-md transition-shadow duration-300">
                                <div className="text-sm font-semibold text-[#333333] mb-3 flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <Compass
                                      size={14}
                                      className="text-[#1E90FF]"
                                    />
                                    <span>ACCELEROMETER CALIBRATION</span>
                                  </div>
                                  <button
                                    onClick={async () => {
                                      try {
                                        const response = await fetch(
                                          "http://localhost:8000/calibrate_accelerometer",
                                          { method: "POST" }
                                        );
                                        if (!response.ok)
                                          throw new Error("Calibration failed");
                                        alert(
                                          "Accelerometer calibration started! Follow drone instructions."
                                        );
                                      } catch (error) {
                                        alert(error.message);
                                      }
                                    }}
                                    className="px-3 py-1 bg-[#1E90FF] text-white text-xs rounded-lg hover:bg-[#1C86EE]"
                                  >
                                    Calibrate
                                  </button>
                                </div>
                                <div className="text-xs text-[#666666] mb-2">
                                  Place the vehicle on a level surface and press
                                  Calibrate. You will be prompted to place the
                                  vehicle in various orientations.
                                </div>
                                <div className="p-2 bg-[#F5F7FA] rounded-lg">
                                  <div className="text-xs text-[#666666]">
                                    Status
                                  </div>
                                  <div className="text-sm font-medium text-amber-500">
                                    Needs Calibration
                                  </div>
                                </div>
                              </div>

                              {/* Initial Parameters */}
                              {/* <div className="p-4 bg-white rounded-xl border border-[#E0E0E0] shadow-sm hover:shadow-md transition-shadow duration-300">
                                <div className="text-sm font-semibold text-[#333333] mb-3 flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <Settings size={14} className="text-[#1E90FF]" />
                                    <span>INITIAL PARAMETERS</span>
                                  </div>
                                  <button className="px-3 py-1 bg-[#1E90FF] text-white text-xs rounded-lg hover:bg-[#1C86EE]">
                                    Load Defaults
                                  </button>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center p-2 bg-[#F5F7FA] rounded-lg">
                                    <span className="text-xs text-[#666666]">PID Controller</span>
                                    <span className="text-sm font-medium">Standard</span>
                                  </div>
                                  <div className="flex justify-between items-center p-2 bg-[#F5F7FA] rounded-lg">
                                    <span className="text-xs text-[#666666]">Firmware Version</span>
                                    <span className="text-sm font-medium">ArduCopter 4.3.2</span>
                                  </div>
                                </div>
                              </div>*/}

                              {/* Radio Calibration */}
                              <div className="p-4 bg-white rounded-xl border border-[#E0E0E0] shadow-sm hover:shadow-md transition-shadow duration-300">
                                <div className="text-sm font-semibold text-[#333333] mb-3 flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <Sliders
                                      size={14}
                                      className="text-[#1E90FF]"
                                    />
                                    <span>RADIO CALIBRATION</span>
                                  </div>
                                  <button
                                    onClick={async () => {
                                      try {
                                        const response = await fetch(
                                          "http://localhost:8000/calibrate_radio",
                                          { method: "POST" }
                                        );
                                        if (!response.ok)
                                          throw new Error("Calibration failed");
                                        alert(
                                          "Radio calibration started! Move all controls through their full range."
                                        );
                                      } catch (error) {
                                        alert(error.message);
                                      }
                                    }}
                                    className="px-3 py-1 bg-[#1E90FF] text-white text-xs rounded-lg hover:bg-[#1C86EE]"
                                  >
                                    Start Calibration
                                  </button>
                                </div>
                                <div className="text-xs text-[#666666] mb-2">
                                  Move all radio control sticks and switches
                                  through their full range and observe the
                                  min/max values.
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="p-2 bg-[#F5F7FA] rounded-lg">
                                    <div className="text-xs text-[#666666]">
                                      Roll
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-xs">Min: 1000</span>
                                      <span className="text-xs">Max: 2000</span>
                                    </div>
                                    <div className="w-full h-2 bg-[#E0E0E0] rounded-full mt-1">
                                      <div className="h-full w-1/2 bg-[#1E90FF] rounded-full"></div>
                                    </div>
                                  </div>
                                  <div className="p-2 bg-[#F5F7FA] rounded-lg">
                                    <div className="text-xs text-[#666666]">
                                      Pitch
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-xs">Min: 1000</span>
                                      <span className="text-xs">Max: 2000</span>
                                    </div>
                                    <div className="w-full h-2 bg-[#E0E0E0] rounded-full mt-1">
                                      <div className="h-full w-1/2 bg-[#1E90FF] rounded-full"></div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Compass Calibration */}
                              <div className="p-4 bg-white rounded-xl border border-[#E0E0E0] shadow-sm hover:shadow-md transition-shadow duration-300">
                                <div className="text-sm font-semibold text-[#333333] mb-3 flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <Compass
                                      size={14}
                                      className="text-[#1E90FF]"
                                    />
                                    <span>COMPASS CALIBRATION</span>
                                  </div>
                                  <button
                                    onClick={async () => {
                                      try {
                                        const response = await fetch(
                                          "http://localhost:8000/calibrate_compass",
                                          { method: "POST" }
                                        );
                                        if (!response.ok)
                                          throw new Error("Calibration failed");
                                        alert(
                                          "Compass calibration started! Rotate drone in all directions."
                                        );
                                      } catch (error) {
                                        alert(error.message);
                                      }
                                    }}
                                    className="px-3 py-1 bg-[#1E90FF] text-white text-xs rounded-lg hover:bg-[#1C86EE]"
                                  >
                                    Start Calibration
                                  </button>
                                </div>
                                <div className="text-xs text-[#666666] mb-2">
                                  Rotate the vehicle around all axes until the
                                  progress bar is full. Keep away from metal
                                  objects.
                                </div>
                                <div className="p-3 bg-[#F5F7FA] rounded-lg">
                                  <div className="text-xs text-[#666666] mb-1">
                                    Calibration Progress
                                  </div>
                                  <div className="w-full h-3 bg-[#E0E0E0] rounded-full overflow-hidden">
                                    <div className="h-full w-1/4 bg-[#1E90FF] rounded-full"></div>
                                  </div>
                                  <div className="text-right text-xs mt-1">
                                    25% Complete
                                  </div>
                                </div>
                              </div>

                              {/* ESC Calibration */}
                              <div className="p-4 bg-white rounded-xl border border-[#E0E0E0] shadow-sm hover:shadow-md transition-shadow duration-300">
                                <div className="text-sm font-semibold text-[#333333] mb-3 flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <Zap size={14} className="text-[#1E90FF]" />
                                    <span>ESC CALIBRATION</span>
                                  </div>
                                  <button
                                    onClick={async () => {
                                      if (
                                        window.confirm(
                                          "WARNING: Remove propellers before proceeding!"
                                        )
                                      ) {
                                        try {
                                          const response = await fetch(
                                            "http://localhost:8000/calibrate_esc",
                                            { method: "POST" }
                                          );
                                          if (!response.ok)
                                            throw new Error(
                                              "Calibration failed"
                                            );
                                          alert("ESC calibration started!");
                                        } catch (error) {
                                          alert(error.message);
                                        }
                                      }
                                    }}
                                    className="px-3 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600"
                                  >
                                    Calibrate ESCs
                                  </button>
                                </div>
                                <div className="text-xs text-[#666666] mb-2 p-2 bg-red-50 border border-red-100 rounded-lg">
                                  <span className="font-semibold text-red-500">
                                    WARNING:
                                  </span>{" "}
                                  Remove propellers before ESC calibration. This
                                  process will arm motors.
                                </div>
                                <div className="p-2 bg-[#F5F7FA] rounded-lg">
                                  <div className="text-xs text-[#666666]">
                                    Status
                                  </div>
                                  <div className="text-sm font-medium">
                                    Ready for calibration
                                  </div>
                                </div>
                              </div>

                              {/* Flight Modes */}
                              <div className="p-4 bg-white rounded-xl border border-[#E0E0E0] shadow-sm hover:shadow-md transition-shadow duration-300">
                                <div className="text-sm font-semibold text-[#333333] mb-3 flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <Plane
                                      size={14}
                                      className="text-[#1E90FF]"
                                    />
                                    <span>FLIGHT MODES</span>
                                  </div>
                                  <button
                                    onClick={saveFlightModes}
                                    className="px-3 py-1 bg-[#1E90FF] text-white text-xs rounded-lg hover:bg-[#1C86EE]"
                                  >
                                    Save Modes
                                  </button>
                                </div>
                                <div className="space-y-2">
                                  {[1, 2, 3].map((modeNum) => (
                                    <div
                                      key={modeNum}
                                      className="flex justify-between items-center p-2 bg-[#F5F7FA] rounded-lg"
                                    >
                                      <span className="text-xs text-[#666666]">
                                        Mode {modeNum}
                                      </span>
                                      <select
                                        value={flightModes[`mode${modeNum}`]}
                                        onChange={(e) =>
                                          setFlightModes((prev) => ({
                                            ...prev,
                                            [`mode${modeNum}`]: e.target.value,
                                          }))
                                        }
                                        className="text-sm bg-white border border-[#E0E0E0] rounded px-2 py-1"
                                      >
                                        {Object.keys(FLIGHT_MODE_MAP).map(
                                          (mode) => (
                                            <option key={mode} value={mode}>
                                              {mode}
                                            </option>
                                          )
                                        )}
                                      </select>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Failsafe */}
                              <div className="p-4 bg-white rounded-xl border border-[#E0E0E0] shadow-sm hover:shadow-md transition-shadow duration-300">
                                <div className="text-sm font-semibold text-[#333333] mb-3 flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <AlertTriangle
                                      size={14}
                                      className="text-[#1E90FF]"
                                    />
                                    <span>FAILSAFE SETTINGS</span>
                                  </div>
                                  <button
                                    onClick={saveFailsafeSettings}
                                    className="px-3 py-1 bg-[#1E90FF] text-white text-xs rounded-lg hover:bg-[#1C86EE]"
                                  >
                                    Save Settings
                                  </button>
                                </div>
                                <div className="space-y-3">
                                  {["battery", "rc", "gcs"].map((type) => (
                                    <div
                                      key={type}
                                      className="flex items-center justify-between p-2 bg-[#F5F7FA] rounded-lg"
                                    >
                                      <div>
                                        <div className="text-xs font-medium">
                                          {type.toUpperCase()} Failsafe
                                        </div>
                                        <div className="text-xs text-[#666666]">
                                          {type === "battery" &&
                                            "Action when battery is low"}
                                          {type === "rc" &&
                                            "Action on RC signal loss"}
                                          {type === "gcs" &&
                                            "Action on ground control loss"}
                                        </div>
                                      </div>
                                      <select
                                        value={failsafeSettings[type]}
                                        onChange={(e) =>
                                          setFailsafeSettings((prev) => ({
                                            ...prev,
                                            [type]: e.target.value,
                                          }))
                                        }
                                        className="text-sm bg-white border border-[#E0E0E0] rounded px-2 py-1"
                                      >
                                        {type === "gcs" ? (
                                          <>
                                            <option>Enabled</option>
                                            <option>Disabled</option>
                                          </>
                                        ) : (
                                          <>
                                            <option>RTL</option>
                                            <option>Land</option>
                                            <option>SmartRTL</option>
                                            <option>Disabled</option>
                                          </>
                                        )}
                                      </select>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4 px-4">
                            <div className="grid grid-cols-2 gap-4">
                              <TelemetryItem
                                label="ALTITUDE (m)"
                                value={telemetry.altitude}
                                color="text-[#1E90FF]"
                                icon={<ArrowUp size={14} />}
                              />
                              <TelemetryItem
                                label="GROUNDSPEED (m/s)"
                                value={telemetry.ground_speed}
                                color="text-[#1E90FF]"
                                icon={<Gauge size={14} />}
                              />

                              <TelemetryItem
                                label="YAW (deg)"
                                value={telemetry.yaw}
                                color="text-[#1E90FF]"
                                icon={<Compass size={14} />}
                              />
                              <TelemetryItem
                                label="VERTICAL SPEED (m/s)"
                                value={telemetry.vertical_speed}
                                color="text-[#1E90FF]"
                                icon={<ArrowUp size={14} />}
                              />
                              <TelemetryItem
                                label="BATTERY (%)"
                                value={telemetry.battery_remaining}
                                color={getBatteryColor()}
                                icon={getBatteryIcon()}
                              />
                              <TelemetryItem
                                label="BATTERY Voltage"
                                value={telemetry.battery_voltage}
                                color={getBatteryColor()}
                                icon={getBatteryIcon()}
                              />
                              <TelemetryItem
                                label="LATITUDE"
                                value={telemetry.latitude}
                                color="text-[#1E90FF]"
                                icon={<Globe size={14} />}
                              />
                              <TelemetryItem
                                label="LONGITUDE"
                                value={telemetry.longitude}
                                color="text-[#1E90FF]"
                                icon={<Globe size={14} />}
                              />
                            </div>
                            <div className="mt-6 flex justify-center">
                              <button
                                className={`px-6 py-3 rounded-xl font-semibold text-white transition-all duration-300 flex items-center space-x-2 hover:scale-105 shadow-md ${isArmed
                                  ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500"
                                  : "bg-gradient-to-r from-[#1E90FF] to-[#6A5ACD] hover:from-[#1C86EE] hover:to-[#5D52B1]"
                                  }`}
                                onClick={toggleArmed}
                              >
                                <Power
                                  size={18}
                                  className={
                                    isArmed ? "text-red-200" : "text-white"
                                  }
                                />
                                <span>{isArmed ? "DISARM" : "ARM"}</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Map */}
          <div
            className={`w-full bg-white flex flex-col relative ${activeTab === "DATA" ? "hidden md:flex" : "flex"
              }`}
          >
            {isLoaded ? (
              <>
                {/* Map Component */}
                <div className="w-full h-full relative">
                  <div className="absolute top-4 left-4 bg-white p-4 rounded-lg shadow-lg space-y-4 z-10">
                    {/* Mission Controls - Only show buttons when on flight plan screen */}
                    <div className="space-y-2">
                      {activeTab === "PLAN" && (
                        <>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setPolygonMode(!polygonMode)}
                              className={`flex-1 ${polygonMode ? "bg-[#1E90FF]" : "bg-[#1E90FF]"
                                } hover:bg-[#1C86EE] text-white font-bold py-2 px-4 rounded-lg`}
                            >
                              {polygonMode
                                ? "🚫 Exit Polygon Mode"
                                : "⬛ Draw Polygon"}
                            </button>
                          </div>

                          {/* Focus on Drone Button - Only shown in PLAN tab */}
                          <button
                            onClick={focusOnDrone}
                            className="w-full bg-[#1E90FF] hover:bg-[#1C86EE] text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2"
                          >
                            <Plane size={16} /> Focus on Drone
                          </button>
                        </>
                      )}

                      {/* Polygon Mission Parameters */}
                      {polygonCorners.length > 0 && (
                        <div className="space-y-2">
                          <input
                            type="number"
                            value={missionAltitude}
                            onChange={(e) => setMissionAltitude(e.target.value)}
                            placeholder="Altitude (meters)"
                            className="w-full p-2 border border-[#E0E0E0] rounded-lg"
                          />
                          <input
                            type="number"
                            value={overlap}
                            onChange={(e) => setOverlap(e.target.value)}
                            placeholder="Overlap (0-1)"
                            step="0.1"
                            min="0"
                            max="1"
                            className="w-full p-2 border border-[#E0E0E0] rounded-lg"
                          />
                          <button
                            onClick={handleGeneratePolygonMission}
                            className="w-full bg-[#1E90FF] hover:bg-[#1C86EE] text-white font-bold py-2 px-4 rounded-lg"
                          >
                            🌱 Generate Lawnmower Mission
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Video Feed in bottom right corner */}
                  <div className="absolute bottom-4 right-4 w-64 h-64 z-20 rounded-lg overflow-hidden shadow-lg">
                    <div className="w-full h-full bg-slate-900 rounded-lg">
                      <div className="relative w-full h-full">
                        {/* Video Feed */}
                        <VideoFeed active={connected} />

                        {/* Overlay with battery and speed */}
                        <div className="absolute top-0 left-0 right-0 bg-black/50 p-2 flex justify-between items-center">
                          <div className="flex items-center space-x-1">
                            {getBatteryIcon()}
                            <span className={`text-xs ${getBatteryColor()}`}>
                              {batteryLevel.toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Gauge className="text-blue-400" size={12} />
                            <span className="text-xs text-blue-400">
                              {droneSpeed.toFixed(1)} m/s
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <MapContainer
                    center={[currentLocation.lat, currentLocation.lng]}
                    zoom={mapZoom}
                    style={{ height: '100%', width: '100%' }}
                    className="z-10"
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <MapClickHandler handleMapClick={handleMapClick} isFlightPlan={isFlightPlan} />
                    {/* Drone marker */}
                    {currentLocation.lat && currentLocation.lng && !isNaN(currentLocation.lat) && !isNaN(currentLocation.lng) && (
                      <Marker
                        position={[currentLocation.lat, currentLocation.lng]}
                        icon={droneIcon}
                        title="Drone Location"
                      />
                    )}
                    {/* Waypoint markers */}
                    {waypoints.map((wp, index) => (
                      <Marker
                        key={index}
                        position={[wp.lat, wp.lng]}
                        icon={waypointIcon}
                        eventHandlers={{
                          click: () => setSelectedWaypoint(wp),
                        }}
                      >
                        <Popup>{`Waypoint ${index + 1}`}</Popup>
                      </Marker>
                    ))}

                    {/* Waypoint polyline */}
                    {waypoints.length > 1 && (
                      <Polyline
                        positions={waypoints.map(wp => [wp.lat, wp.lng])}
                        color="blue"
                      />
                    )}

                    {/* Polygon */}
                    {polygonCorners.length > 2 && (
                      <Polygon
                        positions={polygonCorners.map(corner => [corner.lat, corner.lng])}
                        color="purple"
                        fillOpacity={0.3}
                      />
                    )}
                    {polygonCorners.map((corner, index) => (
                      <Marker
                        key={index}
                        position={[corner.lat, corner.lng]}
                        icon={waypointIcon}
                        eventHandlers={{
                          click: () => setSelectedPolygonPoint(corner),
                        }}
                      />
                    ))}
                    {/* Polygon Corners */}
                    {/*                     {/* Selected Waypoint InfoWindow */}
                    {selectedWaypoint && (
                      <Popup position={[selectedWaypoint.lat, selectedWaypoint.lng]}>
                        <div className="bg-white p-4 rounded-lg shadow-lg max-w-[300px]">
                          <h3 className="font-bold text-lg mb-2">
                            🎯 Waypoint {waypoints.indexOf(selectedWaypoint) + 1}
                          </h3>
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <p className="text-sm">
                                <span className="font-semibold">🌐 Latitude:</span>
                                {selectedWaypoint.lat?.toFixed(6)}
                              </p>
                              <p className="text-sm">
                                <span className="font-semibold">🌐 Longitude:</span>
                                {selectedWaypoint.lng?.toFixed(6)}
                              </p>
                            </div>
                            <button
                              onClick={() => handleFlyHere(selectedWaypoint)}
                              className="bg-[#1E90FF] hover:bg-[#1C86EE] text-white font-bold py-2 px-4 rounded w-full"
                            >
                              ✈️ Fly Here
                            </button>
                          </div>
                        </div>
                      </Popup>
                    )}

                    {/* Selected Polygon Point InfoWindow */}
                    {selectedPolygonPoint && (
                      <InfoWindow
                        position={selectedPolygonPoint}
                        onCloseClick={() => setSelectedPolygonPoint(null)}
                      >
                        <div className="bg-white p-4 rounded-lg shadow-lg max-w-[300px]">
                          <h3 className="font-bold text-lg mb-2">
                            📍 Polygon Point{" "}
                            {polygonCorners.indexOf(selectedPolygonPoint) + 1}
                          </h3>
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 gap-2">
                              <p className="text-sm">
                                <span className="font-semibold">
                                  🌐 Latitude:
                                </span>{" "}
                                {selectedPolygonPoint.lat?.toFixed(6)}
                              </p>
                              <p className="text-sm">
                                <span className="font-semibold">
                                  🌐 Longitude:
                                </span>{" "}
                                {selectedPolygonPoint.lng?.toFixed(6)}
                              </p>
                              <p className="text-sm">
                                <span className="font-semibold">
                                  ⬆️ Altitude:
                                </span>{" "}
                                {selectedPolygonPoint.alt} m
                              </p>
                            </div>
                            <button
                              onClick={() =>
                                removePolygonPoint(
                                  polygonCorners.indexOf(selectedPolygonPoint)
                                )
                              }
                              className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded w-full"
                            >
                              🗑️ Remove Point
                            </button>
                          </div>
                        </div>
                      </InfoWindow>
                    )}

                    {/* Drone Marker - Using current location from telemetry */}
                    {/* {isLoaded && ( */}
                    {/* <Marker
                        position={currentLocation}  // Changed from hardcoded coordinates
                        icon={{
                          path: window.google.maps.SymbolPath.CIRCLE,
                          scale: 15,
                          fillColor: "#FF0000",
                          fillOpacity: 0.8,
                          strokeColor: "#000000",
                          strokeWeight: 2,
                        }}
                        title="Drone Location"
                        zIndex={1000}
                      /> */}
                    {/* )} */}
                  </MapContainer>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full bg-[#F5F7FA] text-[#333333]">
                <div className="animate-spin mr-2">
                  <Compass size={24} />
                </div>
                <span>LOADING MAP...</span>
              </div>
            )}

            {/* Overlay for battery and speed indicators */}
            <div className="absolute top-4 right-4 bg-white/80 p-3 rounded-lg shadow-lg backdrop-blur-sm border border-[#E0E0E0] z-10">
              <div className="flex flex-col space-y-2">
                <div className="flex items-center space-x-2">
                  {getBatteryIcon()}
                  <div className="flex flex-col">
                    <span className="text-xs text-[#666666]">Battery</span>
                    <span
                      className={`text-sm font-semibold ${getBatteryColor()}`}
                    >
                      {telemetry.battery_remaining}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Gauge className="text-[#1E90FF]" size={16} />
                  <div className="flex flex-col">
                    <span className="text-xs text-[#666666]">Speed</span>
                    <span className="text-sm font-semibold text-[#1E90FF]">
                      {telemetry.ground_speed?.toFixed(1)} m/s
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <ArrowUp className="text-[#1E90FF]" size={16} />
                  <div className="flex flex-col">
                    <span className="text-xs text-[#666666]">Altitude</span>
                    <span className="text-sm font-semibold text-[#1E90FF]">
                      {telemetry.altitude} m
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Waypoints Panel */}
            <div className="md:hidden absolute bottom-4 left-4 right-4 bg-white/90 p-3 rounded-lg shadow-lg backdrop-blur-sm border border-[#E0E0E0] z-10 max-h-48 overflow-auto">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-sm">Waypoints</h3>
              </div>
              {waypoints.length > 0 ? (
                <div className="space-y-1">
                  {waypoints.map((wp, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center bg-[#F5F7FA] p-1 rounded text-xs"
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
                <div className="text-center text-xs text-[#666666]">
                  Tap on the map to add waypoints
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="bg-[#F5F7FA] border-t border-[#E0E0E0] py-4 px-6">
          <div className="flex justify-around items-center">
            <TabButton
              label="Quick"
              icon={
                <FaBolt
                  size={15}
                  className={
                    activeTabButton === "Quick"
                      ? "text-[#1E90FF]"
                      : "text-[#666666]"
                  }
                />
              }
              active={activeTabButton === "Quick"}
              onClick={() => {
                setActiveTabButton("Quick");
                setIsDialogOpen(true);
              }}
            />
            <TabButton
              label="Actions"
              icon={
                <FaCog
                  size={15}
                  className={
                    activeTabButton === "Actions"
                      ? "text-[#1E90FF]"
                      : "text-[#666666]"
                  }
                />
              }
              active={activeTabButton === "Actions"}
              onClick={() => {
                setActiveTabButton("Actions");
                setIsDialogOpen(true);
              }}
            />
            <TabButton
              label="Messages"
              icon={
                <FaEnvelope
                  size={15}
                  className={
                    activeTabButton === "Messages"
                      ? "text-[#1E90FF]"
                      : "text-[#666666]"
                  }
                />
              }
              active={activeTabButton === "Messages"}
              onClick={() => {
                setActiveTabButton("Messages");
                setIsDialogOpen(true);
              }}
            />
            <TabButton
              label="FlightPlan"
              icon={
                <FaPlane
                  size={15}
                  className={
                    activeTabButton === "FlightPlan"
                      ? "text-[#1E90FF]"
                      : "text-[#666666]"
                  }
                />
              }
              active={activeTabButton === "FlightPlan"}
              onClick={() => {
                setActiveTabButton("FlightPlan");
                setIsDialogOpen(true);
              }}
            />
            <TabButton
              label="Pre Flight"
              icon={
                <FaPlane
                  size={15}
                  className={
                    activeTabButton === "Pre Flight"
                      ? "text-[#1E90FF]"
                      : "text-[#666666]"
                  }
                />
              }
              active={activeTabButton === "Pre Flight"}
              onClick={() => {
                setActiveTabButton("Pre Flight");
                setIsDialogOpen(true);
              }}
            />
            <TabButton
              label="Status"
              icon={
                <FaChartBar
                  size={15}
                  className={
                    activeTabButton === "Status"
                      ? "text-[#1E90FF]"
                      : "text-[#666666]"
                  }
                />
              }
              active={activeTabButton === "Status"}
              onClick={() => {
                setActiveTabButton("Status");
                setIsDialogOpen(true);
              }}
            />
            <TabButton
              label="Setup"
              icon={
                <Settings
                  size={15}
                  className={
                    activeTabButton === "Setup"
                      ? "text-[#1E90FF]"
                      : "text-[#666666]"
                  }
                />
              }
              active={activeTabButton === "Setup"}
              onClick={() => {
                setActiveTabButton("Setup");
                setIsDialogOpen(true);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Component for navigation buttons
function NavButton({ icon, label, active, onClick }) {
  "use client";
  return (
    <button
      className={`px-3 md:px-5 py-2 rounded-full flex items-center space-x-1 md:space-x-2 transition-all duration-300 ${active
        ? "bg-[#1E90FF] text-white shadow-md"
        : "bg-[#F5F7FA] text-[#333333] hover:bg-[#E6F0FA]"
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
      className={`p-3 rounded-lg flex items-center space-x-3 transition-all duration-300 w-full ${active
        ? "bg-gradient-to-r from-[#1E90FF] to-[#6A5ACD] text-white shadow-md"
        : "bg-white text-[#333333] hover:bg-[#E6F0FA]"
        }`}
      onClick={onClick}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}

function ActionButton({ icon, label, onClick, className }) {
  "use client";
  return (
    <button
      className={`p-4 rounded-xl font-semibold flex flex-col items-center justify-center space-y-2 transition-all duration-300 hover:scale-105 shadow-md bg-gradient-to-r from-[#1E90FF] to-[#6A5ACD] text-white hover:from-[#1C86EE] hover:to-[#5D52B1] ${className}`}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function TabButton({ label, icon, active, onClick }) {
  return (
    <button
      className={`flex flex-col items-center justify-center space-y-1 px-3 py-2 rounded-lg transition-all duration-300 ${active
        ? "bg-gradient-to-r from-[#1E90FF] to-[#6A5ACD] text-white shadow-md"
        : "bg-white text-[#333333] hover:bg-[#E6F0FA]"
        }`}
      onClick={onClick}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

function TelemetryItem({ label, value, color, icon }) {
  "use client";
  return (
    <div className="p-3 bg-white rounded-xl border border-[#E0E0E0] shadow-sm">
      <div className="text-xs text-[#666666] mb-1">{label}</div>
      <div
        className={`text-lg font-semibold ${color} flex items-center space-x-2`}
      >
        {icon}
        <span>{value}</span>
      </div>
    </div>
  );
}
