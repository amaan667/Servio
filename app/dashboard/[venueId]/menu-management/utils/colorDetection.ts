export const detectColorsFromImage = (

): Promise<{ primary: string; secondary: string }> => {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || typeof window.Image === "undefined") {
      resolve({ primary: "#8b5cf6", secondary: "#f3f4f6" });
      return;
    }

    const img = new window.Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        if (typeof window === "undefined" || typeof window.document === "undefined") {
          resolve({ primary: "#8b5cf6", secondary: "#f3f4f6" });
          return;
        }

        const canvas = window.document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({ primary: "#8b5cf6", secondary: "#f3f4f6" });
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;

        const colors: { [key: string]: number } = {
          /* Empty */
        };
        const sampleSize = Math.min(1000, pixels.length / 4);

        for (let i = 0; i < sampleSize; i++) {
          const pixelIndex = Math.floor(Math.random() * (pixels.length / 4)) * 4;
          const r = pixels[pixelIndex];
          const g = pixels[pixelIndex + 1];
          const b = pixels[pixelIndex + 2];
          const a = pixels[pixelIndex + 3];

          if (a < 128) continue;
          if (r > 240 && g > 240 && b > 240) continue;

          const color = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
          colors[color] = (colors[color] || 0) + 1;
        }

        const sortedColors = Object.entries(colors)
          .sort(([, a], [, b]) => b - a)
          .map(([color]) => color);

        const primary = sortedColors[0] || "#8b5cf6";
        const secondary = sortedColors[1] || "#f3f4f6";

        resolve({ primary, secondary });
      } catch (_error) {
        resolve({ primary: "#8b5cf6", secondary: "#f3f4f6" });
      }
    };

    img.onerror = () => {
      resolve({ primary: "#8b5cf6", secondary: "#f3f4f6" });
    };

    img.src = imageUrl;

};
