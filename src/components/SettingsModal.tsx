import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Settings, Key, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { getApiKeys, saveApiKeys, ApiKeys } from '@/services/apiKeyStore';
import { useToast } from '@/hooks/use-toast';

export default function SettingsModal() {
  const [open, setOpen] = useState(false);
  const [keys, setKeys] = useState<ApiKeys>({ yahooFinance: '', claude: '' });
  const [showYahoo, setShowYahoo] = useState(false);
  const [showClaude, setShowClaude] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setKeys(getApiKeys());
    }
  }, [open]);

  const handleSave = () => {
    saveApiKeys(keys);
    toast({
      title: '✅ API Anahtarları Kaydedildi',
      description: 'Anahtarlarınız güvenli bir şekilde tarayıcı deposuna kaydedildi.',
    });
    setOpen(false);
  };

  const maskValue = (val: string) => {
    if (val.length <= 8) return '•'.repeat(val.length);
    return val.slice(0, 4) + '•'.repeat(val.length - 8) + val.slice(-4);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
          <Settings className="w-5 h-5" />
        </button>
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
