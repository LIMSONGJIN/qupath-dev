import React, { useEffect, useRef } from "react";
import OpenSeadragon from "openseadragon";

type ScalebarProps = {
  viewer: OpenSeadragon.Viewer;
  imageWidth: number; // 이미지 크기 추가
  minWidthPx?: number;
  location?: "BOTTOM_LEFT" | "BOTTOM_RIGHT" | "TOP_LEFT" | "TOP_RIGHT";
  color?: string;
  fontColor?: string;
  backgroundColor?: string;
  fontSize?: string;
  barThickness?: number;
};

const Scalebar: React.FC<ScalebarProps> = ({
  viewer,
  imageWidth,
  minWidthPx,
  location,
  color,
  fontColor,
  backgroundColor,
  fontSize,
  barThickness
}) => {
  const scalebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!viewer || !scalebarRef.current || imageWidth <= 0) return;

    // 이미지 크기를 기반으로 zoomSteps 생성
    const maxStep = imageWidth;
    const stepCount = 8;
    const zoomSteps = Array.from({ length: stepCount }, (_, i) => Math.round(maxStep / Math.pow(2, i)));

    const updateScalebar = () => {
      if (!viewer || !scalebarRef.current || !minWidthPx) return;  // minWidthPx 체크 추가

      const zoom = viewer.viewport.getZoom();
      const tiledImage = viewer.world.getItemAt(0);
      if (!tiledImage) return;

      const imageZoom = tiledImage.viewportToImageZoom(zoom);
      const targetStep = zoomSteps.find((step) => minWidthPx / imageZoom >= step) || zoomSteps[zoomSteps.length - 1];

      // DPI 보정 추가
      const dpiCorrection = window.devicePixelRatio || 1;
      const adjustmentFactor = 0.975; // 소수점 보정 추가
      const barLength = (targetStep * imageZoom ) / dpiCorrection;

      console.log('Bar Length:', barLength);
      scalebarRef.current.style.width = `${barLength}px`;
      scalebarRef.current.style.borderBottom = `${barThickness}px solid ${color}`;
      scalebarRef.current.textContent = `${targetStep} px`;
    };

    viewer.addHandler("zoom", updateScalebar);
    viewer.addHandler("animation", updateScalebar);
    viewer.addHandler("open", updateScalebar);

    updateScalebar();

    return () => {
      viewer.removeHandler("zoom", updateScalebar);
      viewer.removeHandler("animation", updateScalebar);
      viewer.removeHandler("open", updateScalebar);
    };
  }, [viewer, imageWidth, minWidthPx, color, barThickness]);

  const getPositionStyles = () => {
    switch (location) {
      case "BOTTOM_LEFT":
        return { bottom: "20px", left: "20px" };
      case "BOTTOM_RIGHT":
        return { bottom: "20px", right: "20px" };
      case "TOP_LEFT":
        return { top: "20px", left: "20px" };
      case "TOP_RIGHT":
        return { top: "20px", right: "20px" };
      default:
        return { bottom: "20px", left: "20px" };
    }
  };

  return (
    <div
      ref={scalebarRef}
      style={{
        position: "absolute",
        boxSizing: "border-box",
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
