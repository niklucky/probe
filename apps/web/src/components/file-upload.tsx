import { useState, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { FileIcon, X, Upload, Image, FileText, Paperclip } from 'lucide-react';

interface FileUploadProps {
  entityType: 'test_case_version' | 'test_result';
  entityId: number;
  onUploadComplete?: () => void;
  existingFiles?: Array<{
    id: number;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
    createdAt: Date | string;
    createdBy: {
      id: number;
      name: string;
    };
  }>;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) {
    return <Image className="h-5 w-5" />;
  } else if (mimeType.includes('pdf')) {
    return <FileText className="h-5 w-5" />;
  } else {
    return <FileIcon className="h-5 w-5" />;
  }
}

export function FileUpload({ entityType, entityId, onUploadComplete, existingFiles = [] }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);

  const utils = trpc.useContext();
  const getUploadUrl = trpc.files.getUploadUrl.useMutation();
  const saveFile = trpc.files.saveFile.useMutation();
  const deleteFile = trpc.files.delete.useMutation({
    onSuccess: () => {
      if (entityType === 'test_case_version') {
        utils.testCases.get.invalidate();
      } else {
        utils.testRuns.getResult.invalidate();
      }
    },
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    handleFiles(files);
  }, []);

  const handleFiles = async (files: File[]) => {
    for (const file of files) {
      await uploadFile(file);
    }
    onUploadComplete?.();
  };

  const uploadFile = async (file: File) => {
    const fileId = `${file.name}-${Date.now()}`;
    setUploadingFiles((prev) => [...prev, fileId]);
    setUploadProgress((prev) => ({ ...prev, [fileId]: 0 }));

    try {
      // Get presigned URL
      const { presignedUrl, objectName, publicUrl } = await getUploadUrl.mutateAsync({
        filename: file.name,
        contentType: file.type,
      });

      // Upload to MinIO
      const xhr = new XMLHttpRequest();
      
      await new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            setUploadProgress((prev) => ({ ...prev, [fileId]: progress }));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
        
        xhr.open('PUT', presignedUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      // Save file metadata
      await saveFile.mutateAsync({
        entityType,
        entityId,
        filename: objectName,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        url: publicUrl,
      });

    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploadingFiles((prev) => prev.filter((id) => id !== fileId));
      setUploadProgress((prev) => {
        const newProgress = { ...prev };
        delete newProgress[fileId];
        return newProgress;
      });
    }
  };

  const handleDelete = async (fileId: number) => {
    await deleteFile.mutateAsync({ id: fileId });
  };

  return (
    <div className="space-y-4">
      {/* Drag and drop area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        }`}
      >
        <input
          type="file"
          multiple
          onChange={handleFileInput}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer flex flex-col items-center gap-2"
        >
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-primary">Click to upload</span> or drag and drop
          </div>
          <div className="text-xs text-muted-foreground">
            Images, documents, and other files
          </div>
        </label>
      </div>

      {/* Uploading files */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((fileId) => (
            <div key={fileId} className="flex items-center gap-3 p-2 bg-muted rounded-lg">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{fileId.split('-')[0]}</div>
                <Progress value={uploadProgress[fileId] || 0} className="h-1" />
              </div>
              <span className="text-xs text-muted-foreground">
                {Math.round(uploadProgress[fileId] || 0)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Existing files */}
      {existingFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Attached Files</h4>
          <div className="space-y-2">
            {existingFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-start gap-3 p-2 bg-muted rounded-lg group"
              >
                {/* Image preview for images */}
                {file.mimeType.startsWith('image/') ? (
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0"
                  >
                    <img
                      src={file.url}
                      alt={file.originalName}
                      className="w-[200px] h-auto max-h-[200px] object-contain rounded-md border hover:opacity-90 transition-opacity"
                    />
                  </a>
                ) : (
                  <div className="shrink-0 p-2 bg-background rounded-md border">
                    {getFileIcon(file.mimeType)}
                  </div>
                )}
                <div className="flex-1 min-w-0 py-1">
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:underline truncate block"
                  >
                    {file.originalName}
                  </a>
                  <div className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)} • {file.createdBy.name}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={() => handleDelete(file.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
