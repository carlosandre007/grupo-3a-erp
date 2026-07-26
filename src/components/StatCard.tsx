import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  colorVariant?: 'default' | 'accent' | 'dark' | 'success';
  badge?: string;
  badgeColor?: string;
}

export default function StatCard({ 
  title, 
  value, 
  trend, 
  icon, 
  colorVariant = 'default',
  badge,
  badgeColor
}: StatCardProps) {
  
  const getCardClasses = () => {
    switch (colorVariant) {
      case 'dark':
        return 'bg-on-background border-on-background text-white';
      case 'accent':
        return 'bg-white border-l-4 border-l-primary-container border-outline-variant';
      case 'success':
        return 'bg-white border-l-4 border-l-[#065F46] border-outline-variant';
      default:
        return 'bg-white border border-outline-variant';
    }
  };

  const getTitleColor = () => {
    return colorVariant === 'dark' ? 'text-white/70' : 'text-secondary';
  };

  const getValueColor = () => {
    if (colorVariant === 'dark') return 'text-white';
    if (colorVariant === 'accent') return 'text-primary';
    return 'text-on-surface';
  };

  return (
    <div className={`p-6 rounded-lg custom-shadow relative overflow-hidden transition-all duration-200 hover:translate-y-[-1px] ${getCardClasses()}`}>
      <div className="flex justify-between items-start mb-3">
        <p className={`text-xs font-bold uppercase tracking-wider ${getTitleColor()}`}>
          {title}
        </p>
        {icon && <div className={`${colorVariant === 'dark' ? 'text-primary-container' : 'text-secondary'}`}>{icon}</div>}
      </div>

      <div className="flex items-baseline justify-between mt-1">
        <h3 className={`font-display font-black text-xl md:text-2xl tracking-tight leading-none ${getValueColor()}`}>
          {value}
        </h3>
        
        {trend && (
          <div className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${trend.isPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {trend.isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            <span>{trend.value}</span>
          </div>
        )}

        {badge && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase ${badgeColor || 'bg-primary-container text-on-primary-container'}`}>
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}
