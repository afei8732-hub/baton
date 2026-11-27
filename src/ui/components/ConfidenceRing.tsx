import { useEffect, useState } from 'react';

interface RingProps {
  value: number;
  label: string;
  size?: number;
}

/** Confidence as a ring: the one number a person needs before they start. */
export function ConfidenceRing({ value, label, size = 132 }: RingProps) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(frame);
  }, [value]);

  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.max(0, Math.min(100, shown)) / 100) * circumference;
  const tone = value >= 75 ? 'strong' : value >= 50 ? 'workable' : 'thin';

  return (
    <div className={`ring ring-${tone}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Confidence ${value} out of 100`}>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" />
        <circle
          className="ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-text">
        <span className="ring-number">{value}</span>
        <span className="ring-label">{label}</span>
      </div>
    </div>
  );
}
