import React, { useEffect, useState, useRef } from "react";
import ViewerSetup from "./ViewerSetup";
import AnnotationRenderer from "./AnnotationRenderer";
import Toolbar from "./Toolbar";
import Scalebar from "./ScaleBar";
import BBoxCreator from "./BBoxCreator";
import OpenSeadragon from "openseadragon";
import { ImageViewerProps } from "../types/imageviewer";

const ImageViewer: React.FC<ImageViewerProps> = ({ imageUrl, annotations, setAnnotations }) => {
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const [isViewerReady, setIsViewerReady] = useState(false);
  const [imageWidth, setImageWidth] = useState(0);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [selectedSide, setSelectedSide] = useState<{ id: string; side: string } | null>(null);
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);
  const [initialSelectionDone, setInitialSelectionDone] = useState(false);

  const imageFileName = imageUrl.split('/').pop()?.split('.')[0] || '';


  useEffect(() => {
    // 이미지가 변경될 때마다 초기 선택 상태를 리셋
    setInitialSelectionDone(false);
  }, [imageUrl]);
  
  useEffect(() => {
    if (!initialSelectionDone && annotations.length > 0 && viewerRef.current) {
      // 뷰어 중앙 좌표 가져오기
      const viewportCenter = viewerRef.current.viewport.getCenter();
      const imageCenter = viewerRef.current.viewport.viewportToImageCoordinates(viewportCenter);
  
      let closestAnnotationId: string | null = null;
      let closestDistance = Infinity;
  
      // 주석 중 가장 가까운 주석을 선택
      annotations.forEach(({ id, bbox }) => {
        const [x, y, width, height] = bbox;
        const centerX = x + width / 2;
        const centerY = y + height / 2;
  
        const distance = Math.sqrt(
          (centerX - imageCenter.x) ** 2 + (centerY - imageCenter.y) ** 2
        );
  
        if (distance < closestDistance) {
          closestDistance = distance;
          closestAnnotationId = id;
        }
      });
  
      if (closestAnnotationId) {
        setSelectedAnnotation(closestAnnotationId);
      }
    }
  }, [annotations, viewerRef.current, initialSelectionDone]);
  
  // 사용자 키 입력 이벤트로 주석 탐색 기능 추가
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!["w", "a", "s", "d"].includes(e.key.toLowerCase())) return;
  
      // 키 입력이 감지되면 초기 선택 상태를 무시하도록 설정
      setInitialSelectionDone(true);
  
      if (!viewerRef.current || !selectedAnnotation) return;
  
      // 방향 벡터 정의
      const directionVectors: Record<string, [number, number]> = {
        w: [0, -1],  // 위쪽
        s: [0, 1],   // 아래쪽
        a: [-1, 0],  // 왼쪽
        d: [1, 0],   // 오른쪽
      };
  
      const alpha = 1;
      const currentAnnotation = annotations.find((annotation) => annotation.id === selectedAnnotation);
      if (!currentAnnotation) return;
  
      const [cx, cy, cWidth, cHeight] = currentAnnotation.bbox;
      const currentCenter = { x: cx + cWidth / 2, y: cy + cHeight / 2 };
      const direction = directionVectors[e.key.toLowerCase()];
  
      let closestCandidate: string | null = null;
      let closestDistance = Infinity;
  
      annotations.forEach(({ id, bbox }) => {
        if (id === selectedAnnotation) return;
  
        const [bx, by, bWidth, bHeight] = bbox;
        const candidateCenter = { x: bx + bWidth / 2, y: by + bHeight / 2 };
  
        const vectorU = {
          x: candidateCenter.x - currentCenter.x,
          y: candidateCenter.y - currentCenter.y,
        };
        const euclideanDistance = Math.sqrt(vectorU.x ** 2 + vectorU.y ** 2);
  
        const normalizedD = {
          x: direction[0],
          y: direction[1],
        };
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
        if (angleCos >= Math.cos(Math.PI / 4) && distanceScore < closestDistance) {
          closestDistance = distanceScore;
          closestCandidate = id;
        }
      });
  
      if (closestCandidate) {
        setSelectedAnnotation(closestCandidate);
        setSelectedSide(null);
      }
    };
  
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [annotations, selectedAnnotation]);
  

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
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
            selectedAnnotation={selectedAnnotation}
            setSelectedAnnotation={setSelectedAnnotation}
            selectedSide={selectedSide}
            setSelectedSide={setSelectedSide}
            imageFileName={imageFileName}
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
          <BBoxCreator viewer={viewerRef.current} imageFileName={imageFileName} />
          {isToolbarVisible && <Toolbar viewer={viewerRef.current} />}
        </>
      )}
    </div>
  );
};

export default ImageViewer;
