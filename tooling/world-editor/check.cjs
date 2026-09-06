const { validateDesignData } = require('./lib/validation.cjs');

const result = validateDesignData();
for (const warning of result.warnings) console.warn(`warn ${warning}`);
for (const error of result.errors) console.error(`error ${error}`);
if (!result.ok) process.exit(1);
console.log(`World editor data OK (${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'})`);
