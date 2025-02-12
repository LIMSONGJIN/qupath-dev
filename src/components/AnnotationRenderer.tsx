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
  setAnnotations,
  viewer,
  selectedAnnotations,
  setSelectedAnnotations,
  selectedSide,
  setSelectedSide,
  imageFileName,
}) => {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [lastImageFile, setLastImageFile] = useState<string | null>(null);

  if (overlayRef.current) {
    viewer.addOverlay({
      element: overlayRef.current as HTMLElement,
      location: new OpenSeadragon.Rect(0, 0, 1, 1),
    });
  }

// 여러 주석을 한 번에 삭제하는 함수로 변경
const deleteSelectedAnnotations = async () => {
  if (!window.confirm("Are you sure you want to delete the selected annotations?")) return;

  const updatedAnnotations = annotations.filter((annotation) => !selectedAnnotations.includes(annotation.id));
  setAnnotations(updatedAnnotations);

  try {
    const response = await window.api.saveAnnotations(`${imageFileName}_annotation`, {
      annotations: updatedAnnotations,
    });

    if (!response.success) {
      throw new Error(response.error || "Failed to save updated annotations.");
    }
    console.log(`Selected annotations deleted and saved successfully!`);
    location.reload();
  } catch (error) {
    console.error("Error deleting annotations:", error);
  }

  // 선택 상태 초기화
  setSelectedAnnotations([]);
  setSelectedSide(null);
};

useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    // Delete 키로 선택된 모든 주석 삭제
    if (event.key === "Delete" && selectedAnnotations.length > 0) {
      deleteSelectedAnnotations();  // 여러 주석을 한 번에 삭제
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [selectedAnnotations]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey) {
        const key = event.key;
        let newClass = null;

        if (key === "0") {
          newClass = "Unclassified";
        } else if (key >= "1" && key <= "9") {
          newClass = `Class ${key}`;
        }

        if (newClass) {
          const matchingAnnotations = annotations
            .filter(annotation => annotation.class === newClass)
            .map(annotation => annotation.id); // ID만 가져옴

          setSelectedAnnotations(matchingAnnotations);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [annotations]);

  useEffect(() => {
    const handleCanvasDoubleClick = (event: CustomOSDEvent) => {
      const viewportPoint = viewer.viewport.pointFromPixel(event.position);
      const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);

      let clickedAnnotationId: string | null = null;
      let clickedSide: string | null = null;
      const borderTolerance = 2;

      // 주석 영역을 확인하여 클릭된 주석 찾기
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
        if (event.originalEvent.altKey) {
          // Alt 키가 눌린 상태면 현재 선택 상태에 따라 추가 또는 제거
          if (selectedAnnotations.includes(clickedAnnotationId)) {
            // 이미 선택된 주석이면 선택 해제
            setSelectedAnnotations(selectedAnnotations.filter((id) => id !== clickedAnnotationId));
          } else {
            // 선택되지 않은 주석이면 추가 선택
            setSelectedAnnotations([...selectedAnnotations, clickedAnnotationId]);
          }
        } else {
          // Alt 키가 아닌 상태에서는 해당 주석만 선택
          setSelectedAnnotations([clickedAnnotationId]);
        }
        setSelectedSide(clickedSide ? { id: clickedAnnotationId, side: clickedSide } : null);
      } else {
        // 선택 해제
        setSelectedAnnotations([]);
        setSelectedSide(null);
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
  }, [annotations, selectedAnnotations, selectedSide, setSelectedAnnotations, setSelectedSide, viewer]);


  useEffect(() => {
    console.log("현재 선택된 주석:", selectedAnnotations); // ✅ 선택된 주석이 변경될 때마다 로그 확인
  }, [selectedAnnotations]);

  useEffect(() => {
    // ✅ 이미지를 처음 로드했거나, 이미지가 변경될 때만 실행
    if (imageFileName !== lastImageFile) {
      if (annotations.length === 0 || !viewer) return; // 어노테이션이 없거나 뷰어가 없으면 실행 X
  
      const viewportCenter = viewer.viewport.getCenter(); 
      const imageCenter = viewer.viewport.viewportToImageCoordinates(viewportCenter);
  
      let closestAnnotationId: string | null = null;
      let closestDistance = Infinity;
  
      annotations.forEach(({ id, bbox }) => {
        const [x, y, width, height] = bbox;
        const annotationCenterX = x + width / 2;
        const annotationCenterY = y + height / 2;
  
        const distance = Math.sqrt(
          (annotationCenterX - imageCenter.x) ** 2 + (annotationCenterY - imageCenter.y) ** 2
        );
  
        if (distance < closestDistance) {
          closestDistance = distance;
          closestAnnotationId = id;
        }
      });
  
      if (closestAnnotationId) {
        setSelectedAnnotations([closestAnnotationId]); // 자동 선택
        setSelectedSide(null);
      }
  
      setLastImageFile(imageFileName); // 현재 이미지 파일을 저장하여 중복 실행 방지
    }
  }, [imageFileName, annotations, viewer]); // ✅ 이미지가 변경될 때만 실행
  const viewport = viewer.viewport;
  return (
    <div ref={overlayRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      {annotations.map(({ id, bbox, class: annotationClass }) => {
        const [x, y, width, height] = bbox;
        const topLeft = viewport.imageToViewportCoordinates(x, y);
        const bottomRight = viewport.imageToViewportCoordinates(x + width, y + height);
        const viewportWidth = bottomRight.x - topLeft.x;
        const viewportHeight = bottomRight.y - topLeft.y;

        const isSelected = selectedAnnotations.some(selectedId => selectedId === id);
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

            {isSelected && (
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
