"use client";

interface Choice {
  id: string;
  text: string;
}

interface Props {
  choices: Choice[];
  disabled?: boolean;
  onChoose: (choiceId: string) => void;
}

export default function ChoicePanel({ choices, disabled, onChoose }: Props) {
  return (
    <div className="relative z-20 mt-4 grid gap-3 sm:grid-cols-2">
      {choices.map((choice) => (
        <button
          key={choice.id}
          type="button"
          disabled={disabled}
          onClick={() => onChoose(choice.id)}
          className="rounded-xl border border-cyan-200/25 bg-black/60 px-4 py-3 text-left text-sm font-bold text-cyan-50 transition hover:border-cyan-200/70 hover:bg-cyan-200/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {choice.text}
        </button>
      ))}
    </div>
  );
}
