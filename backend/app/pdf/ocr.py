import pytesseract
from pdf2image import convert_from_path

def ocr_with_tesseract(pdf_path: str) -> str:
    """Extract text from scanned PDF using Tesseract OCR."""
    images = convert_from_path(pdf_path, dpi=300)
    full_text = ""
    for i, image in enumerate(images):
        text = pytesseract.image_to_string(image, lang='eng+kor') # Assuming Korean and English
        full_text += text + "\n"
    return full_text
