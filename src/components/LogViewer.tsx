import React, { useState, useEffect } from 'react';
import { logger } from '../utils/logger';

interface LogViewerProps {
  isVisible: boolean;
  onClose: () => void;
}

const LogViewer: React.FC<LogViewerProps> = ({ isVisible, onClose }) => {
  const [logLevel, setLogLevel] = useState<'DEBUG' | 'INFO' | 'WARN' | 'ERROR'>('INFO');
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLogLevel = localStorage.getItem('logLevel') as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
      if (savedLogLevel) {
        setLogLevel(savedLogLevel);
      }
    }
  }, []);

  const handleLogLevelChange = (level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR') => {
    setLogLevel(level);
    logger.setLogLevel(level);
    if (typeof window !== 'undefined') {
      localStorage.setItem('logLevel', level);
    }
    logger.systemAction('日誌級別已更改', { newLevel: level });
  };

  const clearConsole = () => {
    console.clear();
    logger.systemAction('控制台已清空');
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">日誌管理</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              日誌級別
            </label>
            <div className="flex gap-2">
              {(['DEBUG', 'INFO', 'WARN', 'ERROR'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => handleLogLevelChange(level)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    logLevel === level
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              日誌級別說明
            </label>
            <div className="bg-slate-700 p-4 rounded-lg text-sm text-slate-300 space-y-2">
              <div><span className="text-cyan-400">🔍 DEBUG:</span> 顯示所有詳細資訊，包含資料內容</div>
              <div><span className="text-green-400">ℹ️ INFO:</span> 用戶操作、檔案處理、系統操作等重要事件</div>
              <div><span className="text-yellow-400">⚠️ WARN:</span> 警告事件，如存儲空間接近滿載</div>
              <div><span className="text-red-400">❌ ERROR:</span> 只顯示錯誤訊息</div>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              控制台操作
            </label>
            <button
              onClick={clearConsole}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md text-sm font-medium"
            >
              清空控制台
            </button>
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              使用說明
            </label>
            <div className="bg-slate-700 p-4 rounded-lg text-sm text-slate-300 space-y-2">
              <p>1. 開啟瀏覽器開發者工具 (F12) 查看控制台日誌</p>
              <p>2. 日誌會以美觀的格式顯示，包含時間戳、級別和來源</p>
              <p>3. DEBUG 模式會顯示詳細的資料內容，適合開發除錯</p>
              <p>4. 生產環境建議使用 INFO 或更高級別</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogViewer;
