// ImageViewer.tsx
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

  // 현재 선택된 Annotation ID, 선택된 side, 툴바/드래그 상태 등 UI 상태
  const [selectedAnnotations, setSelectedAnnotations] = useState<string[]>([]);
  const [selectedSide, setSelectedSide] = useState<{ id: string; side: string } | null>(null);
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  // "이미지 + 어노테이션" 조합에 대해 자동 선택이 이미 실행되었는지 여부
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  const imageFileName = imageUrl.split('/').pop()?.split('.')[0] || '';

  // ---------------------------------------------------------
  // [A] 키보드 입력으로 'w,a,s,d' 키를 이용해 Annotation 간 이동
  // ---------------------------------------------------------
  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      if (!['w', 'a', 's', 'd'].includes(e.key.toLowerCase())) return;
      e.preventDefault();
      e.stopPropagation();

      if (!viewerRef.current || selectedAnnotations.length === 0) return;

      const currentAnnotationId = selectedAnnotations[0];
      const currentAnnotation = annotations.find((ann) => ann.id === currentAnnotationId);
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
  // [B] 이미지나 annotations가 바뀔 때, "자동 선택" 플래그 리셋
  // ---------------------------------------------------------
  useEffect(() => {
    // 이미지나 어노테이션 배열이 변경되면 새로 자동 선택 가능
    setHasAutoSelected(false);
  }, [imageUrl, annotations]);

  // ---------------------------------------------------------
  // [C] "이미지 변경 시 + Annotation 준비 완료"에 한 번만 자동 선택
  // ---------------------------------------------------------
  useEffect(() => {
    if (!viewerRef.current || !isViewerReady) return; // 뷰어가 준비 안 됨
    if (!imageUrl || annotations.length === 0) return; // 이미지나 어노테이션이 비어 있음
    if (hasAutoSelected) return; // 이미 자동 선택 완료

    console.log('자동 선택 실행:', imageUrl);

    // 1) 뷰어의 화면 중심 좌표
    const viewportCenter = viewerRef.current.viewport.getCenter();
    const imageCenter = viewerRef.current.viewport.viewportToImageCoordinates(viewportCenter);

    // 2) 어노테이션 중에서 화면 중심과 가장 가까운 것 찾기
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

    // 3) 선택 적용
    if (closestAnnotationId) {
      setSelectedAnnotations([closestAnnotationId]);
      setSelectedSide(null);
    }

    // 4) "자동 선택 완료" 표시
    setHasAutoSelected(true);

    // 디버깅 로그
    console.log('자동 선택 조건 충족:', {
      isViewerReady,
      imageUrl,
      annotationCount: annotations.length,
    });
  }, [imageUrl, isViewerReady, annotations, hasAutoSelected]);

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
            annotations={annotations}
            setAnnotations={setAnnotations}
            setSelectedAnnotations={setSelectedAnnotations}
          />
          {isToolbarVisible && <Toolbar viewer={viewerRef.current} />}
        </>
      )}
    </div>
  );
};

export default ImageViewer;
