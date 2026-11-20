interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState = ({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center text-center px-8 py-16">
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 flex items-center justify-center mb-4 border border-violet-500/20">
      {icon}
    </div>
    <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
    <p className="text-sm text-slate-400 max-w-xs mb-4">{description}</p>
    {action && (
      <button
        onClick={action.onClick}
        className="px-4 py-2 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition-colors text-sm font-medium focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        {action.label}
      </button>
    )}
  </div>
);
