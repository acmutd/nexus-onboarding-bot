from googledoc.googledoc import GoogleDocsEditor
from docling.document_converter import DocumentConverter
import os.path

from chunking.doc_chunking import DocSemChunker, cosine_similarity
from langchain_core.documents import Document

from vectordb.vector_db_manager import VectorDBManager, Pinecone
from langchain_openai import OpenAIEmbeddings
import numpy as np
 


class superdoc():
    def __init__(self,DOCUMENT_ID:str|None,COURSE_ID:str,index_name='sdtest1'):
        self.DOCUMENT_ID = DOCUMENT_ID
        self.COURSE_ID = COURSE_ID
        self.docs_editor = GoogleDocsEditor()
        if DOCUMENT_ID is None: 
            self.DOCUMENT_ID = self.docs_editor.create_google_doc(name=COURSE_ID).get('documentId')

        self.db = VectorDBManager(pc=Pinecone(os.environ.get("PINECONE_API_KEY")))
        self.db.initVectorStore(index_name=index_name, embedding=OpenAIEmbeddings(api_key=os.getenv("OPENAI_API_KEY")))
        
        self.docs_editor.get_document_structure(document_id=self.DOCUMENT_ID)
        self.converter = DocumentConverter() 
        self.chunker = DocSemChunker()
    
    def merge_pdf(self, pdf_path: str):
        # Convert the provided PDF file (requires file path string)
        pdf = self.converter.convert(pdf_path).document 
        chunk_iter = list(self.chunker.chunk(dl_doc=pdf,doc_name=self.DOCUMENT_ID))
        chunk_iter = self.db.modify_doc_heading(documents=chunk_iter,superdoc_id=self.DOCUMENT_ID,course_id=self.COURSE_ID)
        #may need this everytime I call this method depending on of there are gdoc manipulations before this method
        self.docs_editor.get_document_structure(document_id=self.DOCUMENT_ID)
        
        self.docs_editor.insert_text(document_id=self.DOCUMENT_ID, chunk_docs=chunk_iter)


    def delete_heading(self,old_heading:str): 
        self.docs_editor.delete_heading(old_heading=old_heading)
        self.db.remove_vectordb_heading(heading=old_heading,course_id=self.COURSE_ID,superdoc_id=self.DOCUMENT_ID)
    
    def create_heading(self,new_heading:str):
        self.docs_editor.create_heading(new_heading=new_heading)
        self.db.create_vectordb_heading(heading_text=new_heading,course_id=self.COURSE_ID,superdoc_id=self.DOCUMENT_ID)
    '''Updates old_heading in both google docs and vectorDb'''
    def update_heading(self,old_heading:str,new_heading:str):
        #update googledoc heading named range
        self.docs_editor.update_heading(old_heading=old_heading,new_heading=new_heading)
        self.db.replace_vectordb_heading_with_text(old_heading=old_heading,new_heading_text=new_heading,course_id=self.COURSE_ID,superdoc_id=self.DOCUMENT_ID)

    def group_embedded_chunks(self, chunks: list[Document]):
        groups = []
        used = set()  # Use set for O(1) lookups

        for i in range(len(chunks)): 
            if chunks[i] in used:
                continue

            # Start new group
            similar = [chunks[i]]
            used.add(chunks[i])
            i_embedding = chunks[i].metadata['mean_embedding']

            # Find similar chunks
            for j in range(len(chunks)): 
                if chunks[j] in used:
                    continue

                j_embedding = chunks[j].metadata['mean_embedding']
                if cosine_similarity([i_embedding], [j_embedding])[0][0] > 0.9:
                    similar.append(chunks[j])
                    used.add(chunks[j])

            # Calculate mean embedding CORRECTLY
            embeddings = [chunk.metadata['mean_embedding'] for chunk in similar]
            mean_embedding = np.array(embeddings).mean(axis=0)

            groups.append({
                'mean_embedding': mean_embedding,
                'chunks': similar
            })

        return groups

    def improved_greedy_clustering(self, chunks: list[Document], threshold: float = 0.85):
        """
        Improved version of your original approach with better similarity checking.
        """
        clusters = []
        used = set()

        # Sort by embedding magnitude to start with "prototypical" documents
        sorted_chunks = sorted(chunks, 
            key=lambda x: np.linalg.norm(x.metadata['mean_embedding']), 
            reverse=True)

        for i, chunk in enumerate(sorted_chunks):
            if chunk in used:
                continue

            # Start new cluster
            cluster = [chunk]
            used.add(chunk)
            center_embedding = chunk.metadata['mean_embedding']

            # Find similar chunks (check against cluster center)
            for other_chunk in sorted_chunks[i+1:]:
                if other_chunk in used:
                    continue

                similarity = cosine_similarity(
                    [center_embedding], 
                    [other_chunk.metadata['mean_embedding']]
                )[0][0]

                if similarity >= threshold:
                    cluster.append(other_chunk)
                    used.add(other_chunk)
                    # Update cluster center as we add members
                    cluster_embeddings = [c.metadata['mean_embedding'] for c in cluster]
                    center_embedding = np.array(cluster_embeddings).mean(axis=0)

            # Final mean embedding for the cluster
            cluster_embeddings = [c.metadata['mean_embedding'] for c in cluster]
            mean_embedding = np.array(cluster_embeddings).mean(axis=0)

            clusters.append({
                'mean_embedding': mean_embedding,
                'chunks': cluster,
                'size': len(cluster)
            })

        return clusters

            
        
        
    



def insert_text_ex(): 
     # Initialize the editorpinecone_api_key = os.environ.get("PINECONE_API_KEY")
    pinecone_api_key = os.environ.get("PINECONE_API_KEY")
    print(f"Start of VectorDBManager init")
    db = VectorDBManager(pc=Pinecone(pinecone_api_key))
    db.initVectorStore(index_name="sdtest1", embedding=OpenAIEmbeddings(api_key=os.getenv("OPENAI_API_KEY")))
    print(f"Start of pdf conversion")
    docs_editor = GoogleDocsEditor()
    
    converter = DocumentConverter()
    doc = converter.convert("./files/ResearchPaperTurnIn.pdf").document 
    chunker = DocSemChunker() 
    print("Starting chuking")
    chunk_iter = list(chunker.chunk(dl_doc=doc,doc_name="rpaper"))
    # Your Google Docs document ID (om the URL)
    chunk_iter = db.modify_doc_heading(documents=chunk_iter,superdoc_id="rpaper",course_id="RHET1302")
    DOCUMENT_ID = '1zjQClSEUE587kPrupY5fplFtUcB3OGEj5mKhplmiFxM'
    
    # Example 1: Append to the very end
    docs_editor.get_document_structure(document_id=DOCUMENT_ID)
   # print(f"Doc structure:{docs_editor.doc}")
    #print(docs_editor.find_insertion_point("stuff"))
    #print("Appending to end of document...")
    docs_editor.insert_text(document_id=DOCUMENT_ID, chunk_docs=chunk_iter)
    
    
if __name__ == '__main__': 
    sd = superdoc(DOCUMENT_ID='1zjQClSEUE587kPrupY5fplFtUcB3OGEj5mKhplmiFxM',COURSE_ID="RHET1302")
    #sd.merge_pdf()
   # sd.update_heading(old_heading="Introduction",new_heading="GoofyGoober")
    #sd.create_heading(new_heading="Trump giving Kirk to Bubba")
    sd.delete_heading(old_heading="Trump giving Kirk to Bubba")