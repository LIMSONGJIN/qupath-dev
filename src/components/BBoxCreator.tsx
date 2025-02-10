import React, { useEffect, useState, useRef } from "react";
import OpenSeadragon from "openseadragon";
import { Annotation, BBoxCreatorProps, CustomMouseTrackerEvent } from "../types/bboxcreator";

const BBoxCreator: React.FC<BBoxCreatorProps> = ({ viewer, imageFileName }) => {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const dragRef = useRef<{ startImagePos: OpenSeadragon.Point } | null>(null);

  const resetMode = () => {
    document.body.style.cursor = 'default';
    setSelectionMode(false);
    viewer.setMouseNavEnabled(true);
  };

  const fetchAnnotations = async () => {
    try {
      const response = await fetch(`/public/annotations/${imageFileName}_annotation.json`);
      if (!response.ok) throw new Error(`Failed to fetch annotations: ${response.statusText}`);

      const data = await response.json();
      setAnnotations(data.annotations || []);
    } catch (error) {
      console.error("Error fetching annotations:", error);
    }
  };

  const saveAnnotations = async (newAnnotation: Annotation) => {
    const updatedAnnotations = [...annotations, newAnnotation];
    setAnnotations(updatedAnnotations);

    try {
      const response = await window.api.saveAnnotations(`${imageFileName}_annotation`, {
        annotations: updatedAnnotations,
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to save annotations.");
      }

      console.log("Annotation saved successfully!");
    } catch (error) {
      console.error("Error saving annotation:", error);
    }
  };

  useEffect(() => {
    fetchAnnotations();
  }, [imageFileName]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'n' || event.key === 'N') {
        document.body.style.cursor = 'crosshair';
        setSelectionMode(true);
        viewer.setMouseNavEnabled(false);
      }

      if (event.key === 'Escape') {
        resetMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewer]);

  useEffect(() => {
    const handleCanvasPress = (event: OpenSeadragon.MouseTrackerEvent) => {
      // 타입 가드: position이 있는 경우만 처리
      if (!selectionMode || !(event as CustomMouseTrackerEvent).position) return;

      const { position } = event as CustomMouseTrackerEvent;
      const viewportPos = viewer.viewport.pointFromPixel(position);
      const startImagePos = viewer.viewport.viewportToImageCoordinates(viewportPos);
      console.log("Start Position (Image Coordinates):", startImagePos);

      dragRef.current = { startImagePos };
    };

    const handleCanvasRelease = (event: OpenSeadragon.MouseTrackerEvent) => {
      // 타입 가드: position이 있는 경우만 처리
      if (!dragRef.current || !(event as CustomMouseTrackerEvent).position) return;

      const { position } = event as CustomMouseTrackerEvent;
      const viewportPos = viewer.viewport.pointFromPixel(position);
      const endImagePos = viewer.viewport.viewportToImageCoordinates(viewportPos);

      const { startImagePos } = dragRef.current;
      const x1 = Math.min(startImagePos.x, endImagePos.x);
      const y1 = Math.min(startImagePos.y, endImagePos.y);
      const width = Math.abs(endImagePos.x - startImagePos.x);
      const height = Math.abs(endImagePos.y - startImagePos.y);

      const roundedX1 = Math.round(x1);
      const roundedY1 = Math.round(y1);
      const roundedWidth = Math.round(width);
      const roundedHeight = Math.round(height);

      const newAnnotation: Annotation = {
        id: crypto.randomUUID(),
        bbox: [roundedX1, roundedY1, roundedWidth, roundedHeight],
        class: "Unclassified",
      };

      console.log("Bounding Box Data:", newAnnotation);

      saveAnnotations(newAnnotation);

      dragRef.current = null;
      resetMode();
    };

    const mouseTracker = new OpenSeadragon.MouseTracker({
      element: viewer.element,
      pressHandler: handleCanvasPress,
      releaseHandler: handleCanvasRelease,
    });

    return () => mouseTracker.destroy();
  }, [viewer, selectionMode, annotations]);

  return null;
};

export default BBoxCreator;
