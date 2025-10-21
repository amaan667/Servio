module.exports = {
  "*.{js,jsx,ts,tsx}": [
    "prettier --write",
    "eslint --fix --max-warnings=0"
  ],
  "*.{json,css,scss,md}": [
    "prettier --write"
  ]
};

