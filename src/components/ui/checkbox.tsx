/**
 * Checkbox component using native <input type="checkbox">.
 * Replaces @base-ui/react Checkbox to fix iOS Safari event propagation issues.
 * Styled with Tailwind CSS to match the design system.
 */

import { useCallback } from 'react';
import { cn } from '@/lib/utils';

type CheckboxProps = {
  readonly checked?: boolean;
  readonly onCheckedChange?: (checked: boolean) => void;
  readonly className?: string;
  readonly 'aria-label'?: string;
  readonly disabled?: boolean;
};

function Checkbox({
  checked = false,
  onCheckedChange,
  className,
  'aria-label': ariaLabel,
  disabled = false,
}: CheckboxProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onCheckedChange?.(e.target.checked);
    },
    [onCheckedChange],
  );

  return (
    <label
      className={cn(
        'relative inline-flex size-5 shrink-0 items-center justify-center',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className,
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        aria-label={ariaLabel}
        className="absolute size-full cursor-pointer opacity-0"
      />
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none flex size-5 items-center justify-center rounded-md border-2 transition-colors',
          checked
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-muted-foreground/40 hover:border-primary',
          'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring',
        )}
      >
        {checked && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-3.5"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
    </label>
  );
}

export { Checkbox };
