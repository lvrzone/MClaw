/**
 * Quick Settings Component
 * Toggle switches for common preferences
 */
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Eye, ScrollText, Bell, LayoutGrid } from 'lucide-react';

interface QuickSettingsState {
  showThinking: boolean;
  autoScroll: boolean;
  soundNotify: boolean;
  compactMode: boolean;
}

const STORAGE_KEY = 'mclaw-quick-settings';

function loadSettings(): QuickSettingsState {
  if (typeof window === 'undefined') {
    return { showThinking: true, autoScroll: true, soundNotify: false, compactMode: false };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...{ showThinking: true, autoScroll: true, soundNotify: false, compactMode: false }, ...JSON.parse(stored) };
    }
  } catch {
    // ignore
  }
  return { showThinking: true, autoScroll: true, soundNotify: false, compactMode: false };
}

function saveSettings(settings: QuickSettingsState) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }
}

export function QuickSettings() {
  const { t } = useTranslation('dashboard');
  const [settings, setSettings] = useState<QuickSettingsState>(loadSettings);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const toggleSetting = (key: keyof QuickSettingsState) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const items: Array<{
    key: keyof QuickSettingsState;
    icon: React.ReactNode;
    label: string;
    description: string;
  }> = [
    {
      key: 'showThinking',
      icon: <Eye className="h-4 w-4 text-muted-foreground" />,
      label: t('status.showThinking'),
      description: t('status.showThinkingDesc'),
    },
    {
      key: 'autoScroll',
      icon: <ScrollText className="h-4 w-4 text-muted-foreground" />,
      label: t('status.autoScroll'),
      description: t('status.autoScrollDesc'),
    },
    {
      key: 'soundNotify',
      icon: <Bell className="h-4 w-4 text-muted-foreground" />,
      label: t('status.soundNotify'),
      description: t('status.soundNotifyDesc'),
    },
    {
      key: 'compactMode',
      icon: <LayoutGrid className="h-4 w-4 text-muted-foreground" />,
      label: t('status.compactMode'),
      description: t('status.compactModeDesc'),
    },
  ];

  return (
    <div className="bg-black/5 dark:bg-white/5 rounded-2xl border border-black/10 dark:border-white/10 p-4 space-y-3">
      {items.map((item) => (
        <div
          key={item.key}
          className="flex items-center justify-between py-1"
        >
          <div className="flex items-center gap-2.5">
            {item.icon}
            <div>
              <div className="text-[12px] font-medium text-foreground">{item.label}</div>
              <div className="text-[10px] text-muted-foreground">{item.description}</div>
            </div>
          </div>
          <Switch
            checked={settings[item.key]}
            onCheckedChange={() => toggleSetting(item.key)}
            className="shrink-0"
          />
        </div>
      ))}
    </div>
  );
}

export default QuickSettings;
