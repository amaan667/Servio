export const isDev = () => process.env.NODE_ENV !== 'production';

type Level = 'info' | 'warn' | 'error';

const emit = (level: Level, event: string, payload?: unknown) => {
  if (isDev()) {
    // eslint-disable-next-line no-console
    (console as any)[level]?.(`[${event}]`, payload ?? '');
  }
};

export const logInfo = (e: string, p?: unknown) => emit('info', e, p);
export const logWarn = (e: string, p?: unknown) => emit('warn', e, p);
export const logError = (e: string, p?: unknown) => emit('error', e, p);