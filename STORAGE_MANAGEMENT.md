# 存儲管理與自動清理功能

## 功能概述

本系統實現了以下存儲管理功能：

1. **自動清理過期檔案**: 刪除超過 30 分鐘未訪問的圖片檔案
2. **存儲空間限制**: 當總存儲超過 18GB 時阻止新檔案上傳
3. **即時存儲狀態監控**: 在前端顯示當前存儲使用情況
4. **手動清理功能**: 管理員可手動觸發清理

## 實現原理

### 檔案訪問追蹤
- 每次圖片被請求時，系統會更新檔案的最後訪問時間
- 使用 `/api/uploads/[filename]` 端點處理圖片請求並追蹤訪問

### 自動清理機制
- `/api/storage-cleanup` 提供清理功能
- 檢查每個檔案的最後訪問時間
- 刪除超過 30 分鐘未訪問的檔案

### 存儲限制檢查
- 在檔案上傳前檢查總存儲使用量
- 超過 18GB 時拒絕新的上傳請求

## API 端點

### 1. 存儲管理 API
```
GET /api/storage-cleanup?action=status
GET /api/storage-cleanup?action=cleanup
POST /api/storage-cleanup (body: {action: "cleanup"})
```

### 2. 圖片訪問 API
```
GET /api/uploads/[filename]
```

### 3. 定期清理 API (用於 cron job)
```
GET /api/cron/cleanup?key=cleanup-cron-job-secret
```

## 設定定期清理

### 方法 1: 使用 cron (Linux/macOS)
在伺服器上設定 cron job，每 15 分鐘執行一次清理：

```bash
# 編輯 crontab
crontab -e

# 添加以下行 (每 15 分鐘清理一次)
*/15 * * * * curl -s "http://your-domain.com/api/cron/cleanup?key=cleanup-cron-job-secret" > /dev/null
```

### 方法 2: 使用 Windows 工作排程器
1. 開啟「工作排程器」
2. 建立基本工作
3. 設定觸發程序：每 15 分鐘
4. 設定動作：啟動程式
   - 程式：`curl`
   - 引數：`-s "http://your-domain.com/api/cron/cleanup?key=cleanup-cron-job-secret"`

### 方法 3: 使用雲端服務
如果部署在 Vercel 等平台，可以使用：
- Vercel Cron Jobs
- GitHub Actions (定期執行)
- 外部 cron 服務 (如 cron-job.org)

## 配置參數

在 `/src/app/api/storage-cleanup/route.ts` 中可以調整以下參數：

```typescript
const MAX_STORAGE_GB = 18;        // 最大存儲空間 (GB)
const MAX_FILE_AGE_MINUTES = 30;  // 檔案最大未訪問時間 (分鐘)
```

## 安全性考量

1. **cron API 密鑰**: 更改 `cleanup-cron-job-secret` 為更安全的隨機字串
2. **檔案訪問**: 圖片 API 只允許訪問 uploads 目錄中的檔案
3. **路徑驗證**: 防止路徑遍歷攻擊

## 監控建議

1. 定期檢查清理日誌
2. 監控存儲使用趨勢
3. 設定存儲空間警報 (如 80% 使用量時通知)

## 故障排除

### 清理不執行
1. 檢查 cron job 是否正確設定
2. 驗證 API 密鑰是否正確
3. 檢查伺服器日誌

### 檔案無法刪除
1. 檢查檔案權限
2. 確認檔案路徑正確
3. 檢查是否有程式正在使用檔案

### 存儲檢查不準確
1. 確認 uploads 目錄路徑正確
2. 檢查檔案系統權限
3. 重新啟動應用程式
