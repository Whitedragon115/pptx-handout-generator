import { appConfig } from '../config/app';

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  source?: string;
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;

  private constructor() {
    // 從設定檔讀取日誌級別
    this.logLevel = appConfig.logging.level.toUpperCase() as LogLevel;
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatLog(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    const timestamp = new Date().toISOString();
    const colors = {
      DEBUG: '\x1b[36m', // Cyan
      INFO: '\x1b[32m',  // Green
      WARN: '\x1b[33m',  // Yellow
      ERROR: '\x1b[31m', // Red
    };
    const reset = '\x1b[0m';
    const bold = '\x1b[1m';
    
    const color = colors[entry.level];
    const prefix = `${color}${bold}[${entry.level}]${reset}`;
    const timePrefix = `\x1b[90m${timestamp}${reset}`;
    const sourcePrefix = entry.source ? `\x1b[35m[${entry.source}]${reset}` : '';
    
    console.log(`${timePrefix} ${prefix} ${sourcePrefix} ${entry.message}`);
    
    if (entry.data && entry.level === 'DEBUG') {
      console.log(`${color}📊 Data:${reset}`, entry.data);
    }
  }

  debug(message: string, data?: any, source?: string): void {
    this.formatLog({
      timestamp: new Date().toISOString(),
      level: 'DEBUG',
      message: `🔍 ${message}`,
      data,
      source
    });
  }

  info(message: string, data?: any, source?: string): void {
    this.formatLog({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: `ℹ️  ${message}`,
      data,
      source
    });
  }

  warn(message: string, data?: any, source?: string): void {
    this.formatLog({
      timestamp: new Date().toISOString(),
      level: 'WARN',
      message: `⚠️  ${message}`,
      data,
      source
    });
  }

  error(message: string, data?: any, source?: string): void {
    this.formatLog({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: `❌ ${message}`,
      data,
      source
    });
  }

  // 特殊方法用於用戶操作日誌
  userAction(action: string, details?: any): void {
    this.info(`用戶操作: ${action}`, details, 'USER');
  }

  // 特殊方法用於系統操作日誌
  systemAction(action: string, details?: any): void {
    this.info(`系統操作: ${action}`, details, 'SYSTEM');
  }

  // 特殊方法用於存儲相關日誌
  storage(message: string, storageInfo?: any): void {
    if (storageInfo && storageInfo.currentSizeGB > storageInfo.maxSizeGB * 0.8) {
      this.warn(`存儲警告: ${message}`, storageInfo, 'STORAGE');
    } else {
      this.info(`存儲信息: ${message}`, storageInfo, 'STORAGE');
    }
  }
}

// 導出單例實例
export const logger = Logger.getInstance();

// 根據環境變數設置日誌級別
if (typeof window === 'undefined') {
  // 伺服器端
  const logLevel = process.env.LOG_LEVEL as LogLevel || 'INFO';
  logger.setLogLevel(logLevel);
} else {
  // 客戶端 - 可以從 localStorage 讀取設置
  const savedLogLevel = localStorage.getItem('logLevel') as LogLevel;
  if (savedLogLevel) {
    logger.setLogLevel(savedLogLevel);
  }
}
