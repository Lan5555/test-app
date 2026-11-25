import { ArrowLeft, GitBranch, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { blueprintName, blueprintPath } from "../config";

export function LoadingMessage({ children }: { children: string }) {
  return (
    <output className="bp-loading-message">
      <LoaderCircle size={17} aria-hidden="true" />
      {children}
    </output>
  );
}

export function LoadingRows({ label }: { label: string }) {
  return (
    <>
      <LoadingMessage>{label}</LoadingMessage>
      <div className="bp-loading-rows" aria-hidden="true">
        <div />
        <div />
        <div />
      </div>
    </>
  );
}

export function StudioLoading({
  editor = false,
  label,
}: {
  editor?: boolean;
  label: string;
}) {
  return (
    <main className="bp-studio">
      {editor ? (
        <header className="bp-editor-title">
          <Link href={blueprintPath}>
            <ArrowLeft size={17} />
            <GitBranch size={17} />
            <span>{blueprintName}</span>
          </Link>
        </header>
      ) : null}
      <div className={editor ? "bp-editor-loading" : "bp-home"}>
        {!editor && <h1>{blueprintName}</h1>}
        <LoadingRows label={label} />
      </div>
    </main>
  );
}
