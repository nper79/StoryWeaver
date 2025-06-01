
import React from 'react';

interface ZoomControlsProps {
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}

const ZoomControls: React.FC<ZoomControlsProps> = ({ zoomLevel, onZoomIn, onZoomOut, onResetZoom }) => {
  const buttonClass = "p-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-md shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500";
  
  return (
    <div className="fixed bottom-4 right-4 flex flex-col items-center space-y-2 z-40 p-2 bg-slate-800 bg-opacity-80 backdrop-blur-sm rounded-lg shadow-xl">
      <button onClick={onZoomIn} className={buttonClass} title="Zoom In" aria-label="Zoom In">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>
      <div 
        className="px-3 py-1.5 bg-slate-700 text-slate-100 text-xs font-semibold rounded-md shadow-md cursor-pointer"
        onClick={onResetZoom}
        title="Reset Zoom (Click)"
        aria-label={`Current zoom level ${Math.round(zoomLevel * 100)}%, click to reset`}
      >
        {Math.round(zoomLevel * 100)}%
      </div>
      <button onClick={onZoomOut} className={buttonClass} title="Zoom Out" aria-label="Zoom Out">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
        </svg>
      </button>
    </div>
  );
};

export default ZoomControls;