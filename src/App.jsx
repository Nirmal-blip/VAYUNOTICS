import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import DivyaLinkInterface from './components/DivyaLinkInterface';
import DroneConnector from './components/DroneConnector';
import VideoFeed from './components/VideoFeed';
import Home from './components/Home';

function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Default route */}
        <Route path="/" element={<Home />} />

        {/* Ardupilot route */}
        <Route
          path="/ardupilot"
          element={
            <div className="app-container">
              {/* <VideoFeed /> */}
              <DivyaLinkInterface />
            </div>
          }
        />

        {/* Connect-drone route (uncommented for testing) */}
        <Route path="/connect-drone" element={<DroneConnector />} />

        {/* Catch-all route for unmatched paths */}
        <Route path="*" element={<h1>404 - Page Not Found</h1>} />
      </Routes>
    </HashRouter>
  );
}

export default App;