import React from 'react';
import FarmScene   from '../components/farm/FarmScene';
import FarmOverlay from '../components/ui/FarmOverlay';

/**
 * Simulation Page
 * Acts as a container for the 3D Farm Scene and its UI Overlay.
 */
export default function Simulation() {
  return (
    <>
      {/* 3D Canvas (z-index: 1) */}
      <FarmScene />
      
      {/* HTML UI (z-index: 10) */}
      <FarmOverlay />
    </>
  );
}
