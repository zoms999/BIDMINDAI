from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, create_engine, Float
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime
from app.core.config import settings
import uuid

Base = declarative_base()

class Document(Base):
    __tablename__ = 'documents'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String, nullable=False)
    status = Column(String, nullable=False, default='uploaded')
    created_at = Column(DateTime, default=datetime.utcnow)
    
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")

class DocumentChunk(Base):
    __tablename__ = 'document_chunks'
    
    id = Column(String, primary_key=True)
    document_id = Column(String, ForeignKey('documents.id', ondelete='CASCADE'), nullable=False)
    text = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    
    document = relationship("Document", back_populates="chunks")

class AccessLog(Base):
    __tablename__ = 'access_logs'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    ip_address = Column(String, nullable=True)
    method = Column(String, nullable=True)
    url = Column(String, nullable=True)
    status_code = Column(Integer, nullable=True)
    process_time = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

# Try to use DATABASE_URL from config or construct it
if settings.DATABASE_URL:
    db_url = settings.DATABASE_URL
else:
    db_url = f"postgresql://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}@{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"

try:
    engine = create_engine(db_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
except Exception as e:
    print(f"Failed to create db engine: {e}")
    engine = None
    SessionLocal = None

def get_db():
    if not SessionLocal:
        yield None
        return
        
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    if engine:
        Base.metadata.create_all(bind=engine)
