"use client";

import { Suspense } from "react";
import { SurfacePostsPage } from "@/components/pages/surface-posts";

export default function ShortsPage() {
  return (
    <Suspense>
      <SurfacePostsPage
        surface="shorts"
        title="Shorts"
        description="Shorts recommendation analytics — expected-watch driven ranking"
      />
    </Suspense>
  );
}
