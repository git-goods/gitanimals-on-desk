import { useState, useEffect, useCallback } from "react";
import type { ThemeListItem, ThemeConfig } from "../types";

export function useThemeList() {
  const [themes, setThemes] = useState<ThemeListItem[]>([]);

  useEffect(() => {
    fetch("/api/themes")
      .then((r) => r.json())
      .then(setThemes)
      .catch(console.error);
  }, []);

  return themes;
}

export function useThemeConfig(themeId: string | null) {
  const [config, setConfig] = useState<ThemeConfig | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(() => {
    if (!themeId) return;
    setLoading(true);
    fetch(`/api/themes/${encodeURIComponent(themeId)}/config`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setConfig(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [themeId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { config, loading, reload };
}
