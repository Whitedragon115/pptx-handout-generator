import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import PDFDocument from 'pdfkit';
import { logger } from '../../../utils/logger';

interface SlideData {
  slideNumber: number;
  imageUrl: string;
  notes: string;
}

export async function POST(request: NextRequest) {
  logger.info('PDFKit生成', 'PDFKit PDF 生成 API 啟動');
  
  try {
    const { slides }: { slides: SlideData[] } = await request.json();
    
    logger.info('PDFKit生成', `收到 PDF 生成請求，投影片數量: ${slides.length}`);
    
    if (!slides || slides.length === 0) {
      logger.error('PDFKit生成', '沒有投影片資料');
      return NextResponse.json({ error: '沒有投影片資料' }, { status: 400 });
    }

    logger.debug('PDFKit生成', '開始創建 PDFKit 實例');
    
    // 創建 PDFKit 實例 (橫向 A4)
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: {
        top: 20,
        bottom: 20,
        left: 20,
        right: 20
      }
    });    // 收集 PDF 數據
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    
    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });
    });

    console.log('PDFKit 實例創建成功，開始生成 PDF 內容...');

    // 為每個投影片生成內容
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      console.log(`處理投影片 ${i + 1}/${slides.length} (編號: ${slide.slideNumber})`);
      
      if (i > 0) {
        doc.addPage();
        console.log('- 新增頁面');
      }

      try {
        // 標題
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .text(`投影片 ${slide.slideNumber}`, 20, 25);
        console.log('- 標題已添加');

        // 左側 - 投影片內容區域
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('投影片內容', 20, 50);

        // 圖片處理
        let imageProcessed = false;
        if (slide.imageUrl && !slide.imageUrl.includes('placeholder')) {
          console.log(`- 嘗試處理圖片: ${slide.imageUrl}`);
          
          try {
            // 構建圖片路徑
            const imageUrl = slide.imageUrl.startsWith('/') ? slide.imageUrl : `/${slide.imageUrl}`;
            const imagePath = path.join(process.cwd(), 'public', imageUrl.substring(1));
            console.log(`- 圖片完整路徑: ${imagePath}`);
            
            // 檢查檔案是否存在
            await fs.access(imagePath);
            
            // 添加圖片到 PDF
            doc.image(imagePath, 20, 70, {
              width: 340,  // 約 120mm
              height: 255, // 約 90mm
              fit: [340, 255]
            });
            
            imageProcessed = true;
            console.log(`- 圖片成功添加到 PDF`);
            
          } catch (imageError) {
            console.log(`- 圖片處理失敗: ${imageError}`);
            console.log('- 將使用佔位框代替');
          }
        }

        // 如果圖片處理失敗或沒有圖片，顯示佔位框
        if (!imageProcessed) {
          console.log('- 使用佔位框');
          doc.rect(20, 70, 340, 255)
             .stroke('#cccccc')
             .fontSize(10)
             .font('Helvetica')
             .fillColor('#808080')
             .text(`投影片 ${slide.slideNumber}`, 180, 190, { align: 'center' })
             .fillColor('black');
        }

        // 右側 - 演講者備註區域
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('演講者備註', 380, 50);

        // 分隔線
        doc.moveTo(370, 25)
           .lineTo(370, 540)
           .stroke('#cccccc');

        // 備註內容
        const notesText = slide.notes || '此投影片沒有演講者備註';
        doc.fontSize(10)
           .font('Helvetica')
           .text(notesText, 380, 70, {
             width: 380, // 剩餘寬度
             height: 400, // 最大高度
             align: 'left'
           });
        console.log('- 備註已添加');

        // 頁腳
        doc.fontSize(8)
           .fillColor('#999999')
           .text(
             `第 ${i + 1} 頁，共 ${slides.length} 頁 | 生成時間: ${new Date().toLocaleString('zh-TW')}`,
             20,
             550
           )
           .fillColor('black');
        
        console.log(`- 投影片 ${slide.slideNumber} 處理完成`);
        
      } catch (slideError) {
        console.error(`處理投影片 ${slide.slideNumber} 時發生錯誤:`, slideError);
        // 繼續處理下一個投影片
      }
    }

    console.log('所有投影片處理完成，正在完成 PDF 生成...');

    // 完成 PDF 生成
    doc.end();
    
    // 等待 PDF 生成完成
    const pdfBuffer = await pdfPromise;
    
    console.log('PDF 生成成功！');
    console.log('- PDF 大小:', pdfBuffer.length, 'bytes');
    console.log('=== PDF 生成完成 ===');    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="handouts.pdf"',
        'Content-Length': pdfBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('=== PDF 生成發生嚴重錯誤 ===');
    console.error('錯誤詳情:', error);
    console.error('錯誤堆疊:', error instanceof Error ? error.stack : '無堆疊資訊');
    
    return NextResponse.json(
      { 
        error: '生成 PDF 時發生錯誤',
        details: error instanceof Error ? error.message : '未知錯誤'
      },
      { status: 500 }
    );
  }
}
