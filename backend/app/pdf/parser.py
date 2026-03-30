import fitz  # PyMuPDF
import pdfplumber
from app.pdf.ocr import ocr_with_tesseract

def detect_pdf_type(pdf_path: str) -> str:
    """Determines whether a PDF is 'text', 'table', or 'scanned'."""
    try:
        doc = fitz.open(pdf_path)
        if len(doc) == 0:
            return "scanned"
            
        # Check first few pages for text content
        text_length = 0
        for page_num in range(min(3, len(doc))):
            page = doc[page_num]
            text_length += len(page.get_text())
            
        doc.close()
        
        # Arbitrary threshold to determine if it's purely scanned images
        if text_length < 50: 
            return "scanned"
            
        return "text" 
    except Exception as e:
        print(f"Error detecting type: {e}")
        return "scanned"

def extract_tables(pdf_path: str) -> list[dict]:
    """Extracts tables from the PDF using pdfplumber."""
    tables = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            extracted_tables = page.extract_tables()
            for table in extracted_tables:
                tables.append({"page": i + 1, "content": table})
    return tables

def extract_text(pdf_path: str) -> str:
    """Main function to extract text based on PDF type."""
    pdf_type = detect_pdf_type(pdf_path)
    
    if pdf_type == "scanned":
        return ocr_with_tesseract(pdf_path)
    else:
        doc = fitz.open(pdf_path)
        full_text = ""
        for page in doc:
            full_text += page.get_text() + "\n"
        doc.close()
        return full_text

def process_pdf(pdf_path: str) -> dict:
    """Process a PDF and return extracted text and type."""
    text = extract_text(pdf_path)
    return {
        "text": text,
        "type": detect_pdf_type(pdf_path)
    }
