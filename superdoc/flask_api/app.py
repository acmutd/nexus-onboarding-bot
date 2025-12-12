from flask import Flask, request, jsonify
from superdoc.superdoc import superdoc
import os
import sys
import tempfile
import traceback

# Add parent directory to path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy"}), 200

@app.route('/merge_pdf', methods=['POST'])
def merge_pdf():
    """
    Merge PDF into the document.
    Expects multipart/form-data with:
    - pdf_file (required): PDF file to merge
    - course_id (required): Course ID (as form field)
    - document_id (optional): Google Docs document ID. If not provided, a new document will be created.
    - index_name (optional): Pinecone index name (defaults to 'sdtest1')
    """
    try:
        # Check if PDF file is present
        if 'pdf_file' not in request.files:
            return jsonify({"error": "pdf_file is required"}), 400
        
        pdf_file = request.files['pdf_file']
        
        if pdf_file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        # Get form data
        course_id = request.form.get('course_id')
        if not course_id:
            return jsonify({"error": "course_id is required"}), 400
        
        document_id = request.form.get('document_id', None)
        index_name = request.form.get('index_name', 'sdtest1')
        
        # Read PDF bytes and save to temporary file
        # DocumentConverter requires a file path, not BytesIO
        pdf_bytes = pdf_file.read()
        temp_file_path = None
        
        try:
            # Create temporary file and write PDF bytes
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
                temp_file.write(pdf_bytes)
                temp_file_path = temp_file.name
            
            # Initialize superdoc instance
            sd = superdoc(DOCUMENT_ID=document_id, COURSE_ID=course_id, index_name=index_name)
            
            # Call merge_pdf method with the temporary file path
            sd.merge_pdf(pdf_path=temp_file_path)
            
            return jsonify({
                "status": "success",
                "message": "PDF merged successfully",
                "document_id": sd.DOCUMENT_ID
            }), 200
            
        finally:
            # Clean up temporary file
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                except Exception:
                    pass
        
    except Exception as e:
        return jsonify({
        "error": str(e),
        "trace": traceback.format_exc()
        }), 500

@app.route('/delete_heading', methods=['DELETE'])
def delete_heading():
    """
    Delete a heading from the document.
    Expects JSON body with:
    - course_id (required): Course ID
    - old_heading (required): Name of the heading to delete
    - document_id (optional): Google Docs document ID. If not provided, a new document will be created.
    - index_name (optional): Pinecone index name (defaults to 'sdtest1')
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "Request body is required"}), 400
        
        if 'course_id' not in data:
            return jsonify({"error": "course_id is required"}), 400
        
        if 'old_heading' not in data:
            return jsonify({"error": "old_heading is required"}), 400
        
        course_id = data['course_id']
        old_heading = data['old_heading']
        document_id = data.get('document_id', None)
        index_name = data.get('index_name', 'sdtest1')
        
        # Initialize superdoc instance
        sd = superdoc(DOCUMENT_ID=document_id, COURSE_ID=course_id, index_name=index_name)
        
        # Call delete_heading method
        sd.delete_heading(old_heading=old_heading)
        
        return jsonify({
            "status": "success",
            "message": f"Heading '{old_heading}' deleted successfully",
            "document_id": sd.DOCUMENT_ID
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/create_heading', methods=['POST'])
def create_heading():
    """
    Create a new heading in the document.
    Expects JSON body with:
    - course_id (required): Course ID
    - new_heading (required): Name of the new heading to create
    - document_id (optional): Google Docs document ID. If not provided, a new document will be created.
    - index_name (optional): Pinecone index name (defaults to 'sdtest1')
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "Request body is required"}), 400
        
        if 'course_id' not in data:
            return jsonify({"error": "course_id is required"}), 400
        
        if 'new_heading' not in data:
            return jsonify({"error": "new_heading is required"}), 400
        
        course_id = data['course_id']
        new_heading = data['new_heading']
        document_id = data.get('document_id', None)
        index_name = data.get('index_name', 'sdtest1')
        
        # Initialize superdoc instance
        sd = superdoc(DOCUMENT_ID=document_id, COURSE_ID=course_id, index_name=index_name)
        
        # Call create_heading method
        sd.create_heading(new_heading=new_heading)
        
        return jsonify({
            "status": "success",
            "message": f"Heading '{new_heading}' created successfully",
            "document_id": sd.DOCUMENT_ID
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/update_heading', methods=['PUT', 'PATCH'])
def update_heading():
    """
    Update a heading in the document.
    Expects JSON body with:
    - course_id (required): Course ID
    - old_heading (required): Current name of the heading
    - new_heading (required): New name for the heading
    - document_id (optional): Google Docs document ID. If not provided, a new document will be created.
    - index_name (optional): Pinecone index name (defaults to 'sdtest1')
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "Request body is required"}), 400
        
        if 'course_id' not in data:
            return jsonify({"error": "course_id is required"}), 400
        
        if 'old_heading' not in data:
            return jsonify({"error": "old_heading is required"}), 400
        
        if 'new_heading' not in data:
            return jsonify({"error": "new_heading is required"}), 400
        
        course_id = data['course_id']
        old_heading = data['old_heading']
        new_heading = data['new_heading']
        document_id = data.get('document_id', None)
        index_name = data.get('index_name', 'sdtest1')
        
        # Initialize superdoc instance
        sd = superdoc(DOCUMENT_ID=document_id, COURSE_ID=course_id, index_name=index_name)
        
        # Call update_heading method
        sd.update_heading(old_heading=old_heading, new_heading=new_heading)
        
        return jsonify({
            "status": "success",
            "message": f"Heading '{old_heading}' updated to '{new_heading}' successfully",
            "document_id": sd.DOCUMENT_ID
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

