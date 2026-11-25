import type { buildIR } from "./compiler";
import { cpp } from "./cpp";
import { html } from "./html";
import {
  type GeneratedSource,
  type LanguageAdapter,
  LanguageRegistry,
} from "./ir";
import { javascript } from "./javascript";
import type { Diagnostic, Project } from "./model";
import { getNode } from "./registry";

export const languages = new LanguageRegistry()
  .register(javascript)
  .register(cpp)
  .register(html)
  .register({
    ...javascript,
    id: "security",
    label: "Cybersecurity",
    sourceLanguage: "javascript",
    unsupportedFeatures: ["http", "automation", "document", "memory"],
  });

export function projectLanguage(project: Project) {
  const features = new Set(
    project.graphs.flatMap(({ nodes }) =>
      nodes.map((node) => getNode(node.kind)?.feature),
    ),
  );
  return features.has("document")
    ? "html"
    : features.has("security")
      ? "security"
      : features.has("memory")
        ? "cpp"
        : "javascript";
}

export function generateSource(
  { program, diagnostics }: ReturnType<typeof buildIR>,
  adapter: LanguageAdapter,
  comments: boolean,
  preview = false,
): { source?: GeneratedSource; diagnostics: Diagnostic[] } {
  if (!program) return { diagnostics };
  try {
    const source =
      preview && adapter.generatePreview
        ? adapter.generatePreview(program, { comments })
        : adapter.generate(program, { comments });
    return { source, diagnostics };
  } catch (error) {
    return {
      diagnostics: [
        ...diagnostics,
        {
          severity: "error",
          code: "SOURCE_GENERATION",
          message:
            error instanceof Error
              ? error.message
              : `Could not generate ${adapter.label}.`,
        },
      ],
    };
  }
}
