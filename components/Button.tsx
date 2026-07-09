import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className = "",
  variant = "primary",
  ...props
}) => {
  const baseClassName = variant === "primary" ? "btn-login" : "";
  return (
    <button className={`${baseClassName} ${className}`} {...props}>
      {children}
    </button>
  );
};
