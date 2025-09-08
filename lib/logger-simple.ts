// Simple production-safe logger utility
export const log = (...args: any[]) => { 
  if (process.env.NODE_ENV !== 'production') console.log(...args) 
}

export const warn = (...args: any[]) => { 
  if (process.env.NODE_ENV !== 'production') console.warn(...args) 
}

export const error = (...args: any[]) => { 
  console.error(...args) // keep errors in prod
}

export const debug = (...args: any[]) => { 
  if (process.env.NODE_ENV !== 'production') console.log('[DEBUG]', ...args) 
}
