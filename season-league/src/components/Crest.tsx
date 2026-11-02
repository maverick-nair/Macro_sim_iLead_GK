const INITIALS = (name: string) =>
  name
    .replace(/[^A-Za-z0-9 ]/g, "")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 3);

/** Squad crest: a shield in the squad colour with its initials. Colour is always shown with the name. */
export function Crest({ name, colour, size = 40 }: { name: string; colour: string; size?: number }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 40 46" aria-hidden="true" className="crest">
      <path
        d="M20 1 L38 7 V22 C38 34 30 41 20 45 C10 41 2 34 2 22 V7 Z"
        fill={`var(--squad-${colour})`}
        stroke="var(--ink)"
        strokeWidth="2"
      />
      <path
        d="M20 6 L33 10.5 V22 C33 31 27 36.5 20 39.5 C13 36.5 7 31 7 22 V10.5 Z"
        fill="none"
        stroke="rgba(11,20,48,0.35)"
        strokeWidth="1.5"
      />
      <text
        x="20"
        y="27"
        textAnchor="middle"
        fontFamily="Barlow Condensed"
        fontWeight="800"
        fontSize="14"
        fill="var(--ink)"
      >
        {INITIALS(name)}
      </text>
    </svg>
  );
}
