'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Upload, FileText, Download, Eye } from 'lucide-react';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      setFile(selectedFile);
      setSlides([]);
    } else {
      alert('請選擇有效的 PPTX 檔案');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsProcessing(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/process-pptx', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('處理檔案時發生錯誤');
      }

      const data = await response.json();
      setSlides(data.slides);
    } catch (error) {
      console.error('處理 PPTX 檔案時發生錯誤:', error);
      alert('處理檔案時發生錯誤，請重試');
    } finally {
      setIsProcessing(false);
    }
  };

  const generatePDF = async () => {
    if (slides.length === 0) return;

    try {
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ slides }),
      });

      if (!response.ok) {
        throw new Error('生成 PDF 時發生錯誤');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'handouts.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('生成 PDF 時發生錯誤:', error);
      alert('生成 PDF 時發生錯誤，請重試');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            PPTX 講義生成器
          </h1>
          <p className="text-gray-600">
            上傳您的 PowerPoint 檔案，生成專業的講義 PDF
          </p>
        </div>

        {/* 檔案上傳區域 */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".pptx"
                className="hidden"
              />
              
              {!file ? (
                <div>
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-gray-600 mb-4">
                    點擊選擇或拖放 PPTX 檔案
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
                  >
                    選擇檔案
                  </button>
                </div>
              ) : (
                <div>
                  <FileText className="mx-auto h-12 w-12 text-green-500 mb-4" />
                  <p className="text-gray-800 font-medium mb-2">{file.name}</p>
                  <p className="text-gray-500 text-sm mb-4">
                    檔案大小: {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={handleUpload}
                      disabled={isProcessing}
                      className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition-colors"
                    >
                      {isProcessing ? '處理中...' : '開始處理'}
                    </button>
                    <button
                      onClick={() => {
                        setFile(null);
                        setSlides([]);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                      className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors"
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
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">
                  處理結果 ({slides.length} 頁投影片)
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPreviewMode(!previewMode)}
                    className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                    {previewMode ? '關閉預覽' : '預覽模式'}
                  </button>
                  <button
                    onClick={generatePDF}
                    className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    下載 PDF
                  </button>
                </div>
              </div>

              {previewMode ? (
                // 預覽模式 - 講義格式
                <div className="space-y-6">
                  {slides.map((slide) => (
                    <div key={slide.slideNumber} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex gap-6">
                        <div className="flex-1">
                          <Image
                            src={slide.imageUrl}
                            alt={`投影片 ${slide.slideNumber}`}
                            className="w-full h-auto border border-gray-300 rounded"
                            width={800}
                            height={600}
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold mb-2">
                            投影片 {slide.slideNumber} - 演講者備註
                          </h3>
                          <div className="bg-gray-50 p-4 rounded border min-h-[200px]">
                            <p className="text-gray-700 whitespace-pre-wrap">
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
                    <div key={slide.slideNumber} className="border border-gray-200 rounded-lg p-4">
                      <div className="mb-2">
                        <Image
                          src={slide.imageUrl}
                          alt={`投影片 ${slide.slideNumber}`}
                          className="w-full h-auto border border-gray-300 rounded"
                          width={400}
                          height={300}
                        />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold mb-1">
                          投影片 {slide.slideNumber}
                        </h3>
                        <p className="text-xs text-gray-600 line-clamp-3">
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
