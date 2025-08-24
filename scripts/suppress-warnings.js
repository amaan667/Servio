// Suppress punycode deprecation warning
const originalEmitWarning = process.emitWarning;
process.emitWarning = (warning, ...args) => {
  if (args[0] === 'DeprecationWarning' && warning.includes('punycode')) {
    return;
  }
  if (args[0] && args[0].code === 'DEP0040') {
    return;
  }
  return originalEmitWarning.apply(process, [warning, ...args]);
};