"use client";

import { useState, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Loader2, Image as ImageIcon, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  activityId: Id<"activities">;
  activityTitle: string;
  projectCode: string;
  driveFolderLink?: string;
  images?: Array<{
    url: string;
    driveId?: string;
    caption?: string;
    uploadedAt: number;
  }>;
  onUploadComplete?: () => void;
}

export function ImageUpload({
  activityId,
  activityTitle,
  projectCode,
  driveFolderLink,
  images = [],
  onUploadComplete,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addImage = useMutation(api.images.addImage);
  const removeImage = useMutation(api.images.removeImage);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be less than 10MB");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      // Show preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload to Drive
      const formData = new FormData();
      formData.append("file", file);
      formData.append("activityId", activityId);
      formData.append("activityTitle", activityTitle);
      formData.append("projectCode", projectCode);
      if (driveFolderLink) {
        formData.append("driveFolderLink", driveFolderLink);
      }

      const response = await fetch("/api/upload-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const data = await response.json();

      // Save to Convex
      await addImage({
        activityId,
        url: data.url,
        driveId: data.driveId,
      });

      setPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      onUploadComplete?.();
    } catch (err) {
      console.error("Upload error:", err);
      setError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (imageUrl: string) => {
    if (!confirm("Remove this image?")) return;

    try {
      await removeImage({ activityId, imageUrl });
      onUploadComplete?.();
    } catch (err) {
      console.error("Remove error:", err);
      setError("Failed to remove image");
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Button */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full sm:w-auto"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload Image
            </>
          )}
        </Button>
        <p className="text-xs text-gray-500 mt-1">
          Max 10MB • JPG, PNG, GIF, WebP
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Preview During Upload */}
      {preview && uploading && (
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100">
              <img
                src={preview}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">Uploading to Google Drive...</p>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: "60%" }} />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Image Gallery */}
      {images.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Uploaded Images ({images.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {images.map((image, idx) => (
              <div key={idx} className="group relative">
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                  <img
                    src={image.url}
                    alt={image.caption || `Image ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
                <button
                  onClick={() => handleRemove(image.url)}
                  className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  title="Remove image"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                {image.caption && (
                  <p className="text-xs text-gray-600 mt-1 truncate">
                    {image.caption}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {images.length === 0 && !uploading && (
        <Card className="p-8 text-center border-dashed">
          <ImageIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No images uploaded yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Click "Upload Image" to add photos
          </p>
        </Card>
      )}
    </div>
  );
}
