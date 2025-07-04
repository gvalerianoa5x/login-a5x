import React from "react";

interface TextInputProps {
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  name?: string;
}

const TextInput: React.FC<TextInputProps> = ({
  type = "text",
  value,
  onChange,
  placeholder,
  disabled = false,
  className = "",
  name,
}) => {
  return (
    <input
      type={type}
      value={value}
      name={name}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`w-full px-3 py-2 border-none rounded-md text-sm shadow-sm focus:outline-none focus:border-none ${className}`}
    />
  );
};

export default TextInput;
