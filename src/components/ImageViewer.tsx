import React, { useEffect, useRef, useState } from "react";
import OpenSeadragon from "openseadragon";
import Scalebar from "./ScaleBar"; // Scalebar 컴포넌트 경로

const ImageViewer: React.FC = () => {
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const [isViewerReady, setIsViewerReady] = useState(false);

  // 1 마이크로미터당 픽셀 수 (이미지의 배율 설정)
  const one_um_to_pixels = 0.5; // 예시 값 (20x 확대)
  const RESIZE_RATIO = 1; // 이미지 리사이징 비율

  useEffect(() => {
    if (!viewerRef.current) {
      const viewer = OpenSeadragon({
        element: document.getElementById("openseadragon") as HTMLElement,
        tileSources: {
          type: "image",
          url: "/images/1.png", // 사용할 이미지 경로
        },
        showNavigator: true,
        defaultZoomLevel: 1,
        minZoomLevel: 0.5,
        maxZoomLevel: 10,
        visibilityRatio: 1,
      });

      viewer.addHandler("open", () => {
        console.log("Viewer opened:", viewer);
        setIsViewerReady(true); // Viewer가 준비되었음을 설정
      });

      viewerRef.current = viewer;
    }

    return () => {
      if (viewerRef.current) {
        console.log("Destroying viewer:", viewerRef.current);
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        id="openseadragon"
        style={{
          width: "100%",
          height: "600px",
        }}
      ></div>
      {isViewerReady && viewerRef.current && (
        <Scalebar
          viewer={viewerRef.current}
          pixelsPerMeter={(1000 * 1000 * one_um_to_pixels) / RESIZE_RATIO} // 픽셀과 실제 길이 변환
          minWidthPx={200} // Scalebar의 최소 너비
          location="BOTTOM_RIGHT"
          color="red"
          fontColor="white"
          backgroundColor="rgba(0, 0, 0, 0.7)"
          fontSize="14px"
          barThickness={6}
        />
      )}
    </div>
  );
};

export default ImageViewer;
