import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings as SettingsIcon, Save, Activity, CheckCircle2, XCircle, Database, Cpu } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Card, CardContent } from '@/src/components/ui/Card';
import { Select } from '@/src/components/ui/Select';
import { getSettings, saveSettings, AppSettings } from '@/src/services/settings';
import { testConnection } from '@/src/services/ai';

export default function Settings() {
  const navigate = useNavigate();
  const [settings, setLocalSettings] = useState<AppSettings>({
    provider: 'gemini',
    model: 'gemini-3-flash-preview',
    deepseekApiKey: '',
    geminiApiKey: '',
    matchDataServerUrl: '',
    matchDataApiKey: '',
  });
  const [saved, setSaved] = useState(false);
  const [aiTestStatus, setAiTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [aiTestMessage, setAiTestMessage] = useState('');
  const [dataTestStatus, setDataTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [dataTestMessage, setDataTestMessage] = useState('');

  useEffect(() => {
    setLocalSettings(getSettings());
  }, []);

  const handleSave = () => {
    saveSettings(settings);
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
      setAiTestMessage('AI 模型连接成功！');
    } catch (e: any) {
      setAiTestStatus('error');
      setAiTestMessage(e.message || 'AI 模型连接失败。');
    }
  };

  const handleTestDataConnection = async () => {
    if (!settings.matchDataServerUrl) {
      setDataTestStatus('error');
      setDataTestMessage('请先输入 Server URL');
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
      setDataTestMessage('数据源连接成功！');
    } catch (e: any) {
      setDataTestStatus('error');
      setDataTestMessage(e.message || '数据源连接失败。');
    }
  };

  const providerOptions = [
    { value: 'gemini', label: 'Google Gemini' },
    { value: 'deepseek', label: 'DeepSeek' }
  ];

  const modelOptions = settings.provider === 'gemini' ? [
    { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview (快速)' },
    { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview (智能)' }
  ] : [
    { value: 'deepseek-chat', label: 'DeepSeek Chat (V3)' },
    { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner (R1 - 思考模型)' }
  ];

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans flex flex-col pb-20">
      <header className="sticky top-0 z-20 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="h-8 w-8 rounded-full bg-zinc-900 border border-white/10">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
            <SettingsIcon className="w-4 h-4 text-emerald-500" /> 设置
          </h1>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-6">
        <Card className="border-zinc-800 bg-zinc-950">
          <CardContent className="p-6 space-y-6">
            
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-500" /> AI 模型配置
              </h3>
              
              <div className="space-y-2 relative z-20">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">AI 提供商</label>
                <Select
                  value={settings.provider}
                  onChange={handleProviderChange}
                  options={providerOptions}
                />
              </div>

              <div className="space-y-2 relative z-10">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">模型</label>
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
                    注意：Reasoner 模型将在 Agent 运行环境中输出思考过程。
                  </p>
                )}
              </div>

              {settings.provider === 'deepseek' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">DeepSeek API Key</label>
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
                  <p className="text-[10px] text-zinc-500 mt-1">
                    密钥仅保存在您的浏览器本地。您可以前往 <a href="https://platform.deepseek.com/" target="_blank" rel="noreferrer" className="text-emerald-500 hover:underline">DeepSeek 开放平台</a> 获取。
                  </p>
                </div>
              )}

              {settings.provider === 'gemini' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Gemini API Key (可选)</label>
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
                  <p className="text-[10px] text-zinc-500 mt-1">
                    如果不填写，将使用系统默认的 API Key。您可以前往 <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-emerald-500 hover:underline">Google AI Studio</a> 获取。
                  </p>
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
                  测试 AI 模型连接
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
                    <span className="break-all">{aiTestMessage || '正在测试连接...'}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-white/10 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-500" /> 赛事数据源 (可选)
              </h3>
              
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Server URL</label>
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
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">API Key</label>
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
                  如果不配置，应用将使用内置的模拟数据。
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
                  测试数据源连接
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
                    <span className="break-all">{dataTestMessage || '正在测试连接...'}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-white/10">
              <Button 
                onClick={handleSave} 
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                variant={saved ? "outline" : "default"}
              >
                <Save className="w-4 h-4" />
                {saved ? "已保存！" : "保存所有设置"}
              </Button>
            </div>

          </CardContent>
        </Card>
      </main>
    </div>
  );
}
