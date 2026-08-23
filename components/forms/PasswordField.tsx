"use client";

import { useState } from "react";

type PasswordFieldProps = {
  name: string;
  label?: string;
  autoComplete?: string;
  minLength?: number;
  placeholder?: string;
  wrapperClassName?: string;
  inputClassName?: string;
};

export default function PasswordField({
  name,
  label = "Contraseña",
  autoComplete = "new-password",
  minLength = 8,
  placeholder,
  wrapperClassName = "",
  inputClassName = "w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 pr-24 outline-none focus:border-cyan-300",
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={wrapperClassName}>
      {label ? (
        <span className="mb-2 block text-sm font-bold text-slate-300">
          {label}
        </span>
      ) : null}

      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          name={name}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className={inputClassName}
        />

        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-3 my-auto h-fit rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black text-slate-300 transition hover:border-cyan-300 hover:text-cyan-300"
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </div>
    </div>
  );
}