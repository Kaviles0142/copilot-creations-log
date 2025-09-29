import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, File, X, Eye, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface UploadedDocument {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  parsed_content: string | null;
  created_at: string;
}

interface DocumentUploadProps {
  conversationId: string | null;
  onDocumentUploaded: (documents: UploadedDocument[]) => void;
  documents: UploadedDocument[];
}

export default function DocumentUpload({ conversationId, onDocumentUploaded, documents }: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files);
    }
  }, [conversationId]);

  const handleFileUpload = async (files: File[]) => {
    if (!conversationId) {
      toast({
        title: "Error",
        description: "Please start a conversation first",
        variant: "destructive",
      });
      return;
    }

    if (files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const uploadedDocs: UploadedDocument[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(((i + 0.5) / files.length) * 100);

        // Upload to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${conversationId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Parse document content if it's a supported type
        let parsedContent = null;
        if (file.type.includes('text') || file.type.includes('pdf') || file.type.includes('document')) {
          try {
            // For text files, read content directly
            if (file.type.includes('text')) {
              parsedContent = await file.text();
            }
            // For other types, you might want to integrate with document parsing service
          } catch (parseError) {
            console.warn('Could not parse document content:', parseError);
          }
        }

        // Save document metadata to database
        const { data: docData, error: dbError } = await supabase
          .from('documents')
          .insert({
            conversation_id: conversationId,
            filename: file.name,
            file_type: file.type,
            file_size: file.size,
            storage_path: filePath,
            parsed_content: parsedContent
          })
          .select()
          .single();

        if (dbError) throw dbError;

        uploadedDocs.push(docData);
        setUploadProgress(((i + 1) / files.length) * 100);
      }

      onDocumentUploaded([...documents, ...uploadedDocs]);
      
      toast({
        title: "Success",
        description: `${files.length} document(s) uploaded successfully`,
      });

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload documents. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const removeDocument = async (documentId: string) => {
    try {
      const doc = documents.find(d => d.id === documentId);
      if (!doc) return;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([doc.storage_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (dbError) throw dbError;

      onDocumentUploaded(documents.filter(d => d.id !== documentId));
      
      toast({
        title: "Success",
        description: "Document removed",
      });
    } catch (error) {
      console.error('Remove error:', error);
      toast({
        title: "Error",
        description: "Failed to remove document",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('image')) return '🖼️';
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('text')) return '📝';
    if (fileType.includes('document') || fileType.includes('word')) return '📄';
    if (fileType.includes('spreadsheet') || fileType.includes('excel')) return '📊';
    if (fileType.includes('audio')) return '🎵';
    return '📎';
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragging
              ? 'border-primary bg-primary/10'
              : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium mb-1">
            {isDragging ? 'Drop files here' : 'Upload Documents'}
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Drag & drop files or click to browse
          </p>
          <input
            type="file"
            multiple
            className="hidden"
            id="file-upload"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) {
                handleFileUpload(files);
              }
            }}
            accept=".pdf,.doc,.docx,.txt,.md,.jpg,.jpeg,.png,.webp,.mp3,.wav"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => document.getElementById('file-upload')?.click()}
            disabled={uploading || !conversationId}
          >
            <Upload className="h-4 w-4 mr-2" />
            Browse Files
          </Button>
          
          {!conversationId && (
            <div className="flex items-center justify-center mt-2 text-xs text-orange-600">
              <AlertCircle className="h-3 w-3 mr-1" />
              Select a figure first to upload documents
            </div>
          )}
        </div>

        {/* Upload Progress */}
        {uploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Uploading...</span>
              <span>{Math.round(uploadProgress)}%</span>
            </div>
            <Progress value={uploadProgress} className="w-full" />
          </div>
        )}

        {/* Document List */}
        {documents.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center">
              <File className="h-4 w-4 mr-2" />
              Uploaded Documents ({documents.length})
            </h4>
            
            <ScrollArea className="h-32">
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <span className="text-lg">{getFileIcon(doc.file_type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.filename}</p>
                        <div className="flex items-center space-x-2">
                          <Badge variant="secondary" className="text-xs">
                            {formatFileSize(doc.file_size)}
                          </Badge>
                          {doc.parsed_content && (
                            <Badge variant="outline" className="text-xs">
                              <Eye className="h-3 w-3 mr-1" />
                              Analyzed
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDocument(doc.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </Card>
  );
}