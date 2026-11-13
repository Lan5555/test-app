"use client";

import {
  Check,
  ImagePlus,
  LoaderCircle,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { VotingImage } from "./image";
import {
  VOTING_IMAGE_ACCEPT,
  validateVotingImage,
  votingService,
} from "./service";
import type { UploadedVotingImage, VotingImagePurpose } from "./types";

export type ImageUploadStatus = "idle" | "uploading" | "ready" | "error";

export default function VotingImageUpload({
  purpose,
  value,
  onChange,
  onStatus,
  onAuthError,
  disabled = false,
}: {
  purpose: VotingImagePurpose;
  value: UploadedVotingImage | null;
  onChange: (value: UploadedVotingImage | null) => void;
  onStatus: (status: ImageUploadStatus) => void;
  onAuthError: (error: unknown) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const title = purpose === "POLL" ? "Poll cover" : "Candidate portrait";
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(
    () => () => {
      epoch.current++;
      controller.current?.abort();
      onStatus("idle");
    },
    [onStatus],
  );

  function clear() {
    epoch.current++;
    controller.current?.abort();
    controller.current = null;
    setFile(null);
    setError("");
    setUncertain(false);
    setPending(false);
    onChange(null);
    onStatus("idle");
    if (input.current) input.current.value = "";
  }
  async function upload(next: File) {
    if (disabled) return;
    const request = ++epoch.current;
    controller.current?.abort();
    onChange(null);
    setError("");
    setUncertain(false);
    try {
      validateVotingImage(next);
    } catch (failure) {
      setFile(null);
      setPending(false);
      onStatus("error");
      setError(
        failure instanceof Error ? failure.message : "Choose a valid image.",
      );
      return;
    }
    setFile(next);
    setPending(true);
    onStatus("uploading");
    const abort = new AbortController();
    controller.current = abort;
    try {
      const uploaded = await votingService.uploadImage(
        next,
        purpose,
        abort.signal,
      );
      if (request !== epoch.current) return;
      onChange(uploaded);
      onStatus("ready");
    } catch (failure) {
      if (request !== epoch.current) return;
      setError(
        failure instanceof Error
          ? failure.message
          : "This image could not be uploaded.",
      );
      setUncertain(!(failure instanceof Error && "status" in failure));
      onStatus("error");
      onAuthError(failure);
    } finally {
      if (request === epoch.current) {
        setPending(false);
        controller.current = null;
      }
    }
  }

  return (
    <section
      className={`voting-upload voting-upload-${purpose.toLowerCase()}`}
      aria-labelledby={`${id}-title`}
      aria-busy={pending}
    >
      <div className="voting-upload-heading">
        <div>
          <h3 id={`${id}-title`}>
            {title}
            <span>Optional</span>
          </h3>
          <p>
            {purpose === "POLL"
              ? "Give your poll a cover worth sharing."
              : "Put a face to the name."}
          </p>
        </div>
        <ImagePlus size={21} />
      </div>
      {(value || preview) && (
        <div className="voting-upload-preview">
          <VotingImage
            src={value?.url || preview}
            local={!value}
            alt={`${title} preview`}
            priority
          />
          <span className={value ? "is-ready" : ""}>
            {value ? (
              <>
                <Check size={13} />
                Uploaded
              </>
            ) : (
              <>
                {pending ? (
                  <LoaderCircle size={13} className="animate-spin" />
                ) : (
                  <ImagePlus size={13} />
                )}
                Preview · not saved
              </>
            )}
          </span>
        </div>
      )}
      <div className="voting-upload-picker">
        <Upload size={20} />
        <label htmlFor={`${id}-file`}>
          {pending
            ? "Uploading your image…"
            : value
              ? "Choose a different image"
              : "Choose an image"}
          <input
            ref={input}
            id={`${id}-file`}
            type="file"
            accept={VOTING_IMAGE_ACCEPT}
            disabled={disabled || pending}
            aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
            onChange={(event) => {
              const selected = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (selected) void upload(selected);
            }}
          />
        </label>
        <p id={`${id}-hint`}>JPEG, PNG, or WebP · up to 5 MiB</p>
      </div>
      {file && <p className="voting-upload-filename">{file.name}</p>}
      {error && (
        <p className="voting-upload-error" role="alert" id={`${id}-error`}>
          {error}
        </p>
      )}
      {uncertain && error && (
        <p className="voting-upload-note">
          The upload could not be confirmed. Retrying may upload another copy.
        </p>
      )}
      {(value || file || error) && (
        <div className="voting-upload-actions">
          {error && file && (
            <button
              type="button"
              disabled={disabled || pending}
              onClick={() => void upload(file)}
            >
              <RefreshCw size={13} />
              Retry upload
            </button>
          )}
          <button type="button" disabled={disabled} onClick={clear}>
            <X size={13} />
            {pending
              ? "Cancel upload"
              : error
                ? "Continue without an image"
                : "Remove from form"}
          </button>
        </div>
      )}
      <p className="voting-upload-note">
        This image will appear on the public voting page.{" "}
        {value
          ? "It will be attached when you save this form."
          : "Upload an image or continue without one."}
      </p>
    </section>
  );
}
