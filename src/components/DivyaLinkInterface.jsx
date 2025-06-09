"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import React from "react";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
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
  Marker,
  Polyline,
  Polygon,
  InfoWindow,
} from "@react-google-maps/api";
import VideoFeed from "./VideoFeed";
import PreflightChecks from "./Preflight";

// Mock Google Maps API key - in a real app, use environment variables
const googleAPIKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
// const googleAPIKey = "AIzaSyBzN-QQm82VLEp30jxV2UvNCA3k8C0Hnak";

const containerStyle = {
  width: "100%",
  height: "100%",
};

const frameTypeOptions = {
  0: "Quadcopter", // 4 motors
  1: "Hexacopter", // 6 motors
  2: "Octocopter", // 8 motors
  3: "Tricopter", // 3 motors
  4: "Y6", // 6 motors, coaxial setup
};

const frameClassOptions = {
  0: "X Configuration", // 4 arms in an X pattern
  1: "Plus (+) Configuration", // 4 arms in a "+" pattern
  2: "H Configuration", // Used for coaxial setups
  3: "V Configuration", // Used for Tricopters
  4: "Coaxial", // Two stacked motors on each arm
};

export default function DivyalinkInterface() {
  const [configuring, setConfiguring] = useState(false);
  const [configured, setConfigured] = useState(false);

  const [isConnecting, setIsConnecting] = useState(false);
  const [connecting, setConnecting] = useState(false); // UI spinner/disable

  const [isConnected, setIsConnected] = useState(false); // WebSocket connection status

  const [comPort, setComPort] = useState(""); // Selected COM port
  const [baudRate, setBaudRate] = useState(57600); // Selected baud rate

  const [frameType, setFrameType] = useState(0); // Default Quad
  const [frameClass, setFrameClass] = useState(1); // Default X
  const [currentTime, setCurrentTime] = useState("00:00:00");
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
    lat: -35.3632622,
    lng: 149.1652373,
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [polygonMode, setPolygonMode] = useState(false);
  const [polygonCorners, setPolygonCorners] = useState([]);
  const [selectedPolygonPoint, setSelectedPolygonPoint] = useState(null);
  const [missionAltitude, setMissionAltitude] = useState(50);
  const [overlap, setOverlap] = useState(0.3);
  const [defaultLogs] = useState([]);
  const [mapZoom, setMapZoom] = useState(18);

  const [connected, setConnected] = useState(false);
  const [ESCcalibrationStatus, ESCsetCalibrationStatus] = useState(
    "Ready for calibration"
  );
  const [isCalibrating, setESCIsCalibrating] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const reconnectInterval = useRef(null);
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
    radio: {},
    radio_sticks: {},
    compass_calibration: [
      {
        compass_id: 0,
        cal_status: 0,
        completion_pct: 0,
        direction_x: 0.0,
        direction_y: 0.0,
        direction_z: 0.0,
      },
      {
        compass_id: 1,
        cal_status: 0,
        completion_pct: 0,
        direction_x: 0.0,
        direction_y: 0.0,
        direction_z: 0.0,
      },
      {
        compass_id: 2,
        cal_status: 0,
        completion_pct: 0,
        direction_x: 0.0,
        direction_y: 0.0,
        direction_z: 0.0,
      },
    ],
  });
  const [frameClassSupported, setFrameClassSupported] = useState(true);
  const [altitude, setAltitude] = useState(10); // Default takeoff altitude
  const [ws, setWs] = useState(null);

  // --- Mission Planner Style Flight Modes ---
  const [flightModes, setFlightModes] = useState({}); // { FLTMODE1: 0, FLTMODE2: 2, ... }
  const [supportedModes, setSupportedModes] = useState({}); // { 0: 'Stabilize', ... }
  const [flightModesLoading, setFlightModesLoading] = useState(false);

  // Fetch current flight mode assignments and supported modes on connect AND poll every 2 seconds
  useEffect(() => {
    let retryTimeout;
    let pollInterval;
    const fetchFlightModes = (retryCount = 0) => {
      setFlightModesLoading(true);
      fetch("http://localhost:8000/get_flight_modes")
        .then((res) => {
          if (!res.ok) throw new Error(res.statusText);
          return res.json();
        })
        .then((data) => {
          if (data.assignments) setFlightModes(data.assignments);
          if (data.supported_modes) setSupportedModes(data.supported_modes);
        })
        .catch((e) => {
          cons.warn("Failed to fetch flight modes: " + e.message);
          if (retryCount < 5) {
            retryTimeout = setTimeout(
              () => fetchFlightModes(retryCount + 1),
              2000
            );
          }
        })
        .finally(() => setFlightModesLoading(false));
    };
    if (isConnected) {
      fetchFlightModes();
      pollInterval = setInterval(fetchFlightModes, 2000);
    }
    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isConnected]);

  // Helper: get mode name by id
  const getModeName = (id) =>
    supportedModes && supportedModes[id] ? supportedModes[id] : id;
  // Helper: get mode id by name
  const getModeIdByName = (name) => {
    if (!supportedModes) return null;
    return Object.keys(supportedModes).find(
      (key) => supportedModes[key] === name
    );
  };
  // Helper to convert degrees to compass direction
  function getCompassDirection(degrees) {
    if (typeof degrees !== "number" || isNaN(degrees)) return "Unknown";
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW", "N"];
    return dirs[Math.round((degrees % 360) / 45)];
  }
  // Save all flight mode assignments
  const saveFlightModes = async () => {
    try {
      setFlightModesLoading(true);
      // Save all 6 mode slots
      const responses = await Promise.all(
        Object.entries(flightModes).map(([slot, modeId], idx) =>
          fetch(`http://localhost:8000/set_flight_mode/${idx + 1}/${modeId}`, {
            method: "POST",
          })
        )
      );
      for (const response of responses) {
        if (!response.ok) throw new Error("Failed to set flight mode");
      }
      toast.success("Flight modes saved successfully");
      // Re-fetch to ensure sync
      const data = await fetch("http://localhost:8000/get_flight_modes").then(
        (r) => r.json()
      );
      if (data.assignments) setFlightModes(data.assignments);
    } catch (error) {
      toast.error(`Failed to save flight modes: ${error.message}`);
    } finally {
      setFlightModesLoading(false);
    }
  };

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
  const [calibrationStatus, setCalibrationStatus] =
    useState("Needs Calibration");
  const [statusColor, setStatusColor] = useState("text-amber-500");
  const [params, setParams] = useState([
    { param: "RATE_ROLL_P", value: 0.14 },
    { param: "RATE_PITCH_P", value: 0.14 },
    { param: "RATE_YAW_P", value: 0.18 },
  ]);

  const handleParamChange = (index, field, newValue) => {
    const newParams = [...params];
    newParams[index][field] =
      field === "value" ? parseFloat(newValue) : newValue;
    setParams(newParams);
  };

  const addNewParam = () => {
    setParams([...params, { param: "", value: 0.0 }]);
  };

  const sendParameters = async () => {
    try {
      const response = await fetch(
        "http://localhost:8000/set_initial_parameters",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(params),
        }
      );

      if (!response.ok) throw new Error("Failed to apply parameters");
      const data = await response.json();
      toast.success(data.message);
    } catch (error) {
      toast.error("Error: " + error.message);
    }
  };

  const calibrate = async () => {
    try {
      setCalibrationStatus("Calibration in Progress...");
      setStatusColor("text-gray-500");
      const response = await fetch(
        "http://localhost:8000/calibrate_accelerometer",
        { method: "POST" }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Unknown error");
      }
      // if (!response.ok) throw new Error("Calibration failed");
      toast.success(
        "Accelerometer calibration started! Follow drone instructions."
      );
      // setCalibrationStatus('Calibration in Progress...');

      // You might want to update status further based on success/failure
      // Example: After successful calibration
      // setTimeout(() => {
      setCalibrationStatus("Accelerometer Calibration Initiated");
      setStatusColor("text-green-500");
      // }, 2000);  // Simulate delay after calibration
    } catch (error) {
      setCalibrationStatus("Calibration Failed");
      setStatusColor("text-red-500");
      toast.success(error.message);
    }
  };
  // Frame Configuration
  {
    /*const configureFrame = async () => {
    try {
      const frameTypeResponse = await fetch(
        `http://localhost:8000/set_frame_type/${frameType}`,
        {
          method: "POST",
        }
      );
      if (!frameTypeResponse.ok) throw new Error("Failed to set frame type");

      const frameClassResponse = await fetch(
        `http://localhost:8000/set_parameter/FRAME_CLASS/${frameClass}`,
        {
          method: "POST",
        }
      );
      if (!frameClassResponse.ok) throw new Error("Failed to set frame class");

      // Re-fetch actual values from backend to ensure UI is in sync
      const [typeRes, classRes] = await Promise.all([
        fetch("http://localhost:8000/get_parameter/FRAME_TYPE").then((r) =>
          r.json()
        ),
        fetch("http://localhost:8000/get_parameter/FRAME_CLASS").then((r) =>
          r.json()
        ),
      ]);
      if (typeof typeRes.value !== "undefined")
        setFrameType(Number(typeRes.value));
      if (typeof classRes.value !== "undefined")
        setFrameClass(Number(classRes.value));

      toast.success("Frame configuration applied successfully");
    } catch (error) {
      toast.error(`Frame configuration failed: ${error.message}`);
    }
  };*/
  }

  {
    /*recasted frame configuration*/
  }

  const configureFrame = async () => {
    if (configuring || configured) return;

    setConfiguring(true);
    try {
      const frameTypeRes = await fetch(
        `http://localhost:8000/set_frame_type/${frameType}`,
        {
          method: "POST",
        }
      );
      if (!frameTypeRes.ok) throw new Error("Failed to set FRAME_TYPE");

      await fetch(
        `http://localhost:8000/set_parameter/FRAME_CLASS/${frameClass}`,
        {
          method: "POST",
        }
      ).catch(() => {}); // safely ignore if not supported

      await Promise.all([
        fetch("http://localhost:8000/get_parameter/FRAME_TYPE")
          .then((r) => r.json())
          .then((d) => setFrameType(Number(d.value))),
        fetch("http://localhost:8000/get_parameter/FRAME_CLASS")
          .then((r) => r.json())
          .then((d) => setFrameClass(Number(d.value)))
          .catch(() => {}),
      ]);

      toast.success("Frame configured!");
      setConfigured(true);
    } catch (err) {
      toast.error("Configuration failed: " + err.message);
    } finally {
      setConfiguring(false);
    }
  };

  // Fetch true frame type/class from backend when connected
  useEffect(() => {
    let retryTimeoutType, retryTimeoutClass, retryTimeoutModes;

    const fetchFrameType = (retryCount = 0) => {
      fetch("http://localhost:8000/get_parameter/FRAME_TYPE")
        .then((res) => {
          if (!res.ok) throw new Error(res.statusText);
          return res.json();
        })
        .then((data) => {
          if (typeof data.value !== "undefined")
            setFrameType(Number(data.value));
        })
        .catch((e) => {
          if (retryCount < 5) {
            retryTimeoutType = setTimeout(
              () => fetchFrameType(retryCount + 1),
              2000
            );
          } else {
            toast.error("Failed to fetch FRAME_TYPE: " + e.message);
          }
        });
    };
    {
      /*previous frame class*/
    }

    const fetchFrameClass = (retryCount = 0) => {
      fetch("http://localhost:8000/get_parameter/FRAME_CLASS")
        .then((res) => {
          if (!res.ok) throw new Error(res.statusText);
          return res.json();
        })
        .then((data) => {
          console.log("Frame Class Data:", data);
          if (typeof data.value !== "undefined")
            setFrameClass(Number(data.value));
        })
        .catch((e) => {
          if (retryCount < 5) {
            retryTimeoutClass = setTimeout(
              () => fetchFrameClass(retryCount + 1),
              2000
            );
          } else {
            console.log("Failed to fetch FRAME_CLASS:", e.message);
            toast.error(`Failed to fetch FRAME_CLASS: ${e.message}`);
          }
        });
    };

    const fetchFlightModes = (retryCount = 0) => {
      setFlightModesLoading(true);
      fetch("http://localhost:8000/get_flight_modes")
        .then((res) => {
          if (!res.ok) throw new Error(res.statusText);
          return res.json();
        })
        .then((data) => {
          if (data.assignments) setFlightModes(data.assignments);
          if (data.supported_modes) setSupportedModes(data.supported_modes);
        })
        .catch((e) => {
          if (retryCount < 5) {
            retryTimeoutModes = setTimeout(
              () => fetchFlightModes(retryCount + 1),
              2000
            );
          } else {
            toast.error("Failed to fetch flight modes: " + e.message);
          }
        })
        .finally(() => setFlightModesLoading(false));
    };
    if (isConnected) {
      fetchFrameType();
      fetchFrameClass();
      fetchFlightModes();
    }
    return () => {
      if (retryTimeoutType) clearTimeout(retryTimeoutType);
      if (retryTimeoutClass) clearTimeout(retryTimeoutClass);
      if (retryTimeoutModes) clearTimeout(retryTimeoutModes);
    };
  }, [isConnected]);

  // --- FLIGHT MODES UI RENDERING (Mission Planner style) ---
  // --- FLIGHT MODES UI RENDERING (Mission Planner style, 3 sections, show mode names) ---
  const renderFlightModesSection = () => {
    // Defensive: don't render if modes are not loaded
    if (
      !flightModes ||
      !supportedModes ||
      Object.keys(supportedModes).length === 0
    ) {
      return (
        <div style={{ color: "red", margin: 16 }}>
          No flight modes available. Please check connection and configuration.
        </div>
      );
    }

    // Get current mode slot from RC channel 5 (flight mode switch)
    // ArduPilot: RC channel 5 (chan5_raw) determines the slot (1-6)
    let currentSlot = null;
    const rc5 = telemetry?.radio_sticks?.aux1;
    if (typeof rc5 === "number") {
      // ArduPilot default PWM slot mapping:
      // 1230-1360: slot 1, 1361-1490: slot 2, 1491-1620: slot 3, 1621-1749: slot 4, 1750-1879: slot 5, 1880+: slot 6
      if (rc5 < 1230) currentSlot = 1;
      else if (rc5 < 1361) currentSlot = 2;
      else if (rc5 < 1491) currentSlot = 3;
      else if (rc5 < 1621) currentSlot = 4;
      else if (rc5 < 1750) currentSlot = 5;
      else if (rc5 < 1880) currentSlot = 6;
      else currentSlot = 6;
    }

    // Render all 6 slots in a single section
    return (
      <div className="mb-4 rounded-xl bg-gray-50 border border-gray-200 shadow-sm p-4">
        <h4 className="text-base font-semibold text-gray-700 mb-3">
          Flight Modes (1-6)
        </h4>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-2 px-3 text-left font-medium text-gray-600 rounded-tl-lg">
                  Slot
                </th>
                <th className="py-2 px-3 text-left font-medium text-gray-600">
                  Assigned Mode
                </th>
                <th className="py-2 px-3 text-center font-medium text-gray-600 rounded-tr-lg">
                  Active
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }, (_, i) => {
                const slot = `FLTMODE${i + 1}`;
                let assignedId = flightModes[slot];
                if (assignedId !== undefined && assignedId !== null)
                  assignedId = String(assignedId);
                // Show green dot only for the slot currently selected on the transmitter
                const isActive = currentSlot === i + 1;
                return (
                  <tr key={slot} className="border-b last:border-b-0">
                    <td className="py-2 px-3 font-semibold text-gray-700">
                      {slot.replace("FLTMODE", "Mode ")}
                    </td>
                    <td className="py-2 px-3">
                      <select
                        value={assignedId ?? ""}
                        onChange={(e) =>
                          setFlightModes((fm) => ({
                            ...fm,
                            [slot]: e.target.value,
                          }))
                        }
                        disabled={flightModesLoading}
                        className="min-w-[120px] px-2 py-1 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-blue-400 focus:border-blue-500 text-gray-800"
                      >
                        <option value="" disabled>
                          Select mode...
                        </option>
                        {Object.entries(supportedModes).map(([id, name]) => (
                          <option key={id} value={id}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-3 text-center">
                      {isActive ? (
                        <span className="text-green-500 font-bold text-lg">
                          ●
                        </span>
                      ) : (
                        ""
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ textAlign: "right", marginTop: 8 }}>
          <button
            onClick={saveFlightModes}
            disabled={flightModesLoading}
            className={
              "px-5 py-2 rounded-lg font-semibold text-white bg-gradient-to-r from-blue-500 to-purple-600 shadow-md hover:from-blue-600 hover:to-purple-700 transition-all duration-200" +
              (flightModesLoading ? " opacity-60 cursor-not-allowed" : "")
            }
          >
            Save Flight Modes
          </button>
        </div>
      </div>
    );
  };

  // Failsafe Settings Handler
  const saveFailsafeSettings = async () => {
    try {
      const responses = await Promise.all([
        fetch(
          `http://localhost:8000/set_parameter/FS_BATT_ACTION/${
            FAILSAFE_MAP[failsafeSettings.battery]
          }`,
          { method: "POST" }
        ),
        fetch(
          `http://localhost:8000/set_parameter/FS_RC_ACTION/${
            FAILSAFE_MAP[failsafeSettings.rc]
          }`,
          { method: "POST" }
        ),
        fetch(
          `http://localhost:8000/set_parameter/FS_GCS_ENABLE/${
            FAILSAFE_MAP[failsafeSettings.gcs]
          }`,
          { method: "POST" }
        ),
      ]);

      for (const response of responses) {
        if (!response.ok) throw new Error("Failed to set failsafe parameter");
      }
      toast.success("Failsafe settings saved successfully");
    } catch (error) {
      toast.error(`Failed to save failsafe settings: ${error.message}`);
    }
  };

  // Set up WebSocket connection
  useEffect(() => {
    // let websocket;
    if (isConnected) {
      const websocket = new WebSocket(
        `ws://localhost:8000/ws?comPort=${comPort}&baudRate=${baudRate}`
      );

      wsRef.current = websocket;
      websocket.onopen = () => console.log("WebSocket connected");

      websocket.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "connection") {
          if (msg.connected) {
            setConnected(true); // ✅ REAL connected
            setConnecting(false);
            Swal.close();
            toast.success("Drone connected!");
          } else {
            setConnected(false);
          }
        }

        if (msg.type === "telemetry") {
          setTelemetryData((prev) => ({ ...prev, ...msg.data }));
        }
      };

      websocket.onerror = (error) => console.error("WebSocket error:", error);

      websocket.onclose = () => {
        console.log("WebSocket closed");
        setConnected(false);
        setIsConnected(false);

        // if (isConnected) { // Only reconnect if we should be connected
        //   reconnectInterval.current = setInterval(() => {
        //     console.log("Attempting reconnect...");
        //     // Your connection logic
        //   }, 3000);
        // }
      };

      // setWs(websocket);
    }

    return () => {
      if (reconnectInterval.current) clearInterval(reconnectInterval.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isConnected, comPort, baudRate]);

  useEffect(() => {
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 15000);

    return () => clearInterval(pingInterval);
  }, []);

  // useEffect(() => {
  //   console.log(telemetry);

  // }, [telemetry])
  useEffect(() => {
    if (telemetry.arming?.armed !== undefined) {
      setIsArmed(telemetry.arming.armed);
      console.log(
        "Armed status updated:",
        telemetry.arming.armed ? "ARMED" : "DISARMED"
      );
    }
  }, [telemetry.arming?.armed]);

  // Send takeoff command

  const sendTakeoff = async () => {
    if (preflightStatus !== "completed") {
      Swal.fire({
        icon: "warning",
        title: "Preflight Required",
        text: "Preflight checks must be completed before takeoff.",
      });
      return;
    }

    const { value: altitude } = await Swal.fire({
      title: "Enter Takeoff Altitude",
      input: "number",
      inputLabel: "Altitude in meters",
      inputPlaceholder: "e.g., 10",
      inputAttributes: {
        min: 1,
        step: 1,
      },
      showCancelButton: true,
      confirmButtonText: "Takeoff",
    });

    if (!altitude || isNaN(altitude) || altitude <= 0) {
      Swal.fire({
        icon: "error",
        title: "Invalid Input",
        text: "Please enter a valid positive number for altitude.",
      });
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:8000/takeoff/${altitude}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to initiate takeoff.");
      }

      Swal.fire({
        icon: "success",
        title: `Takeoff Started at ${altitude} meters`,
        text: data.message,
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Takeoff Failed",
        text: error.message,
      });
    }
  };

  // Send land command
  const sendLand = () => {
    if (preflightStatus !== "completed") {
      toast.success("Preflight checks must be completed before landing.");
      return;
    }
    fetch("http://localhost:8000/land", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then((response) => response.json())
      .then((data) => toast.success(data.message))
      .catch((error) => toast.error("Error during landing: " + error));
  };

  // Use provided telemetry or default values

  // Mock loading script for Google Maps
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: googleAPIKey,
  });
  // console.log(isLoaded)

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
    if (telemetry.latitude && telemetry.longitude) {
      setCurrentLocation({
        lat: telemetry.latitude,
        lng: telemetry.longitude,
      });
      // console.log("Updated current location:", telemetry.latitude, telemetry.longitude);
    }
  }, [telemetry]);

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
  }, [isConnected]);

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

  const [armingInProgress, setArmingInProgress] = useState(false);

  // Toggle arm/disarm

  const toggleArmed = async () => {
    try {
      setArmingInProgress(true);

      if (!isArmed) {
        const response = await fetch("http://localhost:8000/arm_drone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || "Failed to arm the drone");
        }

        toast.success("Drone armed successfully!");
        setIsArmed(true);
      } else {
        const response = await fetch("http://localhost:8000/disarm_drone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || "Failed to disarm the drone");
        }

        toast.success("Drone disarmed successfully!");
        setIsArmed(false);
      }
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setArmingInProgress(false);
    }
  };

  // --- RADIO CALIBRATION STATE ---
  const radioChannels = [
    { label: "Roll", key: "roll" },
    { label: "Pitch", key: "pitch" },
    { label: "Throttle", key: "throttle" },
    { label: "Yaw", key: "yaw" },
    { label: "AUX1", key: "aux1" },
    { label: "AUX2", key: "aux2" },
    { label: "AUX3", key: "aux3" },
    { label: "AUX4", key: "aux4" },
  ];
  const [radioCalibrating, setRadioCalibrating] = useState(false);
  const [radioCalComplete, setRadioCalComplete] = useState(false);
  const [radioCalStatusMsg, setRadioCalStatusMsg] = useState("");
  const [radioMinMax, setRadioMinMax] = useState(() => {
    const obj = {};
    radioChannels.forEach((ch) => {
      obj[ch.key] = { min: 2000, max: 1000 };
    });
    return obj;
  });

  // --- RADIO CALIBRATION EFFECT ---
  useEffect(() => {
    if (!radioCalibrating) return;
    // Update min/max and force UI update on every telemetry change
    setRadioMinMax((prev) => {
      const updated = { ...prev };
      radioChannels.forEach((ch) => {
        const value = telemetry.radio_sticks?.[ch.key];
        if (typeof value === "number") {
          updated[ch.key] = {
            min: Math.min(prev[ch.key].min, value),
            max: Math.max(prev[ch.key].max, value),
          };
        }
      });
      return updated;
    });
  }, [telemetry.radio_sticks, radioCalibrating]);

  const handleStartRadioCal = async () => {
    // Step 1: Show first instruction
    await Swal.fire({
      title: "Radio Calibration",
      html: `<div style='text-align:left;'>Ensure your transmitter is <b>on</b> and receiver is powered and connected.<br><br><span style='color:red;font-weight:bold;'>Ensure your motor does not have power/no props!!!!</span></div>`,
      icon: "info",
      confirmButtonText: "Continue",
      allowOutsideClick: false,
      allowEscapeKey: false,
    });
    // Step 2: Show second instruction
    await Swal.fire({
      title: "Radio Calibration",
      html: `<div style='text-align:left;'>Click OK and <b>move all RC sticks and switches to their extreme positions</b> so the red bars hit the limits.</div>`,
      icon: "info",
      confirmButtonText: "OK",
      allowOutsideClick: false,
      allowEscapeKey: false,
    });
    // Now start calibration
    setRadioCalibrating(true);
    setRadioCalComplete(false);
    setRadioMinMax(() => {
      const obj = {};
      radioChannels.forEach((ch) => {
        obj[ch.key] = { min: 2000, max: 1000 };
      });
      return obj;
    });
    setRadioCalStatusMsg(
      "Calibration started. Move all sticks and switches through their full range."
    );
  };

  const handleSaveRadioCal = async () => {
    setRadioCalibrating(false);
    setRadioCalComplete(true);
    setRadioCalStatusMsg("Saving calibration...");
    await Swal.fire({
      title: "Radio Calibration",
      html: `<div style='text-align:left;'>Ensure all your sticks are centered and throttle is down and click Ok to continue</div>`,
      icon: "info",
      confirmButtonText: "OK",
      allowOutsideClick: false,
      allowEscapeKey: false,
    });
    setTimeout(() => {
      setRadioCalStatusMsg("Calibration saved successfully!");
      toast.success("Radio calibration saved!");
      // --- Show summary/report of min/max values ---

      const summaryHtml = `<table style='width:100%;text-align:left;'>
        <thead><tr><th>Channel</th><th>Min</th><th>Max</th></tr></thead>
        <tbody>
          ${radioChannels
            .map(
              (ch) =>
                `<tr><td>${ch.label}</td><td>${
                  radioMinMax[ch.key]?.min ?? "-"
                }</td><td>${radioMinMax[ch.key]?.max ?? "-"}</td></tr>`
            )
            .join("")}
        </tbody>
      </table>`;
      Swal.fire({
        title: "Radio Calibration Summary",
        html: summaryHtml,
        icon: "info",
        confirmButtonText: "OK",
        width: 400,
      });
    }, 500);
    // Optionally, send radioMinMax to backend here
  };

  // --- ESC CALIBRATION STATE ---
  const [escCalibrating, setEscCalibrating] = useState(false);
  const [escCalStatusMsg, setEscCalStatusMsg] = useState("");
  const [showEscInstructions, setShowEscInstructions] = useState(false);

  // --- ESC CALIBRATION HANDLER ---
  const handleStartEscCal = async () => {
    setEscCalibrating(true);
    setEscCalStatusMsg("Sending ESC calibration command to the drone...");
    setShowEscInstructions(false);
    try {
      const response = await fetch("http://localhost:8000/calibrate_esc", {
        method: "POST",
      });
      if (!response.ok) throw new Error("ESC calibration failed to start");
      setEscCalStatusMsg(
        "ESC calibration command sent. Please follow the instructions below."
      );
      setShowEscInstructions(true);
    } catch (e) {
      setEscCalStatusMsg("Failed to start ESC calibration.");
      setEscCalibrating(false);
      toast.error(e.message);
    }
  };

  // --- COMPASS CALIBRATION STATE ---
  const [compassCalibrating, setCompassCalibrating] = useState(false);
  const [compassCalDone, setCompassCalDone] = useState(false);
  const [compassCalStatusMsg, setCompassCalStatusMsg] = useState("");

  // Start compass calibration handler
  const handleStartCompassCal = async () => {
    setCompassCalibrating(true);
    setCompassCalDone(false);
    setCompassCalStatusMsg("Compass calibration started. Follow instructions.");
    try {
      const response = await fetch("http://localhost:8000/calibrate_compass", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to start compass calibration");
      // Optionally show a toast or message
    } catch (e) {
      setCompassCalibrating(false);
      setCompassCalStatusMsg("Failed to start compass calibration.");
      toast.error(e.message);
    }
  };

  // Listen for compass calibration completion from telemetry
  useEffect(() => {
    // If telemetry has compass.calibrated true or all compass_calibration cal_status are 3 (done)
    const allDone = telemetry?.compass_calibration?.every(
      (c) => c.cal_status === 3
    );
    if (compassCalibrating && (telemetry?.compass?.calibrated || allDone)) {
      setCompassCalibrating(false);
      setCompassCalDone(true);
      setCompassCalStatusMsg("Compass calibration complete!");
      toast.success("Compass calibration complete!");
    }
  }, [telemetry, compassCalibrating]);

  // Optionally, fallback: auto-complete after 30s if no telemetry
  useEffect(() => {
    if (compassCalibrating) {
      const timer = setTimeout(() => {
        if (compassCalibrating) {
          setCompassCalibrating(false);
          setCompassCalDone(true);
          setCompassCalStatusMsg(
            "Compass calibration (timeout fallback) complete!"
          );
        }
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [compassCalibrating]);

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
      toast.success("Lawnmower mission generated and started!");
      setPolygonCorners([]);
      setPolygonMode(false);
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    }
  };

  const handleFlyHere = async (waypoint) => {
    console.log(waypoint);
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
      toast.success("Navigating to waypoint!");
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleReturnToHome = async () => {
    try {
      const response = await fetch("http://localhost:8000/returntohome", {
        method: "POST",
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      toast.success("Returning to home location!");
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleStartMission = async () => {
    try {
      const currentLocation = {
        lat: telemetry.latitude,
        lon: telemetry.longitude,
        alt: missionAltitude, // Use the mission altitude or telemetry altitude
      };

      // Prepend the current location as the first waypoint
      const missionWaypoints = [
        currentLocation,
        ...waypoints.map((wp) => ({
          lat: wp.lat,
          lon: wp.lng,
          alt: wp.alt || missionAltitude,
        })),
      ];
      const response = await fetch("http://localhost:8000/start_mission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(missionWaypoints),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      toast.success("Mission started!");
    } catch (error) {
      toast.error(error.message);
    }
  };

  //end mission
  const handleEndMission = async () => {
    try {
      const response = await fetch("http://localhost:8000/end_mission", {
        method: "POST",
      });
      const data = await response.json();
      toast.success(data.message || "Mission ended.");
      setMissionStarted(false);
    } catch (err) {
      toast.error("Failed to end mission");
      console.error(err);
    }
  };

  const handleMapClick = (e) => {
    if (activeTabButton === "FlightPlan") {
      if (polygonMode) {
        const newCorner = {
          lat: e.latLng.lat(),
          lng: e.latLng.lng(),
          alt: missionAltitude,
        };
        setPolygonCorners([...polygonCorners, newCorner]);
      } else {
        const newWaypoint = {
          lat: e.latLng.lat(),
          lng: e.latLng.lng(),
          alt: missionAltitude,
        };
        setWaypoints([...waypoints, newWaypoint]);
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
    if (batteryLevel > 60) return <Battery className="text-emerald-400" />;
    if (batteryLevel > 20) return <BatteryMedium className="text-amber-500" />;
    return <BatteryLow className="text-red-500" />;
  };

  // Battery color based on level
  const getBatteryColor = () => {
    if (batteryLevel > 60) return "text-emerald-400";
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

  const [missionStarted, setMissionStarted] = useState(false);

  const [messageQueue, setMessageQueue] = useState([]);
  const [currentMessage, setCurrentMessage] = useState(null);
  const [seenTimestamps, setSeenTimestamps] = useState(new Set());

  useEffect(() => {
    if (!telemetry?.status_messages) return;

    const newMessages = telemetry.status_messages.filter(
      (msg) => !seenTimestamps.has(msg.timestamp)
    );

    if (newMessages.length > 0) {
      setMessageQueue((prev) => [...prev, ...newMessages]);
      setSeenTimestamps((prev) => {
        const updated = new Set(prev);
        newMessages.forEach((m) => updated.add(m.timestamp));
        return updated;
      });
    }
  }, [telemetry?.status_messages]);

  // --- Accelerometer Calibration State ---
  const accelSteps = [
    "Place the vehicle level and press Calibrate.",
    "Place LEFT side down.",
    "Place RIGHT side down.",
    "Place NOSE down.",
    "Place TAIL down.",
    "Place UPSIDE DOWN.",
    "Calibration complete!",
  ];
  const [accelCalibrating, setAccelCalibrating] = useState(false);
  const [accelCalStep, setAccelCalStep] = useState(0); // 0 = not started
  const [accelCalStatus, setAccelCalStatus] = useState("Idle");
  const [accelCalError, setAccelCalError] = useState("");
  const [accelCalDone, setAccelCalDone] = useState(false);
  const [accelCalPressKeyPrompt, setAccelCalPressKeyPrompt] = useState(false); // Track if 'press any key' prompt is active

  // Only show accelerometer calibration related messages
  const filterAccelCalMsgs = (msgs) => {
    if (!Array.isArray(msgs)) return [];
    // Keywords that indicate accel calibration messages
    const keywords = [
      "level",
      "left",
      "right",
      "nose",
      "tail",
      "upside",
      "press any key",
      "calibration failed",
      "successful",
      "error",
    ];
    return msgs.filter(
      (msg) =>
        typeof msg.text === "string" &&
        keywords.some((kw) => msg.text.toLowerCase().includes(kw))
    );
  };

  // Listen for telemetry status messages to update calibration step
  useEffect(() => {
    if (!accelCalibrating) return;
    if (!telemetry?.status_messages?.length) return;
    // const accelMsgs = filterAccelCalMsgs(telemetry.status_messages);
    // if (!accelMsgs.length) return;
    // console.log(accelMsgs)
    // const lastMsg = accelMsgs[accelMsgs.length - 1]?.text?.toLowerCase() || "";
    const lastMsg = telemetry?.status_messages?.at(0).text.toLowerCase();
    console.log(lastMsg);
    // Detect step prompts from firmware messages
    if (lastMsg.includes("calibration successful")) {
      setAccelCalStep(7);
      setAccelCalibrating(false);
      setAccelCalDone(true);
      setCalibrationStatus("Calibration Complete");
      setStatusColor("text-green-500");
    }
    // Detect 'press any key' prompt
    // if (lastMsg.includes("press any key")) setAccelCalPressKeyPrompt(true);
    // else setAccelCalPressKeyPrompt(false);
    // Detect error
    if (lastMsg.includes("failed") || lastMsg.includes("error")) {
      setAccelCalError(lastMsg);
      setAccelCalibrating(false);
      setCalibrationStatus("Calibration Failed");
      setStatusColor("text-red-500");
    }
  }, [telemetry.status_messages, accelCalibrating]);

  const handleAccelCalibrate = async () => {
    setAccelCalibrating(true);
    setAccelCalStep(1);
    setAccelCalStatus("Starting calibration...");
    setAccelCalError("");
    setAccelCalDone(false);
    setCalibrationStatus("Calibration in Progress...");
    setStatusColor("text-gray-500");
    try {
      const response = await fetch(
        "http://localhost:8000/calibrate_accelerometer",
        { method: "POST" }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Unknown error");
      }
      toast.success(
        "Accelerometer calibration started! Follow drone instructions."
      );
    } catch (error) {
      setAccelCalibrating(false);
      setCalibrationStatus("Calibration Failed");
      setStatusColor("text-red-500");
      setAccelCalError(error.message);
      toast.error(error.message);
    }
  };

  const handleAccelCalConfirmStep = async (vehiclePos) => {
    try {
      await fetch("http://localhost:8000/accel_confirm_step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehiclePos }),
      });
      setAccelCalPressKeyPrompt(false);
    } catch (e) {
      toast.error("Failed to confirm calibration step");
    }
  };
  // --- Accelerometer Offsets (Board Level) Calibration State ---
  const [accelOffsetsCalibrating, setAccelOffsetsCalibrating] = useState(false);
  const [accelOffsetsCalDone, setAccelOffsetsCalDone] = useState(false);
  const [accelOffsetsCalError, setAccelOffsetsCalError] = useState("");
  const [accelOffsetsCalStatus, setAccelOffsetsCalStatus] = useState("Idle");

  // Handler for board level calibration
  const handleAccelOffsetsCalibrate = async () => {
    setAccelOffsetsCalibrating(true);
    setAccelOffsetsCalDone(false);
    setAccelOffsetsCalError("");
    setAccelOffsetsCalStatus("Starting board level calibration...");
    try {
      const response = await fetch(
        "http://localhost:8000/calibrate_accel_offsets",
        { method: "POST" }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unknown error");
      setAccelOffsetsCalStatus(
        data.message || "Board level calibration command sent."
      );
      setAccelOffsetsCalibrating(false);
      setAccelOffsetsCalDone(true);
      toast.success("Accelerometer offsets (board level) calibration started!");
    } catch (error) {
      setAccelOffsetsCalError(error.message);
      setAccelOffsetsCalStatus("Calibration failed.");
      setAccelOffsetsCalibrating(false);
      setAccelOffsetsCalDone(false);
      toast.error(error.message);
    }
  };

  // --- Simple Accelerometer Calibration State ---
  const [accelSimpleCalibrating, setAccelSimpleCalibrating] = useState(false);
  const [accelSimpleCalDone, setAccelSimpleCalDone] = useState(false);
  const [accelSimpleCalError, setAccelSimpleCalError] = useState("");
  const [accelSimpleCalStatus, setAccelSimpleCalStatus] = useState("Idle");

  // Handler for simple accel calibration
  const handleAccelSimpleCalibrate = async () => {
    setAccelSimpleCalibrating(true);
    setAccelSimpleCalDone(false);
    setAccelSimpleCalError("");
    setAccelSimpleCalStatus("Starting simple accelerometer calibration...");
    try {
      const response = await fetch(
        "http://localhost:8000/calibrate_accel_simple",
        { method: "POST" }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unknown error");
      setAccelSimpleCalStatus(
        data.message || "Simple accelerometer calibration command sent."
      );
      setAccelSimpleCalibrating(false);
      setAccelSimpleCalDone(true);
      toast.success("Simple accelerometer calibration started!");
    } catch (error) {
      setAccelSimpleCalError(error.message);
      setAccelSimpleCalStatus("Calibration failed.");
      setAccelSimpleCalibrating(false);
      setAccelSimpleCalDone(false);
      toast.error(error.message);
    }
  };

  const displayHeading = useShortestRotation(telemetry.heading || 0);

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

      <div className="flex flex-col min-h-screen bg-black text-white select-none font-['Nasalization'] transition-colors duration-300">
        {/* Top Navigation Bar */}
        <div className="flex justify-between items-center bg-gradient-to-br from-slate-800/50 to-slate-700/50 hover:from-slate-700/70 border-b hover:to-black  transition-all duration-300 shadow-lg hover:shadow-glow  z-10">
          {/* Center: Branding */}
          <div className="flex-1 flex justify-center">
            <div className="relative md:text-xl  text-lg lg:text-3xl font-extrabold text-transparent  bg-clip-text bg-gradient-to-r sm:ml-3 md:ml-5 lg:ml-0 lg:mr-[60%] lg:mb-0 md:mb-0 mb-3 from-[#1E90FF] shadow-amber-100  to-[#6A5ACD] lg:pb-0 tracking-tighter">
              DIVYALINK
              <span className="absolute -bottom-2 left-0 text-xs text-white font-light tracking-widest ml-1 opacity-90">
                by Vayunotics
              </span>
            </div>
          </div>

          {/* Right Section: Connection Status */}
          <div className="  flex items-center space-x-6 md:space-x-8 sm:space-x-4">
            {/* Desktop Connection Status */}
            <div className=" hidden sm:flex  items-center space-x-5  px-5 md:px-7 py-2 md:py-2 rounded-2xl  shadow-xl hover:shadow-2xl transition-all duration-300">
              <div className="relative group">
                <select
                  value={comPort}
                  onChange={(e) => setComPort(e.target.value)}
                  className="md:w-44   p-3 bg-[#07041e] border border-[#5e5757] rounded-lg text-sm text-white font-medium focus:ring-2 focus:ring-blue-400 focus:border-blue-500 transition-all duration-200 appearance-none cursor-pointer"
                >
                  <option value="">-- Select COM Port --</option>
                  <option value="COM3">COM3</option>
                  <option value="COM4">COM4</option>
                  <option value="COM5">COM5</option>
                  <option value="COM7">COM7</option>
                  <option value="udp:127.0.0.1:14550">UDP</option>

                  <option value="tcp:127.0.0.1:5760">TCP</option>
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                  <svg
                    className="w-4 h-4 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
                <span className="absolute hidden group-hover:block -top-10 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded-lg px-2 py-1 transition-opacity duration-200">
                  Select a COM port
                </span>
              </div>
              <div className="relative group">
                <select
                  value={baudRate}
                  onChange={(e) => setBaudRate(Number(e.target.value))}
                  className="w-36 p-3 bg-[#07041e] border  border-[#5e5757] rounded-lg text-sm text-white font-medium focus:ring-2 focus:ring-blue-400 focus:border-blue-500 transition-all duration-200 appearance-none cursor-pointer"
                >
                  <option value={57600}>57600</option>
                  <option value={115200}>115200</option>
                  <option value={9600}>9600</option>
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                  <svg
                    className="w-4 h-4 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
                <span className="absolute hidden group-hover:block -top-10 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded-lg px-2 py-1 transition-opacity duration-200">
                  Select baud rate
                </span>
              </div>
              <div className="h-7 w-px bg-gradient-to-b from-gray-200 to-gray-300"></div>
              <div
                className="flex items-center space-x-4 cursor-pointer group"
                onClick={() => setConnected(!connected)}
              >
                <div
                  className={`md:w-4 md:h-4 sm:w-3 sm:h-3 rounded-full transition-all border-white  border-[1px] duration-300 ${
                    connected
                      ? "bg-blue-600 animate-pulse  "
                      : "bg-red-600 shadow-md"
                  }`}
                ></div>

                {/*changed here connect and disconnect*/}

                <button
                  onClick={() => {
                    if (connecting) return;

                    if (!connected) {
                      if (!comPort || !baudRate) {
                        toast.error("Please select COM port and baud rate");
                        return;
                      }

                      setConnecting(true); // UI disable
                      setIsConnected(true); // WebSocket trigger karega useEffect
                      Swal.fire({
                        title: "Connecting...",
                        html: "Please wait...",
                        allowOutsideClick: false,
                        didOpen: () => Swal.showLoading(),
                      });

                      // yeh wala onmessage me handle hoga:
                      // setConnected(true);
                    } else {
                      setConnecting(true);
                      Swal.fire({
                        title: "Disconnecting...",
                        html: "Please wait...",
                        allowOutsideClick: false,
                        didOpen: () => Swal.showLoading(),
                      });

                      setIsConnected(false); // WebSocket band karo
                      setTimeout(() => {
                        setConnected(false);
                        setConnecting(false);
                        Swal.close();
                        toast.success("Disconnected!");
                      }, 1000);
                    }
                  }}
                  disabled={
                    connecting || (!connected && (!comPort || !baudRate))
                  }
                  className={`md:px-6 md:py-2 sm:px-3 sm:py-2 rounded-md md:font-semibold font-medium border-[#17b4ed] border-1 text-white transition ${
                    connecting
                      ? "bg-gray-400 cursor-not-allowed"
                      : connected
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {connecting
                    ? connected
                      ? "DISCONNECTING..."
                      : "CONNECTING..."
                    : connected
                    ? "DISCONNECT"
                    : "CONNECT"}
                </button>
              </div>
            </div>

            {/* Mobile Connection Button */}
            <button
              className="sm:hidden flex items-center space-x-2 bg-gradient-to-br from-white to-blue-50/50 px-4 py-2.5 rounded-xl border border-gray-100 shadow-lg hover:shadow-xl hover:bg-blue-100/50 transition-all duration-300"
              onClick={() => setConnected(!connected)}
            >
              <div
                className={`w-3 h-3 rounded-full ${
                  connected
                    ? "bg-blue-600 animate-pulse shadow-md"
                    : "bg-red-600 shadow-sm"
                }`}
              ></div>
              <span
                className={`text-sm font-semibold tracking-wide ${
                  connected ? "text-blue-700" : "text-gray-800"
                }`}
              >
                {connected ? "ON" : "OFF"}
              </span>
            </button>
          </div>
        </div>

        {/* Status Message Bar */}
        {statusMessage && (
          <div className="bg-white p-2 text-center text-sm font-medium shadow-md">
            <div className="max-w-4xl mx-auto flex items-center justify-center space-x-2">
              <div className="h-1.5 w-full bg-[#E0E0E0] rounded-full overflow-hidden">
                <div className="h-full  bg-[#1E90FF]/50 animate-progress"></div>
              </div>
              <span className="whitespace-nowrap text-[#333333]">
                {statusMessage}
              </span>
            </div>
          </div>
        )}

        {/*part 3 */}

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Hidden on mobile when showing map */}
          <div
            className={`border-r border-[#E0E0E0] flex flex-col bg-white ${
              activeTab === "DATA" ? "block" : "hidden md:flex"
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
                  <div className="relative w-full md:w-1/3 h-full bg-gradient-to-tr from-[#141313] to-slate-900  border-r border-[#E0E0E0] p-4 overflow-y-auto">
                    <button
                      className="absolute top-2 right-2 text-[#666666] hover:text-[#333333] z-10"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      ✕
                    </button>
                    <div className="flex flex-col h-full">
                      {/* Compass Direction Bar */}

                      {/* Altitude Indicator */}
                      <div className="w-full h-[290px] flex-shrink-0 bg-gradient-to-b from-[#B3D4FF] pt-2   to-[#7DA8E6] border-b border-[#D1D5DB]">
                        <div className="relative h-[250px] flex items-center justify-center">
                          <div className="relative w-85 h-63">
                            {/* Background Frame */}
                            <div className="absolute  inset-0 rounded-xl bg-[#1F2A44] border  border-[#334155] shadow-xl" />
                            {/* Static sky background */}
                            <div className="absolute inset-2 rounded-lg overflow-hidden">
                              <div className="absolute inset-0 bg-gradient-to-b  from-[#509fff] to-[#B3E0FF]" />
                              <div
                                className="absolute left-1/2"
                                style={{
                                  transform: `translateX(-50%) rotate(${displayHeading}deg)`,
                                  transition: "transform 0.2s linear", // optional, for smoothness
                                }}
                              >
                                <div className="w-0.5 h-8 bg-blue-600 rounded-full  ml-1" />
                                <div className="w-3 h-3 bg-blue-600 rounded-full mx-auto mt-[-6px]" />
                              </div>
                              {/* Degree and direction label */}
                              <div className="absolute w-full text-center top-8 text-sm font-mono text-gray-800">
                                {typeof telemetry.heading === "number"
                                  ? `${telemetry.heading.toFixed(
                                      0
                                    )}° (${getCompassDirection(
                                      telemetry.heading
                                    )})`
                                  : "Unknown"}
                              </div>
                              {/* Dynamic land/horizon bar (zIndex -1 so overlays are visible) */}
                              <div
                                className="absolute left-0 w-full"
                                style={{
                                  height: "60%",
                                  top: `calc(50% + ${
                                    (telemetry.pitch || 0) * -1.5
                                  }px)`,
                                  transform: `rotate(${
                                    -telemetry.roll || 0
                                  }deg)`,
                                  background:
                                    "linear-gradient(to bottom, #4CAF50 60%, #388E3C 100%)",
                                  borderTop: "2px solid #fff",
                                  borderBottomLeftRadius: "16px",
                                  borderBottomRightRadius: "16px",
                                  zIndex: 0,
                                }}
                              />
                              <div className="absolute inset-0 border border-[#60A5FA]/40 rounded-lg pointer-events-none" />
                            </div>

                            {/* Pitch Lines and Markings (dynamic) */}
                            <div className="absolute inset-2 pointer-events-none select-none">
                              {/* Horizon Line */}
                              <div
                                className="absolute top-1/2 w-full h-0.5 bg-white/95 shadow-sm"
                                style={{
                                  transform: `translateY(${
                                    (telemetry.pitch || 0) * -1.5
                                  }px)`,
                                }}
                              />
                              {/* Pitch Markings (every 10 deg from -40 to +40) */}
                              {Array.from({ length: 9 }, (_, i) => {
                                const pitchVal = (i - 4) * 10;
                                if (pitchVal === 0) return null;
                                return (
                                  <div
                                    key={pitchVal}
                                    className="absolute left-0 w-full flex justify-between px-8"
                                    style={{
                                      top: `calc(50% + ${pitchVal * -1.5}px)`,
                                    }}
                                  >
                                    <div className="flex items-center space-x-1">
                                      <span className="text-white text-xs font-mono font-medium">
                                        {pitchVal > 0
                                          ? `+${pitchVal}°`
                                          : `${pitchVal}°`}
                                      </span>
                                      <div className="w-6 h-0.5 bg-white/95" />
                                    </div>
                                    <div className="flex items-center space-x-1">
                                      <div className="w-6 h-0.5 bg-white/95" />
                                      <span className="text-white text-xs font-mono font-medium">
                                        {pitchVal > 0
                                          ? `+${pitchVal}°`
                                          : `${pitchVal}°`}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Roll Markings (Top Arc, dynamic) */}
                              <div
                                className="absolute top-0 left-1/2"
                                style={{ transform: "translateX(-50%)" }}
                              >
                                <svg
                                  width="288"
                                  height="60"
                                  viewBox="0 0 288 60"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  {/* Arc */}
                                  <path
                                    d="M24,56 A120,120 0 0,1 264,56"
                                    stroke="#fff"
                                    strokeWidth="2"
                                    fill="none"
                                  />
                                  {/* Markers every 15 deg from -45 to +45 */}
                                  {Array.from({ length: 7 }, (_, i) => {
                                    const rollVal = (i - 3) * 15;
                                    const angle =
                                      (rollVal + 90) * (Math.PI / 180);
                                    const x = 144 + 120 * Math.cos(angle);
                                    const y = 56 - 120 * Math.sin(angle);
                                    return (
                                      <g key={rollVal}>
                                        <rect
                                          x={x - 1}
                                          y={y - 8}
                                          width="2"
                                          height="16"
                                          fill="#fff"
                                          transform={`rotate(${-rollVal},${x},${y})`}
                                        />
                                        <text
                                          x={x}
                                          y={y - 12}
                                          fill="#fff"
                                          fontSize="10"
                                          fontFamily="monospace"
                                          textAnchor="middle"
                                        >
                                          {rollVal}°
                                        </text>
                                      </g>
                                    );
                                  })}
                                </svg>
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
                                <span className="absolute bottom-[-35px] text-white/85 text-xs font-mono font-bold">
                                  AS:
                                  {telemetry.ground_speed?.toFixed(1) || "0.0"}{" "}
                                  m/s
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
                                <span className="absolute bottom-[-35px] text-white/85 text-xs font-mono font-bold">
                                  ALT: {telemetry.altitude?.toFixed(1) || "0.0"}{" "}
                                  m
                                </span>
                              </div>
                            </div>

                            {/* Telemetry Bar */}
                            <div className="absolute bottom-0 inset-x-0 p-2 bg-[#2A3A3B]/95 border-t border-[#3A4A4B] rounded-b-xl shadow-md">
                              <div className="flex justify-between items-center text-xs font-mono font-medium text-white/85">
                                <div>
                                  AS:{" "}
                                  {telemetry.ground_speed?.toFixed(1) || "0.0"}{" "}
                                  m/s | Elev:{" "}
                                  {telemetry.altitude?.toFixed(1) || "0.0"} m
                                </div>
                                <div className="flex flex-col items-center">
                                  <div
                                    className={`font-bold ${
                                      telemetry.arming?.armed
                                        ? "text-emerald-400"
                                        : "text-red-400"
                                    }`}
                                  >
                                    {isArmed ? "ARMED" : "DISARMED"}
                                  </div>
                                  <div
                                    className={`${
                                      telemetry.gps?.fix_type >= 3
                                        ? "text-emerald-400"
                                        : "text-red-400"
                                    } font-bold`}
                                  >
                                    {telemetry.gps?.fix_type >= 3
                                      ? "READY"
                                      : "NOT READY"}
                                  </div>
                                </div>
                                <div>
                                  {telemetry.altitude?.toFixed(1) || "0"} m |{" "}
                                  {telemetry.heading || "0"}° | GPS:{" "}
                                  {telemetry.gps?.fix_type >= 3
                                    ? `${telemetry.gps.satellites} Sats`
                                    : "No Fix"}
                                </div>
                              </div>
                              <div className="flex justify-center items-center text-xs font-mono font-medium text-white/85 mt-1">
                                <div>
                                  {telemetry.battery_voltage?.toFixed(2) ||
                                    "0.00"}
                                  V |{" "}
                                  {telemetry.battery_current?.toFixed(1) ||
                                    "0.0"}
                                  A | {telemetry.battery_remaining || "0"}% |
                                  EKF Vibe
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/*Action Button*/}

                      {/* Tab Content */}
                      <div className="flex-1 ">
                        {activeTabButton === "Actions" ? (
                          <div className="space-y-6 px-6 py-5 ">
                            {/* Header */}
                            <div className="h-[35px] mt-[-10px] mb-2 bg-[#0d062d] p-2 rounded-lg shadow-lg border border-gray-100 flex items-center justify-center gap-3 transition-transform duration-300 hover:scale-[1.01]">
                              <Settings size={18} className="text-cyan-400" />
                              <span className="text-white font-semibold text-base tracking-wide">
                                DRONE ACTIONS
                              </span>
                            </div>

                            {/* Combined Flight Controls Section */}
                            <div className="space-y-1 max-w-lg mx-auto">
                              <div className="text-sm font-semibold text-gray-800 flex items-center gap-2 justify-center">
                                <Plane size={18} className="text-cyan-400" />
                                <span className="text-white">
                                  FLIGHT AND MISSION CONTROLS
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-6 justify-center">
                                {/* TAKEOFF */}
                                <div className="group relative">
                                  <ActionButton
                                    icon={
                                      <Plane
                                        className="transform group-hover:scale-125 transition-transform duration-300"
                                        size={16}
                                      />
                                    }
                                    label="TAKEOFF"
                                    onClick={sendTakeoff} // unchanged
                                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-8 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105 w-full flex justify-center"
                                  />
                                  <div className="absolute bottom-full mb-2 hidden group-hover:block w-max px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg shadow-lg">
                                    Initiate takeoff sequence
                                  </div>
                                </div>

                                {/* LAND */}
                                <div className="group relative">
                                  <ActionButton
                                    icon={
                                      <Plane
                                        className="transform rotate-180 group-hover:scale-125 transition-transform duration-300"
                                        size={16}
                                      />
                                    }
                                    label="LAND"
                                    onClick={sendLand} // unchanged
                                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-8 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105 w-full flex justify-center"
                                  />
                                  <div className="absolute bottom-full mb-2 hidden group-hover:block w-max px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg shadow-lg">
                                    Initiate landing sequence
                                  </div>
                                </div>

                                {/* MISSION START */}
                                <div className="group relative">
                                  <ActionButton
                                    icon={
                                      <Play
                                        className="transform group-hover:scale-125 transition-transform duration-300"
                                        size={16}
                                      />
                                    }
                                    label="MISSION START"
                                    onClick={handleStartMission} // unchanged
                                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-8 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105 w-full flex justify-center"
                                  />
                                  <div className="absolute bottom-full mb-2 hidden group-hover:block w-max px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg shadow-lg">
                                    Start the pre-programmed mission
                                  </div>
                                </div>

                                {/* RETURN HOME */}
                                <div className="group relative">
                                  <ActionButton
                                    icon={
                                      <Home
                                        className="transform group-hover:scale-125 transition-transform duration-300"
                                        size={16}
                                      />
                                    }
                                    label="RETURN HOME"
                                    onClick={handleReturnToHome} // unchanged
                                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-8 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105 w-full flex justify-center"
                                  />
                                  <div className="absolute bottom-full mb-2 hidden group-hover:block w-max px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg shadow-lg">
                                    Return to the home position
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Navigation Controls Section */}
                            <div className="space-y-1">
                              <div className="text-sm font-semibold text-gray-800 flex items-center gap-2 justify-center">
                                <MapPin size={16} className="text-cyan-400" />
                                <span className="text-white">
                                  NAVIGATION CONTROLS
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-8 justify-center">
                                <div className="group relative">
                                  <ActionButton
                                    icon={
                                      <ArrowUp
                                        className="transform group-hover:scale-125 transition-transform duration-300"
                                        size={16}
                                      />
                                    }
                                    label="CHANGE ALTITUDE"
                                    onClick={async () => {
                                      const { value: altitude } =
                                        await Swal.fire({
                                          title: "Change Altitude",
                                          input: "number",
                                          inputLabel:
                                            "Enter new altitude in meters",
                                          inputPlaceholder: "e.g., 20",
                                          inputAttributes: {
                                            min: 1,
                                            step: 1,
                                          },
                                          showCancelButton: true,
                                          confirmButtonText: "Change",

                                          // 💡 Add these:
                                          position: "top-center", // 📍 Show top-right
                                          backdrop: false, // 🚫 No full-screen dark background

                                          customClass: {
                                            popup: "swal-altitude-popup", // 🎨 Custom style
                                          },
                                        });

                                      if (
                                        !altitude ||
                                        isNaN(altitude) ||
                                        altitude <= 0
                                      ) {
                                        return Swal.fire({
                                          icon: "error",
                                          title: "Invalid Input",
                                          text: "Please enter a valid positive number for altitude.",
                                        });
                                      }

                                      try {
                                        const response = await fetch(
                                          `http://localhost:8000/change_altitude/${altitude}`,
                                          {
                                            method: "POST",
                                          }
                                        );

                                        if (!response.ok)
                                          throw new Error(
                                            "Altitude change failed"
                                          );

                                        Swal.fire({
                                          icon: "success",
                                          title: "Success",
                                          text: `Altitude changed to ${altitude} meters!`,
                                        });
                                      } catch (error) {
                                        Swal.fire({
                                          icon: "error",
                                          title: "Error",
                                          text: error.message,
                                        });
                                      }
                                    }}
                                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                                  />
                                  <div className="absolute bottom-full mb-2 hidden group-hover:block w-max px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg shadow-lg">
                                    Adjust the drone's altitude
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : /*messages section*/

                        activeTabButton === "Messages" ? (
                          <div className="flex flex-col px-6 py-4  overflow-y-auto space-y-4">
                            {/* Header */}
                            <div className="bg-[#0d062d] p-4 rounded-xl shadow-lg border border-gray-100 flex items-center justify-center space-x-3 transform hover:scale-[1.01] transition-all duration-300">
                              <Settings size={18} className="text-cyan-400" />
                              <span className="text-white-800 font-semibold text-base tracking-wide">
                                SYSTEM MESSAGES
                              </span>
                            </div>

                            {/* Telemetry Messages */}
                            {telemetry?.status_messages?.length > 0 ? (
                              telemetry.status_messages.map((msg, index) => (
                                <div
                                  key={index}
                                  className={`rounded-lg px-4 py-3 text-sm border shadow-md ${
                                    msg.severity >= 4
                                      ? "bg-red-100 text-red-800 border-red-300"
                                      : msg.severity === 3
                                      ? "bg-amber-100 text-amber-800 border-amber-300"
                                      : "bg-blue-100 text-blue-800 border-blue-300"
                                  }`}
                                >
                                  <div className="flex justify-between items-center">
                                    <span className="truncate font-medium">
                                      {msg.text}
                                    </span>
                                    <span className="text-xs opacity-75 ml-4 whitespace-nowrap">
                                      {new Date(
                                        msg.timestamp
                                      ).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-center text-gray-500 text-sm py-6">
                                No system messages yet.
                              </div>
                            )}
                          </div>
                        ) : /* Flight Plan Editor Section */

                        activeTabButton === "FlightPlan" ? (
                          <div className="flex flex-col h-full px-2  rounded-2xl">
                            {/* Header */}
                            <div className="bg-[#08031d] border-white border-[1px] text-white p-1 text-center mt-2 font-bold rounded-md z-10 shadow-lg mb-[10px]">
                              <div className="flex items-center justify-center space-x-3">
                                <Layers size={20} />
                                <span className="text-lg tracking-wide">
                                  Flight Plan Editor
                                </span>
                              </div>
                            </div>

                            <div className="space-y-3 flex-1 overflow-auto">
                              {/* Waypoints Section */}
                              <div>
                                <div className="text-sm font-semibold text-gray-800 mb-3 flex items-center space-x-2">
                                  <MapPin size={16} className="text-cyan-400" />
                                  <span className="text-white">WAYPOINTS</span>
                                </div>
                                <div className="space-y-3">
                                  {waypoints.length > 0 ? (
                                    waypoints.map((wp, i) => (
                                      <div
                                        key={i}
                                        className="group p-4 bg-[#060423] hover:bg-[#0b0a11]  rounded-xl flex justify-between items-center border border-gray-100 transition-all duration-200 shadow-md hover:shadow-xl"
                                      >
                                        <div className="flex items-center space-x-3">
                                          <div className="w-7 h-7 rounded-full bg-cyan-600 flex items-center justify-center text-sm font-bold text-white">
                                            {i + 1}
                                          </div>
                                          <span className="text-sm font-medium text-white-800">
                                            {wp.name || `Waypoint ${i + 1}`}
                                          </span>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                          <span className="text-xs text-gray-400">
                                            {wp.lat.toFixed(4)},{" "}
                                            {wp.lng.toFixed(4)}
                                          </span>
                                          <button
                                            onClick={() => removeWaypoint(i)}
                                            className="p-1.5 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors duration-200"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                        <span className="absolute hidden group-hover:block -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded-lg px-2 py-1 shadow-md">
                                          Remove waypoint
                                        </span>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="p-4 bg-[#060423] hover:bg-[#0b0a11] rounded-xl border border-gray-100 text-center text-white-200 shadow-md">
                                      No waypoints added. Click on the map to
                                      add waypoints.
                                    </div>
                                  )}
                                </div>
                                {/* Total Distance */}
                                {waypoints.length >= 2 && (
                                  <div className="mt-4 p-4 bg-white rounded-xl border border-gray-100 shadow-md">
                                    <div className="text-sm font-semibold text-gray-800 flex items-center space-x-2">
                                      <Ruler
                                        size={16}
                                        className="text-blue-600"
                                      />
                                      <span>TOTAL DISTANCE</span>
                                    </div>
                                    <div className="mt-2 text-sm">
                                      <span className="font-semibold text-gray-800">
                                        {totalWaypointDistance} meters
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Polygon Points Section */}
                              {polygonMode && (
                                <div>
                                  <div className="text-sm font-semibold text-gray-800 mb-3 flex items-center space-x-2">
                                    <Layers
                                      size={16}
                                      className="text-blue-600"
                                    />
                                    <span>POLYGON POINTS</span>
                                  </div>
                                  <div className="space-y-3">
                                    {polygonCorners.length > 0 ? (
                                      polygonCorners.map((point, i) => (
                                        <div
                                          key={i}
                                          className="group p-4 bg-white rounded-xl flex justify-between items-center border border-gray-100 hover:bg-blue-50/50 transition-all duration-200 shadow-md hover:shadow-xl"
                                        >
                                          <div className="flex items-center space-x-3">
                                            <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center text-sm font-bold text-white">
                                              {i + 1}
                                            </div>
                                            <span className="text-sm font-medium text-gray-800">
                                              Point {i + 1}
                                            </span>
                                          </div>
                                          <div className="flex flex-col items-end space-y-1">
                                            <span className="text-xs text-gray-600">
                                              Lat: {point.lat.toFixed(6)}, Lng:{" "}
                                              {point.lng.toFixed(6)}
                                            </span>
                                            <span className="text-xs text-gray-600">
                                              Alt: {point.alt}m
                                            </span>
                                            <button
                                              onClick={() =>
                                                removePolygonPoint(i)
                                              }
                                              className="mt-1 p-1.5 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors duration-200"
                                            >
                                              ✕
                                            </button>
                                          </div>
                                          <span className="absolute hidden group-hover:block -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded-lg px-2 py-1 shadow-md">
                                            Remove polygon point
                                          </span>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="p-4 bg-white rounded-xl border border-gray-100 text-center text-gray-600 shadow-md">
                                        No polygon points added. Click on the
                                        map to add points.
                                      </div>
                                    )}

                                    {/* Distance Information */}
                                    {calculateDistances.length > 0 && (
                                      <div className="mt-4 p-4 bg-white rounded-xl border border-gray-100 shadow-md">
                                        <div className="text-sm font-semibold text-gray-800 mb-3 flex items-center space-x-2">
                                          <Ruler
                                            size={16}
                                            className="text-blue-600"
                                          />
                                          <span>DISTANCES</span>
                                        </div>
                                        <div className="space-y-2 max-h-40 overflow-y-auto">
                                          {calculateDistances.map((dist, i) => (
                                            <div
                                              key={i}
                                              className="text-xs flex justify-between items-center p-2 bg-gray-50 rounded-lg"
                                            >
                                              <span>
                                                Point {dist.from + 1} to Point{" "}
                                                {dist.to + 1}:
                                              </span>
                                              <span className="font-semibold text-gray-800">
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

                              {/* Mission Parameters Section */}
                              <div>
                                <div className="text-sm font-semibold text-gray-800 mb-3 flex items-center space-x-2">
                                  <Settings
                                    size={16}
                                    className="text-cyan-400"
                                  />
                                  <span className="text-white">
                                    MISSION PARAMETERS
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="p-4 bg-[#060423] hover:bg-[#0b0a11] rounded-lg border border-gray-100 shadow-md">
                                    <div className="text-xs text-white-600 mb-1">
                                      Altitude
                                    </div>
                                    <div className="text-sm text-gray-800 flex items-center space-x-2">
                                      <ArrowUp
                                        size={14}
                                        className="text-cyan-400"
                                      />
                                      <input
                                        type="number"
                                        value={missionAltitude}
                                        onChange={(e) =>
                                          setMissionAltitude(e.target.value)
                                        }
                                        className="w-full p-2 
                                        text-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-colors duration-200"
                                      />
                                    </div>
                                  </div>
                                  <div className="p-4 bg-[#060423] hover:bg-[#0b0a11] rounded-lg border border-gray-100 shadow-md">
                                    <div className="text-xs text-white-600 mb-1">
                                      Speed
                                    </div>
                                    <div className="text-sm text-white-800 flex items-center space-x-2">
                                      <Zap
                                        size={14}
                                        className="text-cyan-400"
                                      />
                                      <span>{telemetry.ground_speed} m/s</span>
                                    </div>
                                  </div>
                                  <div className="p-4 bg-[#060423] hover:bg-[#0b0a11]  rounded-lg border border-gray-100 shadow-md">
                                    <div className="text-xs text-white-600 mb-1">
                                      Mission Type
                                    </div>
                                    <div className="text-sm text-white-800 flex items-center space-x-2">
                                      <Compass
                                        size={14}
                                        className="text-cyan-400"
                                      />
                                      <span>
                                        {polygonMode ? "Polygon" : "Waypoint"}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="p-4 bg-[#060423] hover:bg-[#0b0a11] rounded-lg border border-gray-100 shadow-md">
                                    <div className="text-xs text-white-600 mb-1">
                                      Duration
                                    </div>
                                    <div className="text-sm text-white-800 flex items-center space-x-2">
                                      <Clock
                                        size={14}
                                        className="text-cyan-400"
                                      />
                                      <span>~15 minutes</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Start Mission Button */}
                              <button
                                className={`w-full py-3 rounded-xl text-white border-white border-[1px] font-semibold flex items-center justify-center space-x-3 transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl
    ${
      missionStarted
        ? "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
        : "bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
    }`}
                                onClick={() => {
                                  if (missionStarted) {
                                    handleEndMission();
                                  } else {
                                    const action = polygonMode
                                      ? handleGeneratePolygonMission
                                      : handleStartMission;
                                    action().then(() =>
                                      setMissionStarted(true)
                                    );
                                  }
                                }}
                              >
                                <Shield size={18} />
                                <span>
                                  {missionStarted
                                    ? "END MISSION"
                                    : polygonMode
                                    ? "GENERATE POLYGON MISSION"
                                    : "START MISSION"}
                                </span>
                              </button>
                            </div>
                          </div>
                        ) : activeTabButton === "Pre Flight" ? (
                          <div className="flex flex-col h-full bg-[#0b0d58]/40 rounded-2xl">
                            {/* Header */}
                            <div className="bg-[#060423] hover:bg-[#0b0a11] p-4 text-center font-semibold text-white border border-gray-100 flex items-center justify-center space-x-3  m-2 rounded-xl shadow-lg transform hover:scale-[1.01] transition-all duration-300">
                              <Shield size={18} className="text-cyan-400" />
                              <span className="text-base tracking-wide">
                                PREFLIGHT CHECKS
                              </span>
                            </div>

                            <div className="space-y-6 flex-1 overflow-auto p-6">
                              {/* Preflight Status */}
                              <div
                                className={`p-2 rounded-xl border shadow-md transition-all duration-300 ${
                                  preflightStatus === "completed"
                                    ? "bg-green-50 border-green-200"
                                    : preflightStatus === "failed"
                                    ? "bg-red-50 border-red-200"
                                    : "bg-amber-50 border-amber-200"
                                }`}
                              >
                                <div className="flex items-center justify-center space-x-3 text-sm font-medium">
                                  {preflightStatus === "in_progress" ? (
                                    <Loader2Icon
                                      size={18}
                                      className="animate-spin text-amber-600"
                                    />
                                  ) : (
                                    <Shield
                                      size={18}
                                      className={
                                        preflightStatus === "completed"
                                          ? "text-green-600"
                                          : preflightStatus === "failed"
                                          ? "text-red-600"
                                          : "text-amber-600"
                                      }
                                    />
                                  )}
                                  <span className="capitalize text-gray-800">
                                    {preflightStatus.replace("_", " ")}
                                  </span>
                                </div>
                              </div>

                              {/* Preflight Checks List */}
                              <div className="flex flex-row flex-wrap gap-4">
                                {preflightChecks.map((check, index) => {
                                  const result = preflightResults.find(
                                    (r) => r.check_id === check.id
                                  );
                                  return (
                                    <div
                                      key={check.id}
                                      className="group p-2 bg-[#060423] hover:bg-[#0b0a11]
                                      rounded-xl border border-gray-100 shadow-md transition-all duration-200"
                                    >
                                      <div className="flex-justify-between items-start">
                                        <div className="flex items-start space-x-4">
                                          <div
                                            className={`mt-1 w-6 h-6 rounded-full flex items-center justify-center ${
                                              result?.status
                                                ? "bg-green-600"
                                                : "bg-red-600"
                                            }`}
                                          >
                                            {result?.status ? (
                                              <Check
                                                size={14}
                                                className="text-white"
                                              />
                                            ) : (
                                              <X
                                                size={14}
                                                className="text-white"
                                              />
                                            )}
                                          </div>
                                          <div>
                                            <div className="text-sm font-semibold text-white-800">
                                              {check.name}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-1">
                                              {check.description}
                                            </div>
                                            {result?.message && (
                                              <div
                                                className={`text-xs mt-2 ${
                                                  result.status
                                                    ? "text-green-700"
                                                    : "text-red-700"
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
                                              className="px-3 py-1.5 text-xs bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors duration-200"
                                            >
                                              Confirm
                                            </button>
                                          )}
                                      </div>
                                      {check.check_type === "manual" && (
                                        <span className="absolute hidden group-hover:block -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded-lg px-2 py-1 shadow-md">
                                          {result?.status
                                            ? "Check passed"
                                            : "Confirm manual check"}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Run Preflight Button */}
                            <div className="p-2 border-t border-gray-100">
                              <button
                                className="w-full py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl text-white font-semibold flex items-center justify-center space-x-3 transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl disabled:opacity-60 disabled:hover:scale-100"
                                onClick={handleRunPreflight}
                                disabled={preflightStatus === "in_progress"}
                              >
                                {preflightStatus === "in_progress" ? (
                                  <Loader2Icon
                                    size={18}
                                    className="animate-spin"
                                  />
                                ) : (
                                  <Shield size={18} />
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
                        ) : /*dynamically coded the status section*/

                        /*2008-2112*/

                        //                         :activeTabButton === "Status" ?
                        //                           <div className="flex flex-col h-full px-6 py-4 bg-gradient-to-br from-gray-50 to-blue-50/20 rounded-2xl overflow-y-auto">
                        //                             <div className="bg-white p-4 text-center font-semibold text-gray-800 border-b border-gray-100 flex items-center justify-center space-x-3 mb-6 rounded-t-xl shadow-lg">
                        //                               <AlertTriangle size={18} className="text-blue-600" />
                        //                               <span className="text-base tracking-wide">SYSTEM STATUS</span>
                        //                             </div>

                        //                             <div className="space-y-6 flex-1 py-4">
                        //                               {/* Hardware */}
                        //                               <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-md">
                        //                                 <div className="text-sm font-semibold text-gray-800 mb-4 flex items-center space-x-2">
                        //                                   <Cpu size={16} className="text-blue-600" />
                        //                                   <span>HARDWARE</span>
                        //                                 </div>

                        //                                 {/* CPU */}
                        //                                 <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        //                                   <span className="flex items-center space-x-2 text-gray-800 font-medium">
                        //                                     <Cpu size={14} />
                        //                                     <span>CPU</span>
                        //                                   </span>
                        //                                   <span className="text-sm text-gray-800">
                        //                                     {telemetry?.cpu_usage ?? "--"}%
                        //                                   </span>
                        //                                 </div>

                        //                                 {/* Memory */}
                        //                                 <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        //                                   <span className="flex items-center space-x-2 text-gray-800 font-medium">
                        //                                     <Layers size={14} />
                        //                                     <span>Memory</span>
                        //                                   </span>
                        //                                   <span className="text-sm text-gray-800">
                        //                                     {telemetry?.memory_usage ?? "--"}%
                        //                                   </span>
                        //                                 </div>

                        //                                 {/* Temperature */
                        //                                 <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        //                                   <span className="flex items-center space-x-2 text-gray-800 font-medium">
                        //                                     <Zap size={14} />
                        //                                     <span>Temperature</span>
                        //                                   </span>
                        //                                   <span className="text-sm text-gray-800">
                        //                                     {telemetry?.temperature ?? "--"}°C
                        //                                   </span>
                        //                                 </div>
                        //                               </div>

                        //                               {/* Sensors */}
                        //                               <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-md">
                        //                                 <div className="text-sm font-semibold text-gray-800 mb-4 flex items-center space-x-2">
                        //                                   <Settings size={16} className="text-blue-600" />
                        //                                   <span>SENSORS</span>
                        //                                 </div>

                        //                                 <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        //                                   <span className="flex items-center space-x-2 text-gray-800 font-medium">
                        //                                     <Globe size={14} />
                        //                                     <span>GPS</span>
                        //                                   </span>
                        //                                   <span className="text-sm text-gray-800">
                        //                                     {telemetry?.gps?.satellites ?? 0} satellites
                        //                                   </span>
                        //                                 </div>

                        //                                 <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        //                                   <span className="flex items-center space-x-2 text-gray-800 font-medium">
                        //                                     <Compass size={14} />
                        //                                     <span>Compass</span>
                        //                                   </span>
                        //                                   <span className="text-sm text-gray-800">
                        //                                     {telemetry?.compass?.calibrated ? "Calibrated" : "Not Calibrated"}
                        //                                   </span>
                        //                                 </div>
                        //                               </div>

                        //                               {/* Battery */}
                        //                               <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-md">
                        //                                 <div className="text-sm font-semibold text-gray-800 mb-4 flex items-center space-x-2">
                        //                                   <Battery size={16} className="text-blue-600" />
                        //                                   <span>BATTERY</span>
                        //                                 </div>

                        //                                 <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        //                                   <span className="flex items-center space-x-2 text-gray-800 font-medium">
                        //                                     <Battery size={14} />
                        //                                     <span>Voltage</span>
                        //                                   </span>
                        //                                   <span className="text-sm text-gray-800">
                        //                                     {telemetry?.battery_voltage?.toFixed(2) ?? "--"}V
                        //                                   </span>
                        //                                 </div>

                        //                                 <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        //                                   <span className="flex items-center space-x-2 text-gray-800 font-medium">
                        //                                     <Clock size={14} />
                        //                                     <span>Remaining</span>
                        //                                   </span>
                        //                                   <span className="text-sm text-gray-800">
                        //                                     {telemetry?.battery_remaining ?? "--"}%
                        //                                   </span>
                        //                                 </div>
                        //                               </div>
                        //                             </div>
                        //                           </div>

                        // /*setup section*/

                        activeTabButton === "Setup" ? (
                          <div className="flex flex-col h-full px-6 py-4 ">
                            {/* Header */}
                            <div className="bg-[#060423] hover:bg-[#0b0a11] p-4 text-center font-semibold text-white-800 border border-gray-100 flex items-center justify-center space-x-3 mb-6 rounded-xl shadow-lg transform hover:scale-[1.01] transition-all duration-300">
                              <Settings size={18} className="text-cyan-400" />
                              <span className="text-base tracking-wide">
                                DRONE SETUP & CALIBRATION
                              </span>
                            </div>

                            <div className="space-y-6 flex-1 overflow-auto">
                              {/* Frame Setup */}
                              <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-xl transition-all duration-300">
                                <div className="text-sm font-semibold text-gray-800 mb-4 flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <Sliders
                                      size={16}
                                      className="text-blue-600"
                                    />
                                    <span>FRAME SETUP</span>
                                  </div>

                                  {/*changed button configuration for frame setup*/}
                                  {!configured ? (
                                    <button
                                      onClick={configureFrame}
                                      disabled={configuring}
                                      className={`px-4 py-1.5 text-white text-xs rounded-lg transition-colors duration-200 ${
                                        configuring
                                          ? "bg-yellow-500 cursor-not-allowed"
                                          : "bg-blue-600 hover:bg-blue-700"
                                      }`}
                                    >
                                      {configuring
                                        ? "Configuring..."
                                        : "Configure"}
                                    </button>
                                  ) : (
                                    <div className="flex gap-2">
                                      <button
                                        disabled
                                        className="px-4 py-1.5 bg-green-600 text-white text-xs rounded-lg cursor-not-allowed"
                                      >
                                        Done
                                      </button>
                                      <button
                                        onClick={() => setConfigured(false)}
                                        className="px-4 py-1.5 bg-gray-700 text-white text-xs rounded-lg hover:bg-gray-800"
                                      >
                                        Configure Again
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                                    <div className="text-xs text-gray-600">
                                      Frame Type
                                    </div>
                                    <div className="text-sm font-medium text-gray-800">
                                      {frameTypeOptions[frameType] || "Unknown"}
                                    </div>
                                  </div>
                                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                                    <div className="text-xs text-gray-600">
                                      Frame Class
                                    </div>
                                    <div className="text-sm font-medium text-gray-800">
                                      {frameClassOptions[frameClass] ||
                                        "Unknown"}
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-4">
                                  <label className="text-xs text-gray-600 block mb-1">
                                    Select Frame Type
                                  </label>
                                  <select
                                    value={frameType}
                                    onChange={(e) =>
                                      setFrameType(Number(e.target.value))
                                    }
                                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all duration-200"
                                  >
                                    {Object.entries(frameTypeOptions).map(
                                      ([value, label]) => (
                                        <option key={value} value={value}>
                                          {label}
                                        </option>
                                      )
                                    )}
                                  </select>
                                </div>
                                <div className="mt-3">
                                  <label className="text-xs text-gray-600 block mb-1">
                                    Select Frame Class
                                  </label>
                                  <select
                                    value={frameClass}
                                    onChange={(e) =>
                                      setFrameClass(Number(e.target.value))
                                    }
                                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all duration-200"
                                  >
                                    {Object.entries(frameClassOptions).map(
                                      ([value, label]) => (
                                        <option key={value} value={value}>
                                          {label}
                                        </option>
                                      )
                                    )}
                                  </select>
                                </div>
                              </div>

                              {/* Accelerometer Calibration */}
                              <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-xl transition-all duration-300">
                                <div className="text-sm font-semibold text-gray-800 mb-4 flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <Compass
                                      size={16}
                                      className="text-blue-600"
                                    />
                                    <span>ACCELEROMETER CALIBRATION</span>
                                  </div>
                                  {!accelCalibrating && !accelCalDone && (
                                    <button
                                      onClick={handleAccelCalibrate}
                                      className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors duration-200"
                                    >
                                      Start Calibration
                                    </button>
                                  )}
                                  {accelCalibrating && (
                                    <span className="px-4 py-1.5 bg-amber-400 text-white text-xs rounded-lg animate-pulse">
                                      In Progress
                                    </span>
                                  )}
                                  {accelCalDone && (
                                    <span className="px-4 py-1.5 bg-green-600 text-white text-xs rounded-lg">
                                      Done
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-600 mb-3">
                                  {accelCalibrating ? (
                                    <>
                                      {accelCalStep > 0 &&
                                        accelCalStep <= accelSteps.length && (
                                          <>
                                            <div className="font-semibold text-blue-700 mb-2">
                                              Step {accelCalStep} of{" "}
                                              {accelSteps.length}
                                            </div>
                                            <div className="mb-2">
                                              {accelSteps[accelCalStep - 1]}
                                            </div>
                                            <button
                                              onClick={() => {
                                                handleAccelCalConfirmStep(
                                                  accelCalStep
                                                );
                                                setAccelCalStep(
                                                  (prev) => prev + 1
                                                );
                                              }}
                                              className="mt-3 px-4 py-1.5 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors duration-200"
                                            >
                                              Click When Done
                                            </button>
                                          </>
                                        )}
                                    </>
                                  ) : accelCalDone ? (
                                    <div className="text-green-600 font-semibold">
                                      Calibration successful!
                                    </div>
                                  ) : (
                                    <>
                                      Place the vehicle on a level surface and
                                      press Start Calibration. You will be
                                      prompted to place the vehicle in various
                                      orientations.
                                    </>
                                  )}
                                  {/* {accelCalStatus && <div className="text-blue-600 font-semibold mt-2">{accelCalStatus}</div>} */}
                                  {accelCalError && (
                                    <div className="text-red-600 font-semibold mt-2">
                                      Calibration Failed{" "}
                                    </div>
                                  )}
                                </div>

                                {/* Accelerometer Offsets Calibration (Board Level) */}
                                {/* <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-xl transition-all duration-300"> */}
                                {/* Simple Accelerometer Calibration */}
                                {/* <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-xl transition-all duration-300"> */}
                                <div className="text-sm font-semibold text-gray-800 mb-4 flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <Compass
                                      size={16}
                                      className="text-blue-600"
                                    />
                                    <span>
                                      SIMPLE ACCELEROMETER CALIBRATION
                                    </span>
                                  </div>
                                  {!accelSimpleCalibrating &&
                                    !accelSimpleCalDone && (
                                      <button
                                        onClick={handleAccelSimpleCalibrate}
                                        className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors duration-200"
                                      >
                                        Start Simple Calibration
                                      </button>
                                    )}
                                  {accelSimpleCalibrating && (
                                    <span className="px-4 py-1.5 bg-amber-400 text-white text-xs rounded-lg animate-pulse">
                                      In Progress
                                    </span>
                                  )}
                                  {accelSimpleCalDone &&
                                    !accelSimpleCalibrating && (
                                      <span className="px-4 py-1.5 bg-green-600 text-white text-xs rounded-lg">
                                        Done
                                      </span>
                                    )}
                                </div>
                                <div className="text-xs text-gray-600 mb-3">
                                  {accelSimpleCalibrating ? (
                                    <div>
                                      Simple accelerometer calibration in
                                      progress. Please keep the vehicle level
                                      and still.
                                    </div>
                                  ) : accelSimpleCalDone ? (
                                    <div className="text-green-600 font-semibold">
                                      Completed
                                    </div>
                                  ) : (
                                    <>
                                      <div>
                                        Use this to perform a simple
                                        accelerometer calibration. Place the
                                        vehicle on a level surface and click
                                        Start Simple Calibration.
                                      </div>
                                    </>
                                  )}
                                  {accelSimpleCalStatus && (
                                    <div className="text-blue-600 font-semibold mt-2">
                                      {accelSimpleCalStatus}
                                    </div>
                                  )}
                                  {accelSimpleCalError && (
                                    <div className="text-red-600 font-semibold mt-2">
                                      {accelSimpleCalError}
                                    </div>
                                  )}
                                </div>
                                {/* </div> */}
                                <div className="text-sm font-semibold text-gray-800 mb-4 flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <Compass
                                      size={16}
                                      className="text-blue-600"
                                    />
                                    <span className="text-xs">
                                      ACCELEROMETER OFFSETS CALIBRATION
                                    </span>
                                  </div>
                                  {!accelOffsetsCalibrating &&
                                    !accelOffsetsCalDone && (
                                      <button
                                        onClick={handleAccelOffsetsCalibrate}
                                        className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors duration-200"
                                      >
                                        Calibrate Offsets
                                      </button>
                                    )}
                                  {accelOffsetsCalibrating && (
                                    <span className="px-4 py-1.5 bg-amber-400 text-white text-xs rounded-lg animate-pulse">
                                      In Progress
                                    </span>
                                  )}
                                  {accelOffsetsCalDone &&
                                    !accelOffsetsCalibrating && (
                                      <span className="px-4 py-1.5 bg-green-600 text-white text-xs rounded-lg">
                                        Done
                                      </span>
                                    )}
                                </div>
                                <div className="text-xs text-gray-600 mb-3">
                                  {accelOffsetsCalibrating ? (
                                    <div>
                                      Board level calibration in progress.
                                      Please keep the vehicle level and still.
                                    </div>
                                  ) : accelOffsetsCalDone ? (
                                    <div className="text-green-600 font-semibold">
                                      Completed
                                    </div>
                                  ) : (
                                    <>
                                      <div>
                                        Use this to calibrate the accelerometer
                                        offsets (board level). Place the vehicle
                                        on a level surface and click Calibrate
                                        Offsets.
                                      </div>
                                    </>
                                  )}
                                  {accelOffsetsCalStatus && (
                                    <div className="text-blue-600 font-semibold mt-2">
                                      {accelOffsetsCalStatus}
                                    </div>
                                  )}
                                  {accelOffsetsCalError && (
                                    <div className="text-red-600 font-semibold mt-2">
                                      {accelOffsetsCalError}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Initial Parameters */}
                              <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-xl transition-all duration-300">
                                <div className="text-sm font-semibold text-gray-800 mb-4 flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <Settings
                                      size={16}
                                      className="text-blue-600"
                                    />
                                    <span>INITIAL PARAMETERS</span>
                                  </div>
                                  <button
                                    onClick={sendParameters}
                                    className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors duration-200"
                                  >
                                    Load Parameters
                                  </button>
                                </div>
                                <div className="space-y-3">
                                  {params.map((item, index) => (
                                    <div
                                      key={index}
                                      className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                                    >
                                      <input
                                        type="text"
                                        placeholder="Parameter Name"
                                        value={item.param}
                                        onChange={(e) =>
                                          handleParamChange(
                                            index,
                                            "param",
                                            e.target.value
                                          )
                                        }
                                        className="text-xs text-black px-3 py-1.5 rounded-lg border border-black w-1/2 focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                                      />
                                      <input
                                        type="number"
                                        placeholder="Value"
                                        value={item.value}
                                        onChange={(e) =>
                                          handleParamChange(
                                            index,
                                            "value",
                                            e.target.value
                                          )
                                        }
                                        className="text-xs px-3 text-black py-1.5 rounded-lg border border-black w-1/3 focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                                      />
                                    </div>
                                  ))}
                                </div>
                                <button
                                  onClick={addNewParam}
                                  className="mt-3 text-xs text-blue-600 hover:underline"
                                >
                                  + Add Another Parameter
                                </button>
                              </div>

                              {/* Radio Calibration */}
                              <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-xl transition-all duration-300">
                                <div className="text-sm font-semibold text-gray-800 mb-4 flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <Sliders
                                      size={16}
                                      className="text-blue-600"
                                    />
                                    <span>RADIO CALIBRATION</span>
                                  </div>
                                  {!radioCalibrating && (
                                    <button
                                      onClick={handleStartRadioCal}
                                      className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors duration-200"
                                    >
                                      Start Calibration
                                    </button>
                                  )}
                                  {radioCalibrating && (
                                    <button
                                      onClick={handleSaveRadioCal}
                                      className="px-4 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors duration-200"
                                      disabled={!radioCalibrating}
                                    >
                                      Save Calibration
                                    </button>
                                  )}
                                </div>
                                <div className="text-xs text-gray-600 mb-3">
                                  {radioCalibrating || radioCalComplete ? (
                                    <>
                                      <div>
                                        Move all sticks and switches through
                                        their full range. Min/max values will
                                        update live below.
                                      </div>
                                      <div className="text-blue-600 font-semibold mt-2">
                                        {radioCalStatusMsg}
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div>Instructions:</div>
                                      <ul className="list-disc ml-5 mt-1">
                                        <li>
                                          Click <b>Start Calibration</b> to
                                          begin.
                                        </li>
                                        <li>
                                          Move all RC sticks and switches to
                                          their extremes.
                                        </li>
                                        <li>
                                          Click <b>Save Calibration</b> when
                                          done.
                                        </li>
                                      </ul>
                                    </>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  {radioChannels.map((channel) => (
                                    <div
                                      key={channel.key}
                                      className="p-3 bg-gray-50 rounded-lg"
                                    >
                                      <div className="text-xs text-gray-600">
                                        {channel.label}
                                      </div>
                                      <div className="flex justify-between mt-1">
                                        <span className="text-xs text-gray-600">
                                          Min: {radioMinMax[channel.key].min}
                                        </span>
                                        <span className="text-xs text-gray-600">
                                          Max: {radioMinMax[channel.key].max}
                                        </span>
                                      </div>
                                      <div className="w-full h-2.5 bg-gray-200 rounded-full mt-1">
                                        <div
                                          className="h-full bg-blue-600 rounded-full transition-all duration-200"
                                          style={{
                                            width: `${
                                              ((telemetry?.radio_sticks?.[
                                                channel.key
                                              ] ?? 1500) -
                                                1000) /
                                              10
                                            }%`,
                                          }}
                                        />
                                      </div>
                                      <div className="text-right text-[10px] text-gray-500 mt-1">
                                        Value:{" "}
                                        {telemetry?.radio_sticks?.[
                                          channel.key
                                        ] ?? "—"}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Compass Calibration */}
                              <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-xl transition-all duration-300">
                                <div className="text-sm font-semibold text-gray-800 mb-4 flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <Compass
                                      size={16}
                                      className="text-blue-600"
                                    />
                                    <span>COMPASS CALIBRATION</span>
                                  </div>
                                  <button
                                    onClick={handleStartCompassCal}
                                    className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors duration-200"
                                    disabled={
                                      compassCalibrating || compassCalDone
                                    }
                                    style={{
                                      backgroundColor: compassCalibrating
                                        ? "#f0ad4e"
                                        : compassCalDone
                                        ? "#5cb85c"
                                        : undefined,
                                      color:
                                        compassCalibrating || compassCalDone
                                          ? "white"
                                          : undefined,
                                      cursor: compassCalibrating
                                        ? "not-allowed"
                                        : "pointer",
                                    }}
                                  >
                                    {compassCalibrating
                                      ? "In Progress..."
                                      : compassCalDone
                                      ? "Done"
                                      : "Start Calibration"}
                                  </button>
                                </div>
                                {compassCalStatusMsg && (
                                  <div
                                    style={{
                                      marginTop: 8,
                                      color: compassCalibrating
                                        ? "#f0ad4e"
                                        : compassCalDone
                                        ? "#5cb85c"
                                        : undefined,
                                    }}
                                  >
                                    {compassCalStatusMsg}
                                  </div>
                                )}
                                <div className="text-xs text-gray-600 mb-3">
                                  Rotate the vehicle around all axes until all
                                  compasses reach 100%. Keep away from metal
                                  objects.
                                </div>
                                {telemetry.compass_calibration.length > 0 && (
                                  <>
                                    {telemetry.compass_calibration.map(
                                      (compass, index) => {
                                        const statusMap = {
                                          0: "Not Started",
                                          1: "Failed",
                                          2: "In Progress",
                                          3: "Completed",
                                        };
                                        const statusText =
                                          statusMap[compass.cal_status] ||
                                          "Unknown";
                                        // Show 100% if completed
                                        const displayPct =
                                          compass.cal_status === 3
                                            ? 100
                                            : compass.completion_pct;
                                        return (
                                          <div
                                            key={index}
                                            className="mb-4 p-3 bg-gray-50 rounded-lg"
                                          >
                                            <div className="flex justify-between items-center mb-2">
                                              <div className="font-semibold text-sm text-gray-800">
                                                Compass {compass.compass_id} -{" "}
                                                {statusText}
                                              </div>
                                              <div className="text-xs text-gray-600">
                                                {displayPct}% Complete
                                              </div>
                                            </div>
                                            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden mb-2">
                                              <div
                                                className="h-full bg-blue-600 rounded-full transition-all duration-200"
                                                style={{
                                                  width: `${displayPct}%`,
                                                }}
                                              />
                                            </div>
                                            <div className="text-xs text-gray-600">
                                              <span className="mr-4">
                                                X:{" "}
                                                {compass.direction_x.toFixed(2)}
                                              </span>
                                              <span className="mr-4">
                                                Y:{" "}
                                                {compass.direction_y.toFixed(2)}
                                              </span>
                                              <span>
                                                Z:{" "}
                                                {compass.direction_z.toFixed(2)}
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      }
                                    )}
                                  </>
                                )}
                                <div className="text-xs text-gray-600 mt-2">
                                  {compassCalStatusMsg}
                                </div>
                              </div>

                              {/* ESC Calibration */}
                              <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-xl transition-all duration-300">
                                <div className="text-sm font-semibold text-gray-800 mb-4 flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <Zap size={16} className="text-blue-600" />
                                    <span>ESC CALIBRATION</span>
                                  </div>
                                  <button
                                    onClick={handleStartEscCal}
                                    className="px-4 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors duration-200"
                                  >
                                    Calibrate ESCs
                                  </button>
                                </div>
                                <div className="text-xs text-gray-600 mb-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                                  <span className="font-semibold text-red-600">
                                    WARNING:
                                  </span>{" "}
                                  Remove propellers before ESC calibration. This
                                  process will arm motors.
                                </div>
                                <div className="p-3 bg-gray-50 rounded-lg">
                                  <div className="text-xs text-gray-600">
                                    Status
                                  </div>
                                  <div className="text-sm font-medium text-gray-800">
                                    {escCalStatusMsg}
                                  </div>
                                </div>
                                {showEscInstructions && (
                                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                    <ol className="list-decimal list-inside text-xs text-gray-600 space-y-1">
                                      <li>
                                        Remove all propellers from the drone for
                                        safety.
                                      </li>
                                      <li>Disconnect the battery.</li>
                                      <li>
                                        After clicking the button above,
                                        immediately connect the battery when
                                        prompted.
                                      </li>
                                      <li>
                                        Wait for the ESCs to beep, then follow
                                        any additional beeps as per your ESC
                                        manual.
                                      </li>
                                      <li>
                                        When calibration is complete, disconnect
                                        the battery and reboot the flight
                                        controller.
                                      </li>
                                    </ol>
                                    <div className="text-xs text-orange-600 font-semibold mt-2">
                                      <b>
                                        Do not move the drone or touch the
                                        throttle during calibration.
                                      </b>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Flight Modes (Mission Planner Style, 3 sections) */}
                              <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-xl transition-all duration-300">
                                <div className="text-sm font-semibold text-gray-800 mb-4 flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <Plane
                                      size={16}
                                      className="text-blue-600"
                                    />
                                    <span>FLIGHT MODES</span>
                                  </div>
                                </div>
                                {/* Render the new Mission Planner style UI */}
                                {renderFlightModesSection()}
                              </div>

                              {/* Failsafe */}
                              <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-xl transition-all duration-300">
                                <div className="text-sm font-semibold text-gray-800 mb-4 flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <AlertTriangle
                                      size={16}
                                      className="text-blue-600"
                                    />
                                    <span>FAILSAFE SETTINGS</span>
                                  </div>
                                  <button
                                    onClick={saveFailsafeSettings}
                                    className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors duration-200"
                                  >
                                    Save Settings
                                  </button>
                                </div>
                                <div className="space-y-3">
                                  {["battery", "rc", "gcs"].map((type) => (
                                    <div
                                      key={type}
                                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                    >
                                      <div>
                                        <div className="text-xs font-medium text-gray-800">
                                          {type.toUpperCase()} Failsafe
                                        </div>
                                        <div className="text-xs text-gray-600">
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
                                        className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
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
                          <div className="pt-10 space-y-3 ">
                            <div className="grid grid-cols-3 gap-1">
                              <TelemetryItem
                                label="FLIGHT MODE"
                                value={telemetry.mode || "Unknown"}
                                color="text-purple-600"
                                icon={<Plane size={14} />}
                              />
                              <TelemetryItem
                                label="ALTITUDE (m)"
                                value={telemetry.altitude}
                                color="text-[#1E90FF]"
                                icon={<ArrowUp size={14} />}
                              />
                              <TelemetryItem
                                label="GROUNDSPEED (m/s)"
                                value={telemetry.ground_speed.toFixed(2)}
                                color="text-[#1E90FF]"
                                icon={<Gauge size={14} />}
                              />

                              <TelemetryItem
                                label="YAW (deg)"
                                value={telemetry.yaw.toFixed(2)}
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
                            <div className="mt-5 flex justify-center">
                              <button
                                className={`px-6 py-3 rounded-xl font-semibold text-white transition-all duration-300 flex items-center space-x-2 hover:scale-105 shadow-md ${
                                  isArmed
                                    ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500"
                                    : "bg-gradient-to-r from-[#1E90FF] to-[#6A5ACD] hover:from-[#1C86EE] hover:to-[#5D52B1]"
                                }`}
                                onClick={toggleArmed}
                                disabled={armingInProgress}
                              >
                                <Power
                                  size={18}
                                  className={
                                    isArmed ? "text-red-200" : "text-white"
                                  }
                                />
                                <span>
                                  {armingInProgress
                                    ? isArmed
                                      ? "DISARMING..."
                                      : "ARMING..."
                                    : isArmed
                                    ? "DISARM"
                                    : "ARM"}
                                </span>
                              </button>
                            </div>
                            <div></div>
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
            className={`w-full bg-white flex flex-col relative ${
              activeTab === "DATA" ? "flex" : "flex"
            }`}
          >
            {isLoaded ? (
              <>
                {/* Map Component */}
                <div className="w-full h-full relative">
                  {/* Mission Controls - Only show buttons when on flight plan screen */}
                  <div className="space-y-2">
                    {activeTab === "PLAN" && (
                      <>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setPolygonMode(!polygonMode)}
                            className={`flex-1 ${
                              polygonMode ? "bg-[#1E90FF]" : "bg-[#1E90FF]"
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

                  {/* Messages Overlay */}

                  {telemetry.status_messages?.length > 0 && (
                    <div className="absolute lg:top-[365px] lg:left-[0px] space-y-2 pointer-events-none z-10 md:right-[380px] md:top-[450px] ">
                      {telemetry.status_messages.map((msg, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg text-sm transition-all duration-300 animate-fade-in 
            ${
              msg.severity >= 4
                ? "bg-red-100/70 text-red-700 border-red-200/50"
                : msg.severity >= 3
                ? "bg-amber-100/70 text-amber-700 border-amber-200/50"
                : "bg-blue-100/70 text-blue-700 border-blue-200/50"
            } border shadow-sm backdrop-blur-sm max-w-sm pointer-events-auto hover:bg-opacity-90`}
                          style={{ opacity: 0.85 }}
                        >
                          <div className="flex justify-between items-center">
                            <span className="flex-1 truncate">{msg.text}</span>
                            <span className="text-xs opacity-75 ml-2 whitespace-nowrap">
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/*message part completed*/}

                  <GoogleMap
                    mapContainerStyle={containerStyle}
                    center={currentLocation}
                    zoom={mapZoom}
                    onClick={handleMapClick}
                    options={{
                      styles: [],
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
                        onClick={() => setSelectedPolygonPoint(corner)}
                      />
                    ))}

                    {/* Polygon shape */}
                    {polygonCorners.length >= 3 && (
                      <Polygon
                        paths={polygonCorners}
                        options={{
                          fillColor: "#1E90FF",
                          fillOpacity: 0.2,
                          strokeColor: "#1E90FF",
                          strokeWeight: 2,
                          strokeOpacity: 0.8,
                        }}
                      />
                    )}

                    {/* Connect polygon corners with lines if less than 3 */}
                    {polygonCorners.length > 1 && polygonCorners.length < 3 && (
                      <Polyline
                        path={polygonCorners}
                        options={{
                          strokeColor: "#1E90FF",
                          strokeWeight: 3,
                          strokeOpacity: 0.8,
                          geodesic: true,
                        }}
                      />
                    )}

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
                            🎯 Waypoint{" "}
                            {waypoints.indexOf(selectedWaypoint) + 1}
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
                              className="bg-[#1E90FF] hover:bg-[#1C86EE] text-white font-bold py-2 px-4 rounded w-full"
                            >
                              ✈️ Fly Here
                            </button>
                          </div>
                        </div>
                      </InfoWindow>
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
                    <Marker
                      key={`drone-${currentLocation.lat}-${currentLocation.lng}`}
                      position={currentLocation}
                      icon={{
                        url: "https://img.icons8.com/?size=100&id=21922&format=png&color=000000",
                        scaledSize: new window.google.maps.Size(100, 100),
                      }}
                      title="Drone Location"
                    />
                  </GoogleMap>

                  {/* Inline CSS for Animation */}
                  <style jsx>{`
                    @keyframes fade-in {
                      from {
                        opacity: 0;
                        transform: translateY(10px);
                      }
                      to {
                        opacity: 0.85;
                        transform: translateY(0);
                      }
                    }
                    .animate-fade-in {
                      animation: fade-in 0.5s ease-out forwards;
                    }
                  `}</style>
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
            <div className="absolute top-16 right-4 bg-[#0a0525] p-4 rounded-xl shadow-xl backdrop-blur-md border hover:bg-[#0f0f11]  border-gray-100 z-10 transition-all duration-300 hover:shadow-2xl">
              <div className="flex flex-col space-y-3">
                <div className="group flex items-center space-x-3">
                  {getBatteryIcon()}
                  <div className="flex flex-col">
                    <span className="text-xs text-white">Battery</span>
                    <span
                      className={`text-sm font-semibold ${getBatteryColor()}`}
                    >
                      {telemetry.battery_remaining}%
                    </span>
                  </div>
                  <span className="absolute hidden group-hover:block -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded-lg px-2 py-1 shadow-md">
                    Battery Level
                  </span>
                </div>
                <div className="group flex items-center space-x-3">
                  <Gauge className="text-cyan-300" size={18} />
                  <div className="flex flex-col">
                    <span className="text-xs text-white">Speed</span>
                    <span className="text-sm font-semibold text-cyan-300">
                      {telemetry.ground_speed?.toFixed(1)} m/s
                    </span>
                  </div>
                  <span className="absolute hidden group-hover:block -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded-lg px-2 py-1 shadow-md">
                    Ground Speed
                  </span>
                </div>
                <div className="group flex items-center space-x-3">
                  <ArrowUp className="text-cyan-500" size={18} />
                  <div className="flex flex-col">
                    <span className="text-xs text-white">Altitude</span>
                    <span className="text-sm font-semibold text-cyan-500">
                      {telemetry.altitude} m
                    </span>
                  </div>
                  <span className="absolute hidden group-hover:block -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded-lg px-2 py-1 shadow-md">
                    Current Altitude
                  </span>
                </div>
              </div>
            </div>

            {/* Mobile Waypoints Panel */}
            <div className="sm:hidden absolute bottom-4 left-4 right-4 bg-white/90 p-2 rounded-lg shadow-lg backdrop-blur-sm border border-[#E0E0E0] z-10 max-h-48 overflow-auto">
              <div className="flex justify-between items-center mb-1">
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
        {/* Bottom Navigation Panel */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-700/50 hover:from-slate-700/70  hover:to-black  transition-all duration-300  hover:shadow-glow  tracking-tight border-t border-[#E0E0E0] py-0 px-4">
          <div className=" ml-15 grid grid-cols-3 sm:grid-cols-6 gap-3  items-center">
            <TabButton
              label="Quick"
              icon={
                <FaBolt
                  size={15}
                  className={
                    activeTabButton === "Quick" ? "text-white" : "text-cyan-500"
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
                      ? "text-white"
                      : "text-cyan-500"
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
                      ? "text-white"
                      : "text-cyan-500"
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
                      ? "text-white"
                      : "text-cyan-500"
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
                      ? "text-white"
                      : "text-cyan-500"
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
              label="Setup"
              icon={
                <Settings
                  size={15}
                  className={
                    activeTabButton === "Setup" ? "text-white" : "text-cyan-500"
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

// Component for mobile navigation buttons
function MobileNavButton({ icon, label, active, onClick }) {
  "use client";
  return (
    <button
      className={`p-3 rounded-xl flex items-center space-x-3 transition-transform duration-300 ease-in-out w-full shadow-md relative ${
        active
          ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg scale-[1.03]"
          : "bg-white text-gray-800 hover:bg-blue-50 hover:shadow-lg hover:scale-[1.03]"
      }`}
      onClick={onClick}
    >
      {icon}
      <span className="font-semibold text-sm">{label}</span>
      <span className="absolute hidden group-hover:block -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded-lg px-2 py-1 shadow-lg">
        {label}
      </span>
    </button>
  );
}

// Component for action buttons
function ActionButton({ icon, label, tooltip, onClick, className }) {
  "use client";
  return (
    <button
      className={`group p-4 rounded-xl font-semibold flex flex-col items-center justify-center space-y-2 transition-transform duration-300 ease-in-out  border-white border-[1px] hover:scale-[1.03] shadow-lg bg-gradient-to-r from-cyan-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 ${className}`}
      onClick={onClick}
    >
      {icon}
      <span className="text-sm">{label}</span>
      {tooltip && (
        <span className="absolute hidden group-hover:block -top-10 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded-lg px-2 py-1 shadow-lg">
          {tooltip}
        </span>
      )}
    </button>
  );
}

// Component for tab buttons
function TabButton({ label, icon, active, onClick }) {
  return (
    <button
      className={`group w-2/3 mt-2 mb-2 flex flex-col items-center justify-center space-y-1 py-1 rounded-lg border-white border-1 transition-transform duration-300 ease-in-out ${
        active
          ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md scale-[1.03]"
          : "bg-[#0a0525] text-white hover:bg-[#0f0f11] hover:shadow-md hover:scale-[1.03]"
      }`}
      onClick={onClick}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
      <span className="absolute hidden group-hover:block -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded-lg px-1 py-1 shadow-lg">
        {label}
      </span>
    </button>
  );
}

// Component for telemetry items
function TelemetryItem({ label, value, color, icon }) {
  "use client";
  return (
    <div className="relative group p-3 md:p-4 bg-[#0a0525]  rounded-xl border border-gray-100 shadow-md hover:shadow-lg hover:bg-[#030303] transition-all duration-300">
      {/* Label */}
      <div className="text-xs text-white mb-0.5 truncate">{label}</div>

      {/* Value + Icon */}
      <div
        className={`text-base font-semibold ${color} flex items-center space-x-1.5`}
      >
        {icon}
        <span className="truncate">{value}</span>
      </div>

      {/* Tooltip */}
      <span className="absolute hidden group-hover:block -top-7 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-0.5 shadow-md z-10 whitespace-nowrap">
        {label}: {value}
      </span>
    </div>
  );
}

function useShortestRotation(currentHeading) {
  const prevRawHeading = useRef(currentHeading);
  const prevDisplayHeading = useRef(currentHeading);
  const [smoothedHeading, setSmoothedHeading] = useState(currentHeading);

  useEffect(() => {
    const normalize = (angle) => ((angle % 360) + 360) % 360;

    const from = normalize(prevRawHeading.current);
    const to = normalize(currentHeading);
    let delta = to - from;

    // Make sure we take the shortest rotation direction
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    const newDisplayHeading = prevDisplayHeading.current + delta;

    prevRawHeading.current = currentHeading;
    prevDisplayHeading.current = newDisplayHeading;
    setSmoothedHeading(newDisplayHeading);
  }, [currentHeading]);

  return smoothedHeading;
}
