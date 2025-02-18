import React, { useEffect, useState } from 'react';
import { SketchPicker } from 'react-color';
import { ClassInfo, ClassManagerProps } from '../types/classmanager';

const ClassManager: React.FC<ClassManagerProps> = ({ selectedImageName }) => {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [classCounts, setClassCounts] = useState<Record<string, number>>({});
  const [colorPickerVisible, setColorPickerVisible] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedImageName) return;

    const fetchClasses = async () => {
      const response = await window.api.getClasses();
      if (response.success) {
        setClasses(response.classes);
      }
    };

    const updateClassCounts = async () => {
      const response = await window.api.getAnnotationsCounts(selectedImageName.replace('.png', ''));
      if (response.success) {
        setClassCounts(response.classCounts);
      }
    };

    fetchClasses();
    updateClassCounts();

    const interval = setInterval(updateClassCounts, 1000);
    return () => clearInterval(interval);
  }, [selectedImageName]);

  // 클래스 이름 변경 핸들러
  const handleNameChange = (id: number, oldName: string, newName: string) => {
    if (oldName === 'Unclassified') return;

    const updatedClasses = classes.map((cls) => (cls.id === id ? { ...cls, name: newName } : cls));

    setClasses(updatedClasses);
    window.api.updateClasses(updatedClasses);
    window.api.updateAnnotationsClassname(oldName, newName);
  };

  // 클래스 색상 변경 핸들러
  const handleColorChange = (id: number, newColor: string) => {
    const updatedClasses = classes.map((cls) =>
      cls.id === id ? { ...cls, color: newColor } : cls
    );

    setClasses(updatedClasses);
    window.api.updateClasses(updatedClasses);
  };

  return (
    <div style={{ padding: '10px', backgroundColor: '#222', color: '#fff', borderRadius: '8px' }}>
      <h3 style={{ textAlign: 'center' }}>Class Management</h3>
      {classes.map((cls) => (
        <div
          key={cls.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '10px',
            position: 'relative',
          }}
        >
          {/* 클래스 이름 입력 */}
          <input
            type="text"
            value={cls.name}
            disabled={cls.name === 'Unclassified'}
            onChange={(e) => handleNameChange(cls.id, cls.name, e.target.value)}
            style={{
              marginRight: '10px',
              width: '100px',
              backgroundColor: cls.name === 'Unclassified' ? '#555' : '#fff',
              color: cls.name === 'Unclassified' ? '#aaa' : '#000',
            }}
          />

          {/* 색상 선택기 트리거 */}
          <div
            onClick={() => setColorPickerVisible(cls.id === colorPickerVisible ? null : cls.id)}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '4px',
              backgroundColor: cls.color,
              cursor: 'pointer',
              border: '1px solid #ccc',
              marginRight: '10px',
            }}
          />

          {/* 어노테이션 개수 표시 */}
          <span style={{ marginLeft: 'auto', fontWeight: 'bold' }}>
            {classCounts[cls.name] || 0}
          </span>

          {/* react-color SketchPicker (고정된 위치) */}
          {colorPickerVisible === cls.id && (
            <div
              style={{
                position: 'absolute',
                zIndex: 100,
                left: '-20px', // 왼쪽 정렬 (Class Management 내부)
                top: '40px', // 아래쪽으로 일정하게 배치
                width: '100%', // 패널 내부에서 전체 너비 사용
              }}
            >
              <SketchPicker
                color={cls.color}
                onChange={(newColor) => handleColorChange(cls.id, newColor.hex)}
                width="100%"
              />
              <button
                onClick={() => setColorPickerVisible(null)}
                style={{
                  marginTop: '5px',
                  backgroundColor: '#555',
                  color: '#fff',
                  border: 'none',
                  padding: '5px',
                  cursor: 'pointer',
                  width: '100%',
                  borderRadius: '4px',
                }}
              >
                Close
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ClassManager;
