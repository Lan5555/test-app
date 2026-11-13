import { BookOpen, Check, Sparkles } from "lucide-react";

export function StudyArtwork() {
  return (
    <div className="study-artwork" aria-hidden="true">
      <div className="study-art-orbit" />
      <div className="study-art-orbit second" />
      <span className="study-art-spark">
        <Sparkles size={27} />
      </span>
      <div className="study-art-book">
        <div className="study-art-book-spine" />
        <BookOpen size={55} strokeWidth={1.2} />
        <span>STAY CURIOUS.</span>
        <small>THERE&apos;S ALWAYS MORE TO DISCOVER.</small>
      </div>
      <div className="study-art-note">
        <span>
          <Check size={16} />
        </span>
        One question at a time.
      </div>
    </div>
  );
}
