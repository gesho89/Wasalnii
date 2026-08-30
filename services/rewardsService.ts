import { getSupabaseClient } from '@/template';

export interface RewardData {
  id: string;
  user_id: string;
  points: number;
  total_earned: number;
  total_redeemed: number;
  level: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export interface RewardTransaction {
  id: string;
  user_id: string;
  points: number;
  type: 'earn' | 'redeem';
  description: string;
  created_at: string;
}

export const LEVEL_CONFIG = {
  bronze:   { label: 'برونزي',  icon: '🥉', color: '#CD7F32', min: 0,    max: 499  },
  silver:   { label: 'فضي',    icon: '🥈', color: '#9CA3AF', min: 500,  max: 1499 },
  gold:     { label: 'ذهبي',   icon: '🥇', color: '#F5A623', min: 1500, max: 2999 },
  platinum: { label: 'بلاتيني', icon: '💎', color: '#8B5CF6', min: 3000, max: 99999 },
};

// Inline color constant to avoid circular import
const Colors_primary = '#F5A623';

export const REDEEM_OPTIONS = [
  { id: 'discount5',  label: 'خصم 5 ج.م',   icon: 'local-offer',    points: 100, value: 5,  color: Colors_primary },
  { id: 'discount10', label: 'خصم 10 ج.م',  icon: 'sell',           points: 200, value: 10, color: '#10B981' },
  { id: 'discount20', label: 'خصم 20 ج.م',  icon: 'discount',       points: 400, value: 20, color: '#8B5CF6' },
  { id: 'free_ride',  label: 'رحلة مجانية', icon: 'directions-car', points: 800, value: 0,  color: '#F59E0B' },
];

function getLevelFromTotal(total: number): RewardData['level'] {
  if (total >= 3000) return 'platinum';
  if (total >= 1500) return 'gold';
  if (total >= 500)  return 'silver';
  return 'bronze';
}

// ── Get or create rewards record ────────────────────────────────────
export async function getOrCreateRewards(
  userId: string
): Promise<{ data: RewardData | null; error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    // Try to fetch
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (data) return { data, error: null };

    // Create if not exists
    const { data: created, error: createErr } = await supabase
      .from('rewards')
      .insert({ user_id: userId, points: 0, total_earned: 0, total_redeemed: 0, level: 'bronze' })
      .select('*')
      .single();

    if (createErr) return { data: null, error: createErr.message };
    return { data: created, error: null };
  } catch (e: any) {
    return { data: null, error: e.message };
  }
}

// ── Add reward points (called after trip completion) ─────────────────
export async function addRewardPoints(
  userId: string,
  points: number,
  description: string
): Promise<{ data: RewardData | null; error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    // Ensure rewards row exists
    const { data: existing } = await getOrCreateRewards(userId);
    if (!existing) return { data: null, error: 'لا يمكن العثور على سجل المكافآت' };

    const newPoints    = existing.points + points;
    const newTotal     = existing.total_earned + points;
    const newLevel     = getLevelFromTotal(newTotal);

    // Update rewards row
    const { data: updated, error: updateErr } = await supabase
      .from('rewards')
      .update({
        points:        newPoints,
        total_earned:  newTotal,
        level:         newLevel,
        updated_at:    new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select('*')
      .single();

    if (updateErr) return { data: null, error: updateErr.message };

    // Log transaction
    await supabase.from('reward_transactions').insert({
      user_id:     userId,
      points:      points,
      type:        'earn',
      description: description,
    });

    return { data: updated, error: null };
  } catch (e: any) {
    return { data: null, error: e.message };
  }
}

// ── Award points on trip completion (called by driver-dashboard) ─────
export async function awardTripCompletionPoints(
  userId: string,
  tripPrice: number,
  fromLocation: string,
  toLocation: string
): Promise<void> {
  // Points formula: 5 base + 1 per 10 EGP
  const points = 5 + Math.floor(tripPrice / 10);
  const description = `رحلة من ${fromLocation} إلى ${toLocation}`;
  await addRewardPoints(userId, points, description).catch(() => {/* silent */});
}

// ── Get transaction history ─────────────────────────────────────────
export async function getRewardTransactions(
  userId: string
): Promise<{ data: RewardTransaction[] | null; error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase
      .from('reward_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) return { data: null, error: error.message };
    return { data: data ?? [], error: null };
  } catch (e: any) {
    return { data: null, error: e.message };
  }
}

// ── Redeem points ───────────────────────────────────────────────────
export async function redeemPoints(
  userId: string,
  points: number,
  description: string
): Promise<{ data: RewardData | null; error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    const { data: existing } = await getOrCreateRewards(userId);
    if (!existing) return { data: null, error: 'لا يمكن العثور على سجل المكافآت' };
    if (existing.points < points) return { data: null, error: 'رصيد النقاط غير كافٍ' };

    const newPoints   = existing.points - points;
    const newRedeemed = existing.total_redeemed + points;

    const { data: updated, error: updateErr } = await supabase
      .from('rewards')
      .update({
        points:          newPoints,
        total_redeemed:  newRedeemed,
        updated_at:      new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select('*')
      .single();

    if (updateErr) return { data: null, error: updateErr.message };

    await supabase.from('reward_transactions').insert({
      user_id:     userId,
      points:      -points,
      type:        'redeem',
      description: description,
    });

    return { data: updated, error: null };
  } catch (e: any) {
    return { data: null, error: e.message };
  }
}
