#!/bin/sh
# Write the Google Vision JSON env variable to a file
if [ -z "$GOOGLE_VISION_JSON" ]; then
  echo "GOOGLE_VISION_JSON is not set!"
  exit 1
fi
echo "$GOOGLE_VISION_JSON" > /app/google-vision-key.json
export GOOGLE_APPLICATION_CREDENTIALS=/app/google-vision-key.json
npm start 