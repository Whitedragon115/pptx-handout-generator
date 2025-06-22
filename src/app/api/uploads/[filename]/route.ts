import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../../../../utils/logger';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // 提取檔案名稱
    const filename = pathname.split('/').pop();
    if (!filename) {
      logger.warn('收到無效的檔案名稱請求', { pathname }, 'FILE_ACCESS');
      return NextResponse.json({ error: '無效的檔案名稱' }, { status: 400 });
    }
    
    const filePath = path.join(process.cwd(), 'public', 'uploads', filename);
    
    logger.debug(`檔案訪問請求`, { filename, filePath }, 'FILE_ACCESS');
    
    try {
      // 檢查檔案是否存在
      await fs.access(filePath);
      
      // 更新檔案的最後訪問時間
      const now = new Date();
      const stats = await fs.stat(filePath);
      await fs.utimes(filePath, now, stats.mtime);
      
      logger.debug(`更新檔案訪問時間`, { filename }, 'FILE_ACCESS');
      
      // 讀取檔案並返回
      const fileBuffer = await fs.readFile(filePath);
      
      // 根據檔案副檔名設置適當的 Content-Type
      const ext = path.extname(filename).toLowerCase();
      let contentType = 'application/octet-stream';
      
      if (ext === '.png') contentType = 'image/png';
      else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.gif') contentType = 'image/gif';
      else if (ext === '.webp') contentType = 'image/webp';
      
      logger.info(`檔案訪問成功`, { 
        filename, 
        size: `${(fileBuffer.length / 1024).toFixed(2)} KB`,
        contentType 
      }, 'FILE_ACCESS');
      
      return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600', // 1小時快取
        },
      });
      
    } catch (fileError) {
      logger.warn('檔案不存在或無法訪問', { filename, filePath, error: fileError }, 'FILE_ACCESS');
      return NextResponse.json({ error: '檔案不存在' }, { status: 404 });
    }
    
  } catch (error) {
    logger.error('處理圖片請求時發生錯誤', error, 'FILE_ACCESS');
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
