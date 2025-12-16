import React from 'react';
import { RefreshCw, Utensils, Bus, ShoppingBag, Banknote, Landmark } from 'lucide-react';

export const CurrencyIcon: React.FC<{ currency: 'JPY' | 'HKD'; size?: number; className?: string }> = ({ currency, size = 16, className="" }) => {
    return (
        <span className={`font-mono font-bold flex items-center justify-center rounded bg-gray-100 ${className}`} style={{ width: size * 2, height: size * 1.5, fontSize: size * 0.7 }}>
            {currency}
        </span>
    );
};

export const CategoryIcon: React.FC<{ title: string; type: 'expense' | 'settlement' }> = ({ title, type }) => {
    if (type === 'settlement') return <RefreshCw size={18} className="text-green-500" />;
    
    const lower = title.toLowerCase();
    if (lower.includes('food') || lower.includes('lunch') || lower.includes('dinner') || lower.includes('breakfast') || lower.includes('eat')) {
        return <Utensils size={18} className="text-orange-500" />;
    }
    if (lower.includes('bus') || lower.includes('taxi') || lower.includes('train') || lower.includes('uber') || lower.includes('metro')) {
        return <Bus size={18} className="text-blue-500" />;
    }
    if (lower.includes('hotel') || lower.includes('stay') || lower.includes('airbnb')) {
        return <Landmark size={18} className="text-purple-500" />;
    }
    return <ShoppingBag size={18} className="text-gray-400" />;
};

export const formatMoney = (amount: number, currency: 'JPY' | 'HKD') => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        maximumFractionDigits: 0
    }).format(amount);
};
