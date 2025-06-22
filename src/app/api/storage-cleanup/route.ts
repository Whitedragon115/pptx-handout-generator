import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../../utils/logger';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const MAX_STORAGE_GB = 18;
const MAX_FILE_AGE_MINUTES = 30;

interface FileInfo {
  name: string;
  path: string;
  size: number;
  createdAt: Date;
  lastAccessed: Date;
}

// 獲取檔案統計資訊
async function getFileStats(filePath: string): Promise<FileInfo | null> {
  try {
    const stats = await fs.stat(filePath);
    const name = path.basename(filePath);
    
    return {
      name,
      path: filePath,
      size: stats.size,
      createdAt: stats.birthtime,
      lastAccessed: stats.atime,
    };
  } catch (error) {
    logger.warn(`無法獲取檔案統計資訊: ${filePath}`, error, 'STORAGE');
    return null;
  }
}

// 計算目錄總大小
async function calculateDirectorySize(): Promise<number> {
  try {
    const files = await fs.readdir(UPLOAD_DIR);
    let totalSize = 0;
    
    logger.debug(`計算目錄大小，發現 ${files.length} 個檔案`, null, 'STORAGE');
    
    for (const file of files) {
      const filePath = path.join(UPLOAD_DIR, file);
      const stats = await getFileStats(filePath);
      if (stats) {
        totalSize += stats.size;
      }
    }
    
    logger.debug(`目錄總大小計算完成`, { 
      totalSizeBytes: totalSize, 
      totalSizeGB: (totalSize / (1024 * 1024 * 1024)).toFixed(2) 
    }, 'STORAGE');
    
    return totalSize;
  } catch (error) {
    logger.error('計算目錄大小時發生錯誤', error, 'STORAGE');
    return 0;
  }
}

// 清理過期檔案
async function cleanupOldFiles(): Promise<{ deletedFiles: string[]; totalSizeFreed: number }> {
  try {
    const files = await fs.readdir(UPLOAD_DIR);
    const deletedFiles: string[] = [];
    let totalSizeFreed = 0;
    const now = new Date();
    
    logger.info(`開始清理過期檔案，檢查 ${files.length} 個檔案`, null, 'CLEANUP');
    
    for (const file of files) {
      const filePath = path.join(UPLOAD_DIR, file);
      const stats = await getFileStats(filePath);
      
      if (!stats) continue;
      
      // 檢查檔案是否超過 30 分鐘未被存取
      const minutesSinceLastAccess = (now.getTime() - stats.lastAccessed.getTime()) / (1000 * 60);
      
      if (minutesSinceLastAccess > MAX_FILE_AGE_MINUTES) {
        try {
          await fs.unlink(filePath);
          deletedFiles.push(file);
          totalSizeFreed += stats.size;
          logger.info(`已刪除過期檔案: ${file}`, { 
            sizeMB: (stats.size / 1024 / 1024).toFixed(2),
            minutesSinceLastAccess: minutesSinceLastAccess.toFixed(1)
          }, 'CLEANUP');
        } catch (error) {
          logger.error(`刪除檔案失敗: ${file}`, error, 'CLEANUP');
        }
      } else {
        logger.debug(`檔案 ${file} 仍在有效期內`, { 
          minutesSinceLastAccess: minutesSinceLastAccess.toFixed(1) 
        }, 'CLEANUP');
      }
    }
    
    logger.info('清理過期檔案完成', {
      deletedCount: deletedFiles.length,
      freedSizeMB: (totalSizeFreed / 1024 / 1024).toFixed(2)
    }, 'CLEANUP');
    
    return { deletedFiles, totalSizeFreed };
  } catch (error) {
    logger.error('清理檔案時發生錯誤', error, 'CLEANUP');
    return { deletedFiles: [], totalSizeFreed: 0 };
  }
}

// 檢查存儲空間是否足夠
export async function checkStorageLimit(): Promise<{ canUpload: boolean; currentSizeGB: number; maxSizeGB: number }> {
  const currentSizeBytes = await calculateDirectorySize();
  const currentSizeGB = currentSizeBytes / (1024 * 1024 * 1024);
  
  const result = {
    canUpload: currentSizeGB < MAX_STORAGE_GB,
    currentSizeGB: parseFloat(currentSizeGB.toFixed(2)),
    maxSizeGB: MAX_STORAGE_GB
  };
  
  if (currentSizeGB > MAX_STORAGE_GB * 0.8) {
    logger.warn('存儲空間接近限制', result, 'STORAGE');
  } else {
    logger.debug('存儲空間檢查完成', result, 'STORAGE');
  }
  
  return result;
}

// API 路由處理器
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  
  logger.debug(`存儲管理 API 請求`, { action }, 'STORAGE_API');
  
  try {
    if (action === 'cleanup') {
      logger.info('執行手動清理請求', null, 'STORAGE_API');
      const cleanupResult = await cleanupOldFiles();
      const storageInfo = await checkStorageLimit();
      
      logger.systemAction('手動清理完成', {
        deletedFiles: cleanupResult.deletedFiles.length,
        freedSizeMB: (cleanupResult.totalSizeFreed / 1024 / 1024).toFixed(2),
        newStorageStatus: storageInfo
      });
      
      return NextResponse.json({
        success: true,
        cleanup: cleanupResult,
        storage: storageInfo
      });
    } else if (action === 'status') {
      const storageInfo = await checkStorageLimit();
      logger.debug('返回存儲狀態', storageInfo, 'STORAGE_API');
      
      return NextResponse.json({
        success: true,
        storage: storageInfo
      });
    } else {
      logger.warn('收到無效的操作參數', { action }, 'STORAGE_API');
      return NextResponse.json(
        { error: '無效的操作參數' },
        { status: 400 }
      );
    }
  } catch (error) {
    logger.error('存儲管理 API 錯誤', error, 'STORAGE_API');
    return NextResponse.json(
      { error: '處理請求時發生錯誤' },
      { status: 500 }
    );
  }
}

// POST 方法用於手動清理
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    
    logger.info(`收到 POST 清理請求`, { action }, 'STORAGE_API');
    
    if (action === 'cleanup') {
      const cleanupResult = await cleanupOldFiles();
      const storageInfo = await checkStorageLimit();
      
      logger.userAction('手動清理執行', {
        deletedFiles: cleanupResult.deletedFiles.length,
        freedSizeMB: (cleanupResult.totalSizeFreed / 1024 / 1024).toFixed(2)
      });
      
      return NextResponse.json({
        success: true,
        cleanup: cleanupResult,
        storage: storageInfo
      });
    } else {
      logger.warn('無效的 POST 操作', { action }, 'STORAGE_API');
      return NextResponse.json(
        { error: '無效的操作' },
        { status: 400 }
      );
    }
  } catch (error) {
    logger.error('手動清理錯誤', error, 'STORAGE_API');
    return NextResponse.json(
      { error: '清理時發生錯誤' },
      { status: 500 }
    );
  }
}
