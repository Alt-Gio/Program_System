"use client";

import { useState } from "react";

export interface FormFieldDef {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  options?: string[];
  validation?: { min?: number; max?: number; minLength?: number; maxLength?: number; pattern?: string; customError?: string };
  conditions?: Array<{ fieldId: string; operator: string; value: string; action: string }>;
  points?: number;
  correctAnswer?: string;
}

interface FormFieldProps {
  field: FormFieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
}

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  color: "var(--lh-text)",
  padding: "10px 14px",
  fontSize: 14,
  outline: "none",
};

const OPTION_BASE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 14px",
  borderRadius: 10,
  cursor: "pointer",
  border: "1px solid rgba(255,255,255,0.08)",
  marginBottom: 6,
  fontSize: 14,
  transition: "all 150ms",
};

export function FormField({ field, value, onChange, error }: FormFieldProps) {
  const [focused, setFocused] = useState(false);

  const borderColor = error ? "#ff5f6d" : focused ? "#5b6cff" : "rgba(255,255,255,0.1)";
  const inputStyle = { ...INPUT_STYLE, border: `1px solid ${borderColor}` };

  const labelEl = (
    <label style={{ display: "block", color: "var(--lh-text)", fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
      {field.label}
      {field.required && <span style={{ color: "#ff5f6d", marginLeft: 3 }}>*</span>}
    </label>
  );
  const helpEl = field.helpText && (
    <p style={{ color: "var(--lh-text-2)", fontSize: 12, marginTop: 4, marginBottom: 8 }}>{field.helpText}</p>
  );
  const errEl = error && (
    <p style={{ color: "#ff5f6d", fontSize: 12, marginTop: 4 }}>{error}</p>
  );

  // ── Section / Info ──────────────────────────────────────────────────────────
  if (field.type === "section") {
    return (
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 8, marginBottom: 4 }}>
        <p style={{ color: "#7c8bff", fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.06em" }}>{field.label}</p>
      </div>
    );
  }
  if (field.type === "info") {
    return <p style={{ color: "var(--lh-text-2)", fontSize: 14, lineHeight: 1.6 }}>{field.label}</p>;
  }

  // ── Yes / No ────────────────────────────────────────────────────────────────
  if (field.type === "yes_no") {
    return (
      <div>
        {labelEl}{helpEl}
        <div style={{ display: "flex", gap: 10 }}>
          {["Yes", "No"].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              style={{
                flex: 1,
                padding: "14px",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
                border: `2px solid ${value === opt ? "#5b6cff" : "rgba(255,255,255,0.08)"}`,
                background: value === opt ? "rgba(91,108,255,0.15)" : "rgba(255,255,255,0.03)",
                color: value === opt ? "#a0acff" : "var(--lh-text-2)",
                transition: "all 150ms",
              }}
            >{opt}</button>
          ))}
        </div>
        {errEl}
      </div>
    );
  }

  // ── Rating ───────────────────────────────────────────────────────────────────
  if (field.type === "rating") {
    const num = Number(value) || 0;
    return (
      <div>
        {labelEl}{helpEl}
        <div style={{ display: "flex", gap: 6 }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              style={{ fontSize: 28, cursor: "pointer", background: "none", border: "none", padding: 2 }}
            >
              <span style={{ color: star <= num ? "#fbbf24" : "rgba(255,255,255,0.2)" }}>★</span>
            </button>
          ))}
        </div>
        {errEl}
      </div>
    );
  }

  // ── Scale / NPS ──────────────────────────────────────────────────────────────
  if (field.type === "scale" || field.type === "nps") {
    const max = field.type === "nps" ? 10 : 10;
    const min = field.type === "nps" ? 0 : 1;
    const nums = Array.from({ length: max - min + 1 }, (_, i) => i + min);
    const cur = Number(value);
    return (
      <div>
        {labelEl}{helpEl}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {nums.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              style={{
                width: 38, height: 38, borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer",
                border: `1px solid ${cur === n ? "#5b6cff" : "rgba(255,255,255,0.1)"}`,
                background: cur === n ? "rgba(91,108,255,0.2)" : "rgba(255,255,255,0.03)",
                color: cur === n ? "#a0acff" : "var(--lh-text-2)",
              }}
            >{n}</button>
          ))}
        </div>
        {field.type === "nps" && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 11, color: "#ff5f6d" }}>Not at all likely</span>
            <span style={{ fontSize: 11, color: "#22d3a0" }}>Extremely likely</span>
          </div>
        )}
        {errEl}
      </div>
    );
  }

  // ── Radio ────────────────────────────────────────────────────────────────────
  if (field.type === "radio") {
    return (
      <div>
        {labelEl}{helpEl}
        {(field.options ?? []).map((opt) => {
          const selected = value === opt;
          return (
            <div
              key={opt}
              onClick={() => onChange(opt)}
              style={{
                ...OPTION_BASE,
                background: selected ? "rgba(91,108,255,0.1)" : "rgba(255,255,255,0.02)",
                borderColor: selected ? "#5b6cff" : "rgba(255,255,255,0.08)",
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: "50%", border: `2px solid ${selected ? "#5b6cff" : "rgba(255,255,255,0.3)"}`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {selected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#5b6cff" }} />}
              </div>
              <span style={{ color: selected ? "var(--lh-text)" : "#c8caf0" }}>{opt}</span>
            </div>
          );
        })}
        {errEl}
      </div>
    );
  }

  // ── Checkbox (multi) ─────────────────────────────────────────────────────────
  if (field.type === "checkbox" || field.type === "multiselect") {
    const arr: string[] = Array.isArray(value) ? (value as string[]) : [];
    const toggle = (opt: string) => {
      const next = arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt];
      onChange(next);
    };
    return (
      <div>
        {labelEl}{helpEl}
        {(field.options ?? []).map((opt) => {
          const checked = arr.includes(opt);
          return (
            <div
              key={opt}
              onClick={() => toggle(opt)}
              style={{
                ...OPTION_BASE,
                background: checked ? "rgba(91,108,255,0.1)" : "rgba(255,255,255,0.02)",
                borderColor: checked ? "#5b6cff" : "rgba(255,255,255,0.08)",
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: 5, border: `2px solid ${checked ? "#5b6cff" : "rgba(255,255,255,0.3)"}`,
                background: checked ? "#5b6cff" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {checked && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</span>}
              </div>
              <span style={{ color: checked ? "var(--lh-text)" : "#c8caf0" }}>{opt}</span>
            </div>
          );
        })}
        {errEl}
      </div>
    );
  }

  // ── Select ───────────────────────────────────────────────────────────────────
  if (field.type === "select") {
    return (
      <div>
        {labelEl}{helpEl}
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, borderColor, appearance: "none", cursor: "pointer" }}
        >
          <option value="">{field.placeholder ?? "Select an option..."}</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        {errEl}
      </div>
    );
  }

  // ── Textarea ─────────────────────────────────────────────────────────────────
  if (field.type === "textarea") {
    return (
      <div>
        {labelEl}{helpEl}
        <textarea
          rows={4}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ ...inputStyle, resize: "vertical", borderColor }}
        />
        {errEl}
      </div>
    );
  }

  // ── Date / Time ──────────────────────────────────────────────────────────────
  if (field.type === "date" || field.type === "time") {
    return (
      <div>
        {labelEl}{helpEl}
        <input
          type={field.type}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ ...inputStyle, borderColor }}
        />
        {errEl}
      </div>
    );
  }

  // ── Default: text / email / number / phone ────────────────────────────────────
  return (
    <div>
      {labelEl}{helpEl}
      <input
        type={field.type === "phone" ? "tel" : field.type === "email" ? "email" : field.type === "number" ? "number" : "text"}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        min={field.validation?.min}
        max={field.validation?.max}
        minLength={field.validation?.minLength}
        maxLength={field.validation?.maxLength}
        style={{ ...inputStyle, borderColor }}
      />
      {errEl}
    </div>
  );
}
