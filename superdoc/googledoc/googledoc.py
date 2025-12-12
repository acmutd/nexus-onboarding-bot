import os.path
import json
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google.oauth2 import service_account
from vectordb.vector_db_manager import VectorDBManager
from langchain_openai import OpenAIEmbeddings
from pinecone import Pinecone, IndexModel, ServerlessSpec
from itertools import chain


from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build, Resource
from googleapiclient.errors import HttpError
from langchain_core.documents import Document
from chunking.doc_chunking import DocSemChunker
from docling.document_converter import DocumentConverter

# If modifying these SCOPES, delete the file token.json.
SCOPES = ["https://www.googleapis.com/auth/documents","https://www.googleapis.com/auth/drive"] # Use full scope like 'https://www.googleapis.com/auth/documents' for write operations

class GoogleDocsAPI:
    def __init__(self, credentials_file='credentials.json', token_file='token.json'):
        self.credentials_file = credentials_file
        self.token_file = token_file
        (self.doc_service,self.drive_service) = self.authenticate()
    
    def authenticate(self):
        """Authenticate and build the Google Docs service"""
        '''
        # If you have OAuth 2.0 credentials
        creds = None
        # The file token.json stores the user's access and refresh tokens.
        if os.path.exists(self.token_file):
            creds = Credentials.from_authorized_user_file(self.token_file)
        
        # If there are no (valid) credentials available, let the user log in.
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                # You'll need to set up OAuth 2.0 credentials
                # See: https://developers.google.com/docs/api/quickstart/python
                flow = InstalledAppFlow.from_client_secrets_file(
                    self.credentials_file, 
                    ['https://www.googleapis.com/auth/documents']
                )
                creds = flow.run_local_server(port=0)
            
            # Save the credentials for the next run
            with open(self.token_file, 'w') as token:
                token.write(creds.to_json())
        
        return build('docs', 'v1', credentials=creds)
        '''
        try:
            #print(f"OS:{os.getenv("GOOGLE_SERVICE_ACCT")}")
            creds = service_account.Credentials.from_service_account_file(
                os.getenv("GOOGLE_SERVICE_ACCT"), 
                scopes=SCOPES
            )
            return (build('docs', 'v1', credentials=creds),build('drive', 'v3', credentials=creds))
        except Exception as e:
            print(f"Error authenticating with service account: {e}")
            raise
    
class GoogleDriveActivity(GoogleDocsAPI):
    def list_comments_by_author(self, file_id, author_display_name):
        """Lists all comments on a file made by a specific author, based on display name."""
        try:
        # Get all comments for the file
            response = self.drive_service.comments().list(
                fileId=file_id,
                fields="comments(author(displayName),content,createdTime,id)"
            ).execute()

            comments = response.get('comments', [])
        
            # Filter comments by the author's display name
            authors_comments = [
                comment for comment in comments 
                if comment.get('author', {}).get('displayName') == author_display_name
            ]
        
            return authors_comments
        
        except TypeError as error:
            print(f"An API error occurred: {error}")
            return None
    
    
    
class GoogleDocsEditor(GoogleDocsAPI):
    def create_google_doc(self, name:str):
        try:
            # Create the document using the Docs API
            response = self.doc_service.documents().create(body={'title': name}).execute()
            document_id = response.get('documentId')
            print(f'Created Document ID: {document_id}')

            # Set the document to be editable by anyone with the link
            permission_result = self.drive_service.permissions().create(
                fileId=document_id,
                body={
                    'role': 'writer',
                    'type': 'anyone'
                }
            ).execute()
            print("Document sharing permissions updated.")
            print(document_id)

            return response

        except Exception as err:
            print(f'Error creating document: {err}')
            return None
      
    def get_document_structure(self, document_id):
        """Fetch the current document state"""
        try:
            self.document_id = document_id
            self.doc = self.doc_service.documents().get(documentId=document_id).execute()
        except Exception as e:
            print(f"Error fetching document: {e}")
            return None
    
    def text_utf16_len(self,text:str): 
        return len((text).encode("utf-16-le"))//2
        
    def descending_sort_inserttext(self,requests):
        return sorted(requests, 
                 key=lambda x: x.get("insertText", {})
                               .get("location", {})
                               .get("index", 0), 
                 reverse=True) 
            
    def batch_update(self,requests):
        if not requests or len(requests) == 0: 
            return
        try: 
            # Execute the batch update
            result = self.doc_service.documents().batchUpdate(
                #replace with actual document_id 
                documentId=self.document_id,
                body={'requests': requests}
            ).execute()
            
            #print(f"Successfully inserted text at index {insertion_index}")
            return True
            
        except Exception as e:
            print(f"Error inserting text: {e}")
            return False
    
    
  
    def find_named_range(self,heading:str)->dict|None:
        document = self.doc
        named_ranges = document.get("namedRanges",{})
        for range_name in named_ranges.keys():
            #print(f'-{range_name}')
            if range_name==heading: 
                return named_ranges[heading] 
        return None
    def create_heading(self,new_heading:str): 
        (_,startIndex,_) = self.find_insertion_point()
        named_range = self.find_named_range(heading=new_heading)
        if named_range: 
            raise Exception(f"Heading: {new_heading} already exists")
        
        newHeadingLen = len((new_heading).encode("utf-16-le"))//2
        endIndex = startIndex+newHeadingLen
        requests = [
        {
            'insertText': {
                'location': {
                    'index': startIndex
                },
                'text': new_heading
            }
        },
        # Create a new named range for the updated heading
        {
            'createNamedRange': {
                'name': new_heading,
                'range': {
                    'startIndex': startIndex,
                    'endIndex': endIndex
                }
            }
        }
    ]
        self.batch_update(requests=requests)
        
        
    def delete_heading(self,old_heading:str): 
        named_range = self.find_named_range(heading=old_heading)
        if not named_range: 
            raise Exception(f"Heading: {old_heading} does not exist")
        print(named_range)
        startIndex = named_range['namedRanges'][0]['ranges'][0]['startIndex']
        endIndex = named_range['namedRanges'][0]['ranges'][0]['endIndex']
        oldHeadingLen = len((old_heading).encode("utf-16-le"))//2
        requests = [
        # Delete the old heading text from the document
        {
            'deleteContentRange': {
                'range': {
                    'startIndex': startIndex,
                    'endIndex': startIndex + oldHeadingLen
                }
            }
        },
        # Remove the old named range
        {
            'deleteNamedRange': {
                'name': old_heading
            }
        },
    ]
        self.batch_update(requests=requests)
    def update_heading(self,old_heading:str,new_heading:str): 
        named_range = self.find_named_range(heading=old_heading)
        if not named_range: 
            raise Exception(f"Heading: {old_heading} does not exist")
        print(named_range)
        startIndex = named_range['namedRanges'][0]['ranges'][0]['startIndex']
        endIndex = named_range['namedRanges'][0]['ranges'][0]['endIndex']
        oldHeadingLen = len((old_heading).encode("utf-16-le"))//2
        newHeadingLen = len((new_heading).encode("utf-16-le"))//2
        requests = [
        # Delete the old heading text from the document
        {
            'deleteContentRange': {
                'range': {
                    'startIndex': startIndex,
                    'endIndex': startIndex + oldHeadingLen
                }
            }
        },
        # Insert the new heading text at the same position
        {
            'insertText': {
                'location': {
                    'index': startIndex
                },
                'text': new_heading
            }
        },
        # Remove the old named range
        {
            'deleteNamedRange': {
                'name': old_heading
            }
        },
        # Create a new named range for the updated heading
        {
            'createNamedRange': {
                'name': new_heading,
                'range': {
                    'startIndex': startIndex,
                    'endIndex': endIndex-1+(newHeadingLen-oldHeadingLen)
                }
            }
        },
    ]
        self.batch_update(requests=requests)
        #print(f"Named Range: {named_range}")
        
            
    def find_insertion_point(self, target_heading=None):
        """Locate the insertion point in the document"""
        document = self.doc
        body = document.get('body', {})
        content = body.get('content', [])
        named_ranges = document.get("namedRanges",{})
        for range_name in named_ranges.keys():
            print(f"- {range_name}")
        #print(f"Body:{body}")
        # If no target heading specified, append to the very end
        if not (target_heading):
            print(f"Printing to {content[-1].get('endIndex') - 1}")
            return (content[-1].get('endIndex'),content[-1].get('endIndex') - 1, -2)  # Adjust for 0-based indexing
        #If the heading is non-null, and is new(doesn't exist in document)
        try: 
            named_ranges[target_heading]
        except KeyError as e: 
            return (content[-1].get('endIndex'),content[-1].get('endIndex') - 1, -1)

        # Search for the specific heading
        named_range_data = named_ranges[target_heading]
        for range_group in named_range_data["namedRanges"]:
            for range_info in range_group["ranges"]:
                return (range_info["startIndex"],range_info["endIndex"],0)
            
        # If heading not found, append to end
        print(f"Heading '{target_heading}' not found. Appending to end.")
        print(f"Printing to {content[-1].get('endIndex') - 1}")
        return (content[-1].get('endIndex'),content[-1].get('endIndex') - 1,-1)

    #Before modifying the google doc, we run a quick check on all of the 
    def mutate_named_ranges(self,document_id:str):
        document = self.doc
        named_ranges = document.get("namedRanges",{})
        sorted_items = sorted(named_ranges.items(),key=lambda item: item[1].get("namedRanges", [{}])[0]
                               .get("ranges", [{}])[0]
                               .get("endIndex", 0)) 
        print(sorted_items)
        requests= []
        for i in range(1,len(sorted_items)):
            prev_ranges = sorted_items[i-1][1]\
                        .get("namedRanges",[{}])[0]\
                        .get("ranges",[{}])[0]
            curr_ranges = sorted_items[i][1]\
                        .get("namedRanges",[{}])[0]\
                        .get("ranges",[{}])[0]
            prevEndIdx = prev_ranges.get("endIndex",0)
            currStartIdx = curr_ranges.get("startIndex",0)
            #heading = sorted_items[i][0]
            diff = currStartIdx - prevEndIdx
            print(diff)
            if((diff)>self.text_utf16_len('\n')): 
                print("hit")
                requests.append(
                    {
                        'deleteNamedRange': {
                            'name': sorted_items[i-1][0]#prev_heading
                        }
                    }
                    )
                requests.append(# Create a new named range for the updated heading
                    {
                        'createNamedRange': {
                            'name': sorted_items[i-1][0],
                            'range': {
                                'startIndex': prev_ranges.get("startIndex",0),
                                'endIndex': prevEndIdx-1+(diff)
                            }
                        }
                    }
                )
        #print(requests,self.text_utf16_len('\n'))
        self.batch_update(requests=requests) 
        self.get_document_structure(document_id=document_id) 
        #named_ranges = document.get("namedRanges",{})
              
            
            
    #Ideally, force each of those documents to go through a quick query and search,
    #if the headings are well comparable, change the headings the document contains to
    #frick, have to order documents by the heading/endIndex position(in reverse), then append it to requests,
    #in order to not track and worry about index_math
    #Too many API calls, we are making a batch update for every-chunk, 
    #make some local-caching system or figure out how to print the superdoc in reverse so that
    #we don't have to call the api like 20 times    
        
    def insert_text(self, document_id:str,chunk_docs:list[Document]):
        """Insert text at the specified location"""
        #Fetch current document state
        print("Attempting to insert")
        requests =[]
        document = self.doc
        if not document:
            return False
        
        heading_requests = []
        headings_processed= []
        heading_insertion_index = -1
        print(f"Length of doc:{len(chunk_docs)}")
        for chunk in chunk_docs:
            print(f"Chunk:{chunk}")
            heading = chunk.metadata.get('position',None)
            heading = heading[-1]
            #If heading doesnt exist, generate a heading using openai
            if(not heading): 
                print(f"No Heading found:\n{chunk}")
                heading = "Basic"
                chunk.metadata['position'] = heading
            (_,insertion_index,code) = self.find_insertion_point(heading)
            #Ignores null and already existing headings
            heading_insertion_index = insertion_index
            if(code!=-1 or heading in headings_processed):
                continue
            #basically gets the end of the document
            startIndex = heading_insertion_index 
            endIndex = startIndex+len((heading+"\n").encode("utf-16-le"))//2
            print(f"Messing with heading:{heading}")
            heading_requests.append({
                'insertText': {
                    'location': {
                        'index': startIndex
                    },
                    'text': (heading + '\n\n')  # Add newline to form proper paragraph
                }
            })
            heading_requests.append({
                'createNamedRange': {
                    'name': heading,
                    'range': {
                        'startIndex': startIndex,
                        'endIndex': endIndex-1
                        }
                }
            })
            heading_insertion_index=endIndex
            headings_processed.append(heading)
        #pre-create all neccessary heading
        self.batch_update(heading_requests)
        self.get_document_structure(document_id=document_id)
        
        delete_range_requests = []
        text_requests = []
        create_range_requests = []
        
        range_dict = {}
        #Start appending documents and objects now that every document is supposed to have a heading
        chunk_docs = chunk_docs[::-1]
        for chunk in chunk_docs:
            #Locate insertion point
            heading = chunk.metadata.get('position',None)
            heading = heading[-1] if (heading) else None
            #Need startIndex to make a new namedRange
            (namedRangeStart,namedRangeEnd,code) = (0,0,-1)
            if heading in range_dict: 
                namedRangeStart = range_dict[heading][-1]['createNamedRange']['range']['startIndex']
                namedRangeEnd = range_dict[heading][-1]['createNamedRange']['range']['endIndex']+1
                code = 0
            else:
                (namedRangeStart,namedRangeEnd,code) = self.find_insertion_point(target_heading=heading)    
                if code !=0: 
                    raise Exception(f"Unfound Heading: {heading}, code:{code}")
            
            #We want to insert text to the end of our namedRange(i.e after our heading-paragraph combo)
            insertion_index = namedRangeEnd
            #First lets delete the paragraphBullets(google docs is gae and won't lemme update a namedRange)
            para_bulletin = chunk.page_content+'\n'
            startIndex = insertion_index
            endIndex = insertion_index+len((para_bulletin).encode("utf-16-le"))//2
            text_requests.append(
                {
                    'insertText': {
                        'location': {
                            'index':  namedRangeStart+len((heading+":").encode("utf-16-le"))//2 #startIndex
                        },
                        'text': para_bulletin  # Add newline to form proper paragraph
                    }
                })
            print(f"Named Range End:{namedRangeEnd}")
            range_dict[heading] = [{
                    'deleteNamedRange': {
                        'name': heading
                    }
                },
                {
                    'createParagraphBullets': {
                        'range': {
                            #Using namedRangeStart because if there was a heading, then we want to re-up the original start of the paragraph
                            'startIndex': namedRangeStart+len((heading+":").encode("utf-16-le"))//2,
                            'endIndex': endIndex-1
                        },
                        'bulletPreset': 'BULLET_DISC_CIRCLE_SQUARE',
                    }
                },                   
                {
                    'createNamedRange': {
                        'name': heading,
                        'range': {
                            'startIndex': namedRangeStart,
                            'endIndex': endIndex-1
                            }
                    }   
                }]
    
        text_requests = self.descending_sort_inserttext(text_requests)
        #self.batch_update(requests=delete_range_requests)
        self.batch_update(requests=text_requests)
        self.get_document_structure(document_id=document_id)
        
        for heading in range_dict: 
            (namedRangeStart,_,code) = self.find_insertion_point(target_heading=heading)    
            if code !=0: 
                raise Exception(f"Unfound Heading: {heading}, code:{code}")
            prevStart = range_dict[heading][-1]['createNamedRange']['range']['startIndex']
            prevEnd = range_dict[heading][-1]['createNamedRange']['range']['endIndex']+1 
            endIndex = namedRangeStart+(prevEnd-prevStart)
            print(f"{heading}:{endIndex}-{namedRangeStart}")
            range_dict[heading] = [{
                    'deleteNamedRange': {
                        'name': heading
                    }
                },
                {
                    
                    'deleteParagraphBullets': {
                        'range': {
                                'startIndex': namedRangeStart,
                                'endIndex':  endIndex-1
                            },
                        }
       
                },
                {
                    'createParagraphBullets': {
                        'range': {
                            #Using namedRangeStart because if there was a heading, then we want to re-up the original start of the paragraph
                            'startIndex': namedRangeStart+len((heading+":").encode("utf-16-le"))//2,
                            'endIndex': endIndex-1
                        },
                        'bulletPreset': 'BULLET_DISC_CIRCLE_SQUARE',
                    }
                },                   
                {
                    'createNamedRange': {
                        'name': heading,
                        'range': {
                            'startIndex': namedRangeStart,
                            'endIndex': endIndex-1
                            }
                    }   
                }]    
        range_req = list(chain(*range_dict.values()))
        #print(f"Range_REQ:{range_req}")
        self.batch_update(requests=range_req)
        #self.batch_update(requests=create_range_requests)
        
def insert_text_ex(): 
     # Initialize the editorpinecone_api_key = os.environ.get("PINECONE_API_KEY")
    pinecone_api_key = os.environ.get("PINECONE_API_KEY")
    print(f"Start of VectorDBManager init")
    db = VectorDBManager(pc=Pinecone(pinecone_api_key))
    db.initVectorStore(index_name="sdtest1", embedding=OpenAIEmbeddings(api_key=os.getenv("OPENAI_API_KEY")))
    print(f"Start of pdf conversion")
    docs_editor = GoogleDocsEditor()
    drive_activity = GoogleDriveActivity()
    
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
       
    
    
    
def main():
    # Initialize the editorpinecone_api_key = os.environ.get("PINECONE_API_KEY")
    #drive_activity = GoogleDriveActivity()
    #insert_text_ex()
    DOCUMENT_ID = '1zjQClSEUE587kPrupY5fplFtUcB3OGEj5mKhplmiFxM'
    docs_editor = GoogleDocsEditor()
    docs_editor.get_document_structure(document_id=DOCUMENT_ID)
    #docs_editor.update_heading(old_heading="Introduction",new_heading="Goofy Goober")
    #print(docs_editor.find_named_range(heading="Introduction"))
    docs_editor.mutate_named_ranges(document_id=DOCUMENT_ID)
    
    # print(f"Doc structure:{docs_editor.doc}")
    #print(docs_editor.find_insertion_point("stuff"))
    #print("Appending to end of document...")
    #docs_editor.insert_text(document_id=DOCUMENT_ID, chunk_docs=chunk_iter)
    #AUTHOR_DISPLAY_NAME = "Indrajith Thyagaraja"
    #comments = drive_activity.list_comments_by_author(file_id=DOCUMENT_ID,author_display_name=AUTHOR_DISPLAY_NAME)
    #print(f"Comments: {comments}")
    
if __name__ == "__main__":
    main()