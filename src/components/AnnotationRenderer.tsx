import React, { useEffect, useRef, useState } from "react";
import OpenSeadragon from "openseadragon";
import { AnnotationRendererProps, CustomOSDEvent } from "../types/annotationrenderer";
import { CSSProperties } from 'react';

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
  selectedAnnotation,
  setSelectedAnnotation,
  selectedSide,
  setSelectedSide,
  imageFileName,
}) => {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);

    if (overlayRef.current) {
      viewer.addOverlay({
        element: overlayRef.current as HTMLElement,
        location: new OpenSeadragon.Rect(0, 0, 1, 1),
      });
    }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey) {
        const key = event.key;
        if (key === "0") {
          setSelectedClass("Unclassified");
        } else if (key >= "1" && key <= "9") {
          setSelectedClass(`Class ${key}`);
        }
      }
      if (event.key === "Delete" && selectedAnnotation) {
        deleteAnnotation(selectedAnnotation);
        setSelectedAnnotation(null);
        setSelectedSide(null);
        setSelectedClass(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedAnnotation]);

  useEffect(() => {
    const handleCanvasDoubleClick = (event: CustomOSDEvent) => {
      const imagePoint = viewer.viewport.viewportToImageCoordinates(
        viewer.viewport.pointFromPixel(event.position)
      );
      const clickedAnnotation = findClickedAnnotation(imagePoint);

      if (clickedAnnotation) {
        if (selectedAnnotation === clickedAnnotation.id) {
          handleAnnotationSelection(clickedAnnotation, imagePoint);
        } else {
          setSelectedAnnotation(clickedAnnotation.id);
          setSelectedSide(null);
        }
      } else {
        setSelectedAnnotation(null);
        setSelectedSide(null);
        setSelectedClass(null);
      }
    };

    viewer.addHandler("canvas-double-click", handleCanvasDoubleClick);
    return () => viewer.removeHandler("canvas-double-click", handleCanvasDoubleClick);
  }, [annotations, selectedAnnotation]);

  useEffect(() => {
    if (annotations.length > 0 && viewer && !selectedAnnotation) {
      selectClosestAnnotationToCenter();
    }
  }, [annotations, viewer, selectedAnnotation]);

  const deleteAnnotation = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this annotation?")) return;

    const updatedAnnotations = annotations.filter(annotation => annotation.id !== id);
    setAnnotations(updatedAnnotations);

    try {
      const response = await window.api.saveAnnotations(`${imageFileName}_annotation`, {
        annotations: updatedAnnotations,
      });
      if (!response.success) throw new Error(response.error || "Failed to save updated annotations.");
      location.reload();
    } catch (error) {
      console.error("Error deleting annotation:", error);
    }
  };

  const selectClosestAnnotationToCenter = () => {
    const imageCenter = viewer.viewport.viewportToImageCoordinates(viewer.viewport.getCenter());
    let closestAnnotationId: string | null = null;
    let closestDistance = Infinity;

    annotations.forEach(({ id, bbox }) => {
      const [x, y] = bbox;
      const distance = Math.sqrt((x - imageCenter.x) ** 2 + (y - imageCenter.y) ** 2);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestAnnotationId = id;
      }
    });

    if (closestAnnotationId) setSelectedAnnotation(closestAnnotationId);
  };

  const findClickedAnnotation = (imagePoint: OpenSeadragon.Point) => {
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

    return clickedAnnotationId ? { id: clickedAnnotationId, side: clickedSide } : null;
  };

  const handleAnnotationSelection = (
    annotation: { id: string; side: string | null },
    imagePoint: OpenSeadragon.Point
  ) => {
    const clickedSide = annotation.side ?? ""; // Null 값을 빈 문자열로 처리
    if (clickedSide && selectedSide?.id === annotation.id && selectedSide.side === clickedSide) {
      setSelectedSide(null);
    } else {
      setSelectedSide({ id: annotation.id, side: clickedSide });
    }
  };

  return (
    <div ref={overlayRef} style={styles.overlay as React.CSSProperties}>
      {annotations.map(annotation => (
        <AnnotationBox
          key={annotation.id}
          annotation={annotation}
          isSelected={annotation.id === selectedAnnotation}
          selectedClass={selectedClass}
          selectedSide={selectedSide}
          viewer={viewer}
        />
      ))}
    </div>
  );
};

const AnnotationBox: React.FC<{
  annotation: { id: string; bbox: [number, number, number, number]; class: string };
  isSelected: boolean;
  selectedClass: string | null;
  selectedSide: { id: string; side: string } | null;
  viewer: OpenSeadragon.Viewer;
}> = ({ annotation, isSelected, selectedClass, selectedSide, viewer }) => {
  const { id, bbox, class: annotationClass } = annotation;
  const viewport = viewer.viewport;
  const [x, y, width, height] = bbox;
  const topLeft = viewport.imageToViewportCoordinates(x, y);
  const bottomRight = viewport.imageToViewportCoordinates(x + width, y + height);
  const viewportWidth = bottomRight.x - topLeft.x;
  const viewportHeight = bottomRight.y - topLeft.y;
  const borderColor = classColors[annotationClass] || "#000000";

  return (
    <div
      style={{
        ...styles.annotationBox(topLeft.x, topLeft.y, viewportWidth, viewportHeight),
        borderColor,
      } as React.CSSProperties}
    >
      {(selectedClass === annotationClass || isSelected) && <div style={styles.selectedBorder as React.CSSProperties} />}
      {"top bottom left right".split(" ").map((side) => {
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
            } as React.CSSProperties}
          ></div>
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

const styles = {
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
  },
  annotationBox: (x: number, y: number, width: number, height: number): React.CSSProperties => ({
    position: "absolute",
    left: `${x * 100}%`,
    top: `${y * 100}%`,
    width: `${width * 100}%`,
    height: `${height * 100}%`,
    pointerEvents: "none",
    border: "3px solid",
  }),
  selectedBorder: {
    position: "absolute",
    width: "100%",
    height: "100%",
    border: "3px dashed yellow",
    boxSizing: "border-box",
  },
};

export default AnnotationRenderer;
