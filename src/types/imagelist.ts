export interface ImageListProps {
    onImageSelect: (image: string, name: string) => void;
    selectedImage: string;
    setImages: (images: ImageInfo[]) => void;  // 이미지 리스트 상태 전달
  }
  
export interface ImageInfo {
    url: string;
    name: string;
    width: number;
    height: number;
}