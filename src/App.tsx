import React, { useEffect } from 'react';
import { OverlayApp } from './OverlayApp';
import { SettingsPanel } from './SettingsPanel';

function getRoute() {
  const hash = window.location.hash.replace(/^#/, '') || '/overlay';
  return hash.startsWith('/') ? hash : `/${hash}`;
}

export const App: React.FC = () => {
  const route = getRoute();
  const isSettings = route.startsWith('/settings');

  useEffect(() => {
    document.documentElement.classList.toggle('settings-route', isSettings);
    document.body.classList.toggle('settings-route', isSettings);
    return () => {
      document.documentElement.classList.remove('settings-route');
      document.body.classList.remove('settings-route');
    };
  }, [isSettings]);

  if (isSettings) {
    return <SettingsPanel />;
  }

  return <OverlayApp />;
};
