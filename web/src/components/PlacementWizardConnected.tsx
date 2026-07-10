"use client";

import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

import { PlacementWizard } from "@/components/PlacementWizard";

/** Router-aware wrapper. `useRouter()` needs Next's router context, which only
 * exists in the app — keeping it here is what lets PlacementWizard ship to the
 * design system and be unit-tested. */
export function PlacementWizardConnected(
  props: Omit<ComponentProps<typeof PlacementWizard>, "onFinished">,
) {
  const router = useRouter();
  return (
    <PlacementWizard
      {...props}
      onFinished={() => router.push("/onboarding/placement/result")}
    />
  );
}
