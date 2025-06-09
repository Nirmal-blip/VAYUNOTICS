import { useState, useEffect } from "react"
import React from "react"
export default function VideoFeed() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [streamUrl, setStreamUrl] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    let retryTimeout

    const connectStream = async () => {
      try {
        const url = `http://localhost:8000/video_stream?t=${Date.now()}`
        const response = await fetch(url, { signal: controller.signal })
        
        if (!response.ok) throw new Error("Stream failed")
        setStreamUrl(url)
        setIsLoading(false)
        setError(false)
      } catch (err) {
        if (!controller.signal.aborted) {
          setIsLoading(false)
          setError(true)
          if (retryCount < 3) {
            retryTimeout = setTimeout(() => setRetryCount(c => c + 1), 2000)
          }
        }
      }
    }

    connectStream()

    return () => {
      controller.abort()
      clearTimeout(retryTimeout)
    }
  }, [retryCount])

  const handleReconnect = () => {
    setRetryCount(0)
    setStreamUrl(`http://localhost:8000/video_stream?t=${Date.now()}`)
  }

  return (
    <div className="video-feed h-full w-full flex flex-col">
      <h3 className="text-center py-2 bg-slate-100 dark:bg-slate-800 font-semibold">
        Live Camera Feed
      </h3>

      <div className="video-container relative flex-1 flex items-center justify-center bg-black">
        {isLoading && (
          <div className="loading-overlay absolute inset-0 flex flex-col items-center justify-center bg-slate-900/70 z-10">
            <div className="spinner w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-white">Connecting to video stream...</p>
          </div>
        )}

        {error && (
          <div className="error-overlay absolute inset-0 flex flex-col items-center justify-center bg-slate-900/70 z-10">
            <p className="text-white mb-2">Video feed unavailable</p>
            {retryCount < 3 ? (
              <p className="text-cyan-400">Retrying in {3 - retryCount}s...</p>
            ) : (
              <button
                onClick={handleReconnect}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors"
              >
                Reconnect
              </button>
            )}
          </div>
        )}

        <img
          src={streamUrl}
          alt="Drone Camera Feed"
          className=" h-full object-contain"
          style={{
            maxHeight: "480px",
            borderRadius: "8px",
            backgroundColor: "black",
            visibility: error ? "hidden" : "visible"
          }}
          onError={() => setError(true)}
        />
      </div>
    </div>
  )
}