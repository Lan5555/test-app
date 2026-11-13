"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReviewDetail,
  ReviewsOverview,
} from "@/app/components/reviews/review-views";
import { useToast } from "@/app/components/toast";
import Validator from "@/app/components/validator";
import { CoreService } from "@/app/helpers/api-handler";
import { LogFactory } from "@/app/helpers/factories";

const service = new CoreService();
export default function ReviewsPage() {
  const { studentsInfo } = useToast();
  const [reviews, setReviews] = useState<LogFactory[]>([]);
  const [selected, setSelected] = useState<LogFactory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef(0);
  const content = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    const sequence = ++request.current;
    setLoading(true);
    setError("");
    try {
      const response = await service.get(
        `/review/api/fetch-reviews?userId=${studentsInfo.id}`,
      );
      if (!response.success)
        throw new Error(
          response.message ||
            "Your saved reviews could not be loaded. Please try again.",
        );
      const rows = Array.isArray(response.data)
        ? response.data
        : response.data
          ? [response.data]
          : [];
      const records = rows
        .filter((row) => row && typeof row === "object")
        .map((row) => LogFactory.fromJson(row));
      if (sequence === request.current) setReviews(records);
    } catch (failure) {
      if (sequence === request.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "Your saved reviews could not be loaded.",
        );
    } finally {
      if (sequence === request.current) setLoading(false);
    }
  }, [studentsInfo.id]);
  useEffect(() => {
    if (studentsInfo.id > 0) void load();
    return () => {
      request.current++;
    };
  }, [studentsInfo.id, load]);
  useEffect(() => {
    if (selected) {
      content.current?.querySelector("h1")?.focus();
      window.scrollTo(0, 0);
    }
  }, [selected]);
  return (
    <div className="reviews-experience" ref={content}>
      {selected ? (
        <ReviewDetail review={selected} onBack={() => setSelected(null)} />
      ) : (
        <ReviewsOverview
          reviews={reviews}
          loading={loading}
          error={error}
          onRetry={load}
          onSelect={setSelected}
        />
      )}
      <Validator />
    </div>
  );
}
