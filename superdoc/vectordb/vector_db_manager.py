from langchain_pinecone import PineconeVectorStore
from langchain_openai import OpenAIEmbeddings
from langchain_community.utils.math import (
    cosine_similarity,
)
from pinecone import Pinecone, IndexModel, ServerlessSpec
import os
import hashlib
import numpy as np
import time
from pydantic import BaseModel 
from numpy import ndarray
from typing import Optional
from chunking.doc_chunking import DocSemChunker
from uuid import uuid4
from langchain_core.documents import Document
from docling.document_converter import DocumentConverter
import re
from langchain_openai import ChatOpenAI

'''
Need this to, create tables automatically
Initalize and Access the tables
And also do cosine similarity search efficently
In order to do the superdoc comparison alg properly

'''

class VectorDBManager(BaseModel):
    pc:Pinecone
    vs:Optional[PineconeVectorStore] = None
    index_name:Optional[str] = None
    model_config = {"arbitrary_types_allowed" : True}
    def initVectorStore(self,index_name:str,embedding:OpenAIEmbeddings):
        if not self.pc.has_index(index_name): 
            raise ValueError(f"Index:{index_name}, does not exist")
        index = self.pc.Index(index_name)
        self.vs = PineconeVectorStore(index=index,embedding=embedding)
        self.index_name = index_name        
    def createIndex(self,index_name:str):
        if self.pc.has_index(index_name): 
            raise ValueError(f"Index:{index_name}, already exists")
        self.pc.create_index(
            name=index_name,
            dimension=1536,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )    
        return self.pc.Index(index_name)
    
    def generate_timestamp_id(self,course_id):
        """Generate ID using both content and timestamp"""
        timestamp = int(time.time() * 1000)
        return f"{course_id}_{timestamp}"  
    
    def create_vectordb_heading(self, heading_text: str, course_id: str, superdoc_id: str) -> None:
        """
        Creates a new heading entry in vector DB with dynamically generated OpenAI embedding.
    
        Args:
            heading_text: The heading text (will be used to generate embedding)
            course_id: Course namespace for vector DB operations
            superdoc_id: Source filter for vector DB queries
    
        Raises:
            Exception: If embedding generation or creation fails
        """
        try:
            # Generate OpenAI embedding for the heading text
            embeddings = OpenAIEmbeddings()
            embedding = embeddings.embed_query(heading_text)
    
            print(f"Generated embedding for heading: '{heading_text}' (dimension: {len(embedding)})")
    
            index = self.pc.Index(self.index_name)
    
            # Create new entry with the dynamically generated embedding
            new_vector = {
                "id": self.generate_timestamp_id(course_id),
                "values": embedding,
                "metadata": {
                    "position": [heading_text],
                    "source": superdoc_id,
                    "heading": heading_text
                }
            }
    
            index.upsert(vectors=[new_vector], namespace=course_id)
            print(f"Successfully created new entry with heading: '{heading_text}'")
    
        except ImportError:
            raise Exception("OpenAIEmbeddings not available. Please install langchain-openai")
        except Exception as e:
            raise Exception(f"Failed to create vector DB heading '{heading_text}': {str(e)}")
    
    def remove_vectordb_heading(self, heading: str, course_id: str, superdoc_id: str) -> int:
        """
        Removes all entries with a specific heading from vector DB.

        Args:
            heading: The heading name to be removed
            course_id: Course namespace for vector DB operations
            superdoc_id: Source filter for vector DB queries

        Returns:
            int: Number of entries deleted

        Raises:
            Exception: If deletion fails
        """
        try:
            index = self.pc.Index(self.index_name)

            # Query for entries with the specified heading
            response = index.query(
                top_k=100,
                filter={"source": superdoc_id, "heading": heading},
                vector=[0] * 1536,  # Default OpenAI embedding dimension
                namespace=course_id,
                include_metadata=True
            )

            matches = response.get("matches", [])
            if matches:
                index.delete(ids=[match.id for match in matches], namespace=course_id)
                print(f"Deleted {len(matches)} entries with heading: '{heading}'")
                return len(matches)
            else:
                print(f"No existing entries found with heading: '{heading}'")
                return 0

        except Exception as e:
            raise Exception(f"Failed to remove vector DB heading '{heading}': {str(e)}")
        
        
    def replace_vectordb_heading_with_text(self, old_heading: str, new_heading_text: str, course_id: str, superdoc_id: str) -> None:
        """
        Replaces a heading in vector DB by deleting the old entry and creating a new one
        with the new heading text and its dynamically generated OpenAI embedding.

        Args:
            old_heading: The heading name to be removed
            new_heading_text: The new heading text (will be used to generate embedding)
            course_id: Course namespace for vector DB operations
            superdoc_id: Source filter for vector DB queries

        Raises:
            Exception: If embedding generation fails
        """
        try:
            # Generate OpenAI embedding for the new heading text

            embeddings = OpenAIEmbeddings()
            new_embedding = embeddings.embed_query(new_heading_text)

            print(f"Generated embedding for new heading: '{new_heading_text}' (dimension: {len(new_embedding)})")

            index = self.pc.Index(self.index_name)

            # Delete old entries
            response = index.query(
                top_k=100,
                filter={"source": superdoc_id, "heading": old_heading},
                vector=[0] * len(new_embedding),
                namespace=course_id,
                include_metadata=True
            )

            matches = response.get("matches", [])
            if matches:
                index.delete(ids=[match.id for match in matches], namespace=course_id)
                print(f"Deleted {len(matches)} entries with old heading: '{old_heading}'")
            else:
                print(f"No existing entries found with heading: '{old_heading}'")

            # Create new entry with the dynamically generated embedding
            new_vector = {
                "id": self.generate_timestamp_id(course_id),
                "values": new_embedding,
                "metadata": {
                    "position": [new_heading_text],
                    "source": superdoc_id,
                    "heading": new_heading_text
                }
            }

            index.upsert(vectors=[new_vector], namespace=course_id)
            print(f"Successfully created new entry with heading: '{new_heading_text}'")

        except ImportError:
            raise Exception("OpenAIEmbeddings not available. Please install langchain-openai")
        except Exception as e:
            raise Exception(f"Failed to replace vector DB heading: {str(e)}")
    def _generate_heading_from_sentence(self, sentence: str) -> str:
        """
        Generate a clean, short heading using an OpenAI LLM.
        Falls back to 'Basic' if input is missing or model fails.
        """
        if not sentence or not isinstance(sentence, str):
            return "Basic"      
        try:
            llm = ChatOpenAI(
                model="gpt-4o-mini",
                temperature=0.1,
                max_tokens=20  # keep it short
            )       
            prompt = (
                "Create a concise heading (4–7 words maximum) based ONLY on the following "
                "sentence. The heading must:\n"
                "- be title case\n"
                "- remove unnecessary words\n"
                "- not include punctuation\n"
                "- sound like a real document section heading\n\n"
                f"Sentence: \"{sentence}\"\n\n"
                "Heading:"
            )       
            response = llm.invoke(prompt)
            heading = response.content.strip()      
            # safety check
            if not heading:
                return "Basic"      
            return heading      
        except Exception as e:
            print(f"[WARN] LLM heading generation failed: {e}")
            return "Basic"
    def modify_doc_heading(self, documents: list[Document], course_id: str, superdoc_id: str) -> list[Document]:
        """
            Standardizes document headings across similar content using semantic similarity.
            Reuses existing headings when content is highly similar (≥0.95 cosine similarity),
            otherwise uses current headings. Updates vector database with new headings.
        """
        
        modified_docs = []
        index = self.pc.Index(self.index_name)
        threshold = 0.95
        prev_headings = []
        for doc in documents:
        # Search for similar headings
            #instead of self.vs try index
            #print(f"Trying index search on: {doc.metadata["chunk_embedding"]}")
            response = index.query(
                top_k=1, filter={"source": superdoc_id},
                vector=doc.metadata["chunk_embedding"],
                lambda_mult=1, 
                namespace=course_id,
                include_metadata=True,
                include_values=True
            )
            #print(f"Result:{response.get("matches",[{}])[0].get("metadata",{})}")
            # Get current heading
            results = response.get("matches")
            current_heading = None
            if doc.metadata.get("position",None):
                current_heading = doc.metadata.get("position", ["basic"])[-1]
            if not current_heading:
                relevant = doc.metadata.get("relevant_sentence") or doc.metadata.get("page_content") or ""
                current_heading = self._generate_heading_from_sentence(sentence=relevant)
            #fetched_heading = ""
            if len(results) == 0:
                # No existing headings found - use current one
                new_heading = current_heading
            else:
                # Calculate actual cosine similarity
                similarity = cosine_similarity(
                    [doc.metadata["chunk_embedding"]],
                    [results[0].values]  # Need stored embedding results[0].metadata.get("embedding", [])]
                )[0][0]
                fetched_heading = results[0].metadata.get("position")[-1]
                if similarity >= threshold:
                    # Good match - use the found heading
                    new_heading = fetched_heading
                else:
                    # Poor match - use current heading
                    new_heading = current_heading
        
            # Update document
            print(f"New Heading:{new_heading}")
            doc.metadata["position"] = [new_heading]
            modified_docs.append(doc)
            # Store in vector DB (if new or modified)
            if (len(results) == 0 or similarity < threshold) and not (new_heading in prev_headings):
                index.upsert(vectors=[{
                    "id": self.generate_timestamp_id(course_id),
                    "values": doc.metadata["chunk_embedding"],
                    "metadata": {"position": [new_heading], "source": superdoc_id, "heading": new_heading}
                }], namespace=course_id)
            #index = self.pc.Index(self.index_name)
            prev_headings.append(new_heading)
        return modified_docs  # Return ALL modified docs
                 
                
    def remove_heading_entry(self,heading:str,course_id:str,superdoc_id:str): 
        try:
            # Generate OpenAI embedding for the new heading text

            embeddings = OpenAIEmbeddings()
            index = self.pc.Index(self.index_name)

            # Delete old entries
            response = index.query(
                top_k=100,
                filter={"source": superdoc_id, "heading": heading},
                vector=[0] * 1536,
                namespace=course_id,
                include_metadata=True
            )

            matches = response.get("matches", [])
            if matches:
                index.delete(ids=[match.id for match in matches], namespace=course_id)
                print(f"Deleted {len(matches)} entries with old heading: '{heading}'")
            else:
                print(f"No existing entries found with heading: '{heading}'")
        except Exception as e:
            raise Exception(f"Failed to delete vector DB heading: {str(e)}")                            
            
    #adding document to vector store-append misleading cuz it just adds it to the database
    def append_documents(self,documents:list[Document],course_id:str,superdoc_id:str):
        
        
        index = self.pc.Index(self.index_name)
        filtered_docs = ""
        index.upsert(
            vectors=[{
                "id":self.generate_timestamp_id(doc.course_id), 
                "values": doc.metadata["chunk_embedding"],
                "metadata": {"position":doc.metadata["position"],"superdoc":superdoc_id,"text":doc.page_content}
                    
            } for doc in documents],
            namespace=course_id)      
    
                
                
if __name__ == "__main__": 
    pinecone_api_key = os.environ.get("PINECONE_API_KEY")
    print(f"Start of VectorDBManager init")
    db = VectorDBManager(pc=Pinecone(pinecone_api_key))
    db.initVectorStore(index_name="sdtest1", embedding=OpenAIEmbeddings(api_key=os.getenv("OPENAI_API_KEY")))
    print(f"Start of pdf conversion")
    converter = DocumentConverter()
    doc = converter.convert("./files/ResearchPaperTurnIn.pdf").document 
    print(f"Start of chunking")
    chunker = DocSemChunker() 
    chunk_iter = list(chunker.chunk(dl_doc=doc,doc_name="rpaper"))
    print(f"Start of modifying headings")
    db.modify_doc_heading(documents=chunk_iter,superdoc_id="rpaper",course_id="RHET1302")
    #db.append_documents(documents=chunk_iter,superdoc_str="rpaper",course_id="RHET1302")
    #DOCUMENT CHUNKING AND UPLOADING
    '''
    chunker = DocSemChunker() 
    chunk_iter = list(chunker.chunk(dl_doc=doc,doc_name="rpaper"))
    db.append_documents(documents=chunk_iter,superdoc_str="rpaper",course_id="RHET1302")
    '''

