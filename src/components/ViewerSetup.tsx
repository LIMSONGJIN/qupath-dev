import React, { useEffect } from "react";
import OpenSeadragon from "openseadragon";
import { ViewerSetupProps } from "../types/viewersetup";

const ViewerSetup: React.FC<ViewerSetupProps> = ({
  imageUrl,
  viewerRef,
  setIsViewerReady,
  setImageWidth,
  setIsToolbarVisible,
}) => {
  const hideTimerRef = React.useRef<number | null>(null);

  useEffect(() => {
    if (!viewerRef.current) {
      const viewer = OpenSeadragon({
        element: document.getElementById("openseadragon") as HTMLElement,
        tileSources: {
          type: "image",
          url: imageUrl,
        },
        showNavigator: false,
        showNavigationControl: false,
        defaultZoomLevel: 0.9,
        visibilityRatio: 0,
        minZoomLevel: 0.1,
        maxZoomLevel: 20,
        constrainDuringPan: true,
        animationTime: 1.2,
        springStiffness: 7.0,
        zoomPerClick: 1,
      });
      // 키보드 입력을 제어하는 핸들러 추가
      viewer.addHandler('canvas-key', (event: any) => {
        const key = event.originalEvent.key.toLowerCase();

        if (['w', 'a', 's', 'd', 'r'].includes(key)) {
            event.preventDefault();  // 기본 동작 차단
            event.stopPropagation(); // 이벤트 전파 중지
        }
      });
      viewer.addHandler("open", () => {
        const tiledImage = viewer.world.getItemAt(0);
        if (tiledImage) {
          setImageWidth(tiledImage.getContentSize().x);
        }
        viewer.viewport.fitBounds(tiledImage.getBounds(true));
        setIsViewerReady(true);
      });

      const resetToolbarTimer = () => {
        setIsToolbarVisible(true);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = window.setTimeout(() => setIsToolbarVisible(false), 3000);
      };

      viewer.addHandler("canvas-click", resetToolbarTimer);
      viewer.addHandler("canvas-drag", resetToolbarTimer);
      viewer.addHandler("canvas-scroll", resetToolbarTimer);

      viewerRef.current = viewer;
    } else {
      viewerRef.current.open({ type: "image", url: imageUrl });
    }
  }, [imageUrl]);

  return <div id="openseadragon" style={{ width: "100%", height: "100%", position: "relative" }}></div>;
};

export default ViewerSetup;
