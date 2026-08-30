// Shared coupon types, data and utilities

export interface Coupon {
  id: string;
  code: string;
  title: string;
  description: string;
  discount: number;
  type: 'percent' | 'fixed';
  minAmount: number;
  maxDiscount?: number;
  expiresIn: string;
  isUsed?: boolean;
  color: string;
  icon: string;
}

export const AVAILABLE_COUPONS: Coupon[] = [
  {
    id: 'c1',
    code: 'TUKTUKY20',
    title: 'خصم 20%',
    description: 'خصم 20% على رحلتك القادمة',
    discount: 20,
    type: 'percent',
    minAmount: 30,
    maxDiscount: 25,
    expiresIn: 'ينتهي بعد 3 أيام',
    color: '#1A56DB',
    icon: 'local-offer',
  },
  {
    id: 'c2',
    code: 'NEWRIDE',
    title: 'خصم 15 ج.م',
    description: 'خصم ثابت 15 جنيه على رحلتك',
    discount: 15,
    type: 'fixed',
    minAmount: 40,
    expiresIn: 'ينتهي بعد 7 أيام',
    color: '#10B981',
    icon: 'card-giftcard',
  },
  {
    id: 'c3',
    code: 'EID50',
    title: 'عرض العيد 50%',
    description: 'خصم 50% بمناسبة الأعياد حتى 30 ج.م',
    discount: 50,
    type: 'percent',
    minAmount: 50,
    maxDiscount: 30,
    expiresIn: 'ينتهي بعد يوم',
    color: '#F5A623',
    icon: 'celebration',
  },
  {
    id: 'c4',
    code: 'FIRST10',
    title: 'خصم أول رحلة',
    description: 'خصم 10 ج.م على أول رحلة لك',
    discount: 10,
    type: 'fixed',
    minAmount: 20,
    expiresIn: 'ينتهي بعد 30 يوم',
    isUsed: true,
    color: '#8B5CF6',
    icon: 'star',
  },
];

export function applyCoupon(coupon: Coupon, originalPrice: number): number {
  if (coupon.type === 'percent') {
    const disc = (originalPrice * coupon.discount) / 100;
    const capped = coupon.maxDiscount ? Math.min(disc, coupon.maxDiscount) : disc;
    return Math.max(0, Math.round(originalPrice - capped));
  }
  return Math.max(0, originalPrice - coupon.discount);
}
