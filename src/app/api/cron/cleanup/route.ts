import { NextRequest, NextResponse } from 'next/server';
import { logger } from '../../../../utils/logger';

export async function GET(request: NextRequest) {
  try {
    // 從查詢參數中獲取秘鑰，防止未授權存取
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    
    // 簡單的安全檢查（在生產環境中應該使用更安全的方式）
    if (key !== 'cleanup-cron-job-secret') {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    // 呼叫清理 API
    const cleanupResponse = await fetch(`${request.nextUrl.origin}/api/storage-cleanup?action=cleanup`, {
      method: 'GET'
    });

    if (!cleanupResponse.ok) {
      throw new Error('清理請求失敗');
    }    const cleanupData = await cleanupResponse.json();
    
    logger.info('定期清理', `定期清理執行完成，刪除檔案: ${cleanupData.cleanup?.deletedFiles?.length || 0}，釋放空間: ${cleanupData.cleanup?.totalSizeFreed || 0} bytes`);

    return NextResponse.json({
      success: true,
      message: '定期清理執行完成',
      result: cleanupData
    });

  } catch (error) {
    logger.error('定期清理', `定期清理失敗: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json({
      error: '定期清理失敗',
      details: error instanceof Error ? error.message : '未知錯誤'
    }, { status: 500 });
  }
}
