"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const url =
      window.location.origin +
      pathname +
      (searchParams.toString() ? `?${searchParams.toString()}` : "");
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

if (typeof window !== "undefined") {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  console.log("PostHog initialization check - Key:", key);
  if (key) {
    console.log("Initializing PostHog client with host:", process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com");
    posthog.init(key, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      person_profiles: "always", // Changed from identified_only to always to track all visits/clicks
      capture_pageview: false,   // handled by PostHogPageView below
      capture_pageleave: true,
      autocapture: true,         // auto-tracks clicks, inputs, etc.
    });
  } else {
    console.warn("PostHog key is missing in client environment variables!");
  }
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  );
}
