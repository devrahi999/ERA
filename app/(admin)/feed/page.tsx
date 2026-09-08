"use client";

import { Suspense } from "react";
import { SurfacePostsPage } from "@/components/pages/surface-posts";

export default function FeedPage() {
  return (
    <Suspense>
      <SurfacePostsPage
        surface="feed"
        title="Feed"
        description="Home Feed recommendation analytics — what the ranked feed is showing"
      />
    </Suspense>
  );
}
