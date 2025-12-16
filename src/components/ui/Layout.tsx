import React from 'react';

// --- ATOMS ---

export const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ 
  children, className = "", onClick 
}) => {
  return (
    <div 
      onClick={onClick}
      className={`bg-white rounded-3xl shadow-soft border border-[#E8E4D9] p-5 ${className} ${onClick ? 'cursor-pointer active:translate-y-[2px] active:shadow-none transition-all' : ''}`}
    >
      {children}
    </div>
  );
};

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }> = ({ 
  children, variant = 'primary', className = "", ...props 
}) => {
  const base = "font-bold rounded-full px-6 py-3 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 tracking-wide font-rounded";
  
  const variants = {
    primary: "bg-brand text-white shadow-soft hover:shadow-soft-hover border-2 border-brand hover:-translate-y-0.5",
    secondary: "bg-white text-ink border-2 border-[#E0E5D5] shadow-soft hover:shadow-soft-hover hover:-translate-y-0.5",
    danger: "bg-red-400 text-white shadow-soft border-2 border-red-400",
    ghost: "bg-transparent text-gray-500 hover:bg-black/5"
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ 
  label, className = "", ...props 
}) => {
  return (
    <div className="flex flex-col gap-1 w-full">
      {label && <label className="text-sm font-bold text-gray-500 ml-3 uppercase tracking-wider text-[10px]">{label}</label>}
      <input 
        className={`bg-white border-2 border-[#E0E5D5] rounded-2xl px-5 py-3 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all text-lg shadow-sm placeholder:text-gray-300 ${className}`} 
        {...props} 
      />
    </div>
  );
};

// --- LAYOUTS ---

export const Screen: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  // Updated padding to handle safe areas and taller header
  <div className={`min-h-screen pb-[calc(7rem+env(safe-area-inset-bottom))] pt-[calc(6rem+env(safe-area-inset-top))] px-4 max-w-md mx-auto relative ${className}`}>
    {children}
  </div>
);

export const TopBar: React.FC<{ title: string; onBack?: () => void; rightAction?: React.ReactNode }> = ({ title, onBack, rightAction }) => (
  <div className="fixed top-0 left-0 right-0 z-50 bg-[#F5FFFA]/90 backdrop-blur-md border-b border-[#E0E5D5] pt-[env(safe-area-inset-top)] transition-all duration-300">
     <div className="w-full max-w-md mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 overflow-hidden">
          {onBack && (
            <button onClick={onBack} className="p-2 -ml-2 hover:bg-black/5 rounded-full text-gray-500 transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          )}
          <h1 className="text-xl font-bold truncate text-ink font-rounded">{title}</h1>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {rightAction}
        </div>
     </div>
  </div>
);