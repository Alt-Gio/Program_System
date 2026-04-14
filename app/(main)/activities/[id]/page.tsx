"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ExternalLink, Trash2, MapPin, Calendar, Users, Upload, X, Image as ImageIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatDate, getStatusColor, numberWithCommas, calcTotal, calcMale, calcFemale } from "@/lib/utils";
import { DICT_PROJECTS } from "@/lib/types";
import { toast } from "sonner";
import { useState } from "react";

export default function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const activity = useQuery(api.activities.getActivity, { id: id as any });
  const images = useQuery(api.activityImages.getActivityImages, { activityId: id as any });
  const deleteActivity = useMutation(api.activities.deleteActivity);
  const updateStatus = useMutation(api.activities.updateActivityStatus);
  const addImage = useMutation(api.activityImages.addImage);
  const removeImage = useMutation(api.activityImages.removeImage);
  const updateCaption = useMutation(api.activityImages.updateImageCaption);
  
  const [uploading, setUploading] = useState(false);
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [captionText, setCaptionText] = useState("");

  if (activity === undefined) return <ActivitySkeleton />;
  if (activity === null) return (
    <div className="text-center py-20">
      <p className="text-gray-500">Activity not found.</p>
      <Link href="/activities"><Button variant="outline" className="mt-4">Back</Button></Link>
    </div>
  );

  const def = DICT_PROJECTS.find(p => p.code === activity.project?.code);
  const total = calcTotal(activity.participants);
  const male = calcMale(activity.participants);
  const female = calcFemale(activity.participants);
  const extraFields = activity.extraFields ? JSON.parse(activity.extraFields) : {};

  const statusFlow = ["Draft", "Submitted", "Validated", "Reported"];
  const currentIdx = statusFlow.indexOf(activity.status);
  const nextStatus = statusFlow[currentIdx + 1];

  async function handleDelete() {
    if (!confirm("Delete this activity permanently?")) return;
    await deleteActivity({ id: activity._id });
    toast.success("Activity deleted.");
    router.push("/activities");
  }

  async function handleAdvanceStatus() {
    if (!nextStatus) return;
    await updateStatus({ id: activity._id, status: nextStatus, updatedBy: "system" });
    toast.success(`Status updated to ${nextStatus}`);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('activityId', activity._id);
      formData.append('activityTitle', activity.activityTitle);
      formData.append('projectCode', activity.project?.code || 'MASTER');
      if (activity.driveFolderLink) {
        formData.append('driveFolderLink', activity.driveFolderLink);
      }

      // Try Drive upload first
      let response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      // If Drive upload fails, fall back to simple base64 upload
      if (!response.ok) {
        console.warn('Drive upload failed, using fallback method');
        const simpleFormData = new FormData();
        simpleFormData.append('file', file);
        response = await fetch('/api/upload-image-simple', {
          method: 'POST',
          body: simpleFormData,
        });
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await response.json();
      
      await addImage({
        activityId: activity._id,
        url: data.url,
        driveId: data.driveId || undefined,
      });

      // Sync images back to Google Sheets
      try {
        const allImages = [...(images || []), { url: data.url, driveId: data.driveId, uploadedAt: Date.now() }];
        await fetch('/api/sync-images-to-sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sheetId: '1Y795p_gYzoLz-oOjf4ZGD_SgJEzXJhvFfiU_iJkUqUw', // Your master sheet ID
            activityTitle: activity.activityTitle,
            startDate: activity.startDate,
            images: allImages,
          }),
        });
      } catch (syncError) {
        console.warn('Failed to sync to Sheets:', syncError);
        // Don't fail the upload if Sheets sync fails
      }

      toast.success('Image uploaded successfully!');
      e.target.value = '';
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveImage(imageUrl: string) {
    if (!confirm('Remove this image?')) return;
    try {
      await removeImage({ activityId: activity._id, imageUrl });
      
      // Sync to Google Sheets
      try {
        const remainingImages = (images || []).filter(img => img.url !== imageUrl);
        await fetch('/api/sync-images-to-sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sheetId: '1Y795p_gYzoLz-oOjf4ZGD_SgJEzXJhvFfiU_iJkUqUw',
            activityTitle: activity.activityTitle,
            startDate: activity.startDate,
            images: remainingImages,
          }),
        });
      } catch (syncError) {
        console.warn('Failed to sync to Sheets:', syncError);
      }
      
      toast.success('Image removed');
    } catch (error) {
      toast.error('Failed to remove image');
    }
  }

  async function handleUpdateCaption(imageUrl: string) {
    try {
      await updateCaption({ activityId: activity._id, imageUrl, caption: captionText });
      setEditingCaption(null);
      setCaptionText('');
      toast.success('Caption updated');
    } catch (error) {
      toast.error('Failed to update caption');
    }
  }

  const projectLogo = def?.code ? `/logo/${def.code.toLowerCase() === 'egov' ? 'egov_ph' : def.code.toLowerCase() === 'wifi' ? 'freewifi' : def.code.toLowerCase() === 'cyber' ? 'cybersecurity' : def.code.toLowerCase() === 'ilcdb' || def.code.toLowerCase() === 'iidb' ? 'iidb' : def.code.toLowerCase()}_logo.png` : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/activities">
            <Button variant="ghost" size="icon" className="rounded-full"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          {projectLogo && (
            <div className="w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center shrink-0" style={{ backgroundColor: `${def?.color}10` }}>
              <Image src={projectLogo} alt={def?.shortName || ''} width={36} height={36} className="object-contain" />
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold text-gray-900">{activity.activityTitle}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{def?.shortName ?? activity.project?.shortName ?? "—"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn("text-sm px-3 py-1 rounded-full font-medium border", getStatusColor(activity.status))}>
            {activity.status}
          </span>
          {nextStatus && (
            <Button size="sm" variant="outline" onClick={handleAdvanceStatus}>Mark {nextStatus}</Button>
          )}
          <Button size="icon" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={handleDelete}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Image Gallery */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Activity Photos ({images?.length || 0})
            </CardTitle>
            <label htmlFor="image-upload">
              <Button size="sm" disabled={uploading} asChild>
                <span className="cursor-pointer">
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Upload Photo'}
                </span>
              </Button>
            </label>
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
              disabled={uploading}
            />
          </div>
        </CardHeader>
        <CardContent>
          {!images || images.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No photos yet. Upload images to showcase this activity.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {images.map((image, idx) => (
                <div key={idx} className="group relative aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                  <Image
                    src={image.url}
                    alt={image.caption || `Activity photo ${idx + 1}`}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all">
                    <button
                      onClick={() => handleRemoveImage(image.url)}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {editingCaption === image.url ? (
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-white border-t">
                      <Textarea
                        value={captionText}
                        onChange={(e) => setCaptionText(e.target.value)}
                        placeholder="Add caption..."
                        className="text-xs mb-2 min-h-[60px]"
                      />
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => handleUpdateCaption(image.url)} className="flex-1 h-7 text-xs">
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingCaption(null)} className="flex-1 h-7 text-xs">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : image.caption ? (
                    <div
                      onClick={() => {
                        setEditingCaption(image.url);
                        setCaptionText(image.caption || '');
                      }}
                      className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent cursor-pointer"
                    >
                      <p className="text-xs text-white line-clamp-2">{image.caption}</p>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingCaption(image.url);
                        setCaptionText('');
                      }}
                      className="absolute bottom-2 left-2 right-2 text-xs text-white/80 hover:text-white bg-black/30 hover:bg-black/50 py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      + Add caption
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Activity Information</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                { label: "Province", value: activity.province?.name ?? "—", icon: <MapPin className="w-4 h-4" /> },
                { label: "LGU", value: activity.lgu?.name ?? "—" },
                { label: "Venue", value: activity.venue },
                { label: "Start Date", value: formatDate(activity.startDate), icon: <Calendar className="w-4 h-4" /> },
                { label: "End Date", value: formatDate(activity.endDate) },
                { label: "Mode of Conduct", value: activity.modeOfConduct },
                { label: "Partners", value: activity.partnerOrganizations?.join(", ") || "—" },
                { label: "DICT Personnel", value: activity.personnelRaw || "—" },
                { label: "Remarks", value: activity.remarks || "—" },
              ].map(row => (
                <div key={row.label} className="flex items-start gap-2">
                  {row.icon && <span className="text-gray-400 mt-0.5 shrink-0">{row.icon}</span>}
                  <span className="text-gray-500 shrink-0 min-w-[130px]">{row.label}</span>
                  <span className="text-gray-900 break-words">{row.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Participant Breakdown</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-gray-500 font-medium">Sector</th>
                    <th className="text-center py-2 text-blue-600 font-medium">Male</th>
                    <th className="text-center py-2 text-pink-500 font-medium">Female</th>
                    <th className="text-center py-2 text-gray-700 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    { sector: "NGA", m: activity.participants.nga.male, f: activity.participants.nga.female },
                    { sector: "LGU", m: activity.participants.lgu.male, f: activity.participants.lgu.female },
                    { sector: "SUC", m: activity.participants.suc.male, f: activity.participants.suc.female },
                    { sector: activity.participants.others.label ?? "Others", m: activity.participants.others.male, f: activity.participants.others.female },
                  ].map(row => (
                    <tr key={row.sector}>
                      <td className="py-2 text-gray-700">{row.sector}</td>
                      <td className="py-2 text-center text-blue-600">{numberWithCommas(row.m)}</td>
                      <td className="py-2 text-center text-pink-500">{numberWithCommas(row.f)}</td>
                      <td className="py-2 text-center font-medium">{numberWithCommas(row.m + row.f)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-gray-50">
                    <td className="py-2 font-semibold">TOTAL</td>
                    <td className="py-2 text-center font-bold text-blue-600">{numberWithCommas(male)}</td>
                    <td className="py-2 text-center font-bold text-pink-500">{numberWithCommas(female)}</td>
                    <td className="py-2 text-center font-bold">{numberWithCommas(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>

          {def && Object.keys(extraFields).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">{def.shortName} – Program Data</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {def.extraFieldSchema.map(f => {
                  const val = extraFields[f.key];
                  if (!val && val !== 0) return null;
                  return (
                    <div key={f.key} className="flex gap-2">
                      <span className="text-gray-500 min-w-[180px]">{f.label}</span>
                      <span className="text-gray-900">{String(val)}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="text-center py-2">
                <p className="text-3xl font-bold text-gray-900">{numberWithCommas(total)}</p>
                <p className="text-xs text-gray-500 mt-1">Total Participants</p>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Male</span>
                <span className="font-medium text-blue-600">{numberWithCommas(male)} ({total > 0 ? Math.round(male/total*100) : 0}%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Female</span>
                <span className="font-medium text-pink-500">{numberWithCommas(female)} ({total > 0 ? Math.round(female/total*100) : 0}%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Period</span>
                <span className="font-medium">{activity.month}/{activity.year}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Documentation Links</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: "After Activity Report", url: activity.afterActivityReport },
                { label: "FB Posting", url: activity.fbPostingLink },
                { label: "Raw Photos", url: activity.rawPhotosLink },
                { label: "Testimonials", url: activity.testimonialsLink },
              ].filter(l => l.url).map(link => (
                <a key={link.label} href={link.url!} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  {link.label}
                </a>
              ))}
              {!activity.afterActivityReport && !activity.fbPostingLink && !activity.rawPhotosLink && !activity.testimonialsLink && (
                <p className="text-xs text-gray-400">No links added.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Skeleton className="h-12 w-full" />
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  );
}
