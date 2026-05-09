import { React, h } from "../react.js";
import { ABOUT_LINKS } from "../settings-data.js";
import { Section, SettingRow } from "../components.js";
import type { Snapshot, Translator } from "../types.js";

interface AboutTabProps {
  snapshot: Snapshot;
  t: Translator;
}

export function AboutTab({ snapshot, t }: AboutTabProps) {
  const version = (snapshot && snapshot.appVersion) || "—";
  const openLink = (url) => (event) => {
    event.preventDefault();
    window.settingsAPI.openExternal(url);
  };
  const linkButton = (url) => (
    <div className="row-control">
      <button className="btn" type="button" onClick={openLink(url)}>
        {t("aboutOpenLink")}
      </button>
    </div>
  );

  return (
    <>
      <h1>{t("sidebarAbout")}</h1>
      <p className="subtitle">{t("aboutSubtitle")}</p>
      <Section title="">
        <SettingRow
          label={t("aboutVersion")}
          control={
            <div className="row-control">
              <span className="mono">{`v${version}`}</span>
            </div>
          }
        />
        <SettingRow
          label={t("aboutLicense")}
          control={
            <div className="row-control">
              <span>{t("aboutLicenseValue")}</span>
            </div>
          }
        />
        <SettingRow
          label={t("aboutRepository")}
          desc={ABOUT_LINKS.repository}
          control={linkButton(ABOUT_LINKS.repository)}
        />
        <SettingRow
          label={t("aboutHomepage")}
          desc={ABOUT_LINKS.homepage}
          control={linkButton(ABOUT_LINKS.homepage)}
        />
      </Section>
    </>
  );
}
