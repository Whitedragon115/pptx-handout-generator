import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { logger } from '../../../../utils/logger';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
const STORAGE_LIMIT_BYTES = 18 * 1024 * 1024 * 1024; // 18GB

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

export async function GET(request: NextRequest) {
  try {
    logger.info('系統API', '獲取系統檔案資訊');

    // 確保 uploads 目錄存在
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    const files: FileInfo[] = [];
    let totalSizeBytes = 0;

    // 讀取 uploads 目錄中的所有檔案
    const fileNames = fs.readdirSync(UPLOADS_DIR);
    
    for (const fileName of fileNames) {
      const filePath = path.join(UPLOADS_DIR, fileName);
      
      try {
        const stats = fs.statSync(filePath);
        
        if (stats.isFile()) {
          const uploadTime = stats.mtime.getTime();
          const currentTime = Date.now();
          const timeRemaining = (uploadTime + 30 * 60 * 1000) - currentTime; // 30分鐘後過期
          
          files.push({
            name: fileName,
            uploadTime,
            timeRemaining,
            sizeBytes: stats.size
          });
          
          totalSizeBytes += stats.size;
        }
      } catch (error) {
        logger.warn('系統API', `無法讀取檔案資訊: ${fileName}`);
      }
    }

    // 按上傳時間排序（最新的在前）
    files.sort((a, b) => b.uploadTime - a.uploadTime);

    // 計算系統統計
    const systemStats: SystemStats = {
      totalFiles: files.length,
      totalSizeBytes,
      totalSizeMB: totalSizeBytes / (1024 * 1024),
      storageLimitMB: STORAGE_LIMIT_BYTES / (1024 * 1024),
      usagePercentage: (totalSizeBytes / STORAGE_LIMIT_BYTES) * 100
    };

    logger.info('系統API', `返回 ${files.length} 個檔案資訊，總大小 ${(totalSizeBytes / (1024 * 1024)).toFixed(2)} MB`);

    return NextResponse.json({
      success: true,
      files,
      stats: systemStats
    });

  } catch (error) {
    logger.error('系統API', `獲取系統資訊失敗: ${error instanceof Error ? error.message : String(error)}`);
    
    return NextResponse.json(
      { 
        success: false, 
        error: '獲取系統資訊失敗',
        files: [],
        stats: null
      },
      { status: 500 }
    );
  }
}
