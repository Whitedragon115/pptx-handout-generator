'use client';

import { useEffect, useState } from 'react';
import { logger } from '../../utils/logger';

interface FileInfo {
  name: string;
  uploadTime: number;
  timeRemaining: number;
  sizeBytes: number;
}

interface SystemStats {
  totalFiles: number;
  totalSizeBytes: number;
  totalSizeMB: number;
  storageLimitMB: number;
  usagePercentage: number;
}

export default function SystemPage() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const fetchSystemData = async () => {
    try {
      const response = await fetch('/api/system/files');
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
        setStats(data.stats || null);
      } else {
        logger.warn('系統頁面', '無法獲取系統資料');
      }    } catch (error) {
      logger.error('系統頁面', `獲取系統資料時發生錯誤: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemData();
    
    // 每秒更新倒數時間
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    // 每30秒重新獲取數據
    const dataRefreshTimer = setInterval(() => {
      fetchSystemData();
    }, 30000);

    return () => {
      clearInterval(timer);
      clearInterval(dataRefreshTimer);
    };
  }, []);

  const formatTimeRemaining = (timeRemaining: number) => {
    if (timeRemaining <= 0) return '即將刪除';
    
    const minutes = Math.floor(timeRemaining / (1000 * 60));
    const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
    
    if (minutes > 0) {
      return `${minutes}分${seconds}秒`;
    } else {
      return `${seconds}秒`;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusColor = (timeRemaining: number) => {
    if (timeRemaining <= 60000) return 'text-red-400'; // 1分鐘內 - 紅色
    if (timeRemaining <= 300000) return 'text-yellow-400'; // 5分鐘內 - 黃色
    return 'text-green-400'; // 其他 - 綠色
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-300 text-lg">載入系統資訊中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* 頁面標題 */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold text-white mb-2">🔧 系統管理面板</h1>
          <p className="text-slate-300">檔案存儲管理與監控</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* 系統統計 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-blue-500/20 text-blue-400 mr-4">
                  📁
                </div>
                <div>
                  <p className="text-slate-400 text-sm">檔案總數</p>
                  <p className="text-2xl font-bold">{stats.totalFiles}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-green-500/20 text-green-400 mr-4">
                  💾
                </div>
                <div>
                  <p className="text-slate-400 text-sm">總存儲大小</p>
                  <p className="text-2xl font-bold">{stats.totalSizeMB.toFixed(1)} MB</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-yellow-500/20 text-yellow-400 mr-4">
                  📊
                </div>
                <div>
                  <p className="text-slate-400 text-sm">存儲使用率</p>
                  <p className="text-2xl font-bold">{stats.usagePercentage.toFixed(1)}%</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-purple-500/20 text-purple-400 mr-4">
                  🚀
                </div>
                <div>
                  <p className="text-slate-400 text-sm">存儲限制</p>
                  <p className="text-2xl font-bold">{(stats.storageLimitMB / 1024).toFixed(0)} GB</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 存儲使用率進度條 */}
        {stats && (
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 mb-8">
            <h3 className="text-lg font-semibold mb-4">存儲使用情況</h3>
            <div className="w-full bg-slate-700 rounded-full h-4">
              <div 
                className={`h-4 rounded-full transition-all duration-300 ${
                  stats.usagePercentage > 80 ? 'bg-red-500' : 
                  stats.usagePercentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(stats.usagePercentage, 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-sm text-slate-400 mt-2">
              <span>{stats.totalSizeMB.toFixed(1)} MB 已使用</span>
              <span>{(stats.storageLimitMB / 1024).toFixed(0)} GB 總容量</span>
            </div>
          </div>
        )}

        {/* 檔案列表 */}
        <div className="bg-slate-800 rounded-lg border border-slate-700">
          <div className="px-6 py-4 border-b border-slate-700">
            <h2 className="text-xl font-semibold flex items-center">
              📋 上傳檔案列表
              <span className="ml-2 text-sm font-normal text-slate-400">
                (自動刷新: 30秒)
              </span>
            </h2>
          </div>

          {files.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-6xl mb-4">📂</div>
              <p className="text-slate-400 text-lg">目前沒有任何上傳的檔案</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      檔案名稱
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      檔案大小
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      上傳時間
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      刪除倒數
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      狀態
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {files.map((file, index) => {
                    const timeRemaining = (file.uploadTime + 30 * 60 * 1000) - currentTime;
                    return (
                      <tr key={file.name} className="hover:bg-slate-700/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-blue-400 mr-2">🖼️</span>
                            <span className="text-sm font-medium">{file.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                          {formatFileSize(file.sizeBytes)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                          {new Date(file.uploadTime).toLocaleString('zh-TW')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`font-mono ${getStatusColor(timeRemaining)}`}>
                            {formatTimeRemaining(timeRemaining)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            timeRemaining <= 60000 ? 'bg-red-900 text-red-200' :
                            timeRemaining <= 300000 ? 'bg-yellow-900 text-yellow-200' :
                            'bg-green-900 text-green-200'
                          }`}>
                            {timeRemaining <= 60000 ? '即將刪除' :
                             timeRemaining <= 300000 ? '即將到期' : '正常'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 返回首頁按鈕 */}
        <div className="mt-8 text-center">
          <a 
            href="/"
            className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            ← 返回首頁
          </a>
        </div>
      </div>
    </div>
  );
}
