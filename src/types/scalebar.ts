export interface ScalebarProps {
  viewer: OpenSeadragon.Viewer;
  imageWidth: number; // 이미지 크기 추가
  minWidthPx: number;
  location?: "BOTTOM_LEFT" | "BOTTOM_RIGHT" | "TOP_LEFT" | "TOP_RIGHT";
  color?: string;
  fontColor?: string;
  backgroundColor?: string;
  fontSize?: string;
  barThickness?: number;
};