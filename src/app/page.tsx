'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Upload, FileText, Eye, Settings } from 'lucide-react';
import { logger } from '../utils/logger';

interface SlideData {
  slideNumber: number;
  imageUrl: string;
  notes: string;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [storageStatus, setStorageStatus] = useState<{
    canUpload: boolean;
    currentSizeGB: number;
    maxSizeGB: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 檢查存儲狀態
  const checkStorageStatus = async () => {
    try {
      const response = await fetch('/api/storage-cleanup?action=status');
      if (response.ok) {
        const data = await response.json();
        setStorageStatus(data.storage);
      }
    } catch (error) {
      console.error('檢查存儲狀態失敗:', error);
    }
  };

  // 組件載入時檢查存儲狀態
  useEffect(() => {
    logger.info('應用程式啟動，檢查存儲狀態', null, 'CLIENT');
    checkStorageStatus();
    // 每 5 分鐘檢查一次存儲狀態
    const interval = setInterval(() => {
      logger.debug('定時檢查存儲狀態', null, 'CLIENT');
      checkStorageStatus();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      setFile(selectedFile);
      setSlides([]);
      logger.userAction('檔案選擇', { 
        fileName: selectedFile.name, 
        fileSize: `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` 
      });
    } else {
      logger.warn('用戶選擇了無效的檔案類型', { 
        fileName: selectedFile?.name, 
        fileType: selectedFile?.type 
      }, 'CLIENT');
      alert('請選擇有效的 PPTX 檔案');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    // 檢查存儲限制
    if (storageStatus && !storageStatus.canUpload) {
      logger.warn('存儲空間已滿，拒絕上傳', storageStatus, 'CLIENT');
      alert(`存儲空間已滿 (${storageStatus.currentSizeGB}GB / ${storageStatus.maxSizeGB}GB)，請稍後再試。`);
      return;
    }

    logger.userAction('開始上傳處理', { fileName: file.name });
    setIsProcessing(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/process-pptx', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '處理檔案時發生錯誤');
      }

      const data = await response.json();
      setSlides(data.slides);
      
      logger.userAction('檔案處理成功', { 
        fileName: file.name, 
        slidesCount: data.slides.length 
      });
      
      // 重新檢查存儲狀態
      await checkStorageStatus();
    } catch (error) {
      logger.error('處理 PPTX 檔案時發生錯誤', error, 'CLIENT');
      alert(error instanceof Error ? error.message : '處理檔案時發生錯誤，請重試');
    } finally {
      setIsProcessing(false);
    }
  };

  // 手動清理存儲空間
  const handleManualCleanup = async () => {
    if (!confirm('確定要清理過期檔案嗎？此操作會刪除超過 30 分鐘未訪問的圖片檔案。')) {
      return;
    }

    try {
      const response = await fetch('/api/storage-cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'cleanup' }),
      });

      if (response.ok) {
        const data = await response.json();
        const { cleanup, storage } = data;
        
        alert(`清理完成！\n刪除檔案數: ${cleanup.deletedFiles.length}\n釋放空間: ${(cleanup.totalSizeFreed / 1024 / 1024).toFixed(2)} MB\n目前存儲: ${storage.currentSizeGB}GB / ${storage.maxSizeGB}GB`);
        
        setStorageStatus(storage);
      } else {
        throw new Error('清理失敗');
      }
    } catch (error) {
      console.error('手動清理錯誤:', error);
      alert('清理失敗，請稍後再試');
    }
  };

  const handlePrintPreview = () => {
    if (slides.length === 0) return;

    logger.userAction('開啟列印預覽', { slidesCount: slides.length });

    // 將投影片資料存到 localStorage
    localStorage.setItem('printSlides', JSON.stringify(slides));
    
    // 開啟列印預覽頁面
    const printWindow = window.open('/print-preview', '_blank');
    
    if (!printWindow) {
      logger.warn('無法開啟列印預覽視窗', null, 'CLIENT');
      alert('無法開啟列印預覽視窗，請檢查瀏覽器的彈跳視窗設定');
    } else {
      logger.info('列印預覽視窗已開啟', null, 'CLIENT');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col">
      <div className="container mx-auto px-4 py-8 flex-1 flex flex-col justify-center">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-4">
            PPTX 講義生成器
          </h1>
          <p className="text-slate-300 text-lg">
            上傳您的 PowerPoint 檔案，生成專業的講義 PDF
          </p>
          {storageStatus ? (
            <div className="mt-6 text-sm flex items-center justify-center gap-4">
              <span className={`inline-block px-4 py-2 rounded-full ${
                storageStatus.canUpload 
                  ? 'bg-green-600 text-white' 
                  : 'bg-red-600 text-white'
              }`}>
                伺服器存儲空間: {storageStatus.currentSizeGB}GB / {storageStatus.maxSizeGB}GB
                {!storageStatus.canUpload && ' (已滿)'}
              </span>
              {storageStatus.currentSizeGB > 1 ? (
                <button
                  onClick={handleManualCleanup}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-md transition-colors"
                  title="清理超過 30 分鐘未訪問的檔案"
                >
                  清理空間
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* 檔案上傳區域 */}
        <div className="max-w-3xl mx-auto mb-12 w-full">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-8">
            <div className="border-2 border-dashed border-slate-600 rounded-xl p-12 text-center hover:border-blue-500 transition-all duration-300 hover:bg-slate-750">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".pptx"
                className="hidden"
              />
              
              {!file ? (
                <div className="space-y-6">
                  <Upload className="mx-auto h-16 w-16 text-slate-400" />
                  <div>
                    <p className="text-slate-200 text-xl mb-2">
                      點擊選擇或拖放 PPTX 檔案
                    </p>
                    <p className="text-slate-400 text-sm">
                      支援 PowerPoint (.pptx) 檔案
                    </p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg transition-colors text-lg font-medium"
                  >
                    選擇檔案
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <FileText className="mx-auto h-16 w-16 text-green-400" />
                  <div>
                    <p className="text-slate-200 font-medium text-xl mb-2">{file.name}</p>
                    <p className="text-slate-400 text-sm">
                      檔案大小: {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={handleUpload}
                      disabled={isProcessing}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white px-8 py-3 rounded-lg transition-colors text-lg font-medium flex items-center gap-3"
                    >
                      {isProcessing ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          處理中...
                        </>
                      ) : (
                        '開始處理'
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setFile(null);
                        setSlides([]);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                      className="bg-slate-600 hover:bg-slate-700 text-white px-8 py-3 rounded-lg transition-colors text-lg font-medium"
                    >
                      重新選擇
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 結果顯示區域 */}
        {slides.length > 0 && (
          <div className="max-w-6xl mx-auto">
            <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-slate-200">
                  處理結果 ({slides.length} 頁投影片)
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPreviewMode(!previewMode)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                    {previewMode ? '關閉預覽' : '預覽模式'}
                  </button>
                  <button
                    onClick={handlePrintPreview}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    🖨️ 列印預覽
                  </button>
                </div>
              </div>

              {previewMode ? (
                // 預覽模式 - 講義格式
                <div className="space-y-6">
                  {slides.map((slide) => (
                    <div key={slide.slideNumber} className="border border-slate-600 rounded-lg p-4 bg-slate-700">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="flex flex-col">
                          <h3 className="text-lg font-semibold mb-2 text-slate-200">
                            投影片 {slide.slideNumber}
                          </h3>
                          <div className="bg-white border border-slate-600 rounded overflow-hidden">
                            <Image
                              src={slide.imageUrl}
                              alt={`投影片 ${slide.slideNumber}`}
                              className="w-full h-auto max-h-[400px] object-contain"
                              width={800}
                              height={600}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col">
                          <h3 className="text-lg font-semibold mb-2 text-slate-200">
                            演講者備註
                          </h3>
                          <div className="bg-slate-600 p-4 rounded border border-slate-500 flex-1 min-h-[200px] max-h-[400px] overflow-y-auto">
                            <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                              {slide.notes || '此投影片沒有演講者備註'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // 格子模式
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {slides.map((slide) => (
                    <div key={slide.slideNumber} className="border border-slate-600 rounded-lg p-4 bg-slate-700">
                      <div className="mb-2">
                        <Image
                          src={slide.imageUrl}
                          alt={`投影片 ${slide.slideNumber}`}
                          className="w-full h-auto border border-slate-600 rounded"
                          width={400}
                          height={300}
                        />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold mb-1 text-slate-200">
                          投影片 {slide.slideNumber}
                        </h3>
                        <p 
                          className="text-xs text-slate-400"
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                        >
                          {slide.notes || '無演講者備註'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
