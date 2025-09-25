export const isDev = () => process.env.NODE_ENV !== 'production';

type Level = 'info' | 'warn' | 'error';

const emit = (level: Level, event: string, ...args: unknown[]) => {
  if (isDev()) {
    // eslint-disable-next-line no-console
    (console as any)[level]?.(`[${event}]`, ...args);
  }
};

export const logInfo = (e: string, ...args: unknown[]) => emit('info', e, ...args);
export const logWarn = (e: string, ...args: unknown[]) => emit('warn', e, ...args);
export const logError = (e: string, ...args: unknown[]) => emit('error', e, ...args);