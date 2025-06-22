import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import fs from 'fs/promises';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { checkStorageLimit } from '../storage-cleanup/route';
import { logger } from '../../../utils/logger';

interface SlideData {
  slideNumber: number;
  imageUrl: string;
  notes: string;
}

const CONVERTER_API_URL = 'http://192.168.0.123:5012';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  logger.info('開始處理 PPTX 檔案請求', { timestamp: new Date().toISOString() }, 'API');

  try {
    // 檢查存儲空間
    logger.debug('檢查存儲空間狀態');
    const storageStatus = await checkStorageLimit();
    logger.storage('當前存儲狀態', storageStatus);
    
    if (!storageStatus.canUpload) {
      logger.warn('存儲空間已滿，拒絕上傳', storageStatus, 'STORAGE');
      return NextResponse.json({ 
        error: `存儲空間已滿，目前使用 ${storageStatus.currentSizeGB}GB / ${storageStatus.maxSizeGB}GB。請稍後再試或聯繫管理員清理空間。` 
      }, { status: 413 });
    }

    // 自動清理過期檔案
    try {
      logger.debug('執行自動清理過期檔案');
      await fetch(`${request.nextUrl.origin}/api/storage-cleanup?action=cleanup`, {
        method: 'GET'
      });
      logger.systemAction('自動清理檔案完成');
    } catch (cleanupError) {
      logger.warn('自動清理失敗，但繼續處理', cleanupError);
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;    
    if (!file) {
      logger.error('未找到上傳的檔案', null, 'API');
      return NextResponse.json({ error: '沒有找到檔案' }, { status: 400 });
    }

    logger.info('接收到檔案上傳請求', { 
      fileName: file.name, 
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      fileType: file.type
    }, 'UPLOAD');

    // 步驟 1: 使用外部 API 轉換 PPTX 為圖片
    logger.debug('準備調用外部轉換 API', { apiUrl: CONVERTER_API_URL });
    const convertFormData = new FormData();
    convertFormData.append('file', file);

    const convertResponse = await fetch(`${CONVERTER_API_URL}/convert`, {
      method: 'POST',
      body: convertFormData,
    });

    if (!convertResponse.ok) {
      const error = await convertResponse.json();
      logger.error('外部 API 轉換失敗', { 
        status: convertResponse.status, 
        error: error.error 
      }, 'EXTERNAL_API');
      return NextResponse.json({ 
        error: `轉換失敗: ${error.error || '未知錯誤'}` 
      }, { status: 500 });
    }

    const convertResult = await convertResponse.json();
    const { total_pages, image_download_urls } = convertResult;
    
    logger.info('外部 API 轉換成功', {
      totalPages: total_pages,
      imageUrlsCount: image_download_urls?.length
    }, 'EXTERNAL_API');

    logger.debug('轉換結果詳細資料', {
      totalPages: total_pages,
      imageDownloadUrls: image_download_urls
    });    // 步驟 2: 下載所有圖片到本地
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    
    logger.debug('確保上傳目錄存在', { uploadDir });
    try {
      await fs.access(uploadDir);
    } catch {
      await fs.mkdir(uploadDir, { recursive: true });
      logger.info('創建上傳目錄', { uploadDir }, 'SYSTEM');
    }    // 步驟 3: 提取演講者備註（從原始 PPTX 檔案）
    logger.debug('開始解析 PPTX 檔案提取備註');
    const buffer = Buffer.from(await file.arrayBuffer());
    const zip = new JSZip();
    await zip.loadAsync(buffer);

    const slides: SlideData[] = [];

    for (let i = 0; i < total_pages; i++) {
      const slideNumber = i + 1;
      logger.debug(`處理投影片 ${slideNumber}/${total_pages}`);
      
      try {
        // 下載圖片
        const imageDownloadUrl = `${CONVERTER_API_URL}${image_download_urls[i]}`;
        logger.debug(`下載投影片 ${slideNumber} 圖片`, { url: imageDownloadUrl });
        
        const imageResponse = await fetch(imageDownloadUrl);
        
        if (!imageResponse.ok) {
          throw new Error(`無法下載圖片: ${imageResponse.statusText}`);
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const imageName = `slide_${slideNumber}_${Date.now()}.png`;
        const imagePath = path.join(uploadDir, imageName);
        
        logger.debug(`儲存圖片`, { imageName, imagePath });
        await fs.writeFile(imagePath, new Uint8Array(imageBuffer));
        
        // 設置檔案的訪問時間為當前時間（表示剛被創建和訪問）
        const now = new Date();
        await fs.utimes(imagePath, now, now);
        
        const imageUrl = `/api/uploads/${imageName}`;
        logger.debug(`圖片儲存完成`, { imageUrl });        // 提取演講者備註
        let notes = '';
        const notesFile = `ppt/notesSlides/notesSlide${slideNumber}.xml`;
        
        if (zip.files[notesFile]) {
          try {
            const notesContent = await zip.files[notesFile].async('text');
            const parser = new XMLParser({
              ignoreAttributes: false,
              parseAttributeValue: false
            });
            const notesData = parser.parse(notesContent);
            
            // 提取備註文字
            notes = extractTextFromSlide(notesData) || '';
            logger.debug(`提取投影片 ${slideNumber} 備註`, { notesLength: notes.length });
          } catch (error) {
            logger.warn(`無法解析投影片 ${slideNumber} 的備註`, error);
          }
        } else {
          logger.debug(`投影片 ${slideNumber} 沒有備註檔案`);
        }

        slides.push({
          slideNumber,
          imageUrl,
          notes: notes.trim()
        });
        
        logger.info(`投影片 ${slideNumber} 處理完成`, { 
          imageUrl, 
          notesLength: notes.trim().length,
          hasNotes: notes.trim().length > 0
        });
      } catch (error) {
        logger.error(`處理投影片 ${slideNumber} 時發生錯誤`, error);
        // 即使出錯也要添加基本資訊，使用空白圖片路徑
        slides.push({
          slideNumber,
          imageUrl: `data:image/svg+xml;base64,${Buffer.from(`
            <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
              <rect width="400" height="300" fill="#f0f0f0" stroke="#ccc"/>
              <text x="200" y="150" text-anchor="middle" fill="#666" font-size="16">
                投影片 ${slideNumber}
              </text>
            </svg>          `).toString('base64')}`,
          notes: ''
        });
      }
    }

    const processingTime = Date.now() - startTime;
    logger.info('所有投影片處理完成', {
      totalSlides: slides.length,
      processingTimeMs: processingTime,
      averageTimePerSlide: `${(processingTime / slides.length).toFixed(2)}ms`,
      slidesWithNotes: slides.filter(s => s.notes.length > 0).length
    }, 'PROCESSING');

    logger.debug('最終投影片資料', slides.map(s => ({ 
      slideNumber: s.slideNumber, 
      imageUrl: s.imageUrl, 
      notesLength: s.notes.length,
      hasNotes: s.notes.length > 0
    })));

    logger.userAction('PPTX 檔案處理完成', {
      fileName: file.name,
      totalSlides: slides.length,
      processingTime: `${(processingTime / 1000).toFixed(2)}s`
    });

    return NextResponse.json({ slides });

  } catch (error) {
    logger.error('處理 PPTX 檔案時發生嚴重錯誤', error, 'API');
    return NextResponse.json(
      { error: '處理檔案時發生錯誤' },
      { status: 500 }
    );
  }
}

// 輔助函數：從投影片資料中提取文字
function extractTextFromSlide(slideData: unknown): string {
  let text = '';
  
  function traverse(obj: unknown) {
    if (typeof obj === 'string') {
      text += obj + ' ';
    } else if (typeof obj === 'object' && obj !== null) {
      const objRecord = obj as Record<string, unknown>;      // 特別尋找文字節點
      if (objRecord['a:t']) {
        text += objRecord['a:t'] + '\n';
      }
      if (objRecord['#text']) {
        text += objRecord['#text'] + '\n';
      }
      
      // 遞迴遍歷所有屬性
      Object.values(objRecord).forEach(value => {
        if (typeof value === 'object' || Array.isArray(value)) {
          traverse(value);
        }
      });
    } else if (Array.isArray(obj)) {
      obj.forEach(item => traverse(item));
    }
  }
  
  traverse(slideData);
  return text.trim();
}
