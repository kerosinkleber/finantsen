"use client";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";

export function MarkRead({ label }: { label: string }) {
  const router = useRouter();
  return (
    <button
      className="btn-secondary self-start"
      onClick={async () => {
        await api("POST", "/api/notifications", {}).catch(() => {});
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}
