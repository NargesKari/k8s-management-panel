export default function CreatureSvg() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <ellipse cx="50" cy="58" rx="38" ry="34" fill="#6bc96b" />
      <ellipse cx="50" cy="30" rx="30" ry="26" fill="#7fd97f" />
      {/* mouth */}
      <path d="M 24 44 Q 50 78 76 44 Q 50 66 24 44 Z" fill="#3a1620" className="creature-mouth" />
      <path d="M 30 46 Q 50 40 70 46" stroke="#ffffff" strokeWidth="4" fill="none" strokeLinecap="round" />
      {/* eyes */}
      <circle cx="34" cy="26" r="11" fill="white" />
      <circle cx="66" cy="26" r="11" fill="white" />
      <circle cx="36" cy="27" r="5" fill="#1c2230" />
      <circle cx="64" cy="27" r="5" fill="#1c2230" />
      {/* little nubs on top */}
      <circle cx="26" cy="6" r="5" fill="#6bc96b" />
      <circle cx="74" cy="6" r="5" fill="#6bc96b" />
    </svg>
  );
}
