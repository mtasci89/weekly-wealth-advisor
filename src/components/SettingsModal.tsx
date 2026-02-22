import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Settings, Key, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { getApiKeys, saveApiKeys, ApiKeys } from '@/services/apiKeyStore';
import { useToast } from '@/hooks/use-toast';

interface SettingsModalProps {
  /** Anahtarlar kaydedildikten sonra çağrılır (örn. veriyi yeniden yükle) */
  onSave?: () => void;
  /** Tetikleyici buton etiketi; verilmezse sadece ayarlar ikonu gösterilir */
  triggerLabel?: string;
  /** Dışarıdan kontrol: true ise modal açılır */
  forceOpen?: boolean;
  /** Dışarıdan kapama callback'i */
  onForceClose?: () => void;
}

export default function SettingsModal({ onSave, triggerLabel, forceOpen, onForceClose }: SettingsModalProps = {}) {
  const [open, setOpen] = useState(false);

  // Dışarıdan açma talebi
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);
  const [keys, setKeys] = useState<ApiKeys>({ yahooFinance: '', claude: '', tavily: '', gemini: '' });
  const [showYahoo, setShowYahoo] = useState(false);
  const [showClaude, setShowClaude] = useState(false);
  const [showTavily, setShowTavily] = useState(false);
  const [showGemini, setShowGemini] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setKeys(getApiKeys());
    }
  }, [open]);

  const handleSave = () => {
    saveApiKeys(keys);
    toast({
      title: 'API Anahtarları Kaydedildi',
      description: 'Anahtarlarınız tarayıcı deposuna kaydedildi.',
    });
    setOpen(false);
    onSave?.();
  };

  const maskValue = (val: string) => {
    if (val.length <= 8) return '•'.repeat(val.length);
    return val.slice(0, 4) + '•'.repeat(val.length - 8) + val.slice(-4);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) onForceClose?.(); }}>
      <DialogTrigger asChild>
        {triggerLabel ? (
          <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            {triggerLabel}
          </button>
        ) : (
          <button className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <Settings className="w-5 h-5" />
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="glass-card border-border bg-card sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-foreground">
            <Key className="w-5 h-5 text-primary" />
            API Anahtarları
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          <p className="text-xs text-muted-foreground">
            Gerçek piyasa verilerine erişmek için API anahtarlarınızı girin. Anahtarlar yalnızca tarayıcınızın Local Storage'ında saklanır ve sunucuya gönderilmez.
          </p>

          {/* Yahoo Finance */}
          <div className="space-y-2">
            <Label className="text-sm font-mono text-foreground flex items-center gap-2">
              Yahoo Finance API Key
              {keys.yahooFinance ? (
                <CheckCircle className="w-3.5 h-3.5 text-primary" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </Label>
            <p className="text-[11px] text-muted-foreground">
              RapidAPI üzerinden Yahoo Finance API aboneliği alabilirsiniz →{' '}
              <a href="https://rapidapi.com/sparior/api/yahoo-finance15" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                rapidapi.com
              </a>
            </p>
            <div className="relative">
              <Input
                type={showYahoo ? 'text' : 'password'}
                placeholder="API anahtarınızı buraya yapıştırın..."
                value={keys.yahooFinance}
                onChange={e => setKeys(prev => ({ ...prev, yahooFinance: e.target.value }))}
                className="bg-secondary/50 border-border font-mono text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowYahoo(!showYahoo)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showYahoo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Claude API */}
          <div className="space-y-2">
            <Label className="text-sm font-mono text-foreground flex items-center gap-2">
              Claude API Key
              {keys.claude ? (
                <CheckCircle className="w-3.5 h-3.5 text-primary" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Anthropic Console'dan API anahtarı oluşturabilirsiniz →{' '}
              <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                console.anthropic.com
              </a>
            </p>
            <div className="relative">
              <Input
                type={showClaude ? 'text' : 'password'}
                placeholder="sk-ant-..."
                value={keys.claude}
                onChange={e => setKeys(prev => ({ ...prev, claude: e.target.value }))}
                className="bg-secondary/50 border-border font-mono text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowClaude(!showClaude)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showClaude ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Tavily API — web araştırması için */}
          <div className="space-y-2">
            <Label className="text-sm font-mono text-foreground flex items-center gap-2">
              Tavily API Key
              <span className="text-[10px] font-normal text-muted-foreground/70 bg-secondary/50 px-1.5 py-0.5 rounded">Opsiyonel</span>
              {keys.tavily ? (
                <CheckCircle className="w-3.5 h-3.5 text-primary" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Claude analizine güncel makroekonomik bağlam ekler (faiz, enflasyon, piyasa haberleri) →{' '}
              <a href="https://tavily.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                tavily.com
              </a>
            </p>
            <div className="relative">
              <Input
                type={showTavily ? 'text' : 'password'}
                placeholder="tvly-..."
                value={keys.tavily}
                onChange={e => setKeys(prev => ({ ...prev, tavily: e.target.value }))}
                className="bg-secondary/50 border-border font-mono text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowTavily(!showTavily)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showTavily ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Gemini API — AI chat asistanı için */}
          <div className="space-y-2">
            <Label className="text-sm font-mono text-foreground flex items-center gap-2">
              Gemini API Key
              <span className="text-[10px] font-normal text-muted-foreground/70 bg-secondary/50 px-1.5 py-0.5 rounded">AI Chat</span>
              {keys.gemini ? (
                <CheckCircle className="w-3.5 h-3.5 text-primary" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </Label>
            <p className="text-[11px] text-muted-foreground">
              AI Finans Asistanı için Gemini 2.0 Flash kullanır. Ücretsiz quota mevcut →{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                aistudio.google.com
              </a>
            </p>
            <div className="relative">
              <Input
                type={showGemini ? 'text' : 'password'}
                placeholder="AIza..."
                value={keys.gemini}
                onChange={e => setKeys(prev => ({ ...prev, gemini: e.target.value }))}
                className="bg-secondary/50 border-border font-mono text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowGemini(!showGemini)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showGemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} className="flex-1 font-mono text-sm">
              Kaydet
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)} className="font-mono text-sm">
              İptal
            </Button>
          </div>

          <div className="text-[10px] text-muted-foreground/60 border-t border-border pt-3">
            🔒 Anahtarlar yalnızca bu tarayıcıda saklanır. Farklı bir cihaz veya tarayıcıdan erişildiğinde tekrar girmeniz gerekir.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
