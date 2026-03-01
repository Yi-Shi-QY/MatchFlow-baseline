import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Settings as SettingsIcon, Save, Activity, CheckCircle2, XCircle, Database, Cpu, Globe, Layers, ChevronDown, ChevronUp, Bell, Send, Package } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Card, CardContent } from '@/src/components/ui/Card';
import { Select } from '@/src/components/ui/Select';
import { getSettings, saveSettings, AppSettings, AIProvider } from '@/src/services/settings';
import { testConnection } from '@/src/services/ai';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { AGENT_MODEL_CONFIG, ALL_AGENT_IDS } from '@/src/config/agentModelConfig';

export default function Settings() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [settings, setLocalSettings] = useState<AppSettings>({
    provider: 'gemini',
    model: 'gemini-3-flash-preview',
    agentModelMode: 'global',
    deepseekApiKey: '',
    geminiApiKey: '',
    openaiCompatibleBaseUrl: 'https://api.openai.com/v1',
    openaiCompatibleApiKey: '',
    matchDataServerUrl: '',
    matchDataApiKey: '',
    language: 'en',
    enableBackgroundMode: false,
    enableAutonomousPlanning: false,
  });
  const [saved, setSaved] = useState(false);
  const [aiTestStatus, setAiTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [aiTestMessage, setAiTestMessage] = useState('');
  const [dataTestStatus, setDataTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [dataTestMessage, setDataTestMessage] = useState('');

  const [isBehaviorCollapsed, setIsBehaviorCollapsed] = useState(true);
  const [isAiConfigCollapsed, setIsAiConfigCollapsed] = useState(true);
  const [isDataSourceCollapsed, setIsDataSourceCollapsed] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<string>('unknown');

  useEffect(() => {
    const checkPermission = async () => {
      if (Capacitor.isNativePlatform()) {
        const status = await LocalNotifications.checkPermissions();
        setNotificationPermission(status.display);
      }
    };
    checkPermission();

    const loadedSettings = getSettings();
    setLocalSettings(loadedSettings);
    // Sync i18n language with settings
    if (loadedSettings.language && loadedSettings.language !== i18n.language) {
      i18n.changeLanguage(loadedSettings.language);
    }
  }, [i18n]);

  const handleSave = () => {
    saveSettings(settings);
    // Apply language change immediately
    if (settings.language !== i18n.language) {
      i18n.changeLanguage(settings.language);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleProviderChange = (provider: string) => {
    const nextProvider = provider as AIProvider;
    const nextModel = nextProvider === 'gemini'
      ? 'gemini-3-flash-preview'
      : nextProvider === 'deepseek'
        ? 'deepseek-chat'
        : 'gpt-4o-mini';
    setLocalSettings({
      ...settings,
      provider: nextProvider,
      model: nextModel,
    });
    setAiTestStatus('idle');
    setAiTestMessage('');
  };

  const handleTestAiConnection = async () => {
    setAiTestStatus('testing');
    setAiTestMessage('');
    try {
      if (settings.agentModelMode === 'config') {
        const targetsMap = new Map<string, { provider: AIProvider; model: string }>();
        const configuredAgentIds = new Set<string>();

        Object.entries(AGENT_MODEL_CONFIG).forEach(([agentId, config]) => {
          if (!config?.provider || !config?.model) return;
          configuredAgentIds.add(agentId);
          targetsMap.set(`${config.provider}:${config.model}`, {
            provider: config.provider,
            model: config.model
          });
        });

        const hasFallbackAgents = ALL_AGENT_IDS.some(id => !configuredAgentIds.has(id));
        if (hasFallbackAgents || targetsMap.size === 0) {
          targetsMap.set(`${settings.provider}:${settings.model}`, {
            provider: settings.provider,
            model: settings.model
          });
        }

        for (const target of targetsMap.values()) {
          await testConnection({
            ...settings,
            provider: target.provider,
            model: target.model
          });
        }
      } else {
        await testConnection(settings);
      }

      setAiTestStatus('success');
      setAiTestMessage(t('settings.ai_connected'));
    } catch (e: any) {
      setAiTestStatus('error');
      setAiTestMessage(e.message || t('settings.ai_failed'));
    }
  };

  const handleTestDataConnection = async () => {
    if (!settings.matchDataServerUrl) {
      setDataTestStatus('error');
      setDataTestMessage(t('settings.enter_server_url'));
      return;
    }
    
    setDataTestStatus('testing');
    setDataTestMessage('');
    try {
      const headers: Record<string, string> = {};
      if (settings.matchDataApiKey) {
        headers['Authorization'] = `Bearer ${settings.matchDataApiKey}`;
      }
      
      const response = await fetch(`${settings.matchDataServerUrl}/matches?limit=1`, {
        headers
      });
      
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }
      
      setDataTestStatus('success');
      setDataTestMessage(t('settings.data_connected'));
    } catch (e: any) {
      setDataTestStatus('error');
      setDataTestMessage(e.message || t('settings.data_failed'));
    }
  };

  const providerOptions = [
    { value: 'gemini', label: 'Google Gemini' },
    { value: 'deepseek', label: 'DeepSeek' },
    { value: 'openai_compatible', label: 'OpenAI-Compatible' }
  ];

  const openAIBaseModelOptions = [
    { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
    { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini' },
    { value: 'o3-mini', label: 'o3-mini' }
  ];
  const openAIModelOptions = openAIBaseModelOptions.some(opt => opt.value === settings.model)
    ? openAIBaseModelOptions
    : [{ value: settings.model, label: settings.model }, ...openAIBaseModelOptions];

  const modelOptions = settings.provider === 'gemini'
    ? [
      { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview (Fast)' },
      { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview (Smart)' }
    ]
    : settings.provider === 'deepseek'
      ? [
        { value: 'deepseek-chat', label: 'DeepSeek Chat (V3)' },
        { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner (R1)' }
      ]
      : openAIModelOptions;

  const modelModeOptions = [
    { value: 'global', label: t('settings.model_mode_global') },
    { value: 'config', label: t('settings.model_mode_config') }
  ];

  const configEntries = React.useMemo(() => {
    return Object.entries(AGENT_MODEL_CONFIG)
      .filter(([, value]) => !!value?.provider && !!value?.model)
      .map(([agentId, value]) => ({
        agentId,
        provider: value!.provider,
        model: value!.model
      }));
  }, []);

  const configuredAgentIds = React.useMemo(
    () => new Set(configEntries.map(entry => entry.agentId)),
    [configEntries]
  );

  const configMissingAgents = React.useMemo(
    () => ALL_AGENT_IDS.filter(id => !configuredAgentIds.has(id)),
    [configuredAgentIds]
  );

  const configProviders = React.useMemo(
    () => new Set(configEntries.map(entry => entry.provider)),
    [configEntries]
  );

  const showGeminiKeyInput = settings.agentModelMode === 'global'
    ? settings.provider === 'gemini'
    : configProviders.has('gemini') || settings.provider === 'gemini';
  const showDeepseekKeyInput = settings.agentModelMode === 'global'
    ? settings.provider === 'deepseek'
    : configProviders.has('deepseek') || settings.provider === 'deepseek';
  const showOpenAICompatibleInput = settings.agentModelMode === 'global'
    ? settings.provider === 'openai_compatible'
    : configProviders.has('openai_compatible') || settings.provider === 'openai_compatible';

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans flex flex-col pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="h-8 w-8 rounded-full bg-zinc-900 border border-white/10">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
            <SettingsIcon className="w-4 h-4 text-emerald-500" /> {t('settings.title')}
          </h1>
        </div>
        <Button 
          onClick={handleSave} 
          size="sm"
          className="h-8 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3"
          variant={saved ? "outline" : "default"}
        >
          <Save className="w-3.5 h-3.5" />
          {saved ? t('settings.saved') : t('settings.save_all')}
        </Button>
      </header>

      <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-6">
        <Card className="border-zinc-800 bg-zinc-950">
          <CardContent className="p-6 space-y-6">
            
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-500" /> {t('settings.language_settings')}
              </h3>
              
              <div className="space-y-2">
                <Select
                  value={settings.language || 'en'}
                  onChange={(value) => {
                    setLocalSettings({...settings, language: value as 'en' | 'zh'});
                  }}
                  options={[
                    { value: 'en', label: 'English' },
                    { value: 'zh', label: '中文 (Chinese)' }
                  ]}
                />
              </div>
            </div>

            <div className="pt-6 border-t border-white/10 space-y-4">
              <div 
                className="flex items-center justify-between cursor-pointer group"
                onClick={() => setIsBehaviorCollapsed(!isBehaviorCollapsed)}
              >
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-500" /> {settings.language === 'zh' ? '行为与规划' : 'Behavior & Planning'}
                </h3>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 group-hover:text-white">
                  {isBehaviorCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </Button>
              </div>

              {!isBehaviorCollapsed && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg border border-white/5">
                    <div className="space-y-0.5 pr-4">
                      <label className="text-xs font-medium text-zinc-200 block">{t('settings.background_mode')}</label>
                      <p className="text-[10px] text-zinc-500">{t('settings.background_mode_desc')}</p>
                    </div>
                    <div 
                      className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors shrink-0 ${settings.enableBackgroundMode ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                      onClick={async () => {
                        const newValue = !settings.enableBackgroundMode;
                        if (newValue && Capacitor.isNativePlatform()) {
                          try {
                            const permission = await LocalNotifications.requestPermissions();
                            console.log('Permission request result:', permission);
                            if (permission.display !== 'granted') {
                              alert(settings.language === 'zh' ? '请授予通知权限以启用后台模式' : 'Please grant notification permission to enable background mode');
                              return;
                            }
                          } catch (err) {
                            console.error('Failed to request permissions', err);
                            alert(settings.language === 'zh' ? '请求权限失败，请在系统设置中手动开启' : 'Failed to request permission, please enable in system settings');
                          }
                        }
                        const newSettings = {...settings, enableBackgroundMode: newValue};
                        setLocalSettings(newSettings);
                        saveSettings(newSettings); // Make it live
                      }}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${settings.enableBackgroundMode ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </div>

                  {settings.enableBackgroundMode && (
                    <div className="pt-2 space-y-2">
                      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/30 rounded-lg border border-white/5">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                          {settings.language === 'zh' ? '通知权限状态' : 'Notification Permission'}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          notificationPermission === 'granted' ? 'text-emerald-500 bg-emerald-500/10' : 
                          notificationPermission === 'denied' ? 'text-red-500 bg-red-500/10' : 
                          'text-zinc-500 bg-zinc-500/10'
                        }`}>
                          {notificationPermission === 'granted' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {notificationPermission === 'granted' ? (settings.language === 'zh' ? '已授权' : 'Granted') : 
                           notificationPermission === 'denied' ? (settings.language === 'zh' ? '已拒绝' : 'Denied') : 
                           (settings.language === 'zh' ? '未请求' : 'Not Requested')}
                        </span>
                      </div>
                      <Button 
                        onClick={async () => {
                          if (Capacitor.isNativePlatform()) {
                            const permission = await LocalNotifications.checkPermissions();
                            if (permission.display !== 'granted') {
                              await LocalNotifications.requestPermissions();
                            }
                          }
                          
                          await LocalNotifications.schedule({
                            notifications: [{
                              id: 999,
                              title: settings.language === 'zh' ? '测试通知' : 'Test Notification',
                              body: settings.language === 'zh' ? '如果你看到这条通知，说明后台通知功能正常。' : 'If you see this, background notifications are working.',
                              schedule: { at: new Date(Date.now() + 1000) }
                            }]
                          });
                          
                          if (!Capacitor.isNativePlatform()) {
                            alert(settings.language === 'zh' ? '测试通知已发送（仅原生平台显示）' : 'Test notification scheduled (native only)');
                          }
                        }}
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-white"
                      >
                        <Send className="w-3 h-3" />
                        {settings.language === 'zh' ? '发送测试通知' : 'Send Test Notification'}
                      </Button>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg border border-white/5">
                    <div className="space-y-0.5 pr-4">
                      <label className="text-xs font-medium text-zinc-200 block">{settings.language === 'zh' ? '自主规划模式' : 'Autonomous Planning Mode'}</label>
                      <p className="text-[10px] text-zinc-500">{settings.language === 'zh' ? '开启后，AI 将完全自主决定分析结构，不再使用预设模板。' : 'When enabled, AI will completely autonomously decide the analysis structure instead of using predefined templates.'}</p>
                    </div>
                    <div 
                      className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors shrink-0 ${settings.enableAutonomousPlanning ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                      onClick={() => setLocalSettings({...settings, enableAutonomousPlanning: !settings.enableAutonomousPlanning})}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${settings.enableAutonomousPlanning ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-white/10 space-y-4">
              <div 
                className="flex items-center justify-between cursor-pointer group"
                onClick={() => setIsAiConfigCollapsed(!isAiConfigCollapsed)}
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-emerald-500" /> {t('settings.ai_config')}
                  </h3>
                  {aiTestStatus === 'success' && <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {t('settings.ai_connected')}</span>}
                  {aiTestStatus === 'error' && <span className="text-[10px] text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full flex items-center gap-1"><XCircle className="w-3 h-3" /> {t('settings.ai_failed')}</span>}
                  {aiTestStatus === 'testing' && <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1"><Activity className="w-3 h-3 animate-spin" /> {t('settings.testing')}</span>}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 group-hover:text-white">
                  {isAiConfigCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </Button>
              </div>
              
              {!isAiConfigCollapsed && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="space-y-2 relative z-30">
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t('settings.model_mode')}</label>
                    <Select
                      value={settings.agentModelMode}
                      onChange={(value) => {
                        setLocalSettings({...settings, agentModelMode: value as 'global' | 'config'});
                        setAiTestStatus('idle');
                      }}
                      options={modelModeOptions}
                    />
                    <p className="text-[10px] text-zinc-500">
                      {settings.agentModelMode === 'global'
                        ? t('settings.model_mode_global_desc')
                        : t('settings.model_mode_config_desc')}
                    </p>
                  </div>

                  <div className="space-y-2 relative z-20">
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t('settings.ai_provider')}</label>
                    <Select
                      value={settings.provider}
                      onChange={handleProviderChange}
                      options={providerOptions}
                    />
                    {settings.agentModelMode === 'config' && (
                      <p className="text-[10px] text-zinc-500">{t('settings.global_fallback_hint')}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      {settings.agentModelMode === 'config'
                        ? t('settings.global_fallback_model')
                        : t('settings.model')}
                    </label>
                    {settings.provider === 'openai_compatible' ? (
                      <>
                        <input
                          type="text"
                          value={settings.model}
                          onChange={(e) => {
                            setLocalSettings({...settings, model: e.target.value});
                            setAiTestStatus('idle');
                          }}
                          placeholder="gpt-4o-mini / o3-mini / your-model-id"
                          className="w-full bg-zinc-900 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                        <Select
                          value={settings.model}
                          onChange={(value) => {
                            setLocalSettings({...settings, model: value});
                            setAiTestStatus('idle');
                          }}
                          options={modelOptions}
                        />
                      </>
                    ) : (
                      <Select
                        value={settings.model}
                        onChange={(value) => {
                          setLocalSettings({...settings, model: value});
                          setAiTestStatus('idle');
                        }}
                        options={modelOptions}
                      />
                    )}
                    {settings.model === 'deepseek-reasoner' && (
                      <p className="text-[10px] text-emerald-500/80 mt-1">
                        {t('settings.reasoner_warning')}
                      </p>
                    )}
                  </div>

                  {settings.agentModelMode === 'config' && (
                    <div className="space-y-2 border border-white/10 rounded-lg p-3 bg-zinc-900/40">
                      <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t('settings.config_preview')}</label>
                      <p className="text-[10px] text-zinc-500">
                        {t('settings.config_file_hint')} <span className="font-mono text-zinc-300">src/config/agentModelConfig.ts</span>
                      </p>
                      <div className="max-h-44 overflow-auto space-y-1 pr-1">
                        {configEntries.map(entry => (
                          <div
                            key={entry.agentId}
                            className="flex items-center justify-between text-[11px] bg-black/30 border border-white/5 rounded px-2 py-1"
                          >
                            <span className="font-mono text-zinc-300">{entry.agentId}</span>
                            <span className="text-zinc-500">
                              {entry.provider} / <span className="text-zinc-300">{entry.model}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                      {configMissingAgents.length > 0 && (
                        <p className="text-[10px] text-amber-400">
                          {t('settings.config_missing_agents')}: {configMissingAgents.join(', ')}
                        </p>
                      )}
                    </div>
                  )}

                  {showDeepseekKeyInput && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t('settings.deepseek_api_key')}</label>
                      <input 
                        type="password"
                        value={settings.deepseekApiKey}
                        onChange={(e) => {
                          setLocalSettings({...settings, deepseekApiKey: e.target.value});
                          setAiTestStatus('idle');
                        }}
                        placeholder="sk-..."
                        className="w-full bg-zinc-900 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                      <p className="text-[10px] text-zinc-500 mt-1" dangerouslySetInnerHTML={{__html: t('settings.deepseek_key_hint')}} />
                    </div>
                  )}

                  {showGeminiKeyInput && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t('settings.gemini_api_key_optional')}</label>
                      <input 
                        type="password"
                        value={settings.geminiApiKey || ''}
                        onChange={(e) => {
                          setLocalSettings({...settings, geminiApiKey: e.target.value});
                          setAiTestStatus('idle');
                        }}
                        placeholder="AIzaSy..."
                        className="w-full bg-zinc-900 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                      <p className="text-[10px] text-zinc-500 mt-1" dangerouslySetInnerHTML={{__html: t('settings.gemini_key_hint')}} />
                    </div>
                  )}

                  {showOpenAICompatibleInput && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t('settings.openai_base_url')}</label>
                        <input
                          type="text"
                          value={settings.openaiCompatibleBaseUrl || ''}
                          onChange={(e) => {
                            setLocalSettings({...settings, openaiCompatibleBaseUrl: e.target.value});
                            setAiTestStatus('idle');
                          }}
                          placeholder="https://api.openai.com/v1"
                          className="w-full bg-zinc-900 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                        <p className="text-[10px] text-zinc-500">
                          {t('settings.openai_base_url_hint')}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t('settings.openai_api_key_optional')}</label>
                        <input
                          type="password"
                          value={settings.openaiCompatibleApiKey || ''}
                          onChange={(e) => {
                            setLocalSettings({...settings, openaiCompatibleApiKey: e.target.value});
                            setAiTestStatus('idle');
                          }}
                          placeholder="sk-..."
                          className="w-full bg-zinc-900 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                        <p className="text-[10px] text-zinc-500">
                          {t('settings.openai_api_key_hint')}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <Button 
                      onClick={handleTestAiConnection} 
                      variant="outline"
                      className="w-full gap-2 border-zinc-700 bg-zinc-900 hover:bg-zinc-800"
                      disabled={aiTestStatus === 'testing'}
                    >
                      {aiTestStatus === 'testing' ? (
                        <Activity className="w-4 h-4 animate-spin text-emerald-500" />
                      ) : (
                        <Cpu className="w-4 h-4" />
                      )}
                      {t('settings.test_ai_connection')}
                    </Button>
                    
                    {aiTestStatus !== 'idle' && (
                      <div className={`mt-3 flex items-center gap-2 text-xs p-3 rounded-lg border ${
                        aiTestStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                        aiTestStatus === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                        'bg-zinc-900 border-zinc-800 text-zinc-400'
                      }`}>
                        {aiTestStatus === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                        {aiTestStatus === 'error' && <XCircle className="w-4 h-4 shrink-0" />}
                        {aiTestStatus === 'testing' && <Activity className="w-4 h-4 shrink-0 animate-pulse" />}
                        <span className="break-all">{aiTestMessage || t('settings.testing')}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-white/10 space-y-4">
              <div 
                className="flex items-center justify-between cursor-pointer group"
                onClick={() => setIsDataSourceCollapsed(!isDataSourceCollapsed)}
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-500" /> {t('settings.match_data_source')}
                  </h3>
                  {dataTestStatus === 'success' && <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {t('settings.data_connected')}</span>}
                  {dataTestStatus === 'error' && <span className="text-[10px] text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full flex items-center gap-1"><XCircle className="w-3 h-3" /> {t('settings.data_failed')}</span>}
                  {dataTestStatus === 'testing' && <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1"><Activity className="w-3 h-3 animate-spin" /> {t('settings.testing')}</span>}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 group-hover:text-white">
                  {isDataSourceCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </Button>
              </div>
              
              {!isDataSourceCollapsed && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t('settings.server_url')}</label>
                    <input 
                      type="text"
                      value={settings.matchDataServerUrl || ''}
                      onChange={(e) => {
                        setLocalSettings({...settings, matchDataServerUrl: e.target.value});
                        setDataTestStatus('idle');
                      }}
                      placeholder="https://api.example.com"
                      className="w-full bg-zinc-900 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t('settings.api_key_label')}</label>
                    <input 
                      type="password"
                      value={settings.matchDataApiKey || ''}
                      onChange={(e) => {
                        setLocalSettings({...settings, matchDataApiKey: e.target.value});
                        setDataTestStatus('idle');
                      }}
                      placeholder="Bearer Token"
                      className="w-full bg-zinc-900 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <p className="text-[10px] text-zinc-500 mt-1">
                      {t('settings.match_data_hint')}
                    </p>
                  </div>

                  <div className="pt-2">
                    <Button 
                      onClick={handleTestDataConnection} 
                      variant="outline"
                      className="w-full gap-2 border-zinc-700 bg-zinc-900 hover:bg-zinc-800"
                      disabled={dataTestStatus === 'testing'}
                    >
                      {dataTestStatus === 'testing' ? (
                        <Activity className="w-4 h-4 animate-spin text-emerald-500" />
                      ) : (
                        <Database className="w-4 h-4" />
                      )}
                      {t('settings.test_data_connection')}
                    </Button>
                    
                    {dataTestStatus !== 'idle' && (
                      <div className={`mt-3 flex items-center gap-2 text-xs p-3 rounded-lg border ${
                        dataTestStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                        dataTestStatus === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                        'bg-zinc-900 border-zinc-800 text-zinc-400'
                      }`}>
                        {dataTestStatus === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                        {dataTestStatus === 'error' && <XCircle className="w-4 h-4 shrink-0" />}
                        {dataTestStatus === 'testing' && <Activity className="w-4 h-4 shrink-0 animate-pulse" />}
                        <span className="break-all">{dataTestMessage || t('settings.testing')}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-white/10 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-500" /> {t('settings.extension_hub')}
              </h3>
              <p className="text-[10px] text-zinc-500">
                {t('settings.extension_hub_desc')}
              </p>
              <Button
                onClick={() => navigate('/extensions')}
                variant="outline"
                className="w-full gap-2 border-zinc-700 bg-zinc-900 hover:bg-zinc-800"
              >
                <Package className="w-4 h-4" />
                {t('settings.open_extension_hub')}
              </Button>
            </div>



          </CardContent>
        </Card>
      </main>
    </div>
  );
}
