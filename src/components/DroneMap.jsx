import React, { useState, useEffect, useRef } from "react";
import {
  GoogleMap,
  useLoadScript,
  Marker,
  Polyline,
  InfoWindow,
} from "@react-google-maps/api";
import CameraView from "./CameraView";
import { LuCompass } from "react-icons/lu";

const googleAPIKey = "AIzaSyD_ewtUubbmWArezIcj5HwU5tDBm9rPy7w"; // Replace with your API key
const backendUrl =  "http://localhost:8000";
const containerStyle = {
  width: "100%",
  height: "100vh",
};

export default function DroneMap({ dronePosition, droneData }) {
  const videoRef = useRef(null);
  const [waypoints, setWaypoints] = useState([]);
  const [selectedWaypoint, setSelectedWaypoint] = useState(null);
  const [totalDistance, setTotalDistance] = useState(0);
  const [currentLocation, setCurrentLocation] = useState(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: googleAPIKey,
  });

  useEffect(() => {
    // Fetch current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({ lat: latitude, lng: longitude });
        },
        () => {
          // Fallback to default location (New Delhi) if geolocation fails
          setCurrentLocation({ lat: 28.6139, lng: 77.209 });
        }
      );
    }
  }, []);
  const handleStartMission = async () => {
    if (waypoints.length === 0) {
      alert("Please add at least one waypoint!");
      return;
    }

    // Transform waypoints for backend format (lng -> lon)
    const missionWaypoints = waypoints.map(({ lat, lng, alt }) => ({
      lat,
      lon: lng,
      alt,
    }));

    try {
      const response = await fetch(`${backendUrl}/start_mission`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(missionWaypoints),
      });

      const result = await response.json();
      if (response.ok) {
        alert("Mission started successfully! " + result.message);
      } else {
        throw new Error(result.error || "Failed to start mission");
      }
    } catch (error) {
      alert("Error starting mission: " + error.message);
    }
  };

  const handleFlyHere = async (waypoint) => {
    try {
      const response = await fetch(
        `${backendUrl}/fly_here?lat=${waypoint.lat}&lon=${waypoint.lng}&alt=${waypoint.alt}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();
      if (response.ok) {
        alert("Flying to destination! " + result.message);
      } else {
        throw new Error(result.error || "Failed to send fly command");
      }
    } catch (error) {
      alert("Error sending fly command: " + error.message);
    }
  };
  const handleMapClick = async (event) => {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    const altitude = Math.floor(Math.random() * 100 + 10); // Simulated altitude

    // Fetch location name using Geocoding API
    const locationName = await fetchLocationName(lat, lng);

    const newWaypoint = { lat, lng, alt: altitude, name: locationName };
    const updatedWaypoints = [...waypoints, newWaypoint];
    setWaypoints(updatedWaypoints);

    // Automatically connect and calculate distance if there are 3 or more waypoints
    if (updatedWaypoints.length >= 3) {
      calculateTotalDistance(updatedWaypoints);
    } else {
      setTotalDistance(0); // Reset distance if less than 3 waypoints
    }
  };

  const fetchLocationName = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleAPIKey}`
      );
      const data = await response.json();
      return data.results[0]?.formatted_address || "Unknown Location";
    } catch (error) {
      console.error("Error fetching location name:", error);
      return "Unknown Location";
    }
  };

  const removeWaypoint = (index) => {
    const updatedWaypoints = waypoints.filter((_, i) => i !== index);
    setWaypoints(updatedWaypoints);

    // Recalculate distance if there are 3 or more waypoints
    if (updatedWaypoints.length >= 3) {
      calculateTotalDistance(updatedWaypoints);
    } else {
      setTotalDistance(0); // Reset distance if less than 3 waypoints
    }
  };

  // Calculate 3D distance between two waypoints
  const calculateDistance = (wp1, wp2) => {
    const R = 6371; // Earth radius in km

    // Convert latitude and longitude to radians
    const lat1 = wp1.lat * (Math.PI / 180);
    const lat2 = wp2.lat * (Math.PI / 180);
    const lng1 = wp1.lng * (Math.PI / 180);
    const lng2 = wp2.lng * (Math.PI / 180);

    // Calculate differences
    const dLat = lat2 - lat1;
    const dLng = lng2 - lng1;
    const dAlt = wp2.alt - wp1.alt;

    // Haversine formula for horizontal distance
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    const horizontalDistance =
      R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1000; // Convert to meters

    // 3D distance using Pythagorean theorem
    const distance = Math.sqrt(horizontalDistance ** 2 + dAlt ** 2);
    return distance;
  };

  const calculateTotalDistance = (wps) => {
    let distance = 0;
    for (let i = 0; i < wps.length - 1; i++) {
      distance += calculateDistance(wps[i], wps[i + 1]);
    }
    setTotalDistance(distance);
  };

  const getIcons = () => {
    if (!window.google) return {};
    return {
      droneIcon: {
        url: "https://maps.google.com/mapfiles/kml/shapes/heliport.png",
        scaledSize: new window.google.maps.Size(40, 40),
      },
      waypointIcon: {
        url: "https://maps.google.com/mapfiles/kml/shapes/placemark_circle.png",
        scaledSize: new window.google.maps.Size(30, 30),
      },
    };
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="animate-spin mr-2">
          <LuCompass size={24} />
        </div>
        <span>LOADING MAP...</span>
      </div>
    );
  }

  if (!currentLocation) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <span>Fetching your location...</span>
      </div>
    );
  }

  const { droneIcon, waypointIcon } = getIcons();

  return (
    <div className="relative h-screen bg-gray-900 overflow-hidden">
      {/* Camera View Positioned at Bottom-Right */}
      <div className="absolute bottom-2 right-2 z-[1000] w-[320px] h-[240px] shadow-lg rounded-lg border-2 border-purple-500 bg-black">
        <CameraView droneData={droneData} videoRef={videoRef} />
      </div>

      {/* Sidebar for Waypoints */}
      <div className="absolute top-2 left-2 bg-gray-800 shadow-lg rounded-lg p-4 z-50 w-[300px] text-white">
        <h3 className="font-bold text-lg mb-2">Mission Plan</h3>
        <ul className="max-h-60 overflow-y-auto">
          {waypoints.map((wp, index) => (
            <li
              key={index}
              className="flex justify-between items-center bg-gray-700 p-2 rounded mb-2"
            >
              <span className="text-sm">
                {index + 1}: {wp.name || "Unknown Location"}
              </span>
              <button
                className="bg-red-500 text-white px-2 py-1 rounded text-sm"
                onClick={() => removeWaypoint(index)}
              >
                X
              </button>
            </li>
          ))}
        </ul>
        <button
          onClick={handleStartMission}
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded mt-4 w-full"
        >
          🚀 Start Mission
        </button>
        {waypoints.length >= 3 && (
          <p className="font-bold mt-2">
            Total Distance: {totalDistance.toFixed(2)} meters
          </p>
        )}
      </div>

      {/* Google Map */}
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={currentLocation}
        zoom={14}
        onClick={handleMapClick}
      >
        {/* Connect waypoints if there are 3 or more */}
        {waypoints.length > 1 && (
          <Polyline
            key={waypoints.map((wp) => `${wp.lat},${wp.lng}`).join("-")}
            path={waypoints}
            options={{
              strokeColor: "#FF4500",
              strokeWeight: 4,
              strokeOpacity: 0.9,
              geodesic: true,
            }}
          />
        )}

        {/* Waypoints with distances */}
        {waypoints.map((wp, index) => (
          <Marker
            key={index}
            position={wp}
            icon={waypointIcon}
            title={`Waypoint ${index + 1}`}
            label={{ text: `${index + 1}`, color: "black", fontSize: "12px" }}
            onClick={() => setSelectedWaypoint(wp)}
          />
        ))}

        {/* Show InfoWindow when clicking a waypoint */}
        {selectedWaypoint && (
          <InfoWindow
            position={selectedWaypoint}
            onCloseClick={() => setSelectedWaypoint(null)}
          >
            <div className="bg-gray-800 text-white p-4 rounded-lg shadow-lg max-w-[300px]">
              <h3 className="font-bold text-lg mb-2">
                🎯 Waypoint {waypoints.indexOf(selectedWaypoint) + 1}
              </h3>
              <div className="space-y-2">
                {/* Address */}
                <p className="text-sm">
                  <span className="font-semibold">📍 Address:</span>{" "}
                  {selectedWaypoint.name || "Unknown Location"}
                </p>

                {/* Latitude and Longitude */}
                <div className="grid grid-cols-2 gap-2">
                  <p className="text-sm">
                    <span className="font-semibold">🌐 Latitude:</span>{" "}
                    {selectedWaypoint.lat?.toFixed(6) || "N/A"}
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">🌐 Longitude:</span>{" "}
                    {selectedWaypoint.lng?.toFixed(6) || "N/A"}
                  </p>
                </div>

                {/* Altitude */}
                <p className="text-sm">
                  <span className="font-semibold">📏 Altitude:</span>{" "}
                  {selectedWaypoint.alt !== undefined
                    ? `${selectedWaypoint.alt}m`
                    : "N/A"}
                </p>
                <button
                  onClick={() => handleFlyHere(selectedWaypoint)}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded w-full mt-2"
                >
                  ✈️ Fly Here
                </button>
              </div>
            </div>
          </InfoWindow>
        )}

        {/* Drone Marker */}
        {dronePosition && (
          <Marker
            position={dronePosition}
            icon={droneIcon}
            title="Drone Location"
          />
        )}
      </GoogleMap>
    </div>
  );
}
