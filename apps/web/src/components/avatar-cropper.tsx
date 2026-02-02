import { useState, useCallback, useEffect, useMemo } from 'react';
import Cropper from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ZoomIn, ZoomOut, RotateCw, Check, X } from 'lucide-react';
import { getCroppedImg } from '@/lib/crop-image';

interface AvatarCropperProps {
  image: File | string | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (croppedImage: Blob) => void;
  title?: string;
  outputWidth?: number;
  outputHeight?: number;
}

export function AvatarCropper({
  image,
  open,
  onClose,
  onConfirm,
  title = 'Crop Avatar',
  outputWidth = 100,
  outputHeight = 100,
}: AvatarCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Create object URL only once when image changes
  const imageSrc = useMemo(() => {
    if (!image) return '';
    if (typeof image === 'string') return image;
    return URL.createObjectURL(image);
  }, [image]);

  // Clean up object URL when component unmounts or image changes
  useEffect(() => {
    return () => {
      if (imageSrc && typeof image !== 'string') {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [imageSrc, image]);

  const onCropComplete = useCallback((_: any, croppedAreaPixels: any) => {
    console.log('Crop complete, area:', croppedAreaPixels);
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.1, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.1, 1));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleConfirm = async () => {
    console.log('Confirm clicked, image:', !!image, 'croppedAreaPixels:', !!croppedAreaPixels, 'imageSrc:', !!imageSrc);
    
    if (!image || !croppedAreaPixels || !imageSrc) {
      console.error('Missing required data:', { hasImage: !!image, hasCroppedArea: !!croppedAreaPixels, hasImageSrc: !!imageSrc });
      return;
    }
    
    setIsProcessing(true);
    try {
      console.log('Starting crop with:', { imageSrc, croppedAreaPixels, rotation, outputWidth, outputHeight });
      const croppedBlob = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        rotation,
        outputWidth,
        outputHeight
      );
      
      console.log('Crop successful, blob size:', croppedBlob.size, 'type:', croppedBlob.type);
      
      // Create preview
      const preview = URL.createObjectURL(croppedBlob);
      setPreviewUrl(preview);
      
      onConfirm(croppedBlob);
      
      // Reset state
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setPreviewUrl(null);
    } catch (error) {
      console.error('Error cropping image:', error);
      alert('Failed to crop image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setPreviewUrl(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        {imageSrc && (
          <div className="relative w-full h-[300px] bg-muted rounded-lg overflow-hidden">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>
        )}

        {/* Preview */}
        {previewUrl && (
          <div className="flex items-center justify-center gap-4 py-2">
            <div className="text-sm text-muted-foreground">Preview:</div>
            <img 
              src={previewUrl} 
              alt="Cropped preview" 
              className="w-16 h-16 rounded-full object-cover border-2 border-primary"
            />
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 py-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomOut}
            disabled={zoom <= 1}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground w-16 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomIn}
            disabled={zoom >= 3}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-border mx-2" />
          <Button
            variant="outline"
            size="icon"
            onClick={handleRotate}
          >
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!croppedAreaPixels || isProcessing}
          >
            <Check className="mr-2 h-4 w-4" />
            {isProcessing ? 'Processing...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Simple upload wrapper component
interface AvatarUploadProps {
  currentAvatar?: string | null;
  onAvatarChange: (file: File) => void;
}

export function AvatarUpload({ currentAvatar, onAvatarChange }: AvatarUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log('File selected:', file?.name, 'size:', file?.size, 'type:', file?.type);
    if (file) {
      setSelectedFile(file);
      setIsCropperOpen(true);
    }
  };

  const handleCroppedImage = (croppedBlob: Blob) => {
    console.log('Cropped blob received:', croppedBlob.size, 'type:', croppedBlob.type);
    
    if (croppedBlob.size === 0) {
      console.error('Cropped blob is empty!');
      alert('Failed to process image. The cropped image is empty.');
      return;
    }
    
    // Convert blob to file
    const fileName = selectedFile?.name || 'avatar.jpg';
    const file = new File([croppedBlob], fileName, { type: 'image/jpeg' });
    console.log('File created:', file.name, 'size:', file.size, 'type:', file.type);
    
    onAvatarChange(file);
    setIsCropperOpen(false);
    setSelectedFile(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="avatar-upload"
          />
          <label
            htmlFor="avatar-upload"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md cursor-pointer hover:bg-primary/90 transition-colors"
          >
            <ZoomIn className="h-4 w-4" />
            Upload Custom Avatar
          </label>
        </div>
      </div>

      <AvatarCropper
        image={selectedFile}
        open={isCropperOpen}
        onClose={() => {
          setIsCropperOpen(false);
          setSelectedFile(null);
        }}
        onConfirm={handleCroppedImage}
        outputWidth={100}
        outputHeight={100}
      />
    </div>
  );
}
