import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import fs from 'fs/promises';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';

interface SlideData {
  slideNumber: number;
  imageUrl: string;
  notes: string;
}

const CONVERTER_API_URL = 'http://192.168.0.123:5012';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: '沒有找到檔案' }, { status: 400 });
    }

    // 步驟 1: 使用外部 API 轉換 PPTX 為圖片
    const convertFormData = new FormData();
    convertFormData.append('file', file);

    const convertResponse = await fetch(`${CONVERTER_API_URL}/convert`, {
      method: 'POST',
      body: convertFormData,
    });

    if (!convertResponse.ok) {
      const error = await convertResponse.json();
      return NextResponse.json({ 
        error: `轉換失敗: ${error.error || '未知錯誤'}` 
      }, { status: 500 });
    }    const convertResult = await convertResponse.json();
    const { total_pages, image_download_urls } = convertResult;
    
    console.log('外部 API 轉換結果:');
    console.log('- 總頁數:', total_pages);
    console.log('- 圖片下載 URLs:', image_download_urls);

    // 步驟 2: 下載所有圖片到本地
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    
    // 確保上傳目錄存在
    try {
      await fs.access(uploadDir);
    } catch {
      await fs.mkdir(uploadDir, { recursive: true });
    }

    // 步驟 3: 提取演講者備註（從原始 PPTX 檔案）
    const buffer = Buffer.from(await file.arrayBuffer());
    const zip = new JSZip();
    await zip.loadAsync(buffer);

    const slides: SlideData[] = [];

    for (let i = 0; i < total_pages; i++) {
      const slideNumber = i + 1;
        try {
        // 下載圖片
        const imageDownloadUrl = `${CONVERTER_API_URL}${image_download_urls[i]}`;
        console.log(`下載投影片 ${slideNumber} 圖片:`, imageDownloadUrl);
        
        const imageResponse = await fetch(imageDownloadUrl);
        
        if (!imageResponse.ok) {
          throw new Error(`無法下載圖片: ${imageResponse.statusText}`);
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const imageName = `slide_${slideNumber}_${Date.now()}.png`;
        const imagePath = path.join(uploadDir, imageName);
        
        console.log(`儲存圖片到:`, imagePath);
        await fs.writeFile(imagePath, new Uint8Array(imageBuffer));
        const imageUrl = `/uploads/${imageName}`;
        console.log(`圖片 URL:`, imageUrl);

        // 提取演講者備註
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
          } catch (error) {
            console.log(`無法解析投影片 ${slideNumber} 的備註:`, error);
          }
        }        slides.push({
          slideNumber,
          imageUrl,
          notes: notes.trim()
        });
        
        console.log(`投影片 ${slideNumber} 處理完成:`, { imageUrl, notesLength: notes.trim().length });      } catch (error) {
        console.error(`處理投影片 ${slideNumber} 時發生錯誤:`, error);
        // 即使出錯也要添加基本資訊，使用空白圖片路徑
        slides.push({
          slideNumber,
          imageUrl: `data:image/svg+xml;base64,${Buffer.from(`
            <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
              <rect width="400" height="300" fill="#f0f0f0" stroke="#ccc"/>
              <text x="200" y="150" text-anchor="middle" fill="#666" font-size="16">
                投影片 ${slideNumber}
              </text>
            </svg>
          `).toString('base64')}`,
          notes: ''
        });
      }}

    console.log('所有投影片處理完成，總數:', slides.length);
    console.log('最終投影片資料:', slides.map(s => ({ 
      slideNumber: s.slideNumber, 
      imageUrl: s.imageUrl, 
      notesLength: s.notes.length 
    })));

    return NextResponse.json({ slides });

  } catch (error) {
    console.error('處理 PPTX 檔案時發生錯誤:', error);
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
