import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { Scene, StoryData, Point, ConnectionDragStartData } from '../types';
import SceneBlock from './SceneBlock';
import ConnectionArrow from './ConnectionArrow';
import Modal from './Modal';
import { ARROW_HEAD_ID, DEFAULT_SCENE_MIN_HEIGHT, DEFAULT_SCENE_WIDTH, WORLD_WIDTH, WORLD_HEIGHT } from '../constants';

interface CanvasViewProps {
  storyData: StoryData;
  onUpdateScene: (id: string, updates: Partial<Omit<Scene, 'id'>>) => void;
  onDeleteScene: (id: string) => void;
  onAddConnection: (fromSceneId: string, toSceneId: string, label: string) => void;
  onDeleteConnection: (connectionId: string) => void;
  activeSceneId: string | null;
  setActiveSceneId: (id: string | null) => void;
  startSceneId: string | null;
  zoomLevel: number;
  onAddMultipleOptions?: (sceneId: string) => void; 
  onAddTwoOptions?: (sceneId: string) => void; 
  onAddOneOption?: (sceneId: string) => void;
  onAddInlineChoice: (sourceSceneId: string, choiceLabel: string) => void; // New
  onUpdateConnectionLabel: (connectionId: string, newLabel: string) => void; // New
  onGenerateSceneImageForScene?: (sceneId: string) => void; // New prop for image generation
  generatingImageForScene: string | null; // New prop for loading state
}

const CanvasView: React.FC<CanvasViewProps> = ({
  storyData,
  onUpdateScene,
  onDeleteScene,
  onAddConnection,
  onDeleteConnection,
  activeSceneId,
  setActiveSceneId,
  startSceneId,
  zoomLevel,
  onAddMultipleOptions,
  onAddTwoOptions,
  onAddOneOption,
  onAddInlineChoice, // Destructure new prop
  onUpdateConnectionLabel, // Destructure new prop
  onGenerateSceneImageForScene, // Destructure new prop
  generatingImageForScene, // Destructure new prop
}) => {
  const { scenes, connections } = storyData;
  const [draggingSceneBody, setDraggingSceneBody] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionDragSource, setConnectionDragSource] = useState<ConnectionDragStartData | null>(null);
  const [connectionPreviewEndPoint, setConnectionPreviewEndPoint] = useState<Point | null>(null);
  const [hoveredTargetSceneIdForConnection, setHoveredTargetSceneIdForConnection] = useState<string | null>(null);

  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [newConnectionLabel, setNewConnectionLabel] = useState('');
  const [modalDataSource, setModalDataSource] = useState<{from: string, to: string} | null>(null);

  const canvasViewportRef = useRef<HTMLDivElement>(null);
  const scalableContentRef = useRef<HTMLDivElement>(null);

  const screenToWorldCoordinates = useCallback((screenX: number, screenY: number): Point => {
    if (!canvasViewportRef.current) return { x: screenX, y: screenY };
    const viewportRect = canvasViewportRef.current.getBoundingClientRect();
    const scrollLeft = canvasViewportRef.current.scrollLeft;
    const scrollTop = canvasViewportRef.current.scrollTop;

    const worldX = (screenX - viewportRect.left + scrollLeft) / zoomLevel;
    const worldY = (screenY - viewportRect.top + scrollTop) / zoomLevel;
    return { x: worldX, y: worldY };
  }, [zoomLevel]);


  const handleSceneBodyMouseDown = (e: React.MouseEvent, sceneId: string) => {
    e.preventDefault(); 
    const scene = scenes.find(s => s.id === sceneId);
    if (scene && canvasViewportRef.current) {
      const worldMousePos = screenToWorldCoordinates(e.clientX, e.clientY);
      setDraggingSceneBody({
        id: sceneId,
        offsetX: worldMousePos.x - scene.x,
        offsetY: worldMousePos.y - scene.y,
      });
    }
  };
  
  const handleSceneClick = (e: React.MouseEvent, sceneId: string) => {
    e.stopPropagation();
    if (draggingSceneBody) return; 
    setActiveSceneId(activeSceneId === sceneId ? null : sceneId);
  };

  const handlePortMouseDown = (e: React.MouseEvent, sceneId: string, portElement: HTMLElement) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canvasViewportRef.current) return;

    const portRect = portElement.getBoundingClientRect();
    const screenPortCenterX = portRect.left + portRect.width / 2;
    const screenPortCenterY = portRect.top + portRect.height / 2;
    
    const worldPortPos = screenToWorldCoordinates(screenPortCenterX, screenPortCenterY);

    setConnectionDragSource({ sceneId, portPosition: worldPortPos });
    setConnectionPreviewEndPoint(worldPortPos);
    setIsConnecting(true);
    setActiveSceneId(null);
  };

  const globalMouseMoveHandler = useCallback((e: MouseEvent) => {
    if (!canvasViewportRef.current) return;
    
    const worldMousePos = screenToWorldCoordinates(e.clientX, e.clientY);

    if (draggingSceneBody) {
      const sceneBeingDragged = scenes.find(s => s.id === draggingSceneBody.id);
      if (!sceneBeingDragged) return;

      let newX = worldMousePos.x - draggingSceneBody.offsetX;
      let newY = worldMousePos.y - draggingSceneBody.offsetY;

      const sceneWidth = sceneBeingDragged.width || DEFAULT_SCENE_WIDTH;
      const sceneHeight = sceneBeingDragged.height || DEFAULT_SCENE_MIN_HEIGHT;
      
      newX = Math.max(0, Math.min(newX, WORLD_WIDTH - sceneWidth));
      newY = Math.max(0, Math.min(newY, WORLD_HEIGHT - sceneHeight));
      onUpdateScene(draggingSceneBody.id, { x: newX, y: newY });

    } else if (isConnecting && connectionDragSource) {
      setConnectionPreviewEndPoint(worldMousePos);

      let targetFound = false;
      for (const scene of scenes) {
        if (scene.id === connectionDragSource.sceneId) continue;

        const sceneLeft = scene.x;
        const sceneRight = scene.x + (scene.width || DEFAULT_SCENE_WIDTH);
        const sceneTop = scene.y;
        const sceneBottom = scene.y + (scene.height || DEFAULT_SCENE_MIN_HEIGHT);

        if (worldMousePos.x >= sceneLeft && worldMousePos.x <= sceneRight && 
            worldMousePos.y >= sceneTop && worldMousePos.y <= sceneBottom) {
          setHoveredTargetSceneIdForConnection(scene.id);
          targetFound = true;
          break;
        }
      }
      if (!targetFound) {
        setHoveredTargetSceneIdForConnection(null);
      }
    }
  }, [draggingSceneBody, isConnecting, connectionDragSource, onUpdateScene, scenes, screenToWorldCoordinates, zoomLevel]); // Added zoomLevel

  const globalMouseUpHandler = useCallback(() => {
    if (draggingSceneBody) {
      setDraggingSceneBody(null);
    }
    if (isConnecting && connectionDragSource && hoveredTargetSceneIdForConnection) {
      setModalDataSource({ from: connectionDragSource.sceneId, to: hoveredTargetSceneIdForConnection });
      const targetSceneTitle = scenes.find(s => s.id === hoveredTargetSceneIdForConnection)?.title || 'scene';
      setNewConnectionLabel(`Choice to ${targetSceneTitle}`);
      setIsConnectionModalOpen(true);
    }
    
    setIsConnecting(false);
    setConnectionDragSource(null);
    setConnectionPreviewEndPoint(null);
    setHoveredTargetSceneIdForConnection(null);

  }, [isConnecting, connectionDragSource, hoveredTargetSceneIdForConnection, scenes]);

  useEffect(() => {
    document.addEventListener('mousemove', globalMouseMoveHandler);
    document.addEventListener('mouseup', globalMouseUpHandler);
    return () => {
      document.removeEventListener('mousemove', globalMouseMoveHandler);
      document.removeEventListener('mouseup', globalMouseUpHandler);
    };
  }, [globalMouseMoveHandler, globalMouseUpHandler]);


  const handleConfirmConnection = () => {
    if (modalDataSource && newConnectionLabel.trim() !== '') {
      onAddConnection(modalDataSource.from, modalDataSource.to, newConnectionLabel);
    }
    setIsConnectionModalOpen(false);
    setNewConnectionLabel('');
    setModalDataSource(null);
  };

  const handleModalClose = () => {
    setIsConnectionModalOpen(false);
    setNewConnectionLabel('');
    setModalDataSource(null);
  };
  
  const handleCanvasClick = () => {
    if (!isConnecting) { 
        setActiveSceneId(null);
    }
  };


  return (
    <div 
      ref={canvasViewportRef} 
      className="relative w-full h-full overflow-auto pt-[70px] canvas-bg select-none"
      onClick={handleCanvasClick}
      style={{ minHeight: 'calc(100vh - 70px)' }}
    >
      <div
        ref={scalableContentRef}
        style={{
          width: WORLD_WIDTH,
          height: WORLD_HEIGHT,
          transform: `scale(${zoomLevel})`,
          transformOrigin: 'top left',
          position: 'relative',
        }}
      >
        <svg 
          width={WORLD_WIDTH} 
          height={WORLD_HEIGHT} 
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 5 }}
        >
          <defs>
            <marker
              id={ARROW_HEAD_ID}
              markerWidth="10"
              markerHeight="7"
              refX="8" 
              refY="3.5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#38bdf8" />
            </marker>
          </defs>
          {connections.map((conn) => (
            <ConnectionArrow
              key={conn.id}
              connection={conn}
              scenes={scenes}
              onDelete={onDeleteConnection}
              isSelected={false} 
            />
          ))}
          {isConnecting && connectionDragSource && connectionPreviewEndPoint && (
            <line
              x1={connectionDragSource.portPosition.x}
              y1={connectionDragSource.portPosition.y}
              x2={connectionPreviewEndPoint.x}
              y2={connectionPreviewEndPoint.y}
              stroke="#0ea5e9"
              strokeWidth={2.5 / zoomLevel}
              strokeDasharray={`${5 / zoomLevel},${5 / zoomLevel}`}
              markerEnd={`url(#${ARROW_HEAD_ID})`}
            />
          )}
        </svg>

        {scenes.map((scene) => (
          <SceneBlock
            key={scene.id}
            scene={scene}
            allConnections={connections} // Pass all connections
            onUpdate={onUpdateScene}
            onDelete={onDeleteScene}
            onBodyMouseDown={handleSceneBodyMouseDown}
            onClick={handleSceneClick}
            onPortMouseDown={handlePortMouseDown}
            isPrimarySelection={activeSceneId === scene.id}
            isConnectionDragTarget={hoveredTargetSceneIdForConnection === scene.id}
            isStartScene={startSceneId === scene.id}
            onAddMultipleOptions={onAddMultipleOptions}
            onAddTwoOptions={onAddTwoOptions}
            onAddOneOption={onAddOneOption}
            onAddInlineChoice={onAddInlineChoice} // Pass new prop
            onUpdateConnectionLabel={onUpdateConnectionLabel} // Pass new prop
            onDeleteConnection={onDeleteConnection} // Pass existing prop
            onGenerateSceneImage={onGenerateSceneImageForScene} // Pass new prop
            generatingImageForScene={generatingImageForScene} // Pass new prop
          />
        ))}
      </div>

      <Modal
        isOpen={isConnectionModalOpen}
        onClose={handleModalClose}
        title="Add Choice / Connection"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Creating a choice from "{scenes.find(s => s.id === modalDataSource?.from)?.title || 'Source Scene'}" 
            to "{scenes.find(s => s.id === modalDataSource?.to)?.title || 'Target Scene'}".
          </p>
          <input
            type="text"
            value={newConnectionLabel}
            onChange={(e) => setNewConnectionLabel(e.target.value)}
            placeholder="Enter choice text (e.g., 'Open the door')"
            className="w-full p-2 border border-slate-500 rounded bg-slate-700 text-slate-100 focus:ring-sky-500 focus:border-sky-500"
            onKeyDown={(e) => e.key === 'Enter' && handleConfirmConnection()}
            autoFocus
          />
          <div className="flex justify-end space-x-3">
            <button
              onClick={handleModalClose}
              className="px-4 py-2 rounded bg-slate-600 hover:bg-slate-500 text-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmConnection}
              className="px-4 py-2 rounded bg-sky-500 hover:bg-sky-600 text-white transition-colors"
            >
              Add Choice
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CanvasView;