import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Settings as SettingsIcon, Save, Activity, CheckCircle2, XCircle, Database, Cpu, Globe, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Card, CardContent } from '@/src/components/ui/Card';
import { Select } from '@/src/components/ui/Select';
import { getSettings, saveSettings, AppSettings } from '@/src/services/settings';
import { testConnection } from '@/src/services/ai';

export default function Settings() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [settings, setLocalSettings] = useState<AppSettings>({
    provider: 'gemini',
    model: 'gemini-3-flash-preview',
    deepseekApiKey: '',
    geminiApiKey: '',
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

  const [isBehaviorCollapsed, setIsBehaviorCollapsed] = useState(false);
  const [isAiConfigCollapsed, setIsAiConfigCollapsed] = useState(false);
  const [isDataSourceCollapsed, setIsDataSourceCollapsed] = useState(false);

  useEffect(() => {
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
    setLocalSettings({
      ...settings,
      provider: provider as 'gemini' | 'deepseek',
      model: provider === 'gemini' ? 'gemini-3-flash-preview' : 'deepseek-chat',
    });
    setAiTestStatus('idle');
    setAiTestMessage('');
  };

  const handleTestAiConnection = async () => {
    setAiTestStatus('testing');
    setAiTestMessage('');
    try {
      await testConnection(settings);
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
    { value: 'deepseek', label: 'DeepSeek' }
  ];

  const modelOptions = settings.provider === 'gemini' ? [
    { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview (Fast)' },
    { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview (Smart)' }
  ] : [
    { value: 'deepseek-chat', label: 'DeepSeek Chat (V3)' },
    { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner (R1)' }
  ];

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
                      onClick={() => setLocalSettings({...settings, enableBackgroundMode: !settings.enableBackgroundMode})}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${settings.enableBackgroundMode ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </div>

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
                  <div className="space-y-2 relative z-20">
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t('settings.ai_provider')}</label>
                    <Select
                      value={settings.provider}
                      onChange={handleProviderChange}
                      options={providerOptions}
                    />
                  </div>

                  <div className="space-y-2 relative z-10">
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t('settings.model')}</label>
                    <Select
                      value={settings.model}
                      onChange={(value) => {
                        setLocalSettings({...settings, model: value});
                        setAiTestStatus('idle');
                      }}
                      options={modelOptions}
                    />
                    {settings.model === 'deepseek-reasoner' && (
                      <p className="text-[10px] text-emerald-500/80 mt-1">
                        {t('settings.reasoner_warning')}
                      </p>
                    )}
                  </div>

                  {settings.provider === 'deepseek' && (
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

                  {settings.provider === 'gemini' && (
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

            <div className="pt-6 border-t border-white/10">
              <Button 
                onClick={handleSave} 
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                variant={saved ? "outline" : "default"}
              >
                <Save className="w-4 h-4" />
                {saved ? t('settings.saved') : t('settings.save_all')}
              </Button>
            </div>

          </CardContent>
        </Card>
      </main>
    </div>
  );
}
