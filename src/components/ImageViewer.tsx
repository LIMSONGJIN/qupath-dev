import React, { useState, useRef } from "react";
import ViewerSetup from "./ViewerSetup";
import AnnotationRenderer from "./AnnotationRenderer";
import Toolbar from "./Toolbar";
import Scalebar from "./ScaleBar";
import BBoxCreator from "./BBoxCreator";
import OpenSeadragon from "openseadragon";
import { ImageViewerProps } from "../types/imageviewer";


const ImageViewer: React.FC<ImageViewerProps> = ({ imageUrl, annotations }) => {
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const [isViewerReady, setIsViewerReady] = useState(false);
  const [imageWidth, setImageWidth] = useState(0);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [selectedSide, setSelectedSide] = useState<{ id: string; side: string } | null>(null);
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);

    // 파일 이름 추출 함수
    const extractFileName = (url: string): string => {
      const parts = url.split('/');
      return parts[parts.length - 1].split('.')[0]; // 확장자를 제거한 파일 이름 반환
    };
  
    const imageFileName = extractFileName(imageUrl);
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
            viewer={viewerRef.current}
            selectedAnnotation={selectedAnnotation}
            setSelectedAnnotation={setSelectedAnnotation}
            selectedSide={selectedSide}
            setSelectedSide={setSelectedSide}
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
          <BBoxCreator viewer={viewerRef.current}  imageFileName={imageFileName}/>
          {isToolbarVisible && <Toolbar viewer={viewerRef.current} />}
        </>
      )}
    </div>
  );
};

export default ImageViewer;
