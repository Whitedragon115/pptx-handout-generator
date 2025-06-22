import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// 動態導入 pdfmake
const pdfMake = require('pdfmake/build/pdfmake');

interface SlideData {
  slideNumber: number;
  imageUrl: string;
  notes: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log('API: 開始處理 PDF 生成請求');
    
    const body = await request.json();
    const { slides } = body;

    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      return NextResponse.json({ error: '沒有投影片資料' }, { status: 400 });
    }

    console.log(`準備生成 PDF，共有 ${slides.length} 個投影片`);
    
    // 設定字體
    let defaultFont = 'Helvetica';
    
    try {
      const fontPath = path.join(process.cwd(), 'public', 'fonts');
      console.log('嘗試載入字體從:', fontPath);
      
      // 檢查字體文件是否存在
      await fs.access(path.join(fontPath, 'NotoSansTC-Regular.ttf'));
      await fs.access(path.join(fontPath, 'NotoSansTC-Bold.ttf'));
      
      // 讀取字體文件
      const normalFontBuffer = await fs.readFile(path.join(fontPath, 'NotoSansTC-Regular.ttf'));
      const boldFontBuffer = await fs.readFile(path.join(fontPath, 'NotoSansTC-Bold.ttf'));
      
      // 設定 vfs 和字體
      pdfMake.vfs = pdfMake.vfs || {};
      pdfMake.vfs['NotoSansTC-Regular.ttf'] = normalFontBuffer.toString('base64');
      pdfMake.vfs['NotoSansTC-Bold.ttf'] = boldFontBuffer.toString('base64');
        pdfMake.fonts = {
        NotoSansTC: {
          normal: 'NotoSansTC-Regular.ttf',
          bold: 'NotoSansTC-Bold.ttf',
          italics: 'NotoSansTC-Regular.ttf', // 使用 Regular 字體代替斜體
          bolditalics: 'NotoSansTC-Bold.ttf'  // 使用 Bold 字體代替粗斜體
        },
        Helvetica: {
          normal: 'Helvetica',
          bold: 'Helvetica-Bold',
          italics: 'Helvetica-Oblique',
          bolditalics: 'Helvetica-BoldOblique'
        }
      };
      
      defaultFont = 'NotoSansTC';
      console.log('中文字體設定成功');
      
    } catch (fontError) {
      console.warn('字體文件載入失敗，使用默認字體:', fontError);
      
      // 使用默認字體
      pdfMake.fonts = {
        Helvetica: {
          normal: 'Helvetica',
          bold: 'Helvetica-Bold'
        }
      };
    }

    // PDF 文檔定義
    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      defaultStyle: {
        font: defaultFont,
        fontSize: 10,
        lineHeight: 1.3
      },
      content: [] as Array<unknown>,
      styles: {
        header: {
          fontSize: 16,
          bold: true,
          margin: [0, 0, 0, 10],
          color: '#333333'
        },
        subheader: {
          fontSize: 12,
          bold: true,
          margin: [0, 0, 0, 5],
          color: '#666666'
        },
        noteText: {
          fontSize: 9,
          margin: [0, 2, 0, 2],
          color: '#444444'
        },
        footer: {
          fontSize: 8,
          color: '#999999',
          margin: [0, 10, 0, 0]
        }
      }
    };

    // 為每個投影片生成內容
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      console.log(`處理投影片 ${i + 1}/${slides.length} (編號: ${slide.slideNumber})`);
      
      if (i > 0) {
        docDefinition.content.push({ text: '', pageBreak: 'before' });
      }

      try {
        // 頁面標題
        docDefinition.content.push({
          text: `投影片 ${slide.slideNumber}`,
          style: 'header'
        });

        // 建立兩欄布局
        const columns: Array<unknown> = [];

        // 左欄 - 投影片內容
        const leftColumn = {
          width: '50%',
          stack: [
            {
              text: '投影片內容',
              style: 'subheader'
            }
          ]
        };

        // 圖片處理
        let imageProcessed = false;
        if (slide.imageUrl && !slide.imageUrl.includes('placeholder') && !slide.imageUrl.startsWith('data:')) {
          console.log(`- 嘗試處理圖片: ${slide.imageUrl}`);
            try {
            if (slide.imageUrl.startsWith('/uploads/')) {
              // 本地上傳圖片
              const imagePath = path.join(process.cwd(), 'public', slide.imageUrl);
              const imageBuffer = await fs.readFile(imagePath);
              const base64Image = imageBuffer.toString('base64');
              
              // 根據檔案副檔名判斷 MIME 類型
              const ext = path.extname(imagePath).toLowerCase();
              let mimeType = 'image/png';
              if (ext === '.jpg' || ext === '.jpeg') {
                mimeType = 'image/jpeg';
              } else if (ext === '.gif') {
                mimeType = 'image/gif';
              } else if (ext === '.webp') {
                mimeType = 'image/webp';
              }
              
              const dataUrl = `data:${mimeType};base64,${base64Image}`;
              
              (leftColumn.stack as Array<unknown>).push({
                image: dataUrl,
                width: 300,
                margin: [0, 5, 0, 5]
              });
              
              imageProcessed = true;
              console.log(`- 本地圖片成功添加到 PDF`);
              
            } else if (slide.imageUrl.startsWith('http')) {
              // 網路圖片，先下載
              const response = await fetch(slide.imageUrl);
              if (!response.ok) throw new Error(`無法下載圖片: ${response.status}`);
              
              const arrayBuffer = await response.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              const base64Image = buffer.toString('base64');
              
              // 嘗試判斷圖片格式
              const mimeType = response.headers.get('content-type') || 'image/png';
              const dataUrl = `data:${mimeType};base64,${base64Image}`;
              
              (leftColumn.stack as Array<unknown>).push({
                image: dataUrl,
                width: 300,
                margin: [0, 5, 0, 5]
              });
              
              imageProcessed = true;
              console.log(`- 網路圖片成功添加到 PDF`);
              
            } else {
              // 其他本地路徑
              const imagePath = slide.imageUrl;
              const imageBuffer = await fs.readFile(imagePath);
              const base64Image = imageBuffer.toString('base64');
              
              // 根據檔案副檔名判斷 MIME 類型
              const ext = path.extname(imagePath).toLowerCase();
              let mimeType = 'image/png';
              if (ext === '.jpg' || ext === '.jpeg') {
                mimeType = 'image/jpeg';
              } else if (ext === '.gif') {
                mimeType = 'image/gif';
              } else if (ext === '.webp') {
                mimeType = 'image/webp';
              }
              
              const dataUrl = `data:${mimeType};base64,${base64Image}`;
              
              (leftColumn.stack as Array<unknown>).push({
                image: dataUrl,
                width: 300,
                margin: [0, 5, 0, 5]
              });
              
              imageProcessed = true;
              console.log(`- 其他圖片成功添加到 PDF`);
            }
            
          } catch (imageError) {
            console.log(`- 圖片處理失敗: ${imageError}`);
            console.log('- 將使用佔位框代替');
          }
        }

        // 如果圖片處理失敗或沒有圖片，顯示佔位框
        if (!imageProcessed) {
          console.log('- 使用佔位框');
          (leftColumn.stack as Array<unknown>).push({
            canvas: [
              {
                type: 'rect',
                x: 0,
                y: 0,
                w: 300,
                h: 200,
                lineColor: '#cccccc',
                lineWidth: 1
              }
            ],
            margin: [0, 5, 0, 5]
          });
          
          (leftColumn.stack as Array<unknown>).push({
            text: `投影片 ${slide.slideNumber}`,
            alignment: 'center',
            color: '#808080',
            margin: [0, -110, 0, 95]
          });
        }

        columns.push(leftColumn);

        // 右欄 - 演講者備註
        const rightColumn = {
          width: '50%',
          stack: [
            {
              text: '演講者備註',
              style: 'subheader'
            }
          ]
        };

        // 處理備註內容
        if (slide.notes && slide.notes.trim()) {
          const noteLines = slide.notes.split('\n').filter((line: string) => line.trim());
          
          if (noteLines.length === 1) {
            // 單行備註
            (rightColumn.stack as Array<unknown>).push({
              text: noteLines[0],
              style: 'noteText'
            });
          } else if (noteLines.length > 1) {
            // 多行備註，使用條列式
            const noteItems = noteLines.map((line: string) => ({
              text: `• ${line.trim()}`,
              style: 'noteText'
            }));
            
            (rightColumn.stack as Array<unknown>).push({
              stack: noteItems
            });
          }
        } else {
          (rightColumn.stack as Array<unknown>).push({
            text: '（無備註）',
            style: 'noteText',
            color: '#999999',
            italics: true
          });
        }

        columns.push(rightColumn);

        // 添加雙欄布局到文檔
        docDefinition.content.push({
          columns: columns,
          columnGap: 20
        });

        // 添加分隔線
        if (i < slides.length - 1) {
          docDefinition.content.push({
            canvas: [
              {
                type: 'line',
                x1: 0,
                y1: 10,
                x2: 515,
                y2: 10,
                lineWidth: 0.5,
                lineColor: '#e0e0e0'
              }
            ],
            margin: [0, 15, 0, 15]
          });
        }

      } catch (slideError) {
        console.error(`處理投影片 ${slide.slideNumber} 時發生錯誤:`, slideError);
        
        // 添加錯誤信息到 PDF
        docDefinition.content.push({
          text: `投影片 ${slide.slideNumber} - 處理時發生錯誤`,
          style: 'header',
          color: '#ff0000'
        });
        
        docDefinition.content.push({
          text: `錯誤信息: ${slideError}`,
          color: '#ff0000',
          margin: [0, 5, 0, 10]
        });
      }
    }

    // 添加頁尾
    docDefinition.content.push({
      text: `生成時間: ${new Date().toLocaleString('zh-TW')} | 共 ${slides.length} 個投影片`,
      style: 'footer',
      alignment: 'center',
      margin: [0, 20, 0, 0]
    });

    console.log('開始生成 PDF...');
    
    // 生成 PDF
    const pdfDoc = pdfMake.createPdf(docDefinition);    return new Promise((resolve) => {
      pdfDoc.getBuffer((buffer: Buffer) => {
        console.log(`PDF 生成成功，大小: ${buffer.length} bytes`);
        
        // 將 Buffer 轉換為正確的格式
        const uint8Array = new Uint8Array(buffer);
        
        const response = new Response(uint8Array.buffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="handouts.pdf"',
            'Content-Length': buffer.length.toString()
          }
        });
        
        resolve(response);
      });
    });

  } catch (error) {
    console.error('PDF 生成失敗:', error);
    return NextResponse.json({ 
      error: 'PDF 生成失敗', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
