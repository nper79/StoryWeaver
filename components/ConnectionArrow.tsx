import React from 'react';
import type { Connection, Scene, Point } from '../types';
import { ARROW_HEAD_ID } from '../constants';

interface ConnectionArrowProps {
  connection: Connection;
  scenes: Scene[];
  onDelete: (connectionId: string) => void;
  isSelected: boolean; // If the connection itself is selected (future use)
  connectionIndex?: number; // Index of this connection among connections from the same source
  totalConnections?: number; // Total connections from the same source
}

// Helper function to calculate intersection point of a line and a rectangle
const getIntersectionPoint = (rect: Scene, lineStart: Point, lineEnd: Point): Point => {
    const { x, y, width, height } = rect;
    const rectLines = [
        { p1: { x, y }, p2: { x: x + width, y } }, // Top
        { p1: { x: x + width, y }, p2: { x: x + width, y: y + height } }, // Right
        { p1: { x: x + width, y: y + height }, p2: { x, y: y + height } }, // Bottom
        { p1: { x, y: y + height }, p2: { x, y } }  // Left
    ];

    let closestIntersection: Point | null = null;
    let minDistance = Infinity;

    for (const rectLine of rectLines) {
        const den = (lineStart.x - lineEnd.x) * (rectLine.p1.y - rectLine.p2.y) - (lineStart.y - lineEnd.y) * (rectLine.p1.x - rectLine.p2.x);
        if (den === 0) continue; // Parallel lines

        const tNum = (lineStart.x - rectLine.p1.x) * (rectLine.p1.y - rectLine.p2.y) - (lineStart.y - rectLine.p1.y) * (rectLine.p1.x - rectLine.p2.x);
        const uNum = -((lineStart.x - lineEnd.x) * (lineStart.y - rectLine.p1.y) - (lineStart.y - lineEnd.y) * (lineStart.x - rectLine.p1.x));
        
        const t = tNum / den;
        const u = uNum / den;

        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            const intersectPt = {
                x: lineStart.x + t * (lineEnd.x - lineStart.x),
                y: lineStart.y + t * (lineEnd.y - lineStart.y),
            };
            // Prefer intersections closer to the lineEnd for startNode, and lineStart for endNode
            // This simple heuristic uses distance to lineEnd (for start node)
            const dist = Math.hypot(intersectPt.x - lineEnd.x, intersectPt.y - lineEnd.y);
            if (dist < minDistance) {
                minDistance = dist;
                closestIntersection = intersectPt;
            }
        }
    }
    // Fallback to center if no intersection found (should not happen with this logic if line crosses rect)
    return closestIntersection || { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
};


const ConnectionArrow: React.FC<ConnectionArrowProps> = ({ connection, scenes, onDelete, isSelected, connectionIndex, totalConnections }) => {
  const fromScene = scenes.find(s => s.id === connection.fromSceneId);
  const toScene = scenes.find(s => s.id === connection.toSceneId);

  if (!fromScene || !toScene) return null;
  
  // Ensure scenes have valid dimensions
  if (!fromScene.width || !fromScene.height || !toScene.width || !toScene.height) {
    console.warn(`Invalid scene dimensions for connection ${connection.id}`);
    return null;
  }

  const fromCenter: Point = { x: fromScene.x + fromScene.width / 2, y: fromScene.y + fromScene.height / 2 };
  const toCenter: Point = { x: toScene.x + toScene.width / 2, y: toScene.y + toScene.height / 2 };

  // Calculate offset for multiple connections
  let offsetX = 0;
  let offsetY = 0;
  
  if (connectionIndex !== undefined && totalConnections !== undefined && totalConnections > 1) {
    const maxOffset = 30; // Maximum offset in pixels
    const offsetStep = maxOffset / Math.max(1, totalConnections - 1);
    const centerIndex = (totalConnections - 1) / 2;
    const relativeIndex = connectionIndex - centerIndex;
    
    // Calculate perpendicular offset
    const dx = toCenter.x - fromCenter.x;
    const dy = toCenter.y - fromCenter.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length > 0) {
      // Perpendicular vector (rotated 90 degrees)
      const perpX = -dy / length;
      const perpY = dx / length;
      
      offsetX = perpX * relativeIndex * offsetStep;
      offsetY = perpY * relativeIndex * offsetStep;
    }
  }

  const adjustedFromCenter: Point = { x: fromCenter.x + offsetX, y: fromCenter.y + offsetY };
  const adjustedToCenter: Point = { x: toCenter.x + offsetX, y: toCenter.y + offsetY };

  const p1 = getIntersectionPoint(fromScene, adjustedFromCenter, adjustedToCenter);
  const p2 = getIntersectionPoint(toScene, adjustedToCenter, adjustedFromCenter); // Reversed for toScene

  // Validate calculated points
  if (!isFinite(p1.x) || !isFinite(p1.y) || !isFinite(p2.x) || !isFinite(p2.y)) {
    console.warn(`Invalid connection points for ${connection.id}`);
    return null;
  }

  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  
  // Calculate angle for text rotation (optional, can be complex for readability)
  // let angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
  // if (angle > 90) angle -= 180;
  // if (angle < -90) angle += 180;
  // transform={`rotate(${angle} ${midX} ${midY})`}

  return (
    <g className="connection-arrow group cursor-pointer">
      <line
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke={isSelected ? '#0ea5e9' : '#38bdf8'} // sky-500 or sky-400
        strokeWidth="3.5"
        markerEnd={`url(#${ARROW_HEAD_ID})`}
        className="transition-all"
      />
      {/* Invisible wider line for easier click detection */}
      <line
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke="transparent"
        strokeWidth="15"
        onClick={(e) => {
          e.stopPropagation(); // Prevent canvas click
          if (window.confirm(`Delete choice: "${connection.label}"?`)) {
            onDelete(connection.id);
          }
        }}
      />
      {connection.label && (
        <text
          x={midX}
          y={midY - 8} // Offset label slightly above the line
          fill={isSelected ? '#e0f2fe' : '#bae6fd'} // sky-100 or sky-200
          textAnchor="middle"
          fontSize="12px"
          paintOrder="stroke"
          stroke="#1e293b" // slate-800, for text outline
          strokeWidth="3px"
          strokeLinecap="butt"
          strokeLinejoin="miter"
          className="font-medium pointer-events-none select-none"
        >
          {connection.label}
        </text>
      )}
       <circle
        cx={midX}
        cy={midY}
        r="10"
        fill="transparent"
        className="group-hover:fill-red-500/30 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          if (window.confirm(`Delete choice: "${connection.label}"?`)) {
            onDelete(connection.id);
          }
        }}
        />
    </g>
  );
};

export default ConnectionArrow;