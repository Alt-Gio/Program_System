"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Save, Plus, Trash2, GripVertical, Eye, EyeOff, 
  Users, MapPin, Tag, Download, Server, Code, Wifi,
  CheckCircle2, AlertCircle
} from "lucide-react";
import { DICT_PROJECTS } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, any> = {
  Users, MapPin, Tag, Download, Server, Code, Wifi, CheckCircle2, AlertCircle
};

export default function HighlightFieldsSettings() {
  const [selectedProject, setSelectedProject] = useState("EGOV");
  const [fields, setFields] = useState<any[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const availableFields = useQuery(api.highlightFields.getAvailableFields, { projectCode: selectedProject });
  const savedConfig = useQuery(api.highlightFields.getProjectHighlightFields, { projectCode: selectedProject });
  const saveConfig = useMutation(api.highlightFields.saveHighlightFields);

  const projectDef = DICT_PROJECTS.find(p => p.code === selectedProject);

  // Initialize fields when config loads
  useState(() => {
    if (savedConfig && !hasChanges) {
      setFields(savedConfig.fields);
    } else if (availableFields && fields.length === 0) {
      // Initialize with available fields, first 2 enabled
      setFields(availableFields.map((f, idx) => ({
        ...f,
        enabled: idx < 2,
        order: idx,
        icon: f.source === "computed" && f.key === "participants" ? "Users" : 
              f.source === "activity" && f.key === "venue" ? "MapPin" : "Tag"
      })));
    }
  });

  const handleAddField = () => {
    const newField = {
      key: "",
      label: "",
      source: "extraFields",
      format: "text",
      enabled: false,
      order: fields.length,
      icon: "Tag"
    };
    setFields([...fields, newField]);
    setHasChanges(true);
  };

  const handleRemoveField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleFieldChange = (index: number, key: string, value: any) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], [key]: value };
    setFields(updated);
    setHasChanges(true);
  };

  const handleToggleField = (index: number) => {
    const updated = [...fields];
    updated[index].enabled = !updated[index].enabled;
    setFields(updated);
    setHasChanges(true);
  };

  const handleMoveField = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === fields.length - 1) return;

    const updated = [...fields];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
    updated.forEach((f, i) => f.order = i);
    setFields(updated);
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await saveConfig({
        projectCode: selectedProject,
        fields: fields,
        updatedBy: "admin" // TODO: Get from auth
      });
      toast.success("Highlight fields saved successfully!");
      setHasChanges(false);
    } catch (error) {
      toast.error("Failed to save highlight fields");
      console.error(error);
    }
  };

  const handleProjectChange = (code: string) => {
    if (hasChanges) {
      if (!confirm("You have unsaved changes. Switch project anyway?")) return;
    }
    setSelectedProject(code);
    setFields([]);
    setHasChanges(false);
  };

  const enabledFields = fields.filter(f => f.enabled);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Highlight Fields Configuration</h1>
        <p className="text-sm text-gray-500 mt-1">
          Customize which data fields are prominently displayed for each program in the activities list
        </p>
      </div>

      {/* Project Selector */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label>Select Program</Label>
              <Select value={selectedProject} onValueChange={handleProjectChange}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DICT_PROJECTS.map(p => (
                    <SelectItem key={p.code} value={p.code}>
                      {p.shortName} - {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={handleSave} 
                disabled={!hasChanges}
                className="gap-2"
                style={{ backgroundColor: projectDef?.color }}
              >
                <Save className="w-4 h-4" />
                Save Changes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="border-l-4" style={{ borderLeftColor: projectDef?.color }}>
        <CardHeader>
          <CardTitle className="text-sm">Preview</CardTitle>
          <CardDescription>How highlight fields will appear in activities list</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
                <span className="text-xs text-gray-400">Photo</span>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center border-2" 
                style={{ backgroundColor: `${projectDef?.color}10`, borderColor: `${projectDef?.color}30` }}>
                <span className="text-xs font-bold">{projectDef?.shortName}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">Sample Activity Title</p>
                <p className="text-xs text-gray-500 mt-0.5">{projectDef?.shortName}</p>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                  <span>📍 Camarines Sur</span>
                  <span>📅 Oct 10, 2025</span>
                  <span>👥 52 pax</span>
                </div>
                {enabledFields.length > 0 && (
                  <div className="flex flex-wrap items-center gap-3 mt-2 pt-2 border-t border-gray-200">
                    {enabledFields.slice(0, 2).map((field, idx) => {
                      const Icon = ICON_MAP[field.icon || "Tag"];
                      return (
                        <span 
                          key={idx} 
                          className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md" 
                          style={{ backgroundColor: `${projectDef?.color}10`, color: projectDef?.color }}
                        >
                          {Icon && <Icon className="w-3 h-3" />}
                          <span className="opacity-70">{field.label}:</span>
                          <span className="font-semibold">
                            {field.format === "number" ? "1,234" : "Sample Value"}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Field Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Configure Highlight Fields</CardTitle>
              <CardDescription>
                Drag to reorder • Toggle to enable/disable • First 2 enabled fields will be shown
              </CardDescription>
            </div>
            <Button onClick={handleAddField} variant="outline" size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Add Custom Field
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {fields.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">No fields configured yet. Add fields to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {fields.map((field, index) => {
                const Icon = ICON_MAP[field.icon || "Tag"];
                return (
                  <div
                    key={index}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-lg border-2 transition-all",
                      field.enabled 
                        ? "bg-white border-blue-200 shadow-sm" 
                        : "bg-gray-50 border-gray-200 opacity-60"
                    )}
                  >
                    {/* Drag Handle */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleMoveField(index, "up")}
                        disabled={index === 0}
                        className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
                      >
                        <GripVertical className="w-4 h-4 text-gray-400" />
                      </button>
                      <button
                        onClick={() => handleMoveField(index, "down")}
                        disabled={index === fields.length - 1}
                        className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
                      >
                        <GripVertical className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>

                    {/* Enable Toggle */}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={field.enabled}
                        onCheckedChange={() => handleToggleField(index)}
                      />
                      {field.enabled ? (
                        <Eye className="w-4 h-4 text-green-600" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      )}
                    </div>

                    {/* Order Badge */}
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                      {index + 1}
                    </div>

                    {/* Icon */}
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${projectDef?.color}15` }}>
                      {Icon && <Icon className="w-5 h-5" style={{ color: projectDef?.color }} />}
                    </div>

                    {/* Field Config */}
                    <div className="flex-1 grid grid-cols-4 gap-3">
                      <div>
                        <Label className="text-xs">Field Key</Label>
                        <Input
                          value={field.key}
                          onChange={(e) => handleFieldChange(index, "key", e.target.value)}
                          placeholder="e.g., participants"
                          className="mt-1 h-9 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Label</Label>
                        <Input
                          value={field.label}
                          onChange={(e) => handleFieldChange(index, "label", e.target.value)}
                          placeholder="e.g., Total Participants"
                          className="mt-1 h-9 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Source</Label>
                        <Select
                          value={field.source}
                          onValueChange={(v) => handleFieldChange(index, "source", v)}
                        >
                          <SelectTrigger className="mt-1 h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="computed">Computed</SelectItem>
                            <SelectItem value="extraFields">Extra Fields</SelectItem>
                            <SelectItem value="activity">Activity</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Format</Label>
                        <Select
                          value={field.format}
                          onValueChange={(v) => handleFieldChange(index, "format", v)}
                        >
                          <SelectTrigger className="mt-1 h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="date">Date</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveField(index)}
                      className="text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Quick Guide</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600 space-y-2">
          <p><strong>Field Key:</strong> Must match the field name in your data (e.g., "participants", "venue", "egovDownloads")</p>
          <p><strong>Label:</strong> Display name shown to users (e.g., "Total Participants", "App Downloads")</p>
          <p><strong>Source:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>Computed:</strong> Calculated values (e.g., total participants)</li>
            <li><strong>Extra Fields:</strong> Project-specific data from Google Sheets</li>
            <li><strong>Activity:</strong> Standard activity fields (venue, date, etc.)</li>
          </ul>
          <p><strong>Format:</strong> How to display the value (Number adds commas, Text shows as-is)</p>
        </CardContent>
      </Card>
    </div>
  );
}
