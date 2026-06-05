export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function shouldLog(level: LogLevel, min: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[min];
}

export interface LogContext {
  correlationId?: string;
  [key: string]: unknown;
}

export function createLogger(service: string, minLevel: LogLevel = "info") {
  return {
    debug(msg: string, ctx?: LogContext) {
      if (shouldLog("debug", minLevel)) write("debug", service, msg, ctx);
    },
    info(msg: string, ctx?: LogContext) {
      if (shouldLog("info", minLevel)) write("info", service, msg, ctx);
    },
    warn(msg: string, ctx?: LogContext) {
      if (shouldLog("warn", minLevel)) write("warn", service, msg, ctx);
    },
    error(msg: string, ctx?: LogContext) {
      if (shouldLog("error", minLevel)) write("error", service, msg, ctx);
    },
  };
}

function write(level: LogLevel, service: string, msg: string, ctx?: LogContext) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    service,
    msg,
    ...ctx,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
