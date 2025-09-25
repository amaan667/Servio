export const log = (...a: any[]) => { 
};

export const warn = (...a: any[]) => { 
  if (process.env.NODE_ENV !== "production") console.warn(...a); 
};

export const error = (...a: any[]) => { 
  console.error(...a); 
};

// Legacy export for backward compatibility
export const logger = { log, warn, error };