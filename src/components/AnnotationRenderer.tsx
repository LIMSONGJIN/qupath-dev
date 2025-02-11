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
    const handleCanvasDoubleClick = (event: CustomOSDEvent) => {
      const viewportPoint = viewer.viewport.pointFromPixel(event.position);
      const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);

      let clickedAnnotationId: string | null = null;
      let clickedSide: string | null = null;
      const borderTolerance = 2;

      // 주석의 박스 내 클릭 여부 및 어느 면이 클릭되었는지 확인
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

      // 클릭된 주석이 없을 경우 중앙과 가장 가까운 주석 선택
      if (!clickedAnnotationId) {
        const viewportCenter = viewer.viewport.getCenter();
        const imageCenter = viewer.viewport.viewportToImageCoordinates(viewportCenter);

        let closestAnnotationId: string | null = null;
        let closestDistance = Infinity;

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

        clickedAnnotationId = closestAnnotationId;
      }

      // 주석 선택 로직
      if (clickedAnnotationId) {
        if (selectedAnnotation === clickedAnnotationId) {
          if (clickedSide) {
            // 클릭된 면이 선택된 상태와 동일하면 선택 해제, 그렇지 않으면 선택 상태 업데이트
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
        // 선택 해제
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
  }, [annotations, selectedAnnotation, selectedSide, setSelectedAnnotation, setSelectedSide, setSelectedClass, viewer]);

  useEffect(() => {
    if (annotations.length > 0 && viewer && !selectedAnnotation) {
      // 뷰어 중앙 좌표 가져오기
      const viewportCenter = viewer.viewport.getCenter();
      const imageCenter = viewer.viewport.viewportToImageCoordinates(viewportCenter);
  
      console.log("Initial image center point:", imageCenter);
  
      let closestAnnotationId: string | null = null;
      let closestDistance = Infinity;
  
      // 각 주석의 좌표와 중앙 좌표 간 거리 비교
      annotations.forEach(({ id, bbox }) => {
        const [x, y] = bbox;  // bbox 시작 좌표
  
        // 이미지 중앙 좌표와 해당 박스 좌표 간 거리 계산
        const distance = Math.sqrt(
          (x - imageCenter.x) ** 2 + (y - imageCenter.y) ** 2
        );
  
        if (distance < closestDistance) {
          closestDistance = distance;
          closestAnnotationId = id;
        }
      });
  
      // 가장 가까운 주석을 선택
      if (closestAnnotationId) {
        setSelectedAnnotation(closestAnnotationId);
        setSelectedSide(null);
      }
    }
  }, [annotations, viewer, selectedAnnotation, setSelectedAnnotation]);
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
