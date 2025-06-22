import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { jsPDF } from 'jspdf';
import { logger } from '../../../utils/logger';

interface SlideData {
  slideNumber: number;
  imageUrl: string;
  notes: string;
}

export async function POST(request: NextRequest) {
  logger.info('PDF生成', 'PDF 生成 API 啟動');
  
  try {
    const { slides }: { slides: SlideData[] } = await request.json();
    
    logger.info('PDF生成', `收到 PDF 生成請求，投影片數量: ${slides.length}`);
    
    if (!slides || slides.length === 0) {
      logger.error('PDF生成', '沒有投影片資料');
      return NextResponse.json({ error: '沒有投影片資料' }, { status: 400 });
    }

    logger.debug('PDF生成', '開始創建 jsPDF 實例');
    
    // 創建 jsPDF 實例 (橫向 A4)
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    logger.debug('PDF生成', 'jsPDF 實例創建成功，開始生成 PDF 內容');    // 為每個投影片生成內容
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      logger.debug('PDF生成', `處理投影片 ${i + 1}/${slides.length} (編號: ${slide.slideNumber})`);
      
      if (i > 0) {
        doc.addPage();
        logger.debug('PDF生成', '新增頁面');
      }      try {
        // 設定字體 (使用內建字體避免環境問題)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        
        // 標題 (避免中文問題)
        const titleText = `Slide ${slide.slideNumber}`;
        doc.text(titleText, 20, 25);
        logger.debug('PDF生成', '標題已添加');
        
        // 左側 - 投影片內容區域
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Slide Content', 20, 40);

        // 圖片處理
        let imageProcessed = false;
        if (slide.imageUrl && !slide.imageUrl.includes('placeholder')) {
          logger.debug('PDF生成', `嘗試處理圖片: ${slide.imageUrl}`);
          
          try {
            // 構建圖片路徑
            const imageUrl = slide.imageUrl.startsWith('/') ? slide.imageUrl : `/${slide.imageUrl}`;
            const imagePath = path.join(process.cwd(), 'public', imageUrl.substring(1));
            logger.debug('PDF生成', `圖片完整路徑: ${imagePath}`);
            
            // 檢查檔案是否存在
            await fs.access(imagePath);
            
            // 讀取圖片並轉換為 base64
            const imageBuffer = await fs.readFile(imagePath);
            const base64Image = imageBuffer.toString('base64');
            
            // 判斷圖片格式
            const imageFormat = slide.imageUrl.toLowerCase().endsWith('.png') ? 'PNG' : 'JPEG';
            
            // 添加圖片到 PDF
            doc.addImage(
              `data:image/${imageFormat.toLowerCase()};base64,${base64Image}`,
              imageFormat,
              20,    // x 位置
              50,    // y 位置
              120,   // 寬度
              80     // 高度
            );
            
            imageProcessed = true;
            logger.debug('PDF生成', `圖片成功添加到 PDF (格式: ${imageFormat})`);
            
          } catch (imageError) {
            logger.warn('PDF生成', `圖片處理失敗: ${imageError}，將使用佔位框代替`);
          }
        }

        // 如果圖片處理失敗或沒有圖片，顯示佔位框
        if (!imageProcessed) {
          logger.debug('PDF生成', '使用佔位框');
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(1);
          doc.rect(20, 50, 120, 80);
            doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(128, 128, 128);
          doc.text(`Slide ${slide.slideNumber}`, 75, 95);
          doc.setTextColor(0, 0, 0); // 重設顏色
        }        // 右側 - 演講者備註區域
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text('Speaker Notes', 155, 40);

        // 分隔線
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.line(150, 30, 150, 180);        // 備註內容
        const notesText = slide.notes || 'No speaker notes for this slide';
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
          // 處理換行符並將長文字分行顯示 (備註區域寬度約 120mm)
        const processedNotes = notesText.replace(/\n/g, ' | '); // 將換行符替換為分隔符
        const splitNotes = doc.splitTextToSize(processedNotes, 120);
        doc.text(splitNotes, 155, 55);
        logger.debug('PDF生成', '備註已添加');

        // 頁腳
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Page ${i + 1} of ${slides.length} | Generated: ${new Date().toLocaleString('en-US')}`,
          20,
          195
        );
        
        // 重設文字顏色
        doc.setTextColor(0, 0, 0);
        
        logger.debug('PDF生成', `投影片 ${slide.slideNumber} 處理完成`);
        
      } catch (slideError) {
        logger.error('PDF生成', `處理投影片 ${slide.slideNumber} 時發生錯誤: ${slideError}`);
        // 繼續處理下一個投影片
      }
    }

    logger.info('PDF生成', '所有投影片處理完成，開始生成 PDF 檔案');    // 生成 PDF buffer
    const pdfOutput = doc.output('arraybuffer');
    const pdfBuffer = Buffer.from(pdfOutput);
    
    logger.info('PDF生成', `PDF 生成成功！大小: ${pdfBuffer.length} bytes`);

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="handouts.pdf"',
        'Content-Length': pdfBuffer.length.toString(),
      },
    });

  } catch (error) {
    logger.error('PDF生成', `PDF 生成發生嚴重錯誤: ${error instanceof Error ? error.message : String(error)}`);
    
    return NextResponse.json(
      { 
        error: '生成 PDF 時發生錯誤',
        details: error instanceof Error ? error.message : '未知錯誤'
      },
      { status: 500 }
    );
  }
}