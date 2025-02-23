import OpenSeadragon from 'openseadragon';
import React, { useEffect, useRef, useState } from 'react';
import { useUndoRedo } from '../context/UndoRedoContext';
import { Annotation, BBoxCreatorProps, CustomMouseTrackerEvent } from '../types/bboxcreator';

const BBoxCreator: React.FC<
  BBoxCreatorProps & { setSelectedAnnotations: (ids: string[]) => void }
> = ({ viewer, imageFileName, setSelectedAnnotations, annotations, setAnnotations }) => {
  const [selectionMode, setSelectionMode] = useState(false);
  const dragRef = useRef<{
    startImagePos: OpenSeadragon.Point;
    overlayElement: HTMLDivElement;
  } | null>(null);

  // Undo/Redo 컨텍스트에서 performCommand 함수를 가져옵니다.
  const { performCommand } = useUndoRedo();

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

      // 드래그 박스를 위한 HTML 요소 생성
      const overlayElement = document.createElement('div');
      overlayElement.style.position = 'absolute';
      overlayElement.style.background = 'rgba(255, 0, 0, 0.3)';
      overlayElement.style.border = '2px solid red';
      overlayElement.style.pointerEvents = 'none';

      // 뷰어 내부에 박스 요소 추가
      viewer.element.appendChild(overlayElement);

      dragRef.current = { startImagePos, overlayElement };
    };

    const handleCanvasMove = (event: OpenSeadragon.MouseTrackerEvent) => {
      if (!dragRef.current || !(event as CustomMouseTrackerEvent).position) return;

      const { position } = event as CustomMouseTrackerEvent;
      const viewportPos = viewer.viewport.pointFromPixel(position);
      const currentImagePos = viewer.viewport.viewportToImageCoordinates(viewportPos);

      const { startImagePos, overlayElement } = dragRef.current;

      // 박스의 위치 및 크기 계산
      const x = Math.min(startImagePos.x, currentImagePos.x);
      const y = Math.min(startImagePos.y, currentImagePos.y);
      const width = Math.abs(currentImagePos.x - startImagePos.x);
      const height = Math.abs(currentImagePos.y - startImagePos.y);

      // 뷰어 좌표를 요소 좌표로 변환하여 스타일 업데이트
      const pointTL = viewer.viewport.imageToViewerElementCoordinates(
        new OpenSeadragon.Point(x, y)
      );
      const pointBR = viewer.viewport.imageToViewerElementCoordinates(
        new OpenSeadragon.Point(x + width, y + height)
      );

      overlayElement.style.left = `${pointTL.x}px`;
      overlayElement.style.top = `${pointTL.y}px`;
      overlayElement.style.width = `${pointBR.x - pointTL.x}px`;
      overlayElement.style.height = `${pointBR.y - pointTL.y}px`;
    };

    const handleCanvasRelease = (event: OpenSeadragon.MouseTrackerEvent) => {
      if (!dragRef.current || !(event as CustomMouseTrackerEvent).position) return;

      const { position } = event as CustomMouseTrackerEvent;
      const viewportPos = viewer.viewport.pointFromPixel(position);
      const endImagePos = viewer.viewport.viewportToImageCoordinates(viewportPos);

      const { startImagePos, overlayElement } = dragRef.current;

      // 이미지 경계 크기 가져오기
      const imageBounds = viewer.world.getItemAt(0).getContentSize();

      // 경계를 넘어가지 않도록 제한
      const boundedStartX = Math.max(0, Math.min(imageBounds.x, startImagePos.x));
      const boundedStartY = Math.max(0, Math.min(imageBounds.y, startImagePos.y));
      const boundedEndX = Math.max(0, Math.min(imageBounds.x, endImagePos.x));
      const boundedEndY = Math.max(0, Math.min(imageBounds.y, endImagePos.y));

      const x1 = Math.min(boundedStartX, boundedEndX);
      const y1 = Math.min(boundedStartY, boundedEndY);
      const width = Math.abs(boundedEndX - boundedStartX);
      const height = Math.abs(boundedEndY - boundedStartY);

      // 박스 크기가 유효한 경우에만 처리
      if (width > 0 && height > 0) {
        const newAnnotation: Annotation = {
          id: crypto.randomUUID(),
          bbox: [Math.round(x1), Math.round(y1), Math.round(width), Math.round(height)],
          class: 'Unclassified',
        };

        // ... 생략 ...
        performCommand({
          redo: () => {
            setAnnotations((prev) => {
              const updated = [...prev, newAnnotation];
              window.api
                .saveAnnotations(`${imageFileName}_annotation`, { annotations: updated })
                .catch((error) => console.error('Error saving annotation on redo:', error));
              setSelectedAnnotations([newAnnotation.id]);
              return updated;
            });
          },
          undo: () => {
            setAnnotations((prev) => {
              const updated = prev.filter((ann) => ann.id !== newAnnotation.id);
              window.api
                .saveAnnotations(`${imageFileName}_annotation`, { annotations: updated })
                .catch((error) => console.error('Error saving annotation on undo:', error));
              return updated;
            });
          },
        });
      }

      // 드래그 박스 삭제 및 모드 리셋
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
