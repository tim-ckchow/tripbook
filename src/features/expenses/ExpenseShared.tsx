import React from 'react';
import { RefreshCw, Utensils, Bus, ShoppingBag, Banknote, Landmark, Wallet } from 'lucide-react';

export const ALL_CURRENCIES = [
  "AED", "AFN", "ALL", "AMD", "ANG", "AOA", "ARS", "AUD", "AWG", "AZN",
  "BAM", "BBD", "BDT", "BGN", "BHD", "BIF", "BMD", "BND", "BOB", "BRL",
  "BSD", "BTN", "BWP", "BYN", "BZD", "CAD", "CDF", "CHF", "CLP", "CNY",
  "COP", "CRC", "CUP", "CVE", "CZK", "DJF", "DKK", "DOP", "DZD", "EGP",
  "ERN", "ETB", "EUR", "FJD", "FKP", "FOK", "GBP", "GEL", "GGP", "GHS",
  "GIP", "GMD", "GNF", "GTQ", "GYD", "HKD", "HNL", "HRK", "HTG", "HUF",
  "IDR", "ILS", "IMP", "INR", "IQD", "IRR", "ISK", "JEP", "JMD", "JOD",
  "JPY", "KES", "KGS", "KHR", "KID", "KMF", "KRW", "KWD", "KYD", "KZT",
  "LAK", "LBP", "LKR", "LRD", "LSL", "LYD", "MAD", "MDL", "MGA", "MKD",
  "MMK", "MNT", "MOP", "MRU", "MUR", "MVR", "MWK", "MXN", "MYR", "MZN",
  "NAD", "NGN", "NIO", "NOK", "NPR", "NZD", "OMR", "PAB", "PEN", "PGK",
  "PHP", "PKR", "PLN", "PYG", "QAR", "RON", "RSD", "RUB", "RWF", "SAR",
  "SBD", "SCR", "SDG", "SEK", "SGD", "SHP", "SLL", "SOS", "SRD", "SSP",
  "STN", "SYP", "SZL", "THB", "TJS", "TMT", "TND", "TOP", "TRY", "TTD",
  "TVD", "TWD", "TZS", "UAH", "UGX", "USD", "UYU", "UZS", "VES", "VND",
  "VUV", "WST", "XAF", "XCD", "XDR", "XOF", "XPF", "YER", "ZAR", "ZMW", "ZWL"
];

export const CurrencyIcon: React.FC<{ currency: string; size?: number; className?: string }> = ({ currency, size = 16, className="" }) => {
    return (
        <span className={`font-mono font-bold flex items-center justify-center rounded bg-gray-100 ${className}`} style={{ width: size * 2, height: size * 1.5, fontSize: size * 0.7 }}>
            {currency}
        </span>
    );
};

export const CategoryIcon: React.FC<{ title: string; type: 'expense' | 'settlement' | 'budget' }> = ({ title, type }) => {
    if (type === 'settlement') return <RefreshCw size={18} className="text-green-500" />;
    if (type === 'budget') return <Wallet size={18} className="text-purple-500" />;
    
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

export const formatMoney = (amount: number, currency: string) => {
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            maximumFractionDigits: 0
        }).format(amount);
    } catch (e) {
        // Fallback for invalid currency codes
        return `${currency} ${amount.toFixed(0)}`;
    }
};
