import React, { useState } from 'react';
import { Download, Wifi, WifiOff, RefreshCw, X, Smartphone, Monitor, Apple } from 'lucide-react';
import { usePWA } from '@/lib/usePWA';

export function PWAOfflineBanner() {
  const { isOnline } = usePWA();
  if (isOnline) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-blue-600 text-white px-4 py-2 flex items-center gap-2 text-sm font-medium shadow-lg">
      <WifiOff size={16} />
      <span>You're offline. Viewing cached data.</span>
    </div>
  );
}

export function PWAUpdateBanner({ updateAvailable, applyUpdate }) {
  if (!updateAvailable) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-xl px-4 py-3 flex items-center gap-3 shadow-xl max-w-sm">
      <RefreshCw size={18} className="shrink-0" />
      <div className="flex-1">
        <div className="font-semibold text-sm">Update Available</div>
        <div className="text-xs opacity-80">A new version is ready.</div>
      </div>
      <button
        onClick={applyUpdate}
        className="bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
      >
        Update
      </button>
    </div>
  );
}

function IOSInstructions({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 text-lg">Install on iOS</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <ol className="space-y-3 text-sm text-gray-700">
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-blue-900 text-white flex items-center justify-center text-xs font-bold shrink-0">1</span>
            <span>Open this page in <strong>Safari</strong> on your iPhone or iPad.</span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-blue-900 text-white flex items-center justify-center text-xs font-bold shrink-0">2</span>
            <span>Tap the <strong>Share button</strong> (the box with an arrow pointing up) at the bottom of the screen.</span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-blue-900 text-white flex items-center justify-center text-xs font-bold shrink-0">3</span>
            <span>Scroll down and tap <strong>"Add to Home Screen"</strong>.</span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-blue-900 text-white flex items-center justify-center text-xs font-bold shrink-0">4</span>
            <span>Tap <strong>"Add"</strong> in the top right corner.</span>
          </li>
        </ol>
        <p className="text-xs text-gray-500">The app icon will appear on your home screen and open in full-screen mode.</p>
        <button
          onClick={onClose}
          className="w-full bg-blue-900 text-white rounded-xl py-3 font-semibold text-sm"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

export function PWAInstallButton() {
  const { isInstallable, isInstalled, platform, install, updateAvailable, applyUpdate } = usePWA();
  const [showIOS, setShowIOS] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);

  const isIOS = platform === 'ios';
  const showButton = !isInstalled && (isInstallable || isIOS);

  const handleInstall = async () => {
    if (isIOS) { setShowIOS(true); return; }
    setInstalling(true);
    const ok = await install();
    setInstalling(false);
    if (ok) setInstalled(true);
  };

  if (installed) {
    return (
      <span className="text-xs text-blue-300 flex items-center gap-1 px-2">
        <Download size={13} /> Installed
      </span>
    );
  }

  return (
    <>
      {showButton && (
        <button
          onClick={handleInstall}
          disabled={installing}
          title={isIOS ? 'Add to Home Screen' : platform === 'android' ? 'Install App' : 'Install App'}
          className="flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--sidebar-foreground))] hover:text-[hsl(var(--sidebar-primary))] px-3 py-2 rounded-lg hover:bg-[hsl(var(--sidebar-accent))] transition-colors"
        >
          {isIOS ? <Apple size={16} /> : platform === 'android' ? <Smartphone size={16} /> : <Monitor size={16} />}
          <span className="hidden sm:inline">
            {installing ? 'Installing…' : isIOS ? 'Add to Home Screen' : 'Install App'}
          </span>
        </button>
      )}
      {updateAvailable && (
        <button
          onClick={applyUpdate}
          title="Update available"
          className="flex items-center gap-1.5 text-sm font-medium text-blue-400 px-3 py-2 rounded-lg hover:bg-[hsl(var(--sidebar-accent))] transition-colors"
        >
          <RefreshCw size={16} />
          <span className="hidden sm:inline">Update</span>
        </button>
      )}
      {showIOS && <IOSInstructions onClose={() => setShowIOS(false)} />}
    </>
  );
}
