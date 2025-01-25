import React, { useEffect, useRef } from "react";
import OpenSeadragon from "openseadragon";

type ScalebarProps = {
  viewer: OpenSeadragon.Viewer;
  pixelsPerMeter: number; // Number of pixels per meter for the image
  minWidthPx?: number; // Minimum width of the scalebar in pixels
  location?: "BOTTOM_LEFT" | "BOTTOM_RIGHT" | "TOP_LEFT" | "TOP_RIGHT"; // Location of the scalebar
  color?: string; // Scalebar color
  fontColor?: string; // Font color
  backgroundColor?: string; // Background color
  fontSize?: string; // Font size
  barThickness?: number; // Thickness of the scalebar in pixels
};

const Scalebar: React.FC<ScalebarProps> = ({
  viewer,
  pixelsPerMeter,
  minWidthPx = 150,
  location = "BOTTOM_LEFT",
  color = "white",
  fontColor = "white",
  backgroundColor = "rgba(0, 0, 0, 0.5)",
  fontSize = "14px",
  barThickness = 4,
}) => {
  const scalebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!viewer || !scalebarRef.current) return;

    const updateScalebar = () => {
      if (!viewer || !scalebarRef.current) return;

      const zoom = viewer.viewport.getZoom();
      const imageZoom = viewer.world.getItemAt(0).viewportToImageZoom(zoom);
      const currentPixelsPerMeter = imageZoom * pixelsPerMeter;

      // Calculate size and text for the scalebar
      const sizeInMeters = minWidthPx / currentPixelsPerMeter;
      const sizeText =
        sizeInMeters >= 1
          ? `${sizeInMeters.toFixed(2)} m`
          : `${(sizeInMeters * 1000).toFixed(0)} mm`;

      // Update scalebar styles
      scalebarRef.current.style.width = `${minWidthPx}px`;
      scalebarRef.current.style.borderBottom = `${barThickness}px solid ${color}`;
      scalebarRef.current.textContent = sizeText;
    };

    // Attach event handlers
    viewer.addHandler("zoom", updateScalebar);
    viewer.addHandler("animation", updateScalebar);
    viewer.addHandler("open", updateScalebar);

    // Initialize the scalebar
    updateScalebar();

    return () => {
      // Cleanup handlers
      viewer.removeHandler("zoom", updateScalebar);
      viewer.removeHandler("animation", updateScalebar);
      viewer.removeHandler("open", updateScalebar);
    };
  }, [viewer, pixelsPerMeter, minWidthPx, color, barThickness]);

  const getPositionStyles = () => {
    switch (location) {
      case "BOTTOM_LEFT":
        return { bottom: "10px", left: "10px" };
      case "BOTTOM_RIGHT":
        return { bottom: "10px", right: "10px" };
      case "TOP_LEFT":
        return { top: "10px", left: "10px" };
      case "TOP_RIGHT":
        return { top: "10px", right: "10px" };
      default:
        return { bottom: "10px", left: "10px" };
    }
  };

  return (
    <div
      ref={scalebarRef}
      style={{
        position: "absolute",
        ...getPositionStyles(),
        color: fontColor,
        backgroundColor,
        padding: "4px 8px",
        textAlign: "center",
        fontSize,
        pointerEvents: "none",
        whiteSpace: "nowrap",
      }}
    ></div>
  );
};

export default Scalebar;
