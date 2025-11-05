"use client";

import { useState } from "react";
import { X, Upload, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabaseBrowser } from "@/lib/supabase";
import { toast } from "sonner";

interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  category: string;
  image_url?: string | null;
  is_available: boolean;
}

interface EditItemModalProps {
  item: MenuItem | null;
  venueId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditItemModal({ item, venueId, open, onClose, onSuccess }: EditItemModalProps) {
  const [formData, setFormData] = useState<Partial<MenuItem>>({
    name: "",
    description: "",
    price: 0,
    category: "",
    image_url: "",
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Update form data when item changes
  useState(() => {
    if (item) {
      setFormData({
        name: item.name,
        description: item.description || "",
        price: item.price,
        category: item.category,
        image_url: item.image_url || "",
      });
      setImagePreview(item.image_url || null);
      setImageFile(null);
    }
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setImageFile(file);
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;

    setUploading(true);
    try {
      const supabase = supabaseBrowser();

      // Ensure bucket exists (idempotent)
      try {
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = buckets?.some((b) => b.name === "menu-images");

        if (!bucketExists) {
          await supabase.storage.createBucket("menu-images", {
            public: true,
            allowedMimeTypes: ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"],
            fileSizeLimit: 5242880, // 5MB
          });
        }
      } catch (bucketError) {
        // Bucket might already exist or creation failed - continue anyway
        console.error("Bucket check/create error:", bucketError);
      }

      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${venueId}/${item?.id || Date.now()}-${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from("menu-images")
        .upload(fileName, imageFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("menu-images").getPublicUrl(data.path);

      return publicUrl;
    } catch (error) {
      console.error("Image upload error:", error);
      toast.error("Failed to upload image");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!item) return;

    setSaving(true);
    try {
      const supabase = supabaseBrowser();

      // Upload new image if selected
      let imageUrl = formData.image_url;
      if (imageFile) {
        const uploadedUrl = await uploadImage();
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        } else {
          setSaving(false);
          return; // Stop if image upload failed
        }
      }

      // Update menu item
      const { error } = await supabase
        .from("menu_items")
        .update({
          name: formData.name,
          description: formData.description,
          price: formData.price,
          category: formData.category,
          image_url: imageUrl,
        })
        .eq("id", item.id)
        .eq("venue_id", venueId);

      if (error) {
        throw error;
      }

      toast.success("Item updated successfully");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to update item");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setFormData({ ...formData, image_url: "" });
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Menu Item</DialogTitle>
          <DialogDescription>Update item details and image</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Image Section */}
          <div className="space-y-2">
            <Label>Item Image</Label>
            {imagePreview ? (
              <div className="relative w-full aspect-video bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={imagePreview}
                  alt={formData.name}
                  className="w-full h-full object-contain"
                />
                <button
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="w-full aspect-video bg-gray-100 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-gray-300">
                <ImageIcon className="h-12 w-12 text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">No image uploaded</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById("image-upload")?.click()}
                disabled={uploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                {imageFile ? "Change Image" : "Upload Image"}
              </Button>
              <input
                id="image-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
            </div>
            <p className="text-xs text-gray-500">Recommended: JPG, PNG, or WEBP. Max 5MB.</p>
          </div>

          {/* Item Details */}
          <div className="space-y-2">
            <Label htmlFor="name">Item Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Avocado Toast"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the item"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price (£)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g., Breakfast"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving || uploading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || uploading}>
            {saving || uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {uploading ? "Uploading..." : "Saving..."}
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
