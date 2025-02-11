import React, { useEffect, useRef, useState } from "react";
import OpenSeadragon from "openseadragon";
import { AnnotationRendererProps, CustomOSDEvent } from "../types/annotationrenderer";

const classColors: Record<string, string> = {
  "Unclassified": "#FF0000",
  "Class 1": "#0072B2",
  "Class 2": "#56B4E9",
  "Class 3": "#90EE90",
  "Class 4": "#009E73",
  "Class 5": "#E69F00",
  "Class 6": "#D55E00",
  "Class 7": "#CC79A7",
  "Class 8": "#4B0082",
  "Class 9": "#CCCCCC",
};

const AnnotationRenderer: React.FC<AnnotationRendererProps> = ({
  annotations,
  setAnnotations, // 상태 업데이트를 위한 함수 추가
  viewer,
  selectedAnnotation,
  setSelectedAnnotation,
  selectedSide,
  setSelectedSide,
  imageFileName,  // 이미지 파일 이름 추가
}) => {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);


  // 삭제 기능
  const deleteAnnotation = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this annotation?")) {
      return;  // 사용자가 취소하면 삭제하지 않음
    }
  
    // 상태에서 주석 삭제
    const updatedAnnotations = annotations.filter(annotation => annotation.id !== id);
    setAnnotations(updatedAnnotations);
  
    try {
      console.log("Saving updated annotations...");
      const response = await window.api.saveAnnotations(`${imageFileName}_annotation`, {
        annotations: updatedAnnotations,
      });
  
      if (!response.success) {
        throw new Error(response.error || "Failed to save updated annotations.");
      }
  
      console.log(`Annotation with ID ${id} deleted and saved successfully!`);
      location.reload();  // 페이지 새로고침
    } catch (error) {
      console.error("Error deleting annotation:", error);
    }
  };
  
  useEffect(() => {
    // 키보드 이벤트 핸들러
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey) {
        const key = event.key;
        if (key === "0") {
          setSelectedClass("Unclassified");
        } else if (key >= "1" && key <= "9") {
          setSelectedClass(`Class ${key}`);
        }
      }
  
      // Delete 키를 눌렀을 때 동작 추가
      if (event.key === "Delete" && selectedAnnotation) {
        console.log(`Delete key pressed for annotation: ${selectedAnnotation}`);
        deleteAnnotation(selectedAnnotation);  // 선택된 주석 삭제
        setSelectedAnnotation(null);           // 선택 해제
        setSelectedSide(null);
        setSelectedClass(null);
      }
    };
  
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedAnnotation, annotations]);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedAnnotation || !["w", "a", "s", "d"].includes(event.key.toLowerCase())) {
        return;
      }
  
      // OpenSeadragon의 기본 동작 막기
      event.preventDefault();
      event.stopPropagation();  // 이벤트 전파 방지
  
      const directionVectors: Record<string, [number, number]> = {
        w: [0, -1],
        s: [0, 1],
        a: [-1, 0],
        d: [1, 0],
      };
  
      const alpha = 1;
      const currentAnnotation = annotations.find(annotation => annotation.id === selectedAnnotation);
  
      if (!currentAnnotation) return;
  
      const [cx, cy, cWidth, cHeight] = currentAnnotation.bbox;
      const currentCenter = { x: cx + cWidth / 2, y: cy + cHeight / 2 };
      const direction = directionVectors[event.key.toLowerCase()];
  
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
        setSelectedClass(null);
      }
    };
  
    // 이벤트 등록
    window.addEventListener("keydown", handleKeyDown, true);  // 캡처 단계에서 이벤트 처리
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [annotations, selectedAnnotation, setSelectedAnnotation, setSelectedSide, setSelectedClass]);
  
  
  useEffect(() => {
    const handleCanvasDoubleClick = (event: CustomOSDEvent) => {
      const viewportPoint = viewer.viewport.pointFromPixel(event.position);
      const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);

      let clickedAnnotationId: string | null = null;
      let clickedSide: string | null = null;
      const borderTolerance = 2;

      annotations.forEach(({ id, bbox }) => {
        const [x, y, width, height] = bbox;

        if (
          imagePoint.x >= x - borderTolerance &&
          imagePoint.x <= x + width + borderTolerance &&
          imagePoint.y >= y - borderTolerance &&
          imagePoint.y <= y + height + borderTolerance
        ) {
          clickedAnnotationId = id;

          if (Math.abs(imagePoint.y - y) <= borderTolerance) clickedSide = "top";
          else if (Math.abs(imagePoint.y - (y + height)) <= borderTolerance) clickedSide = "bottom";
          else if (Math.abs(imagePoint.x - x) <= borderTolerance) clickedSide = "left";
          else if (Math.abs(imagePoint.x - (x + width)) <= borderTolerance) clickedSide = "right";
        }
      });

      if (clickedAnnotationId) {
        if (selectedAnnotation === clickedAnnotationId) {
          if (clickedSide) {
            if (selectedSide?.id === clickedAnnotationId && selectedSide.side === clickedSide) {
              setSelectedSide(null);
            } else {
              setSelectedSide({ id: clickedAnnotationId, side: clickedSide });
            }
          } else {
            setSelectedSide(null);
          }
        } else {
          setSelectedAnnotation(clickedAnnotationId);
          setSelectedSide(null);
        }
      } else {
        setSelectedAnnotation(null);
        setSelectedSide(null);
        setSelectedClass(null);
      }
    };

    if (overlayRef.current) {
      viewer.addOverlay({
        element: overlayRef.current as HTMLElement,
        location: new OpenSeadragon.Rect(0, 0, 1, 1),
      });
    }
    viewer.addHandler("canvas-double-click", handleCanvasDoubleClick);

    return () => viewer.removeHandler("canvas-double-click", handleCanvasDoubleClick);
  }, [annotations, selectedAnnotation, selectedSide, setSelectedAnnotation, setSelectedSide]);

  const viewport = viewer.viewport;

  return (
    <div ref={overlayRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      {annotations.map(({ id, bbox, class: annotationClass }) => {
        const [x, y, width, height] = bbox;
        const topLeft = viewport.imageToViewportCoordinates(x, y);
        const bottomRight = viewport.imageToViewportCoordinates(x + width, y + height);
        const viewportWidth = bottomRight.x - topLeft.x;
        const viewportHeight = bottomRight.y - topLeft.y;

        const isSelectedClass = annotationClass === selectedClass;
        const isSelected = id === selectedAnnotation;
        const borderColor = classColors[annotationClass] || "#000000";

        return (
          <div
            key={id}
            style={{
              position: "absolute",
              left: `${topLeft.x * 100}%`,
              top: `${topLeft.y * 100}%`,
              width: `${viewportWidth * 100}%`,
              height: `${viewportHeight * 100}%`,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                border: `3px solid ${borderColor}`,
                boxSizing: "border-box",
              }}
            ></div>

            {(isSelectedClass || isSelected) && (
              <div
                style={{
                  position: "absolute",
                  width: "100%",
                  height: "100%",
                  border: "3px dashed yellow",
                  boxSizing: "border-box",
                }}
              ></div>
            )}

            {isSelected && (
              <>
                {["top", "bottom", "left", "right"].map((side) => {
                  const sideStyle = getSideStyle(side, viewportWidth, viewportHeight);
                  const isThisSideSelected = selectedSide?.id === id && selectedSide.side === side;

                  return (
                    <div
                      key={side}
                      style={{
                        ...sideStyle,
                        position: "absolute",
                        backgroundColor: "transparent",
                        border: isThisSideSelected ? "3px solid cyan" : "none",
                        cursor: "pointer",
                        pointerEvents: "auto",
                      }}
                    ></div>
                  );
                })}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

const getSideStyle = (side: string, width: number, height: number): React.CSSProperties => {
  const sidePositions: Record<string, React.CSSProperties> = {
    top: { left: "0%", top: "-3px", width: "100%", height: "6px" },
    bottom: { left: "0%", bottom: "-3px", width: "100%", height: "6px" },
    left: { left: "-3px", top: "0%", width: "6px", height: "100%" },
    right: { right: "-3px", top: "0%", width: "6px", height: "100%" },
  };

  return sidePositions[side];
};

export default AnnotationRenderer;
