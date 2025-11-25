const { execSync } = require("child_process");

try {
  const output = execSync("npm run build 2>&1", { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  const lines = output.split("\n");

  const errors = [];
  let currentError = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match error lines with file paths
    const fileMatch = line.match(/\[([^\]]+)\]/);
    if (fileMatch) {
      const filePath = fileMatch[1];
      if (filePath.includes(".ts") || filePath.includes(".tsx")) {
        currentError = { file: filePath, type: null, line: null };
      }
    }

    // Match error types
    if (
      line.includes("cannot reassign") ||
      line.includes("redefined") ||
      line.includes("Syntax Error") ||
      line.includes("Expected") ||
      line.includes("Unexpected")
    ) {
      if (currentError) {
        currentError.type = line.trim();
        errors.push(currentError);
        currentError = null;
      }
    }

    // Match line numbers
    if (currentError && line.match(/^\s*\d+\s*\|/)) {
      const lineMatch = line.match(/^\s*(\d+)\s*\|/);
      if (lineMatch) {
        currentError.line = parseInt(lineMatch[1]);
      }
    }
  }

  // Deduplicate
  const uniqueErrors = [];
  const seen = new Set();
  for (const err of errors) {
    const key = `${err.file}:${err.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueErrors.push(err);
    }
  }

  console.log("Build Errors Found:");
  uniqueErrors.forEach((err, i) => {
    console.log(`${i + 1}. ${err.file}`);
    console.log(`   Type: ${err.type}`);
    if (err.line) console.log(`   Line: ${err.line}`);
    console.log("");
  });

  console.log(`Total: ${uniqueErrors.length} unique errors`);
} catch (error) {
  console.error("Error running build:", error.message);
}
