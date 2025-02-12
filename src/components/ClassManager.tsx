import React, { useEffect, useState } from 'react';
import { ClassInfo, ClassManagerProps } from '../types/classmanager';

const ClassManager: React.FC<ClassManagerProps> = ({ selectedImageName }) => {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [classCounts, setClassCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!selectedImageName) return;

    // 클래스 목록 불러오기
    const fetchClasses = async () => {
      const response = await window.api.getClasses();
      if (response.success) {
        setClasses(response.classes);
      }
    };

    // 선택된 이미지의 어노테이션 개수 불러오기
    const updateClassCounts = async () => {
      const response = await window.api.getAnnotationsCounts(selectedImageName.replace('.png', ''));
      if (response.success) {
        setClassCounts(response.classCounts);
      }
    };

    fetchClasses();
    updateClassCounts();

    // 1초마다 어노테이션 개수 업데이트
    const interval = setInterval(updateClassCounts, 1000);

    return () => clearInterval(interval);
  }, [selectedImageName]);

  // 클래스 이름 변경 핸들러
  const handleNameChange = (id: number, oldName: string, newName: string) => {
    if (oldName === 'Unclassified') return; // Unclassified는 변경 금지

    // 기존 클래스에서 이름 변경
    const updatedClasses = classes.map((cls) => (cls.id === id ? { ...cls, name: newName } : cls));

    setClasses(updatedClasses);
    window.api.updateClasses(updatedClasses);
    window.api.updateAnnotationsClassname(oldName, newName); // 어노테이션 내 클래스 이름 변경
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
        <div key={cls.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
          {/* 클래스 이름 수정 (Unclassified는 비활성화) */}
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

          {/* 클래스 색상 변경 */}
          <input
            type="color"
            value={cls.color}
            onChange={(e) => handleColorChange(cls.id, e.target.value)}
            style={{ marginRight: '10px' }}
          />

          {/* 어노테이션 개수 표시 */}
          <span style={{ marginLeft: 'auto', fontWeight: 'bold' }}>
            {classCounts[cls.name] || 0}
          </span>
        </div>
      ))}
    </div>
  );
};

export default ClassManager;
