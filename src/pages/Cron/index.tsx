/**
 * Cron Page
 * Manage scheduled tasks with template-based creation
 */
import { useEffect, useState, useCallback, type ReactNode, type SelectHTMLAttributes } from 'react';
import {
  Plus,
  Clock,
  Play,
  Trash2,
  RefreshCw,
  X,
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Loader2,
  Timer,
  History,
  ChevronDown,
  Briefcase,
  BookOpen,
  Gamepad2,
  Plane,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { hostApiFetch } from '@/lib/host-api';
import { useCronStore } from '@/stores/cron';
import { useGatewayStore } from '@/stores/gateway';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatRelativeTime, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { CronJob, CronJobCreateInput, ScheduleType } from '@/types/cron';
import { CHANNEL_ICONS, CHANNEL_NAMES, type ChannelType } from '@/types/channel';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

// Common cron schedule presets
const schedulePresets: { key: string; value: string; type: ScheduleType }[] = [
  { key: 'everyMinute', value: '* * * * *', type: 'interval' },
  { key: 'every5Min', value: '*/5 * * * *', type: 'interval' },
  { key: 'every15Min', value: '*/15 * * * *', type: 'interval' },
  { key: 'everyHour', value: '0 * * * *', type: 'interval' },
  { key: 'daily9am', value: '0 9 * * *', type: 'daily' },
  { key: 'daily6pm', value: '0 18 * * *', type: 'daily' },
  { key: 'weeklyMon', value: '0 9 * * 1', type: 'weekly' },
  { key: 'monthly1st', value: '0 9 1 * *', type: 'monthly' },
];

// Template categories
const CATEGORIES = [
  { id: 'all', labelKey: 'categories.all', icon: <Clock className="h-3.5 w-3.5" /> },
  { id: 'productivity', labelKey: 'categories.productivity', icon: <Briefcase className="h-3.5 w-3.5" /> },
  { id: 'study', labelKey: 'categories.study', icon: <BookOpen className="h-3.5 w-3.5" /> },
  { id: 'life', labelKey: 'categories.life', icon: <Plane className="h-3.5 w-3.5" /> },
  { id: 'entertainment', labelKey: 'categories.entertainment', icon: <Gamepad2 className="h-3.5 w-3.5" /> },
];

// Task templates for quick setup
interface TaskTemplate {
  id: string;
  titleKey: string;
  descriptionKey: string;
  category: string;
  name: string;
  message: string;
  schedule: string;
  deliveryMode: 'none' | 'announce';
}

const taskTemplates: TaskTemplate[] = [
  {
    id: 'news',
    titleKey: 'templates.news.title',
    descriptionKey: 'templates.news.desc',
    category: 'productivity',
    name: '每日热点资讯汇总',
    message: '帮我整理今天最重要的10条科技/AI/互联网行业新闻，用简洁的方式呈现重点，附带简短点评。',
    schedule: '0 9 * * *',
    deliveryMode: 'none',
  },
  {
    id: 'travel',
    titleKey: 'templates.travel.title',
    descriptionKey: 'templates.travel.desc',
    category: 'life',
    name: '周末出游规划',
    message: '根据我的偏好（可以补充具体要求），推荐适合周末的出游目的地和行程安排。',
    schedule: '0 10 * * 5',
    deliveryMode: 'none',
  },
  {
    id: 'study-plan',
    titleKey: 'templates.studyPlan.title',
    descriptionKey: 'templates.studyPlan.desc',
    category: 'study',
    name: '制定学习计划',
    message: '帮我制定一个适合备考/学习《XX科目》的轻量计划，分解目标到每日任务，突出重点和难点。',
    schedule: '0 20 * * *',
    deliveryMode: 'none',
  },
  {
    id: 'explain',
    titleKey: 'templates.explain.title',
    descriptionKey: 'templates.explain.desc',
    category: 'study',
    name: '深度内容讲解',
    message: '帮我深入讲解以下知识点/概念，拆解卡点，找到破局思路，用通俗易懂的方式解释：[粘贴知识点]',
    schedule: '0 14 * * *',
    deliveryMode: 'none',
  },
  {
    id: 'invoice',
    titleKey: 'templates.invoice.title',
    descriptionKey: 'templates.invoice.desc',
    category: 'productivity',
    name: '发票智能归档',
    message: '帮我整理和归档这个月收到的发票，按照日期、类型、金额分类，生成汇总报表。',
    schedule: '0 18 28 * *',
    deliveryMode: 'none',
  },
  {
    id: 'docs',
    titleKey: 'templates.docs.title',
    descriptionKey: 'templates.docs.desc',
    category: 'productivity',
    name: '资料整理成文档',
    message: '帮我把收藏夹里的资料链接整理成结构化文档，提炼有用信息，去除冗余内容。',
    schedule: '0 10 * * 6',
    deliveryMode: 'none',
  },
  {
    id: 'schedule',
    titleKey: 'templates.schedule.title',
    descriptionKey: 'templates.schedule.desc',
    category: 'productivity',
    name: '日程任务跟踪提醒',
    message: '检查我的日程安排，列出今天的任务清单，标注优先级，并提醒即将到期的deadline。',
    schedule: '0 8 * * *',
    deliveryMode: 'none',
  },
  {
    id: 'framework',
    titleKey: 'templates.framework.title',
    descriptionKey: 'templates.framework.desc',
    category: 'study',
    name: '知识点框架梳理',
    message: '帮我把某个复杂主题/书籍的知识点整理成清晰的框架图，理清各知识点之间的关系。',
    schedule: '0 21 * * 3',
    deliveryMode: 'none',
  },
  {
    id: 'doubt',
    titleKey: 'templates.doubt.title',
    descriptionKey: 'templates.doubt.desc',
    category: 'study',
    name: '拆解学习目标与督促打卡',
    message: '回顾今天的单词/知识背诵进度，检查是否完成目标，没完成的话帮我制定补救计划。',
    schedule: '0 22 * * *',
    deliveryMode: 'none',
  },
];

// Parse cron schedule to human-readable format
function parseCronSchedule(schedule: unknown, t: TFunction<'cron'>): string {
  if (schedule && typeof schedule === 'object') {
    const s = schedule as { kind?: string; expr?: string; tz?: string; everyMs?: number; at?: string };
    if (s.kind === 'cron' && typeof s.expr === 'string') {
      return parseCronExpr(s.expr, t);
    }
    if (s.kind === 'every' && typeof s.everyMs === 'number') {
      const ms = s.everyMs;
      if (ms < 60_000) return t('schedule.everySeconds', { count: Math.round(ms / 1000) });
      if (ms < 3_600_000) return t('schedule.everyMinutes', { count: Math.round(ms / 60_000) });
      if (ms < 86_400_000) return t('schedule.everyHours', { count: Math.round(ms / 3_600_000) });
      return t('schedule.everyDays', { count: Math.round(ms / 86_400_000) });
    }
    if (s.kind === 'at' && typeof s.at === 'string') {
      try {
        return t('schedule.onceAt', { time: new Date(s.at).toLocaleString() });
      } catch {
        return t('schedule.onceAt', { time: s.at });
      }
    }
    return String(schedule);
  }
  if (typeof schedule === 'string') {
    return parseCronExpr(schedule, t);
  }
  return String(schedule ?? t('schedule.unknown'));
}

function parseCronExpr(cron: string, t: TFunction<'cron'>): string {
  const preset = schedulePresets.find((p) => p.value === cron);
  if (preset) return t(`presets.${preset.key}` as const);
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;
  const [minute, hour, dayOfMonth, , dayOfWeek] = parts;
  if (minute === '*' && hour === '*') return t('presets.everyMinute');
  if (minute.startsWith('*/')) return t('schedule.everyMinutes', { count: Number(minute.slice(2)) });
  if (hour === '*' && minute === '0') return t('presets.everyHour');
  if (dayOfWeek !== '*' && dayOfMonth === '*') {
    return t('schedule.weeklyAt', { day: dayOfWeek, time: `${hour}:${minute.padStart(2, '0')}` });
  }
  if (dayOfMonth !== '*') {
    return t('schedule.monthlyAtDay', { day: dayOfMonth, time: `${hour}:${minute.padStart(2, '0')}` });
  }
  if (hour !== '*') {
    return t('schedule.dailyAt', { time: `${hour}:${minute.padStart(2, '0')}` });
  }
  return cron;
}

function estimateNextRun(scheduleExpr: string): string | null {
  const now = new Date();
  const next = new Date(now.getTime());
  if (scheduleExpr === '* * * * *') { next.setSeconds(0, 0); next.setMinutes(next.getMinutes() + 1); return next.toLocaleString(); }
  if (scheduleExpr === '*/5 * * * *') { const delta = 5 - (next.getMinutes() % 5 || 5); next.setSeconds(0, 0); next.setMinutes(next.getMinutes() + delta); return next.toLocaleString(); }
  if (scheduleExpr === '*/15 * * * *') { const delta = 15 - (next.getMinutes() % 15 || 15); next.setSeconds(0, 0); next.setMinutes(next.getMinutes() + delta); return next.toLocaleString(); }
  if (scheduleExpr === '0 * * * *') { next.setMinutes(0, 0, 0); next.setHours(next.getHours() + 1); return next.toLocaleString(); }
  if (scheduleExpr === '0 9 * * *' || scheduleExpr === '0 18 * * *') {
    const targetHour = scheduleExpr === '0 9 * * *' ? 9 : 18;
    next.setSeconds(0, 0); next.setHours(targetHour, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.toLocaleString();
  }
  if (scheduleExpr === '0 9 * * 1') { next.setSeconds(0, 0); next.setHours(9, 0, 0, 0); const day = next.getDay(); const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7; next.setDate(next.getDate() + daysUntilMonday); return next.toLocaleString(); }
  if (scheduleExpr === '0 9 1 * *') { next.setSeconds(0, 0); next.setDate(1); next.setHours(9, 0, 0, 0); if (next <= now) next.setMonth(next.getMonth() + 1); return next.toLocaleString(); }
  return null;
}

interface DeliveryChannelAccount { accountId: string; name: string; isDefault: boolean; }
interface DeliveryChannelGroup { channelType: string; defaultAccountId: string; accounts: DeliveryChannelAccount[]; }
interface ChannelTargetOption { value: string; label: string; kind: 'user' | 'group' | 'channel'; }

function isKnownChannelType(value: string): value is ChannelType { return value in CHANNEL_NAMES; }
function getChannelDisplayName(value: string): string { return isKnownChannelType(value) ? CHANNEL_NAMES[value] : value; }
function getDeliveryAccountDisplayName(account: DeliveryChannelAccount, t: TFunction): string {
  return account.accountId === 'default' && account.name === account.accountId ? t('channels:account.mainAccount') : account.name;
}
const TESTED_CRON_DELIVERY_CHANNELS = new Set<string>(['feishu', 'telegram', 'qqbot', 'wecom', 'wechat']);
function isSupportedCronDeliveryChannel(channelType: string): boolean { return TESTED_CRON_DELIVERY_CHANNELS.has(channelType); }

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> { children: ReactNode; }
function SelectField({ className, children, ...props }: SelectFieldProps) {
  return (
    <div className="relative">
      <Select className={cn('h-[44px] rounded-xl border-black/10 dark:border-white/10 bg-background text-[13px] pr-10 [background-image:none] appearance-none', className)} {...props}>
        {children}
      </Select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

// Template Card Component
interface TemplateCardProps {
  template: TaskTemplate;
  onSelect: (template: TaskTemplate) => void;
}

// Random hover colors for template cards
const HOVER_COLORS = [
  { bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'hover:border-rose-300 dark:hover:border-rose-700', shadow: 'hover:shadow-rose-200/50 dark:hover:shadow-rose-900/30', text: 'group-hover:text-rose-600 dark:group-hover:text-rose-400' },
  { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'hover:border-amber-300 dark:hover:border-amber-700', shadow: 'hover:shadow-amber-200/50 dark:hover:shadow-amber-900/30', text: 'group-hover:text-amber-600 dark:group-hover:text-amber-400' },
  { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'hover:border-emerald-300 dark:hover:border-emerald-700', shadow: 'hover:shadow-emerald-200/50 dark:hover:shadow-emerald-900/30', text: 'group-hover:text-emerald-600 dark:group-hover:text-emerald-400' },
  { bg: 'bg-sky-50 dark:bg-sky-950/30', border: 'hover:border-sky-300 dark:hover:border-sky-700', shadow: 'hover:shadow-sky-200/50 dark:hover:shadow-sky-900/30', text: 'group-hover:text-sky-600 dark:group-hover:text-sky-400' },
  { bg: 'bg-violet-50 dark:bg-violet-950/30', border: 'hover:border-violet-300 dark:hover:border-violet-700', shadow: 'hover:shadow-violet-200/50 dark:hover:shadow-violet-900/30', text: 'group-hover:text-violet-600 dark:group-hover:text-violet-400' },
  { bg: 'bg-pink-50 dark:bg-pink-950/30', border: 'hover:border-pink-300 dark:hover:border-pink-700', shadow: 'hover:shadow-pink-200/50 dark:hover:shadow-pink-900/30', text: 'group-hover:text-pink-600 dark:group-hover:text-pink-400' },
  { bg: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'hover:border-cyan-300 dark:hover:border-cyan-700', shadow: 'hover:shadow-cyan-200/50 dark:hover:shadow-cyan-900/30', text: 'group-hover:text-cyan-600 dark:group-hover:text-cyan-400' },
  { bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'hover:border-orange-300 dark:hover:border-orange-700', shadow: 'hover:shadow-orange-200/50 dark:hover:shadow-orange-900/30', text: 'group-hover:text-orange-600 dark:group-hover:text-orange-400' },
  { bg: 'bg-teal-50 dark:bg-teal-950/30', border: 'hover:border-teal-300 dark:hover:border-teal-700', shadow: 'hover:shadow-teal-200/50 dark:hover:shadow-teal-900/30', text: 'group-hover:text-teal-600 dark:group-hover:text-teal-400' },
];

// Get consistent color for each template based on ID
function getTemplateColor(templateId: string) {
  const hash = templateId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return HOVER_COLORS[hash % HOVER_COLORS.length];
}

function TemplateCard({ template, onSelect }: TemplateCardProps) {
  const { t } = useTranslation('cron');
  const color = getTemplateColor(template.id);

  return (
    <button
      onClick={() => onSelect(template)}
      className={cn(
        "group relative flex flex-col text-left p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10 transition-all duration-300",
        color.border,
        `hover:${color.bg}`,
        `hover:shadow-lg`,
        `hover:shadow-primary/5`,
        color.shadow
      )}
    >
      <div className={cn("absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300", color.bg)} />
      <div className="relative z-10">
        <h3 className={cn("text-[15px] font-semibold text-foreground mb-2 transition-colors", color.text)}>
          {t(template.titleKey)}
        </h3>
        <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-3 flex-1">
          {t(template.descriptionKey)}
        </p>
        <div className="mt-4">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/5 text-[11px] font-medium text-foreground/70 group-hover:bg-black/10 dark:group-hover:bg-white/10 transition-colors">
            <Timer className="h-3 w-3" />
            {parseCronSchedule(template.schedule, t)}
          </span>
        </div>
      </div>
    </button>
  );
}

// Create Form Component (inline, not dialog)
interface CreateFormProps {
  template?: TaskTemplate;
  configuredChannels: DeliveryChannelGroup[];
  onClose: () => void;
  onSave: (input: CronJobCreateInput) => Promise<void>;
}

function CreateForm({ template, configuredChannels, onClose, onSave }: CreateFormProps) {
  const { t } = useTranslation('cron');
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(template?.name || '');
  const [message, setMessage] = useState(template?.message || '');
  const [schedule, setSchedule] = useState(template?.schedule || '0 9 * * *');
  const [customSchedule, setCustomSchedule] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [deliveryMode, setDeliveryMode] = useState<'none' | 'announce'>(template?.deliveryMode || 'none');
  const [deliveryChannel, setDeliveryChannel] = useState('');
  const [deliveryTarget, setDeliveryTarget] = useState('');
  const [selectedDeliveryAccountId, setSelectedDeliveryAccountId] = useState('');
  const [channelTargetOptions, setChannelTargetOptions] = useState<ChannelTargetOption[]>([]);
  const [loadingChannelTargets, setLoadingChannelTargets] = useState(false);
  const schedulePreview = estimateNextRun(useCustom ? customSchedule : schedule);
  const selectableChannels = configuredChannels.filter((group) => isSupportedCronDeliveryChannel(group.channelType));
  const availableChannels = selectableChannels;
  const effectiveDeliveryChannel = deliveryChannel || (deliveryMode === 'announce' ? (availableChannels[0]?.channelType || '') : '');
  const unsupportedDeliveryChannel = !!effectiveDeliveryChannel && !isSupportedCronDeliveryChannel(effectiveDeliveryChannel);
  const selectedChannel = availableChannels.find((group) => group.channelType === effectiveDeliveryChannel);
  const deliveryAccountOptions = (selectedChannel?.accounts ?? []).map((account) => ({ accountId: account.accountId, displayName: getDeliveryAccountDisplayName(account, t) }));
  const effectiveDeliveryAccountId = selectedDeliveryAccountId || selectedChannel?.defaultAccountId || deliveryAccountOptions[0]?.accountId || '';
  const showsAccountSelector = (selectedChannel?.accounts.length ?? 0) > 0;
  const selectedResolvedAccountId = effectiveDeliveryAccountId || undefined;
  const availableTargetOptions = channelTargetOptions;

  useEffect(() => {
    if (deliveryMode !== 'announce') { setSelectedDeliveryAccountId(''); return; }
    if (!selectedDeliveryAccountId && selectedChannel?.defaultAccountId) { setSelectedDeliveryAccountId(selectedChannel.defaultAccountId); }
  }, [deliveryMode, selectedChannel?.defaultAccountId, selectedDeliveryAccountId]);

  useEffect(() => {
    if (deliveryMode !== 'announce' || !effectiveDeliveryChannel || unsupportedDeliveryChannel) { setChannelTargetOptions([]); setLoadingChannelTargets(false); return; }
    if (showsAccountSelector && !selectedResolvedAccountId) { setChannelTargetOptions([]); setLoadingChannelTargets(false); return; }
    let cancelled = false;
    setLoadingChannelTargets(true);
    const params = new URLSearchParams({ channelType: effectiveDeliveryChannel });
    if (selectedResolvedAccountId) params.set('accountId', selectedResolvedAccountId);
    void hostApiFetch<{ success: boolean; targets?: ChannelTargetOption[]; error?: string }>(`/api/channels/targets?${params.toString()}`).then((result) => {
      if (cancelled) return;
      if (!result.success) throw new Error(result.error || 'Failed to load channel targets');
      setChannelTargetOptions(result.targets || []);
    }).catch((error) => { if (!cancelled) { console.warn('Failed to load channel targets:', error); setChannelTargetOptions([]); } }).finally(() => { if (!cancelled) setLoadingChannelTargets(false); });
    return () => { cancelled = true; };
  }, [deliveryMode, effectiveDeliveryChannel, selectedResolvedAccountId, showsAccountSelector, unsupportedDeliveryChannel]);

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error(t('toast.nameRequired')); return; }
    if (!message.trim()) { toast.error(t('toast.messageRequired')); return; }
    const finalSchedule = useCustom ? customSchedule : schedule;
    if (!finalSchedule.trim()) { toast.error(t('toast.scheduleRequired')); return; }
    setSaving(true);
    try {
      const finalDelivery = deliveryMode === 'announce' ? { mode: 'announce' as const, channel: effectiveDeliveryChannel.trim(), ...(selectedResolvedAccountId ? { accountId: effectiveDeliveryAccountId } : {}), to: deliveryTarget.trim() } : { mode: 'none' as const };
      if (finalDelivery.mode === 'announce') {
        if (!finalDelivery.channel) { toast.error(t('toast.channelRequired')); return; }
        if (!isSupportedCronDeliveryChannel(finalDelivery.channel)) { toast.error(t('toast.deliveryChannelUnsupported', { channel: getChannelDisplayName(finalDelivery.channel) })); return; }
        if (!finalDelivery.to) { toast.error(t('toast.deliveryTargetRequired')); return; }
      }
      await onSave({ name: name.trim(), message: message.trim(), schedule: finalSchedule, delivery: finalDelivery, enabled });
      onClose();
      toast.success(t('toast.created'));
    } catch (err) { toast.error(String(err)); } finally { setSaving(false); }
  };

  return (
    <div className="mb-8 p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{t('dialog.createTitle')}</h3>
          {template && <p className="text-[13px] text-muted-foreground mt-1">{t('dialog.usingTemplate', { template: t(template.titleKey) })}</p>}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Name & Message */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-[13px] font-semibold">{t('dialog.taskName')}</Label>
            <Input id="name" placeholder={t('dialog.taskNamePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message" className="text-[13px] font-semibold">{t('dialog.message')}</Label>
            <Textarea id="message" placeholder={t('dialog.messagePlaceholder')} value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="rounded-xl resize-none" />
          </div>
        </div>

        {/* Right: Schedule & Delivery */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[13px] font-semibold">{t('dialog.schedule')}</Label>
            {!useCustom ? (
              <div className="grid grid-cols-4 gap-1.5">
                {schedulePresets.slice(4).map((preset) => (
                  <Button key={preset.value} type="button" variant={schedule === preset.value ? 'default' : 'outline'} size="sm" onClick={() => setSchedule(preset.value)} className="h-9 text-[11px] rounded-lg justify-start">
                    <Timer className="h-3 w-3 mr-1" />
                    {t(`presets.${preset.key}` as const)}
                  </Button>
                ))}
              </div>
            ) : (
              <Input placeholder={t('dialog.cronPlaceholder')} value={customSchedule} onChange={(e) => setCustomSchedule(e.target.value)} className="h-11 rounded-xl font-mono" />
            )}
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">{schedulePreview ? `${t('card.next')}: ${schedulePreview}` : ''}</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => setUseCustom(!useCustom)} className="text-[11px] h-6 px-2">
                {useCustom ? t('dialog.usePresets') : t('dialog.useCustomCron')}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] font-semibold">{t('dialog.deliveryTitle')}</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={deliveryMode === 'none' ? 'default' : 'outline'} size="sm" onClick={() => setDeliveryMode('none')} className="h-auto min-h-10 rounded-xl py-2 text-left">
                <span className="text-[12px] font-medium">{t('dialog.deliveryModeNone')}</span>
              </Button>
              <Button type="button" variant={deliveryMode === 'announce' ? 'default' : 'outline'} size="sm" onClick={() => setDeliveryMode('announce')} className="h-auto min-h-10 rounded-xl py-2 text-left">
                <span className="text-[12px] font-medium">{t('dialog.deliveryModeAnnounce')}</span>
              </Button>
            </div>

            {deliveryMode === 'announce' && (
              <div className="space-y-2 rounded-xl bg-black/5 dark:bg-white/5 p-3">
                <SelectField value={effectiveDeliveryChannel} onChange={(e) => { setDeliveryChannel(e.target.value); setSelectedDeliveryAccountId(''); setDeliveryTarget(''); }}>
                  <option value="">{t('dialog.selectChannel')}</option>
                  {availableChannels.map((group) => <option key={group.channelType} value={group.channelType}>{getChannelDisplayName(group.channelType)}</option>)}
                </SelectField>
                {showsAccountSelector && (
                  <SelectField value={effectiveDeliveryAccountId} onChange={(e) => { setSelectedDeliveryAccountId(e.target.value); setDeliveryTarget(''); }}>
                    <option value="">{t('dialog.selectDeliveryAccount')}</option>
                    {deliveryAccountOptions.map((opt) => <option key={opt.accountId} value={opt.accountId}>{opt.displayName}</option>)}
                  </SelectField>
                )}
                <SelectField value={deliveryTarget} onChange={(e) => setDeliveryTarget(e.target.value)} disabled={loadingChannelTargets || availableTargetOptions.length === 0}>
                  <option value="">{loadingChannelTargets ? t('dialog.loadingTargets') : t('dialog.selectDeliveryTarget')}</option>
                  {availableTargetOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </SelectField>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-6 pt-4 border-t border-black/5 dark:border-white/5">
        <div className="flex items-center gap-2">
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          <span className="text-[13px] text-muted-foreground">{t('dialog.enableImmediately')}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-full px-5">{t('common:actions.cancel', 'Cancel')}</Button>
          <Button onClick={handleSubmit} disabled={saving} className="rounded-full px-5">
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('common:status.saving', 'Saving...')}</> : <><CheckCircle2 className="h-4 w-4 mr-2" />{t('dialog.createTitle')}</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Job Card Component (same as before)
interface CronJobCardProps {
  job: CronJob;
  deliveryAccountName?: string;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onTrigger: () => Promise<void>;
}

function CronJobCard({ job, deliveryAccountName, onToggle, onEdit, onDelete, onTrigger }: CronJobCardProps) {
  const { t } = useTranslation('cron');
  const [triggering, setTriggering] = useState(false);
  const handleTrigger = async (e: React.MouseEvent) => { e.stopPropagation(); setTriggering(true); try { await onTrigger(); toast.success(t('toast.triggered')); } catch (error) { toast.error(t('toast.failedTrigger', { error: error instanceof Error ? error.message : String(error) })); } finally { setTriggering(false); } };
  const handleDelete = (e: React.MouseEvent) => { e.stopPropagation(); onDelete(); };
  const deliveryChannel = typeof job.delivery?.channel === 'string' ? job.delivery.channel : '';
  const deliveryLabel = deliveryChannel ? getChannelDisplayName(deliveryChannel) : '';
  const deliveryIcon = deliveryChannel && isKnownChannelType(deliveryChannel) ? CHANNEL_ICONS[deliveryChannel] : null;

  return (
    <div className="group flex flex-col p-5 rounded-2xl bg-transparent border border-transparent hover:bg-black/5 dark:hover:bg-white/5 transition-all relative overflow-hidden cursor-pointer" onClick={onEdit}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="h-[46px] w-[46px] shrink-0 flex items-center justify-center text-foreground bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-full shadow-sm group-hover:scale-105 transition-transform">
            <Clock className={cn("h-5 w-5", job.enabled ? "text-foreground" : "text-muted-foreground")} />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-[16px] font-semibold text-foreground truncate">{job.name}</h3>
              <div className={cn("w-2 h-2 rounded-full shrink-0", job.enabled ? "bg-green-500" : "bg-muted-foreground")} title={job.enabled ? t('stats.active') : t('stats.paused')} />
            </div>
            <p className="text-[13px] text-muted-foreground flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5" />
              {parseCronSchedule(job.schedule, t)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <Switch checked={job.enabled} onCheckedChange={onToggle} />
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-end mt-2 pl-[62px]">
        <div className="flex items-start gap-2 mb-3">
          <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
          <p className="text-[13.5px] text-muted-foreground line-clamp-2 leading-[1.5]">{job.message}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-muted-foreground/80 font-medium mb-3">
          {job.delivery?.mode === 'announce' && deliveryChannel && (
            <span className="flex items-center gap-1.5">{deliveryIcon}<span>{deliveryLabel}</span>{deliveryAccountName ? <span className="max-w-[220px] truncate">{deliveryAccountName}</span> : job.delivery.to && <span className="max-w-[220px] truncate">{job.delivery.to}</span>}</span>
          )}
          {job.lastRun && (
            <span className="flex items-center gap-1.5"><History className="h-3.5 w-3.5" />{t('card.last')}: {formatRelativeTime(job.lastRun.time)}{job.lastRun.success ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <XCircle className="h-3.5 w-3.5 text-red-500" />}</span>
          )}
          {job.nextRun && job.enabled && (
            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{t('card.next')}: {new Date(job.nextRun).toLocaleString()}</span>
          )}
        </div>
        {job.lastRun && !job.lastRun.success && job.lastRun.error && (
          <div className="flex items-start gap-2 p-2.5 mb-3 rounded-xl bg-destructive/10 border border-destructive/20 text-[13px] text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><span className="line-clamp-2">{job.lastRun.error}</span>
          </div>
        )}
        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity mt-auto">
          <Button variant="ghost" size="sm" onClick={handleTrigger} disabled={triggering} className="h-8 px-3 text-foreground/70 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-[13px] font-medium">
            {triggering ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}{t('card.runNow')}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDelete} className="h-8 px-3 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-lg text-[13px] font-medium">
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />{t('common:actions.delete', 'Delete')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Cron() {
  const { t } = useTranslation('cron');
  const { jobs, loading, error, fetchJobs, createJob, updateJob, toggleJob, deleteJob, triggerJob } = useCronStore();
  const gatewayStatus = useGatewayStore((state) => state.status);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | undefined>();
  const [editingJob, setEditingJob] = useState<CronJob | undefined>();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<{ id: string } | null>(null);
  const [configuredChannels, setConfiguredChannels] = useState<DeliveryChannelGroup[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');

  const isGatewayRunning = gatewayStatus.state === 'running';

  const fetchConfiguredChannels = useCallback(async () => {
    try {
      const response = await hostApiFetch<{ success: boolean; channels?: DeliveryChannelGroup[]; error?: string }>('/api/channels/accounts');
      if (!response.success) throw new Error(response.error || 'Failed to load delivery channels');
      setConfiguredChannels(response.channels || []);
    } catch (fetchError) { console.warn('Failed to load delivery channels:', fetchError); setConfiguredChannels([]); }
  }, []);

  useEffect(() => { if (isGatewayRunning) fetchJobs(); }, [fetchJobs, isGatewayRunning]);
  useEffect(() => { void fetchConfiguredChannels(); }, [fetchConfiguredChannels]);

  const safeJobs = Array.isArray(jobs) ? jobs : [];

  const handleSave = useCallback(async (input: CronJobCreateInput) => {
    if (editingJob) { await updateJob(editingJob.id, input); } else { await createJob(input); }
  }, [editingJob, createJob, updateJob]);

  const handleToggle = useCallback(async (id: string, enabled: boolean) => {
    try { await toggleJob(id, enabled); toast.success(enabled ? t('toast.enabled') : t('toast.paused')); } catch { toast.error(t('toast.failedUpdate')); }
  }, [toggleJob, t]);

  const handleSelectTemplate = (template: TaskTemplate) => {
    setSelectedTemplate(template);
    setShowCreateForm(true);
  };

  const handleCloseCreateForm = () => {
    setShowCreateForm(false);
    setSelectedTemplate(undefined);
  };

  const filteredTemplates = activeCategory === 'all' ? taskTemplates : taskTemplates.filter(t => t.category === activeCategory);

  if (loading) {
    return (
      <div className="flex flex-col -m-6 dark:bg-background min-h-[calc(100vh-2.5rem)] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col -m-6 dark:bg-background h-[calc(100vh-2.5rem)] overflow-hidden">
      <div className="w-full max-w-5xl mx-auto flex flex-col h-full p-10 pt-16">
        {/* Header */}
        <PageHeader
          title={t('title')}
          description={t('subtitle')}
          actions={
            <>
              <Button variant="outline" onClick={() => { void fetchJobs(); void fetchConfiguredChannels(); }} disabled={!isGatewayRunning} className="h-9 text-[13px] font-medium rounded-full px-4">
                <RefreshCw className="h-3.5 w-3.5 mr-2" />{t('refresh')}
              </Button>
              <Button onClick={() => { setSelectedTemplate(undefined); setShowCreateForm(true); }} disabled={!isGatewayRunning} className="h-9 text-[13px] font-medium rounded-full px-4">
                <Plus className="h-3.5 w-3.5 mr-2" />{t('newTask')}
              </Button>
            </>
          }
        />

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto pr-2 pb-10 min-h-0 -mr-2">
          {!isGatewayRunning && (
            <div className="mb-6 p-4 rounded-xl border border-yellow-500/50 bg-yellow-500/10 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              <span className="text-yellow-700 dark:text-yellow-400 text-sm font-medium">{t('gatewayWarning')}</span>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 rounded-xl border border-destructive/50 bg-destructive/10 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span className="text-destructive text-sm font-medium">{error}</span>
            </div>
          )}

          {/* Create Form (Inline) */}
          {showCreateForm && (
            <CreateForm template={selectedTemplate} configuredChannels={configuredChannels} onClose={handleCloseCreateForm} onSave={handleSave} />
          )}

          {/* Category Tabs */}
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all whitespace-nowrap',
                  activeCategory === cat.id ? 'bg-primary text-primary-foreground' : 'bg-black/5 dark:bg-white/5 text-foreground/70 hover:text-foreground'
                )}
              >
                {cat.icon}
                {t(cat.labelKey)}
              </button>
            ))}
          </div>

          {/* Template Grid */}
          {safeJobs.length === 0 && !showCreateForm && (
            <>
              <h2 className="text-[15px] font-semibold text-foreground mb-4">{t('templateGrid.title')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {filteredTemplates.map((template) => (
                  <TemplateCard key={template.id} template={template} onSelect={handleSelectTemplate} />
                ))}
              </div>
            </>
          )}

          {/* Existing Jobs */}
          {safeJobs.length > 0 && (
            <>
              <h2 className="text-[15px] font-semibold text-foreground mb-4">{t('templateGrid.existingTasks', { count: safeJobs.length })}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {safeJobs.map((job) => {
                  const channelGroup = configuredChannels.find((group) => group.channelType === job.delivery?.channel);
                  const account = channelGroup?.accounts.find((item) => item.accountId === job.delivery?.accountId);
                  const deliveryAccountName = account ? getDeliveryAccountDisplayName(account, t) : undefined;
                  return (
                    <CronJobCard key={job.id} job={job} deliveryAccountName={deliveryAccountName} onToggle={(enabled) => handleToggle(job.id, enabled)}
                      onEdit={() => { setEditingJob(job); setShowEditDialog(true); }}
                      onDelete={() => setJobToDelete({ id: job.id })} onTrigger={() => triggerJob(job.id)} />
                  );
                })}
              </div>

              {/* Show templates below existing jobs */}
              {!showCreateForm && (
                <>
                  <h2 className="text-[15px] font-semibold text-foreground mb-4 mt-8">{t('templateGrid.moreTemplates')}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTemplates.slice(0, 6).map((template) => (
                      <TemplateCard key={template.id} template={template} onSelect={handleSelectTemplate} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Edit Dialog (kept for editing existing jobs) */}
      {showEditDialog && editingJob && (
        <EditJobDialog job={editingJob} configuredChannels={configuredChannels} onClose={() => { setShowEditDialog(false); setEditingJob(undefined); }} onSave={handleSave} />
      )}

      <ConfirmDialog open={!!jobToDelete} title={t('common:actions.confirm', 'Confirm')} message={t('card.deleteConfirm')} confirmLabel={t('common:actions.delete', 'Delete')} cancelLabel={t('common:actions.cancel', 'Cancel')} variant="destructive"
        onConfirm={async () => { if (jobToDelete) { await deleteJob(jobToDelete.id); setJobToDelete(null); toast.success(t('toast.deleted')); } }} onCancel={() => setJobToDelete(null)} />
    </div>
  );
}

// Edit Job Dialog (simplified version)
interface EditJobDialogProps {
  job: CronJob;
  configuredChannels: DeliveryChannelGroup[];
  onClose: () => void;
  onSave: (input: CronJobCreateInput) => Promise<void>;
}

function EditJobDialog({ job, configuredChannels, onClose, onSave }: EditJobDialogProps) {
  const { t } = useTranslation('cron');
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(job.name);
  const [message, setMessage] = useState(job.message);
  const initialSchedule = typeof job.schedule === 'string' ? job.schedule : ('expr' in job.schedule ? job.schedule.expr : '0 9 * * *');
  const [schedule, setSchedule] = useState(initialSchedule);
  const [customSchedule, setCustomSchedule] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [enabled, setEnabled] = useState(job.enabled);
  const [deliveryMode, setDeliveryMode] = useState<'none' | 'announce'>(job.delivery?.mode === 'announce' ? 'announce' : 'none');
  const [deliveryChannel, setDeliveryChannel] = useState(job.delivery?.channel || '');
  const [deliveryTarget, setDeliveryTarget] = useState(job.delivery?.to || '');
  const [selectedDeliveryAccountId, setSelectedDeliveryAccountId] = useState(job.delivery?.accountId || '');
  const [channelTargetOptions, setChannelTargetOptions] = useState<ChannelTargetOption[]>([]);
  const [loadingChannelTargets, setLoadingChannelTargets] = useState(false);
  const schedulePreview = estimateNextRun(useCustom ? customSchedule : schedule);
  const selectableChannels = configuredChannels.filter((group) => isSupportedCronDeliveryChannel(group.channelType));
  const availableChannels = selectableChannels;
  const effectiveDeliveryChannel = deliveryChannel || (deliveryMode === 'announce' ? (availableChannels[0]?.channelType || '') : '');
  const unsupportedDeliveryChannel = !!effectiveDeliveryChannel && !isSupportedCronDeliveryChannel(effectiveDeliveryChannel);
  const selectedChannel = availableChannels.find((group) => group.channelType === effectiveDeliveryChannel);
  const deliveryAccountOptions = (selectedChannel?.accounts ?? []).map((account) => ({ accountId: account.accountId, displayName: getDeliveryAccountDisplayName(account, t) }));
  const effectiveDeliveryAccountId = selectedDeliveryAccountId || selectedChannel?.defaultAccountId || deliveryAccountOptions[0]?.accountId || '';
  const showsAccountSelector = (selectedChannel?.accounts.length ?? 0) > 0;
  const selectedResolvedAccountId = effectiveDeliveryAccountId || undefined;
  const availableTargetOptions = channelTargetOptions;

  useEffect(() => {
    if (deliveryMode !== 'announce') { setSelectedDeliveryAccountId(''); return; }
    if (!selectedDeliveryAccountId && selectedChannel?.defaultAccountId) { setSelectedDeliveryAccountId(selectedChannel.defaultAccountId); }
  }, [deliveryMode, selectedChannel?.defaultAccountId, selectedDeliveryAccountId]);

  useEffect(() => {
    if (deliveryMode !== 'announce' || !effectiveDeliveryChannel || unsupportedDeliveryChannel) { setChannelTargetOptions([]); setLoadingChannelTargets(false); return; }
    if (showsAccountSelector && !selectedResolvedAccountId) { setChannelTargetOptions([]); setLoadingChannelTargets(false); return; }
    let cancelled = false;
    setLoadingChannelTargets(true);
    const params = new URLSearchParams({ channelType: effectiveDeliveryChannel });
    if (selectedResolvedAccountId) params.set('accountId', selectedResolvedAccountId);
    void hostApiFetch<{ success: boolean; targets?: ChannelTargetOption[]; error?: string }>(`/api/channels/targets?${params.toString()}`).then((result) => {
      if (cancelled) return;
      if (!result.success) throw new Error(result.error || 'Failed to load channel targets');
      setChannelTargetOptions(result.targets || []);
    }).catch((error) => { if (!cancelled) { console.warn('Failed to load channel targets:', error); setChannelTargetOptions([]); } }).finally(() => { if (!cancelled) setLoadingChannelTargets(false); });
    return () => { cancelled = true; };
  }, [deliveryMode, effectiveDeliveryChannel, selectedResolvedAccountId, showsAccountSelector, unsupportedDeliveryChannel]);

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error(t('toast.nameRequired')); return; }
    if (!message.trim()) { toast.error(t('toast.messageRequired')); return; }
    const finalSchedule = useCustom ? customSchedule : schedule;
    if (!finalSchedule.trim()) { toast.error(t('toast.scheduleRequired')); return; }
    setSaving(true);
    try {
      const finalDelivery = deliveryMode === 'announce' ? { mode: 'announce' as const, channel: effectiveDeliveryChannel.trim(), ...(selectedResolvedAccountId ? { accountId: effectiveDeliveryAccountId } : {}), to: deliveryTarget.trim() } : { mode: 'none' as const };
      if (finalDelivery.mode === 'announce') {
        if (!finalDelivery.channel) { toast.error(t('toast.channelRequired')); return; }
        if (!isSupportedCronDeliveryChannel(finalDelivery.channel)) { toast.error(t('toast.deliveryChannelUnsupported', { channel: getChannelDisplayName(finalDelivery.channel) })); return; }
        if (!finalDelivery.to) { toast.error(t('toast.deliveryTargetRequired')); return; }
      }
      await onSave({ name: name.trim(), message: message.trim(), schedule: finalSchedule, delivery: finalDelivery, enabled });
      onClose();
      toast.success(t('toast.updated'));
    } catch (err) { toast.error(String(err)); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl border-0 shadow-2xl bg-[#f3f1e9] dark:bg-card overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-start justify-between pb-2 shrink-0">
          <div>
            <CardTitle className="text-2xl font-serif font-normal">{t('dialog.editTitle')}</CardTitle>
            <CardDescription className="text-[15px] mt-1 text-foreground/70">{t('dialog.description')}</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8 -mr-2 -mt-2 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 pt-4 overflow-y-auto flex-1 p-6">
          <div className="space-y-2"><Label htmlFor="edit-name" className="text-[14px] font-bold">{t('dialog.taskName')}</Label><Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" /></div>
          <div className="space-y-2"><Label htmlFor="edit-message" className="text-[14px] font-bold">{t('dialog.message')}</Label><Textarea id="edit-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="rounded-xl resize-none" /></div>
          <div className="space-y-2">
            <Label className="text-[14px] font-bold">{t('dialog.schedule')}</Label>
            {!useCustom ? (
              <div className="grid grid-cols-4 gap-1.5">
                {schedulePresets.slice(4).map((preset) => (
                  <Button key={preset.value} type="button" variant={schedule === preset.value ? 'default' : 'outline'} size="sm" onClick={() => setSchedule(preset.value)} className="h-9 text-[11px] rounded-lg justify-start">
                    <Timer className="h-3 w-3 mr-1" />{t(`presets.${preset.key}` as const)}
                  </Button>
                ))}
              </div>
            ) : (
              <Input placeholder={t('dialog.cronPlaceholder')} value={customSchedule} onChange={(e) => setCustomSchedule(e.target.value)} className="h-11 rounded-xl font-mono" />
            )}
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-muted-foreground">{schedulePreview ? `${t('card.next')}: ${schedulePreview}` : ''}</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => setUseCustom(!useCustom)} className="text-[12px] h-7 px-2">{useCustom ? t('dialog.usePresets') : t('dialog.useCustomCron')}</Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[14px] font-bold">{t('dialog.deliveryTitle')}</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={deliveryMode === 'none' ? 'default' : 'outline'} onClick={() => setDeliveryMode('none')} className="rounded-xl h-auto min-h-11 py-2"><span className="text-[12px] font-medium">{t('dialog.deliveryModeNone')}</span></Button>
              <Button type="button" variant={deliveryMode === 'announce' ? 'default' : 'outline'} onClick={() => setDeliveryMode('announce')} className="rounded-xl h-auto min-h-11 py-2"><span className="text-[12px] font-medium">{t('dialog.deliveryModeAnnounce')}</span></Button>
            </div>
            {deliveryMode === 'announce' && (
              <div className="space-y-2 rounded-xl bg-[#eeece3] dark:bg-muted p-3">
                <SelectField value={effectiveDeliveryChannel} onChange={(e) => { setDeliveryChannel(e.target.value); setSelectedDeliveryAccountId(''); setDeliveryTarget(''); }}>
                  <option value="">{t('dialog.selectChannel')}</option>
                  {availableChannels.map((group) => <option key={group.channelType} value={group.channelType}>{getChannelDisplayName(group.channelType)}</option>)}
                </SelectField>
                {showsAccountSelector && (
                  <SelectField value={effectiveDeliveryAccountId} onChange={(e) => { setSelectedDeliveryAccountId(e.target.value); setDeliveryTarget(''); }}>
                    <option value="">{t('dialog.selectDeliveryAccount')}</option>
                    {deliveryAccountOptions.map((opt) => <option key={opt.accountId} value={opt.accountId}>{opt.displayName}</option>)}
                  </SelectField>
                )}
                <SelectField value={deliveryTarget} onChange={(e) => setDeliveryTarget(e.target.value)} disabled={loadingChannelTargets || availableTargetOptions.length === 0}>
                  <option value="">{loadingChannelTargets ? t('dialog.loadingTargets') : t('dialog.selectDeliveryTarget')}</option>
                  {availableTargetOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </SelectField>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between bg-[#eeece3] dark:bg-muted p-3 rounded-xl">
            <span className="text-[14px] font-bold">{t('dialog.enableImmediately')}</span>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={onClose} className="rounded-full px-5">{t('common:actions.cancel', 'Cancel')}</Button>
            <Button onClick={handleSubmit} disabled={saving} className="rounded-full px-5">
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('common:status.saving', 'Saving...')}</> : <><CheckCircle2 className="h-4 w-4 mr-2" />{t('dialog.saveChanges')}</>}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Cron;
