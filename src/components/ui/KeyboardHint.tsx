interface KeyboardHintProps {
  keys: string[];
  label: string;
  visible?: boolean;
}

export const KeyboardHint = ({
  keys,
  label,
  visible = true,
}: KeyboardHintProps) => {
  if (!visible) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-slate-500 animate-in fade-in duration-500">
      <div className="flex gap-1">
        {keys.map((key) => (
          <kbd
            key={key}
            className="px-1.5 py-0.5 rounded bg-slate-800 border border-white/10 text-slate-300 font-mono text-[11px]"
          >
            {key}
          </kbd>
        ))}
      </div>
      <span>{label}</span>
    </div>
  );
};
