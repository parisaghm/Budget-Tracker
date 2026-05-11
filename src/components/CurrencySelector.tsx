import { useEffect, useState } from 'react';
import {
  CURRENCY_OTHER_VALUE,
  CURRENCY_PRESETS,
  isPresetCurrency,
  normalizeCurrencyCode,
} from '@/utils/money';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CurrencySelectorProps {
  value: string;
  onChange: (code: string) => void;
  className?: string;
  /** Compact styling for the dashboard header chip row */
  variant?: 'default' | 'header';
}

export function CurrencySelector({ value, onChange, className, variant = 'default' }: CurrencySelectorProps) {
  const normalized = normalizeCurrencyCode(value);
  const [browsingOther, setBrowsingOther] = useState(false);
  const [otherDraft, setOtherDraft] = useState(
    isPresetCurrency(normalized) ? '' : normalized,
  );

  useEffect(() => {
    if (!isPresetCurrency(normalized)) {
      setOtherDraft(normalized);
      setBrowsingOther(false);
    }
  }, [normalized]);

  const selectValue =
    browsingOther || !isPresetCurrency(normalized) ? CURRENCY_OTHER_VALUE : normalized;

  const handleSelectChange = (v: string) => {
    if (v === CURRENCY_OTHER_VALUE) {
      setBrowsingOther(true);
      setOtherDraft(isPresetCurrency(normalized) ? '' : normalized);
      return;
    }
    setBrowsingOther(false);
    onChange(v);
  };

  const commitOther = () => {
    const next = normalizeCurrencyCode(otherDraft || 'EUR');
    setBrowsingOther(false);
    onChange(next);
  };

  const headerTrigger =
    variant === 'header'
      ? 'h-7 min-w-[4.25rem] border-border bg-secondary/60 text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full'
      : '';

  const showOtherInput = selectValue === CURRENCY_OTHER_VALUE;

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <Select value={selectValue} onValueChange={handleSelectChange}>
        <SelectTrigger
          className={cn(
            variant === 'header' && headerTrigger,
            variant === 'default' && 'h-9 w-[min(100%,11rem)] text-sm',
          )}
          aria-label="Currency"
        >
          <SelectValue placeholder="Currency" />
        </SelectTrigger>
        <SelectContent>
          {CURRENCY_PRESETS.map((p) => (
            <SelectItem key={p.code} value={p.code}>
              {p.code} — {p.label}
            </SelectItem>
          ))}
          <SelectItem value={CURRENCY_OTHER_VALUE}>Other…</SelectItem>
        </SelectContent>
      </Select>
      {showOtherInput && (
        <Input
          className={cn(
            'h-7 w-[4.5rem] font-mono text-[10px] uppercase',
            variant === 'default' && 'h-9 w-24 text-sm',
          )}
          maxLength={3}
          placeholder="ISO"
          value={otherDraft}
          onChange={(e) => setOtherDraft(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3))}
          onBlur={commitOther}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          aria-label="Custom currency code (ISO 4217)"
        />
      )}
    </div>
  );
}
