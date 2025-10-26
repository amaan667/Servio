module.exports = {
  "*.{js,jsx,ts,tsx}": [
    "prettier --write",
    "eslint --fix --max-warnings=100" // Temporarily allow warnings during cleanup
  ],
  "*.{json,css,scss,md}": [
    "prettier --write"
  ]
};

