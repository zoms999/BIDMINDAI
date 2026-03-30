from langchain_text_splitters import RecursiveCharacterTextSplitter

def chunk_document(text: str, document_id: str, chunk_size: int = 8192, chunk_overlap: int = 200) -> list[dict]:
    """Chunk the extracted text for embedding."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", " ", ""]
    )
    
    chunks = splitter.split_text(text)
    
    result = []
    for i, chunk_text in enumerate(chunks):
        result.append({
            "chunk_id": f"{document_id}_c{i}",
            "document_id": document_id,
            "text": chunk_text,
            "chunk_index": i
        })
        
    return result
