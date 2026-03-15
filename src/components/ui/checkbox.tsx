/**
 * Checkbox component built with @base-ui/react Checkbox primitive.
 * Styled with Tailwind CSS to match the design system.
 */

import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
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
  return (
    <CheckboxPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-md border-2 border-muted-foreground/40 transition-colors',
        'hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'data-[checked]:border-primary data-[checked]:bg-primary data-[checked]:text-primary-foreground',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3.5"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
