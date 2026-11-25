"use client";

import { cpp } from "@codemirror/lang-cpp";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import CodeMirror from "@uiw/react-codemirror";
import { useEffect, useRef } from "react";
import type { GeneratedSource } from "../core/ir";
import type { Location } from "../core/model";

const extensions: Record<string, ReturnType<typeof javascript>[]> = {
  javascript: [javascript()],
  cpp: [cpp()],
  html: [html()],
};
export default function SourceView({
  source,
  language,
  languageLabel,
  selected,
  onLocate,
}: {
  source: GeneratedSource;
  language: string;
  languageLabel: string;
  selected?: Location;
  onLocate(at: Location): void;
}) {
  const editor = useRef<
    | Parameters<
        NonNullable<React.ComponentProps<typeof CodeMirror>["onCreateEditor"]>
      >[0]
    | undefined
  >(undefined);
  const highlighting = useRef(false);
  const matching = source.ranges.find(
    ({ at }) =>
      at.graphId === selected?.graphId && at.nodeId === selected.nodeId,
  );
  useEffect(() => {
    const view = editor.current;
    if (!view || !matching || matching.start > view.state.doc.lines) return;
    const line = view.state.doc.line(matching.start);
    const end = view.state.doc.line(
      Math.min(matching.end, view.state.doc.lines),
    ).to;
    if (
      view.state.selection.main.from === line.from &&
      view.state.selection.main.to === end
    )
      return;
    // CodeMirror reports this dispatch through onUpdate synchronously.
    highlighting.current = true;
    try {
      view.dispatch({
        selection: { anchor: line.from, head: end },
        scrollIntoView: true,
      });
    } finally {
      highlighting.current = false;
    }
  }, [matching]);
  return (
    <div className="bp-code">
      <CodeMirror
        value={source.code}
        theme="dark"
        height="100%"
        editable={false}
        readOnly
        extensions={extensions[language]}
        onCreateEditor={(view) => {
          editor.current = view;
          if (
            !matching &&
            source.entryLine &&
            source.entryLine <= view.state.doc.lines
          ) {
            view.dispatch({
              selection: { anchor: view.state.doc.line(source.entryLine).from },
              scrollIntoView: true,
            });
          }
        }}
        onUpdate={(update) => {
          if (
            highlighting.current ||
            !update.selectionSet ||
            !update.view.hasFocus
          )
            return;
          const line = update.state.doc.lineAt(
            update.state.selection.main.head,
          ).number;
          const range = source.ranges
            .filter((entry) => entry.start <= line && entry.end >= line)
            .sort((a, b) => a.end - a.start - (b.end - b.start))
            .at(0);
          if (
            range &&
            (range.at.graphId !== selected?.graphId ||
              range.at.nodeId !== selected?.nodeId)
          )
            onLocate(range.at);
        }}
        aria-label={`Generated ${languageLabel}`}
      />
    </div>
  );
}
