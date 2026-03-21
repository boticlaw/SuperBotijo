"use client";

import { useState, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, AlertCircle } from "lucide-react";
import { useI18n, I18nProvider } from "@/i18n/provider";
import logo from "@/../public/logo.png";

function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (data.success) {
        const from = searchParams.get("from") || "/";
        router.push(from);
        router.refresh();
      } else {
        setError(t("login.incorrectPassword"));
      }
    } catch {
      setError(t("login.connectionError"));
    }

    setLoading(false);
  };

  return (
    <div
      className="rounded-xl p-10"
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Header */}
      <div className="text-center mb-6 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2.5">
          <Image
            src={logo}
            alt="SuperBotijo"
            width={40}
            height={40}
            style={{ objectFit: "contain" }}
          />
          <h1
            className="text-xl font-bold"
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--text-primary)",
              letterSpacing: "-0.5px",
            }}
          >
            SuperBotijo
          </h1>
        </div>
        <p
          className="text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("login.subtitle")}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="relative">
          <Lock
            className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px]"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-lg text-sm"
            style={{
              backgroundColor: "var(--card-elevated)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
            placeholder={t("login.passwordPlaceholder")}
            required
          />
        </div>

        {error && (
          <div
            className="flex items-center gap-2 text-sm px-4 py-3 rounded-lg"
            style={{
              backgroundColor: "var(--error-bg)",
              color: "var(--error)",
            }}
          >
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
          style={{
            backgroundColor: "var(--accent)",
            color: "white",
          }}
        >
          {loading ? t("login.verifying") : t("login.signIn")}
        </button>
      </form>

      {/* Footer */}
      <p
        className="text-center text-xs mt-6"
        style={{ color: "var(--text-muted)" }}
      >
        {t("login.footer")}
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <I18nProvider>
      <div
        className="min-h-screen flex items-center justify-center p-4 -ml-64"
        style={{ backgroundColor: "var(--background)" }}
      >
        <div className="w-full max-w-md">
          <Suspense
            fallback={
              <div
                className="rounded-xl p-10 animate-pulse"
                style={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="h-8 bg-neutral-700 rounded mb-4" />
                <div className="h-12 bg-neutral-700 rounded mb-4" />
                <div className="h-10 bg-neutral-700 rounded" />
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </I18nProvider>
  );
}
