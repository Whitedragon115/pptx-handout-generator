// 應用程式設定檔案
export const appConfig = {
  // 日誌設定
  logging: {
    level: 'info' as 'debug' | 'info' | 'warn' | 'error',
    enableConsoleOutput: true,
    enableFileOutput: false, // 未來可擴展檔案輸出
  },

  // 存儲設定
  storage: {
    maxSizeBytes: 18 * 1024 * 1024 * 1024, // 18GB
    cleanupIntervalMinutes: 30, // 30分鐘未訪問自動刪除
    uploadsDirectory: 'public/uploads',
  },

  // 應用程式設定
  app: {
    title: 'PPTX 轉講義工具',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  }
};

export default appConfig;
