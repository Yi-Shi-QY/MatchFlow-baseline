import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings as SettingsIcon, Save, Activity, CheckCircle2, XCircle, BookOpen, Code, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Card, CardContent } from '@/src/components/ui/Card';
import { getSettings, saveSettings, AppSettings } from '@/src/services/settings';
import { testConnection } from '@/src/services/ai';

export default function Settings() {
  const navigate = useNavigate();
  const [settings, setLocalSettings] = useState<AppSettings>({
    provider: 'gemini',
    model: 'gemini-3-flash-preview',
    deepseekApiKey: '',
  });
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [showTutorial, setShowTutorial] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLocalSettings(getSettings());
  }, []);

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provider = e.target.value as 'gemini' | 'deepseek';
    setLocalSettings({
      ...settings,
      provider,
      model: provider === 'gemini' ? 'gemini-3-flash-preview' : 'deepseek-chat',
    });
    setTestStatus('idle');
    setTestMessage('');
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('');
    try {
      await testConnection(settings);
      setTestStatus('success');
      setTestMessage('连接成功！');
    } catch (e: any) {
      setTestStatus('error');
      setTestMessage(e.message || '连接失败。');
    }
  };

  const sampleJson = `{
  "data": [
    {
      "id": "match_1",
      "league": "Premier League",
      "date": "2024-03-10T15:00:00Z",
      "status": "upcoming",
      "homeTeam": {
        "name": "Arsenal",
        "logo": "https://example.com/arsenal.png"
      },
      "awayTeam": {
        "name": "Chelsea",
        "logo": "https://example.com/chelsea.png"
      },
      "stats": {
        "possession": { "home": 55, "away": 45 },
        "shots": { "home": 12, "away": 8 },
        "shotsOnTarget": { "home": 5, "away": 3 }
      },
      "customInfo": "Arsenal missing key midfielder due to injury."
    }
  ]
}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sampleJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
            
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">AI 提供商</label>
              <select 
                value={settings.provider}
                onChange={handleProviderChange}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="gemini">Google Gemini</option>
                <option value="deepseek">DeepSeek</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">模型</label>
              <select 
                value={settings.model}
                onChange={(e) => {
                  setLocalSettings({...settings, model: e.target.value});
                  setTestStatus('idle');
                }}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              >
                {settings.provider === 'gemini' ? (
                  <>
                    <option value="gemini-3-flash-preview">Gemini 3 Flash Preview (快速)</option>
                    <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview (智能)</option>
                  </>
                ) : (
                  <>
                    <option value="deepseek-chat">DeepSeek Chat (V3)</option>
                    <option value="deepseek-reasoner">DeepSeek Reasoner (R1 - 思考模型)</option>
                  </>
                )}
              </select>
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
                    setTestStatus('idle');
                  }}
                  placeholder="sk-..."
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  密钥仅保存在您的浏览器本地。您可以前往 <a href="https://platform.deepseek.com/" target="_blank" rel="noreferrer" className="text-emerald-500 hover:underline">DeepSeek 开放平台</a> 获取。
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-white/10 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" /> 赛事数据源 (可选)
              </h3>
              
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Server URL</label>
                <input 
                  type="text"
                  value={settings.matchDataServerUrl || ''}
                  onChange={(e) => setLocalSettings({...settings, matchDataServerUrl: e.target.value})}
                  placeholder="https://api.example.com"
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">API Key</label>
                <input 
                  type="password"
                  value={settings.matchDataApiKey || ''}
                  onChange={(e) => setLocalSettings({...settings, matchDataApiKey: e.target.value})}
                  placeholder="Bearer Token"
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  如果不配置，应用将使用内置的模拟数据。
                </p>
              </div>

              {/* Tutorial Section */}
              <div className="mt-4 border border-zinc-800 rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowTutorial(!showTutorial)}
                  className="w-full flex items-center justify-between p-3 bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors text-sm font-medium text-zinc-300"
                >
                  <span className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-500" />
                    如何搭建自定义数据源？
                  </span>
                  {showTutorial ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {showTutorial && (
                  <div className="p-4 bg-zinc-950/50 border-t border-zinc-800 space-y-4 text-xs text-zinc-400 leading-relaxed">
                    <p>
                      您可以搭建自己的服务器来提供实时的赛事数据。应用会向您配置的 <code className="text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded">Server URL</code> 发送 <code className="text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded">GET /matches</code> 请求。
                    </p>
                    
                    <div className="space-y-2">
                      <h4 className="font-bold text-zinc-300 flex items-center gap-1">
                        <Code className="w-3 h-3" /> 请求格式
                      </h4>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>Method: <code className="text-zinc-300">GET</code></li>
                        <li>Path: <code className="text-zinc-300">/matches</code></li>
                        <li>Headers: <code className="text-zinc-300">Authorization: Bearer [您的 API Key]</code></li>
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-zinc-300 flex items-center gap-1">
                          <Code className="w-3 h-3" /> 响应 JSON 格式示例
                        </h4>
                        <button 
                          onClick={handleCopy}
                          className="flex items-center gap-1 text-[10px] text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded transition-colors"
                        >
                          {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copied ? '已复制' : '复制代码'}
                        </button>
                      </div>
                      <pre className="bg-black border border-zinc-800 p-3 rounded-lg overflow-x-auto text-[10px] font-mono text-zinc-300">
                        {sampleJson}
                      </pre>
                    </div>
                    
                    <p className="text-[10px] text-zinc-500 italic">
                      提示：您可以将上述 JSON 格式提供给 ChatGPT 或 Claude，让它们帮您快速生成一个 Node.js 或 Python 的后端服务代码。
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 space-y-4">
              <div className="flex gap-3">
                <Button 
                  onClick={handleTestConnection} 
                  variant="outline"
                  className="flex-1 gap-2 border-zinc-700 bg-zinc-900 hover:bg-zinc-800"
                  disabled={testStatus === 'testing'}
                >
                  {testStatus === 'testing' ? (
                    <Activity className="w-4 h-4 animate-spin text-emerald-500" />
                  ) : (
                    <Activity className="w-4 h-4" />
                  )}
                  测试连接
                </Button>
                
                <Button 
                  onClick={handleSave} 
                  className="flex-1 gap-2"
                  variant={saved ? "outline" : "default"}
                >
                  <Save className="w-4 h-4" />
                  {saved ? "已保存！" : "保存设置"}
                </Button>
              </div>

              {testStatus !== 'idle' && (
                <div className={`flex items-center gap-2 text-xs p-3 rounded-lg border ${
                  testStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                  testStatus === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                  'bg-zinc-900 border-zinc-800 text-zinc-400'
                }`}>
                  {testStatus === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                  {testStatus === 'error' && <XCircle className="w-4 h-4 shrink-0" />}
                  {testStatus === 'testing' && <Activity className="w-4 h-4 shrink-0 animate-pulse" />}
                  <span className="break-all">{testMessage || '正在测试连接...'}</span>
                </div>
              )}
            </div>

          </CardContent>
        </Card>
      </main>
    </div>
  );
}
