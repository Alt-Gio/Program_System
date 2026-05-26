"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { FormField, type FormFieldDef } from "./FormField";
import { FormProgress } from "./FormProgress";
import { FormStepWrapper } from "./FormStepWrapper";

export interface FormDef {
  _id?: string;
  title: string;
  description?: string;
  formType: string;
  isStepByStep: boolean;
  showProgressBar: boolean;
  allowMultipleSubmissions: boolean;
  requireAuth: boolean;
  passingScore?: number;
  fields: FormFieldDef[];
  successMessage?: string;
  redirectAfterSubmit?: string;
}

interface FormRendererProps {
  form: FormDef;
  initialValues?: Record<string, unknown>;
  onSubmit: (responses: Record<string, unknown>) => Promise<{ score?: number; passed?: boolean; error?: string } | void>;
  onAutoSave?: (responses: Record<string, unknown>) => void;
  className?: string;
}

function evaluateConditions(field: FormFieldDef, allValues: Record<string, unknown>): boolean {
  if (!field.conditions || field.conditions.length === 0) return true;
  for (const cond of field.conditions) {
    const val = String(allValues[cond.fieldId] ?? "");
    let matches = false;
    if (cond.operator === "equals") matches = val === cond.value;
    else if (cond.operator === "not_equals") matches = val !== cond.value;
    else if (cond.operator === "contains") matches = val.includes(cond.value);
    if (cond.action === "show" && !matches) return false;
    if (cond.action === "hide" && matches) return false;
  }
  return true;
}

function validateField(field: FormFieldDef, value: unknown): string | undefined {
  if (field.required && (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0))) {
    return field.validation?.customError ?? `${field.label} is required`;
  }
  const v = field.validation;
  if (!v) return undefined;
  const str = String(value ?? "");
  if (v.minLength && str.length < v.minLength) return `Minimum ${v.minLength} characters`;
  if (v.maxLength && str.length > v.maxLength) return `Maximum ${v.maxLength} characters`;
  const num = Number(value);
  if (!isNaN(num) && v.min !== undefined && num < v.min) return `Minimum value is ${v.min}`;
  if (!isNaN(num) && v.max !== undefined && num > v.max) return `Maximum value is ${v.max}`;
  if (v.pattern && !new RegExp(v.pattern).test(str)) return v.customError ?? "Invalid format";
  return undefined;
}

export function FormRenderer({ form, initialValues, onSubmit, onAutoSave, className }: FormRendererProps) {
  const [values, setValues] = useState<Record<string, unknown>>(initialValues ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score?: number; passed?: boolean } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleFields = form.fields.filter(
    (f) => f.type !== "section" && f.type !== "info" ? evaluateConditions(f, values) : true
  );

  const allFields = form.fields.filter((f) => evaluateConditions(f, values));

  // Auto-save
  useEffect(() => {
    if (!onAutoSave) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => onAutoSave(values), 30_000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [values, onAutoSave]);

  const updateValue = useCallback((fieldId: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) setErrors((prev) => { const n = { ...prev }; delete n[fieldId]; return n; });
  }, [errors]);

  // ── Step-by-step mode ────────────────────────────────────────────────────────
  if (form.isStepByStep) {
    const interactiveFields = allFields.filter((f) => f.type !== "section" && f.type !== "info");
    const currentField = interactiveFields[step];
    const total = interactiveFields.length;

    const validateCurrent = (): boolean => {
      if (!currentField) return true;
      const err = validateField(currentField, values[currentField.id]);
      if (err) { setErrors((p) => ({ ...p, [currentField.id]: err })); return false; }
      return true;
    };

    const goNext = () => {
      if (!validateCurrent()) return;
      setDirection("forward");
      setStep((s) => Math.min(s + 1, total - 1));
    };

    const goBack = () => {
      setDirection("backward");
      setStep((s) => Math.max(s - 1, 0));
    };

    const handleSubmit = async () => {
      if (!validateCurrent()) return;
      setSubmitting(true);
      try {
        const res = await onSubmit(values);
        if (res && "error" in res) {
          setErrors({ _form: res.error ?? "Submission failed" });
        } else {
          setResult(res ?? null);
          setSubmitted(true);
        }
      } finally {
        setSubmitting(false);
      }
    };

    if (submitted) return <SuccessScreen form={form} result={result} />;

    return (
      <div className={className} style={{ maxWidth: 560, margin: "0 auto" }}>
        {form.showProgressBar && (
          <div style={{ marginBottom: 24 }}>
            <FormProgress current={step + 1} total={total} />
          </div>
        )}
        {currentField && (
          <FormStepWrapper step={step} direction={direction}>
            <div style={{
              background: "var(--lh-card)", borderRadius: 20, padding: "28px 24px",
              border: "1px solid rgba(255,255,255,0.07)", marginBottom: 20,
            }}>
              <FormField
                field={currentField}
                value={values[currentField.id]}
                onChange={(v) => updateValue(currentField.id, v)}
                error={errors[currentField.id]}
              />
            </div>
          </FormStepWrapper>
        )}
        {errors._form && <p style={{ color: "#ff5f6d", fontSize: 13, marginBottom: 12 }}>{errors._form}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
          <button
            type="button"
            onClick={goBack}
            disabled={step === 0}
            style={{
              padding: "11px 22px", borderRadius: 12, fontWeight: 600, fontSize: 14,
              background: "rgba(255,255,255,0.06)", color: "var(--lh-text-2)",
              border: "1px solid rgba(255,255,255,0.1)", cursor: step === 0 ? "not-allowed" : "pointer",
              opacity: step === 0 ? 0.4 : 1,
            }}
          >← Back</button>
          {step < total - 1 ? (
            <button type="button" onClick={goNext} style={BTN_PRIMARY}>Next →</button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={submitting} style={BTN_PRIMARY}>
              {submitting ? "Submitting..." : "Submit ✓"}
            </button>
          )}
        </div>
        {onAutoSave && (
          <p style={{ color: "var(--lh-text-2)", fontSize: 12, textAlign: "center", marginTop: 12 }}>
            💾 Auto-saved
          </p>
        )}
      </div>
    );
  }

  // ── Standard mode (all fields visible) ───────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    for (const field of visibleFields) {
      const err = validateField(field, values[field.id]);
      if (err) newErrors[field.id] = err;
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setSubmitting(true);
    try {
      const res = await onSubmit(values);
      if (res && "error" in res) {
        setErrors({ _form: res.error ?? "Submission failed" });
      } else {
        setResult(res ?? null);
        setSubmitted(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) return <SuccessScreen form={form} result={result} />;

  const filledCount = visibleFields.filter((f) => values[f.id] !== undefined && values[f.id] !== "").length;

  return (
    <form onSubmit={handleSubmit} className={className}>
      {form.showProgressBar && visibleFields.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <FormProgress current={filledCount} total={visibleFields.length} showLabel={false} />
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {allFields.map((field) => {
          const visible = evaluateConditions(field, values);
          return (
            <div
              key={field.id}
              style={{
                opacity: visible ? 1 : 0,
                maxHeight: visible ? 400 : 0,
                overflow: "hidden",
                transition: "opacity 250ms, max-height 250ms",
              }}
            >
              {visible && (
                <FormField
                  field={field}
                  value={values[field.id]}
                  onChange={(v) => updateValue(field.id, v)}
                  error={errors[field.id]}
                />
              )}
            </div>
          );
        })}
      </div>
      {errors._form && <p style={{ color: "#ff5f6d", fontSize: 13, marginTop: 12 }}>{errors._form}</p>}
      <button type="submit" disabled={submitting} style={{ ...BTN_PRIMARY, marginTop: 24, width: "100%" }}>
        {submitting ? "Submitting..." : "Submit"}
      </button>
    </form>
  );
}

function SuccessScreen({ form, result }: { form: FormDef; result: { score?: number; passed?: boolean } | null }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 24px" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{result?.passed === false ? "📊" : "🎉"}</div>
      {result?.score !== undefined && (
        <p style={{ fontSize: 28, fontWeight: 800, color: result.passed ? "#22d3a0" : "#ff8c42", marginBottom: 8 }}>
          {Math.round(result.score)}%
        </p>
      )}
      {result?.passed !== undefined && (
        <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: result.passed ? "#22d3a0" : "#ff5f6d" }}>
          {result.passed ? "✓ Passed!" : "✗ Did not pass"}
        </p>
      )}
      <p style={{ color: "#c8caf0", fontSize: 15, maxWidth: 380, margin: "0 auto" }}>
        {form.successMessage ?? "Your response has been submitted successfully."}
      </p>
    </div>
  );
}

const BTN_PRIMARY: React.CSSProperties = {
  padding: "11px 28px",
  borderRadius: 12,
  fontWeight: 700,
  fontSize: 14,
  background: "#5b6cff",
  color: "#fff",
  border: "none",
  cursor: "pointer",
};
