from docling.document_converter import DocumentConverter
from docling_core.transforms.chunker.hybrid_chunker import HybridChunker
from docling_core.transforms.chunker.hierarchical_chunker import HierarchicalChunker, DocChunk,DocMeta, ChunkingSerializerProvider
from docling_core.types.doc.document import (
    DocItem,
    DoclingDocument,
    DocumentOrigin,
    InlineGroup,
    LevelNumber,
    ListGroup,
    SectionHeaderItem,
    TableItem,
    TitleItem,
    TextItem
)
from docling_core.transforms.serializer.common import create_ser_result
from docling_core.transforms.chunker import BaseChunk, BaseChunker, BaseMeta
from chunking.semchunking import SemanticChunker
from langchain_openai import OpenAIEmbeddings
from typing import Any
from langchain_core.embeddings import Embeddings
from langchain_community.utils.math import cosine_similarity
import numpy as np
import os 

class EmbedChunk(DocChunk):
    embedding:Any

class DocSemChunker():
    def __init__(self):
        self.serializer_provider = ChunkingSerializerProvider()
        self.chunker = SemanticChunker(
            OpenAIEmbeddings(api_key=os.getenv("OPENAI_API_KEY")),
            breakpoint_threshold_type="percentile"
        )
    def chunk(self,dl_doc:DoclingDocument,doc_name:str):
        heading_by_level: dict[int, str] = {}  # Changed LevelNumber to int for simplicity
        visited: set[str] = set()
        
        my_doc_ser = self.serializer_provider.get_serializer(doc=dl_doc)
        excluded_refs = my_doc_ser.get_excluded_refs()
        combined_text = ""
        prev_heading = ""
        prev_level = 0
        seen_heading = False
        #Going through each item/level picked up by docling
        for item, level in dl_doc.iterate_items(with_groups=True):
           # print(f"Item:{item}, level:{level}")
            if item.self_ref in excluded_refs: 
                continue 
            #If the current element is a "heading", then we chunk the combined text and yeild the chunked docs
            if isinstance(item, (TitleItem,SectionHeaderItem)): 
                
                level = item.level if isinstance(item, SectionHeaderItem) else 0 
                
                #flushes current blurb if we're not under the same heading anymore->could deal with some refactoring to take in subheadings and such
                if(item.text!=prev_heading): 
                    if(combined_text!=""): 
                        seen_heading = True
                        for document in self.chunker.create_documents([combined_text]): 
                            
                            '''
                            c = EmbedChunk(
                                text=document.page_content,
                                meta=DocMeta(
                                doc_items=[item],
                                headings=[heading_by_level[k] for k in sorted(heading_by_level)]
                                or None,
                                origin=dl_doc.origin,
                                ),
                                embedding = document.metadata["chunk_embedding"] 
                            )
                        '''
                            document.metadata["source"] = doc_name
                            document.metadata["position"] = [heading_by_level[k] for k in sorted(heading_by_level)] or None
                            document.metadata["origin"] = str(dl_doc.origin) 
                            
                            yield document
                    #combined_text is emptied because we are now under empty/new_heading
                    combined_text = ""
                    
                
                heading_by_level[level] = item.text
                prev_heading = item.text 
                prev_level = level
                
                 # remove headings of higher level as they just went out of scope
                keys_to_del = [k for k in heading_by_level if k > level]
                for k in keys_to_del:
                    heading_by_level.pop(k, None)
                
            elif(
                isinstance(item,(ListGroup, InlineGroup, DocItem))
                and item.self_ref not in visited
            ): 
                if(level<prev_level):
                    for document in self.chunker.create_documents([combined_text]): 
                        document.metadata["source"] = doc_name
                        document.metadata["position"] = [heading_by_level[k] for k in sorted(heading_by_level)] or None
                        document.metadata["origin"] = str(dl_doc.origin) 
                        yield document
                    combined_text=""
                ser_res = my_doc_ser.serialize(item=item, visited=visited)
                combined_text+=ser_res.text
            else:   
                print(f"Ingoring:{item}")
                continue
        if(not seen_heading): 
            for document in self.chunker.create_documents([combined_text]): 
                document.metadata["source"] = doc_name
                document.metadata["position"] = [heading_by_level[k] for k in sorted(heading_by_level)] or None
                document.metadata["origin"] = str(dl_doc.origin) 
                yield document
            
if __name__ == "__main__": 
    converter = DocumentConverter()
    doc = converter.convert("./files/ResearchPaperTurnIn.pdf").document 
    chunker = DocSemChunker() 
    chunk_iter = chunker.chunk(dl_doc=doc,doc_name="rpaper")

    embedder = OpenAIEmbeddings(api_key=os.getenv("OPENAI_API_KEY"))

    for i, chunk in enumerate(chunk_iter):
        print(f"=== {i} ===")
        #print(f"chunk.text:\n{f'{chunk.text[:300]}…'!r}")
        #print(f"chunk.text:\n{f'{chunk.text}'}")
        print(f"chunk.embedding:\n{f'{chunk.metadata["chunk_embedding"]}'}")
        embedding = embedder.embed_documents([chunk.page_content])
        embedding = embedding[0]
        embedding = np.array(embedding).reshape(1, -1)
        chunk_embedding = np.array(chunk.metadata["chunk_embedding"]).reshape(1, -1)
        #cosine_similarity(chunk.embedding,embedding)
        similarity = cosine_similarity(chunk_embedding, embedding) 
        print(f"similarity:{f'{similarity[0][0]}'}")
        print(f"shape:{embedding.shape}")
    
        #enriched_text = chunker.contextualize(chunk=chunk)
        #print(f"chunker.contextualize(chunk):\n{f'{enriched_text[:300]}…'!r}")

        print()
    
    