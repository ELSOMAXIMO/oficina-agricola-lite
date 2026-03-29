import React from 'react';
import { formatNumber } from '../utils/formatters';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  className = '',
  placeholder = '0,00',
  required = false,
  disabled = false,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    const numericValue = parseFloat(rawValue) / 100;
    onChange(numericValue || 0);
  };

  return (
    <input
      type="text"
      value={formatNumber(value)}
      onChange={handleChange}
      className={className}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
    />
  );
};
