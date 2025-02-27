import OpenSeadragon from 'openseadragon';
import React, { useEffect, useRef, useState } from 'react';
import { useUndoRedo } from '../context/UndoRedoContext';
import { Annotation, BBoxCreatorProps, CustomMouseTrackerEvent } from '../types/bboxcreator';

const BBoxCreator: React.FC<
  BBoxCreatorProps & { setSelectedAnnotations: (ids: string[]) => void }
> = ({ viewer, imageFileName, setSelectedAnnotations, setAnnotations, setAnnotationsUnsaved }) => {
  const [selectionMode, setSelectionMode] = useState(false);
  const dragRef = useRef<{
    startImagePos: OpenSeadragon.Point;
    overlayElement: HTMLDivElement;
  } | null>(null);

  const { performCommand } = useUndoRedo();

  const resetMode = () => {
    document.body.style.cursor = 'default';
    setSelectionMode(false);
    viewer.setMouseNavEnabled(true);

    // 🔥 만약 드래그 박스가 남아 있으면 제거
    if (dragRef.current) {
      dragRef.current.overlayElement.remove();
      dragRef.current = null;
    }
  };

  const fetchAnnotations = async () => {
    try {
      const response = await fetch(`/public/annotations/${imageFileName}_annotation.json`);
      if (!response.ok) throw new Error(`Failed to fetch annotations: ${response.statusText}`);

      const data = await response.json();
      setAnnotations(data.annotations || []);
    } catch (error) {
      console.error('Error fetching annotations:', error);
    }
  };

  useEffect(() => {
    fetchAnnotations();
  }, [imageFileName]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'r' || event.key === 'R') {
        document.body.style.cursor = 'crosshair';
        setSelectionMode(true);
        viewer.setMouseNavEnabled(false);
      }

      if (event.key === 'Escape') {
        // 🔥 Esc로 모드 취소
        resetMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewer]);

  useEffect(() => {
    const handleCanvasPress = (event: OpenSeadragon.MouseTrackerEvent) => {
      if (!selectionMode || !(event as CustomMouseTrackerEvent).position) return;

      const { position } = event as CustomMouseTrackerEvent;
      const viewportPos = viewer.viewport.pointFromPixel(position);
      const startImagePos = viewer.viewport.viewportToImageCoordinates(viewportPos);

      // 드래그 박스 생성
      const overlayElement = document.createElement('div');
      overlayElement.style.position = 'absolute';
      overlayElement.style.background = 'rgba(255, 0, 0, 0.3)';
      overlayElement.style.border = '2px solid red';
      overlayElement.style.pointerEvents = 'none';

      viewer.element.appendChild(overlayElement);
      dragRef.current = { startImagePos, overlayElement };
    };

    const handleCanvasMove = (event: OpenSeadragon.MouseTrackerEvent) => {
      if (!dragRef.current || !(event as CustomMouseTrackerEvent).position) return;

      const { position } = event as CustomMouseTrackerEvent;
      const viewportPos = viewer.viewport.pointFromPixel(position);
      const currentImagePos = viewer.viewport.viewportToImageCoordinates(viewportPos);

      const { startImagePos, overlayElement } = dragRef.current;
      const snappedStartX = Math.round(startImagePos.x);
      const snappedStartY = Math.round(startImagePos.y);
      const snappedCurrentX = Math.round(currentImagePos.x);
      const snappedCurrentY = Math.round(currentImagePos.y);

      const x = Math.min(snappedStartX, snappedCurrentX);
      const y = Math.min(snappedStartY, snappedCurrentY);
      const width = Math.abs(snappedCurrentX - snappedStartX);
      const height = Math.abs(snappedCurrentY - snappedStartY);

      const pointTL = viewer.viewport.imageToViewerElementCoordinates(
        new OpenSeadragon.Point(x, y)
      );
      const pointBR = viewer.viewport.imageToViewerElementCoordinates(
        new OpenSeadragon.Point(x + width, y + height)
      );

      overlayElement.style.left = `${Math.round(pointTL.x)}px`;
      overlayElement.style.top = `${Math.round(pointTL.y)}px`;
      overlayElement.style.width = `${Math.round(pointBR.x - pointTL.x)}px`;
      overlayElement.style.height = `${Math.round(pointBR.y - pointTL.y)}px`;
    };

    const handleCanvasRelease = (event: OpenSeadragon.MouseTrackerEvent) => {
      if (!dragRef.current || !(event as CustomMouseTrackerEvent).position) return;

      const { position } = event as CustomMouseTrackerEvent;
      const viewportPos = viewer.viewport.pointFromPixel(position);
      const endImagePos = viewer.viewport.viewportToImageCoordinates(viewportPos);

      const { startImagePos, overlayElement } = dragRef.current;
      const imageBounds = viewer.world.getItemAt(0).getContentSize();

      const boundedStartX = Math.max(0, Math.min(imageBounds.x, startImagePos.x));
      const boundedStartY = Math.max(0, Math.min(imageBounds.y, startImagePos.y));
      const boundedEndX = Math.max(0, Math.min(imageBounds.x, endImagePos.x));
      const boundedEndY = Math.max(0, Math.min(imageBounds.y, endImagePos.y));

      const x1 = Math.min(boundedStartX, boundedEndX);
      const y1 = Math.min(boundedStartY, boundedEndY);
      const width = Math.abs(boundedEndX - boundedStartX);
      const height = Math.abs(boundedEndY - boundedStartY);

      if (width > 0 && height > 0) {
        const newAnnotation: Annotation = {
          id: crypto.randomUUID(),
          bbox: [Math.round(x1), Math.round(y1), Math.round(width), Math.round(height)],
          class: 'Unclassified',
        };

        performCommand({
          redo: () => {
            setAnnotations((prev) => {
              const updated = [...prev, newAnnotation];
              setSelectedAnnotations([newAnnotation.id]);
              return updated;
            });

            // 새 박스가 추가되었으니 unsaved 상태로 표시
            if (setAnnotationsUnsaved) {
              setAnnotationsUnsaved(true);
            }
          },
          undo: () => {
            setAnnotations((prev) => {
              const updated = prev.filter((ann) => ann.id !== newAnnotation.id);
              return updated;
            });
          },
        });
      }

      // 드래그 박스 삭제 + 모드 리셋
      overlayElement.remove();
      dragRef.current = null;
      resetMode();
    };

    const mouseTracker = new OpenSeadragon.MouseTracker({
      element: viewer.element,
      pressHandler: handleCanvasPress,
      dragHandler: handleCanvasMove,
      releaseHandler: handleCanvasRelease,
    });

    return () => mouseTracker.destroy();
  }, [viewer, selectionMode]);

  return null;
};

export default BBoxCreator;
