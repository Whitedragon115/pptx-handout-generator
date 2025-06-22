'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import './print.css';

interface SlideData {
  slideNumber: number;
  imageUrl: string;
  notes: string;
}

export default function PrintPreviewPage() {
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [editableNotes, setEditableNotes] = useState<{ [key: number]: string }>({});
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  useEffect(() => {
    // 從 URL 參數或 localStorage 獲取投影片資料
    const slidesData = searchParams.get('slides');
    if (slidesData) {
      try {
        const decodedSlides = JSON.parse(decodeURIComponent(slidesData));
        setSlides(decodedSlides);
        // 初始化可編輯備註
        const initialNotes: { [key: number]: string } = {};
        decodedSlides.forEach((slide: SlideData) => {
          initialNotes[slide.slideNumber] = slide.notes || '';
        });
        setEditableNotes(initialNotes);
      } catch (error) {
        console.error('解析投影片資料失敗:', error);
      }
    } else {
      // 嘗試從 localStorage 獲取
      const storedSlides = localStorage.getItem('printSlides');
      if (storedSlides) {
        try {
          const decodedSlides = JSON.parse(storedSlides);
          setSlides(decodedSlides);
          // 初始化可編輯備註
          const initialNotes: { [key: number]: string } = {};
          decodedSlides.forEach((slide: SlideData) => {
            initialNotes[slide.slideNumber] = slide.notes || '';
          });
          setEditableNotes(initialNotes);
        } catch (error) {
          console.error('從 localStorage 獲取投影片資料失敗:', error);
        }
      }
    }
    setLoading(false);
  }, [searchParams]);

  useEffect(() => {
    // 頁面載入完成後自動觸發列印對話框
    if (!loading && slides.length > 0) {
      const timer = setTimeout(() => {
        window.print();
      }, 1000); // 延遲 1 秒讓內容完全載入

      return () => clearTimeout(timer);
    }
  }, [loading, slides]);

  const handleNotesChange = (slideNumber: number, newNotes: string) => {
    setEditableNotes(prev => ({
      ...prev,
      [slideNumber]: newNotes
    }));
  };  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    window.history.back();
  };

  if (loading) {
    return (
      <div className="loading-container">
        <p>載入中...</p>
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="error-container">
        <h2>沒有找到投影片資料</h2>
        <button onClick={handleBack} className="back-button">
          返回
        </button>
      </div>
    );
  }

  return (
    <>
      {/* 螢幕顯示的控制按鈕 */}
      <div className="print-controls no-print">
        <h1>列印預覽</h1>
        <div className="button-group">
          <button onClick={handlePrint} className="print-button">
            🖨️ 列印 / 儲存為 PDF
          </button>
          <button onClick={handleBack} className="back-button">
            ← 返回
          </button>
        </div>
        <p className="instruction">
          提示：點擊「列印」按鈕，然後在列印對話框中選擇「另存為 PDF」即可生成 PDF 檔案
        </p>
      </div>      {/* 列印內容 */}
      <div className="print-content">
        <div className="document-header">
          <h1>投影片講義</h1>
          <p>生成時間: {new Date().toLocaleString('zh-TW')}</p>
          <p>共 {slides.length} 個投影片</p>
        </div>

        {/* 讓每個投影片獨立顯示，瀏覽器自動決定分頁 */}        <div className="slides-container">
          {slides.map((slide) => (
            <div key={slide.slideNumber} className="slide-item">              {/* 上半部：圖片 + 投影片編號 */}
              <div className="slide-top-section">
                <div className="slide-image-section">
                  {slide.imageUrl && !slide.imageUrl.includes('placeholder') ? (
                    <img
                      src={slide.imageUrl}
                      alt={`投影片 ${slide.slideNumber}`}
                      className="slide-image"
                    />
                  ) : (
                    <div className="placeholder-image">
                      <p>投影片 {slide.slideNumber}</p>
                    </div>
                  )}
                </div>
                <div className="slide-title">
                  <h3>投影片 {slide.slideNumber}</h3>
                </div>
              </div>
                {/* 下半部：備註文字 */}
              <div className="slide-bottom-section">
                <div className="slide-notes">
                  <textarea
                    className="editable-textarea no-print"
                    value={editableNotes[slide.slideNumber] || ''}
                    onChange={(e) => handleNotesChange(slide.slideNumber, e.target.value)}
                    placeholder="點擊此處編輯備註..."
                  />
                  {/* 用於列印的內容 */}
                  <div className="print-only notes-content" style={{ display: 'none' }}>
                    {editableNotes[slide.slideNumber] && editableNotes[slide.slideNumber].trim() ? (
                      editableNotes[slide.slideNumber].split('\n').map((line, lineIndex) => (
                        line.trim() && (
                          <p key={lineIndex} className="note-line">
                            • {line.trim()}
                          </p>
                        )
                      ))
                    ) : (
                      <p className="no-notes">（無備註）</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="document-footer">
          <p>包含 {slides.length} 個投影片</p>
        </div>
      </div>
    </>
  );
}
