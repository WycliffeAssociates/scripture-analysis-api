interface Option {
  value: string;
  label: string;
}

interface NavSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
}

export function NavSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  loading = false,
}: NavSelectProps) {
  const isDisabled = disabled || loading;

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 truncate">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isDisabled}
        className={[
          'h-8 rounded border px-2 py-0 text-sm leading-none',
          'bg-white focus:outline-none focus:ring-2 focus:ring-blue-500',
          'min-w-[120px] max-w-[220px] truncate',
          isDisabled
            ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50'
            : 'border-gray-300 text-gray-900 cursor-pointer hover:border-gray-400',
        ].join(' ')}
      >
        <option value="" disabled>
          {loading ? 'Loading…' : placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
