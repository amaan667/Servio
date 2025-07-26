import fitz  # PyMuPDF
import os
import sys

# --- Configuration ---
pdf_path = sys.argv[1] if len(sys.argv) > 1 else None
output_dir = sys.argv[2] if len(sys.argv) > 2 else "pdf_images"
dpi = 300  # Use 300 for high quality OCR

if not pdf_path or not os.path.isfile(pdf_path):
    print(f"Usage: python pdf_to_images.py <input.pdf> [output_dir]")
    sys.exit(1)

# --- Create output directory ---
os.makedirs(output_dir, exist_ok=True)

# --- Open PDF ---
pdf = fitz.open(pdf_path)
print(f"Opened '{pdf_path}', total pages: {pdf.page_count}")

# --- Convert each page to PNG ---
for page_number in range(pdf.page_count):
    page = pdf.load_page(page_number)
    # Render page to an image (pixmap)
    pix = page.get_pixmap(dpi=dpi)
    image_path = os.path.join(output_dir, f"page_{page_number+1}.png")
    pix.save(image_path)
    print(f"Saved: {image_path}")

print("✅ All pages converted to PNG images.") 