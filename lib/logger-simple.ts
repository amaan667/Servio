// Simple production-safe logger utility
export const log = (...args: unknown[]) => { 
}

export const warn = (...args: unknown[]) => { 
  if (process.env.NODE_ENV !== 'production') console.warn(...args) 
}

export const error = (...args: unknown[]) => { 
  console.error(...args) // keep errors in prod
}

export const debug = (...args: unknown[]) => { 
}
