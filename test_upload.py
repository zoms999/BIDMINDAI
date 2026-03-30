import requests

def create_dummy_pdf(filename="test_dummy.pdf"):
    # This just creates a text file masquerading as PDF for the sake of the API.
    # Note: If the backend's pdf parser strictly requires a valid pdf, this might fail parsing.
    # Let's write a minimal valid PDF manually.
    minimal_pdf = b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Count 1\n/Kids [3 0 R]\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n/Resources <<\n/Font <<\n/F1 <<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\n>>\n>>\n>>\nendobj\n4 0 obj\n<<\n/Length 73\n>>\nstream\nBT\n/F1 24 Tf\n100 100 Td\n(This is a test PDF document for BidMindAI)\nTj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000111 00000 n\n0000000253 00000 n\ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n374\n%%EOF"
    with open(filename, "wb") as f:
        f.write(minimal_pdf)
    return filename

def test_upload():
    filename = create_dummy_pdf()
    prompt_url = "http://localhost:8000/api/documents/upload"
    
    with open(filename, "rb") as f:
        files = {"file": (filename, f, "application/pdf")}
        print(f"Uploading {filename}...")
        response = requests.post(prompt_url, files=files)
        
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")

if __name__ == "__main__":
    test_upload()
