import OpenSeadragon from 'openseadragon';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImageViewerProps } from '../types/imageviewer';
import AnnotationRenderer from './AnnotationRenderer';
import BBoxCreator from './BBoxCreator';
import Scalebar from './ScaleBar';
import Toolbar from './Toolbar';
import ViewerSetup from './ViewerSetup';

const ImageViewer: React.FC<ImageViewerProps> = ({ imageUrl, annotations, setAnnotations }) => {
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const [isViewerReady, setIsViewerReady] = useState(false);
  const [imageWidth, setImageWidth] = useState(0);
  const [selectedAnnotations, setSelectedAnnotations] = useState<string[]>([]);
  const [selectedSide, setSelectedSide] = useState<{ id: string; side: string } | null>(null);
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  // 이미 자동 선택을 진행한 이미지 URL을 저장
  const [lastSelectedImageUrl, setLastSelectedImageUrl] = useState<string | null>(null);

  const imageFileName = imageUrl.split('/').pop()?.split('.')[0] || '';

  // ---------------------------------------------------------
  // 1) 키보드 입력으로 'w,a,s,d' 키를 이용해 Annotation 사이를 이동하는 로직
  // ---------------------------------------------------------
  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      if (!['w', 'a', 's', 'd'].includes(e.key.toLowerCase())) return;
      e.preventDefault();
      e.stopPropagation();

      if (!viewerRef.current || selectedAnnotations.length === 0) return;

      const currentAnnotationId = selectedAnnotations[0];
      const currentAnnotation = annotations.find(
        (annotation) => annotation.id === currentAnnotationId
      );
      if (!currentAnnotation) return;

      const directionVectors: Record<string, [number, number]> = {
        w: [0, -1],
        s: [0, 1],
        a: [-1, 0],
        d: [1, 0],
      };

      const alpha = 1;
      const [cx, cy, cWidth, cHeight] = currentAnnotation.bbox;
      const currentCenter = { x: cx + cWidth / 2, y: cy + cHeight / 2 };
      const direction = directionVectors[e.key.toLowerCase()];

      let closestCandidate: string | null = null;
      let closestDistance = Infinity;

      annotations.forEach(({ id, bbox }) => {
        if (selectedAnnotations.includes(id)) return;

        const [bx, by, bWidth, bHeight] = bbox;
        const candidateCenter = { x: bx + bWidth / 2, y: by + bHeight / 2 };

        const vectorU = {
          x: candidateCenter.x - currentCenter.x,
          y: candidateCenter.y - currentCenter.y,
        };
        const euclideanDistance = Math.sqrt(vectorU.x ** 2 + vectorU.y ** 2);

        const normalizedD = { x: direction[0], y: direction[1] };
        const dotProduct = vectorU.x * normalizedD.x + vectorU.y * normalizedD.y;
        const projectedVector = {
          x: dotProduct * normalizedD.x,
          y: dotProduct * normalizedD.y,
        };
        const offsetVector = {
          x: vectorU.x - projectedVector.x,
          y: vectorU.y - projectedVector.y,
        };
        const offsetDistance = Math.sqrt(offsetVector.x ** 2 + offsetVector.y ** 2);

        const distanceScore = euclideanDistance + alpha * offsetDistance;
        const angleCos = dotProduct / (euclideanDistance || 1);

        // 방향성(각도) + 거리 점수를 이용해 가장 가까운 Annotation 찾기
        if (angleCos >= Math.cos(Math.PI / 4) && distanceScore < closestDistance) {
          closestDistance = distanceScore;
          closestCandidate = id;
        }
      });

      if (closestCandidate) {
        setSelectedAnnotations([closestCandidate]);
        setSelectedSide(null);
      }
    },
    [annotations, selectedAnnotations]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  // ---------------------------------------------------------
  // 2) "이미지 변경 시 + Annotation이 준비된 시점"에 한 번만 자동 선택
  // ---------------------------------------------------------
  useEffect(() => {
    // 1) 뷰어나 이미지가 준비되지 않았다면 스킵
    if (!viewerRef.current) return; // 뷰어 미준비
    if (!isViewerReady) return; // 뷰어 미준비
    if (!imageUrl) return; // URL 비어있음

    // 2) Annotation이 아직 비어 있으면(= 새 이미지 Annotation이 안 로드된 상태) 스킵
    if (annotations.length === 0) {
      return;
    }

    // 3) 이미 이 이미지Url에 대해 자동 선택을 했다면 재실행 스킵
    if (lastSelectedImageUrl === imageUrl) {
      return;
    }

    // ---- 여기까지 통과하면 "새 이미지 + 해당 Annotation이 로드된 상태" & "아직 자동 선택 안 한 상태" ----
    console.log('이미지 변경으로 인한 자동 선택 effect 실행:', imageUrl);

    // 4) 중앙 Annotation 찾기
    const viewportCenter = viewerRef.current.viewport.getCenter();
    const imageCenter = viewerRef.current.viewport.viewportToImageCoordinates(viewportCenter);

    let closestAnnotationId: string | null = null;
    let closestDistance = Infinity;

    annotations.forEach(({ id, bbox }) => {
      const [x, y, width, height] = bbox;
      const centerX = x + width / 2;
      const centerY = y + height / 2;

      const distance = Math.hypot(centerX - imageCenter.x, centerY - imageCenter.y);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestAnnotationId = id;
      }
    });

    // 5) 실제 선택 적용
    if (closestAnnotationId) {
      setSelectedAnnotations([closestAnnotationId]);
      setSelectedSide(null);
    }

    // 6) "이 이미지에 대해 자동 선택을 완료했다" 표시
    setLastSelectedImageUrl(imageUrl);
  }, [imageUrl, isViewerReady, annotations]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* 뷰어 초기화 (이미지 로딩) */}
      <ViewerSetup
        imageUrl={imageUrl}
        viewerRef={viewerRef}
        setIsViewerReady={setIsViewerReady}
        setImageWidth={setImageWidth}
        setIsToolbarVisible={setIsToolbarVisible}
      />

      {isViewerReady && viewerRef.current && (
        <>
          <AnnotationRenderer
            annotations={annotations}
            setAnnotations={setAnnotations}
            viewer={viewerRef.current}
            selectedAnnotations={selectedAnnotations}
            setSelectedAnnotations={setSelectedAnnotations}
            selectedSide={selectedSide}
            setSelectedSide={setSelectedSide}
            imageFileName={imageFileName}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
          />
          <Scalebar
            viewer={viewerRef.current}
            minWidthPx={200}
            location="BOTTOM_RIGHT"
            color="red"
            fontColor="white"
            backgroundColor="rgba(0, 0, 0, 0.7)"
            fontSize="14px"
            barThickness={6}
            imageWidth={imageWidth}
          />
          <BBoxCreator
            viewer={viewerRef.current}
            imageFileName={imageFileName}
            annotations={annotations} // 부모 상태 전달
            setAnnotations={setAnnotations} // 부모 업데이트 함수 전달
            setSelectedAnnotations={setSelectedAnnotations}
          />
          {isToolbarVisible && <Toolbar viewer={viewerRef.current} />}
        </>
      )}
    </div>
  );
};

export default ImageViewer;
