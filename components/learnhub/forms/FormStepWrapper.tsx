"use client";

import { useEffect, useRef, useState } from "react";

interface FormStepWrapperProps {
  step: number;
  children: React.ReactNode;
  direction?: "forward" | "backward";
}

export function FormStepWrapper({ step, children, direction = "forward" }: FormStepWrapperProps) {
  const [visible, setVisible] = useState(false);
  const prevStep = useRef(step);

  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => { setVisible(true); prevStep.current = step; }, 30);
    return () => clearTimeout(t);
  }, [step]);

  const enterX = direction === "forward" ? "40px" : "-40px";

  return (
    <div
      style={{
        transform: visible ? "translateX(0)" : `translateX(${enterX})`,
        opacity: visible ? 1 : 0,
        transition: "transform 280ms cubic-bezier(0.4,0,0.2,1), opacity 280ms ease",
      }}
    >
      {children}
    </div>
  );
}
