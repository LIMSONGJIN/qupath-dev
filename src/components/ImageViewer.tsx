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
  const [selectedAnnotations, setSelectedAnnotations] = useState<string[]>([]);
  const [selectedSide, setSelectedSide] = useState<{ id: string; side: string } | null>(null);
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);

  const imageFileName = imageUrl.split('/').pop()?.split('.')[0] || '';
  const lastSelectedAnnotationRef = useRef<string | null>(null); // 🔥 마지막으로 선택된 어노테이션 저장

  useEffect(() => {
    // 이미지가 변경될 때마다 초기 선택 상태를 리셋
    setSelectedAnnotations([]);
  }, [imageUrl]);


  // 키보드 입력 이벤트 처리
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!["w", "a", "s", "d"].includes(e.key.toLowerCase())) return;
      e.preventDefault();
      e.stopPropagation();


      if (!viewerRef.current || selectedAnnotations.length === 0) return;

      const currentAnnotationId = selectedAnnotations[0]; // 첫 번째 선택된 주석 기준으로 이동
      const currentAnnotation = annotations.find((annotation) => annotation.id === currentAnnotationId);
      if (!currentAnnotation) return;

      const directionVectors: Record<string, [number, number]> = {
        w: [0, -1],  // 위쪽
        s: [0, 1],   // 아래쪽
        a: [-1, 0],  // 왼쪽
        d: [1, 0],   // 오른쪽
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
        setSelectedAnnotations([closestCandidate]);
        setSelectedSide(null);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [annotations, selectedAnnotations]);


  useEffect(() => {
    if (!isViewerReady || !viewerRef.current || annotations.length === 0) return;
  
  
    let closestAnnotationId: string | null = null;
    let closestDistance = Infinity;
  
    annotations.forEach(({ id, bbox }) => {
      const [x, y, width, height] = bbox;
      const annotationCenterX = x + width / 2;
      const annotationCenterY = y + height / 2;
  
      const distance = Math.sqrt(annotationCenterX ** 2 + annotationCenterY ** 2);
  
      if (distance < closestDistance) {
        closestDistance = distance;
        closestAnnotationId = id;
      }
    });
  
    if (closestAnnotationId && lastSelectedAnnotationRef.current !== closestAnnotationId) {
  
      setSelectedAnnotations([closestAnnotationId]);
      setSelectedSide(null);
      lastSelectedAnnotationRef.current = closestAnnotationId;
    }
  }, [imageUrl, annotations, isViewerReady]); // 🔥 어노테이션이 업데이트될 때도 실행됨!
  
  
  
    

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
            selectedAnnotations={selectedAnnotations}  // 배열 형태로 변경된 상태 전달
            setSelectedAnnotations={setSelectedAnnotations}
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
          <BBoxCreator
            viewer={viewerRef.current}
            imageFileName={imageFileName}
            setSelectedAnnotations={setSelectedAnnotations}  // 선택 상태 전달
          />
          {isToolbarVisible && <Toolbar viewer={viewerRef.current} />}
        </>
      )}
    </div>
  );
};

export default ImageViewer;