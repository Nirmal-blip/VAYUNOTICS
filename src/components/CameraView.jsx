import { useState, useEffect } from "react";
import React from "react";

export default function CameraView({ droneData, videoRef }) {
  const [cameraError, setCameraError] = useState(null);

  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.style.transform = "scaleX(1)";
        }
      } catch (error) {
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            videoRef.current.style.transform = "scaleX(-1)";
          }
        } catch (fallbackError) {
          console.error("Camera error:", fallbackError);
          setCameraError("Camera not available");
        }
      }
    }

    setupCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="w-full h-full bg-black border-2 border-purple-500 rounded-lg overflow-hidden shadow-lg">
      <div className="p-2 bg-purple-900 text-white text-xs flex justify-between items-center">
        <span className="font-medium" style={{ fontFamily: "'NASALIZATION', sans-serif" }}>LIVE CAMERA FEED</span>
        <span className={cameraError ? "text-red-400" : "text-green-400"}>{cameraError ? "● ERROR" : "● LIVE"}</span>
      </div>
      <video ref={videoRef} className="w-full h-[calc(100%-35px)] object-cover block" autoPlay playsInline muted />
    </div>
  );
}