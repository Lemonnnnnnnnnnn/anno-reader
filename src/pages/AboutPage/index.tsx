/**
 * AboutPage component.
 *
 * Settings sub-page showing app identity (name, version, project link)
 * and the update section: manual check against GitHub Releases, with a
 * "go download" shortcut when a newer version exists.
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, BookOpen, Loader2 } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "@/components/primitives";
import { getAppVersion } from "@/lib/version";
import { REPO_URL } from "@/lib/updater";
import { useUpdateStore } from "@/stores/useUpdateStore";

export function AboutPage() {
  const navigate = useNavigate();
  const [version, setVersion] = useState<string>("");

  useEffect(() => {
    getAppVersion().then(setVersion);
  }, []);

  const handleOpenRepo = useCallback(() => {
    openUrl(REPO_URL).catch((err) => {
      console.error("Failed to open repository page:", err);
    });
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg dark:bg-bg-dark text-text dark:text-text-dark font-serif">
      {/* Header */}
      <header className="shrink-0 bg-surface dark:bg-surface-dark border-b border-border dark:border-border-dark">
        <div className="flex items-center gap-3 px-6 py-4 max-w-[1200px] mx-auto w-full">
          <Button variant="icon" onClick={() => navigate(-1)} aria-label="Go back">
            <ArrowLeft size={18} />
          </Button>
          <h1 className="text-xl font-semibold text-text dark:text-text-dark tracking-tight m-0">
            关于
          </h1>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-[600px] mx-auto flex flex-col gap-6">
          {/* App identity */}
          <div className="flex flex-col items-center gap-2 py-6">
            <div className="w-16 h-16 rounded-xl bg-surface dark:bg-surface-dark border border-border dark:border-border-dark flex items-center justify-center text-accent dark:text-accent-dark">
              <BookOpen size={32} />
            </div>
            <h2 className="text-lg font-semibold text-text dark:text-text-dark m-0">
              Anno Reader
            </h2>
            {version && (
              <p className="text-sm font-sans text-text-muted dark:text-text-muted-dark m-0">
                v{version}
              </p>
            )}
            <p className="text-xs font-sans text-text-secondary dark:text-text-secondary-dark m-0 text-center max-w-[360px]">
              极简 EPUB / PDF 阅读器，支持批注与笔记。
            </p>
          </div>

          {/* Updates */}
          <UpdateSection />

          {/* Project link */}
          <button
            onClick={handleOpenRepo}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-sans font-medium text-left bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md hover:border-accent dark:hover:border-accent-dark transition-colors cursor-pointer text-text dark:text-text-dark"
          >
            <ExternalLink size={18} className="text-text-muted dark:text-text-muted-dark" />
            <span>GitHub 仓库</span>
          </button>
        </div>
      </main>
    </div>
  );
}

function UpdateSection() {
  const status = useUpdateStore((s) => s.status);
  const latestVersion = useUpdateStore((s) => s.latestVersion);
  const releaseUrl = useUpdateStore((s) => s.releaseUrl);
  const error = useUpdateStore((s) => s.error);
  const checkUpdate = useUpdateStore((s) => s.checkUpdate);

  const handleOpenRelease = useCallback(() => {
    if (!releaseUrl) return;
    openUrl(releaseUrl).catch((err) => {
      console.error("Failed to open release page:", err);
    });
  }, [releaseUrl]);

  const hint =
    status === "available" && latestVersion ? (
      <p className="text-xs font-sans m-0 text-accent dark:text-accent-dark font-medium">
        发现新版本 v{latestVersion}，下载安装包后重新安装即可
      </p>
    ) : status === "up-to-date" ? (
      <p className="text-xs font-sans m-0 text-text-secondary dark:text-text-secondary-dark">
        ✓ 已是最新版本
      </p>
    ) : status === "error" ? (
      <p className="text-xs font-sans m-0 text-error dark:text-error-dark">
        检查失败：{error}
      </p>
    ) : (
      <p className="text-xs font-sans m-0 text-text-secondary dark:text-text-secondary-dark">
        检查 GitHub 上的新版本
      </p>
    );

  return (
    <section className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md">
      <div className="flex flex-col gap-0.5 min-w-0">
        <h3 className="text-sm font-sans font-medium text-text dark:text-text-dark m-0">
          软件更新
        </h3>
        {hint}
      </div>
      {status === "available" ? (
        <Button variant="primary" size="sm" onClick={handleOpenRelease} className="shrink-0">
          前往下载
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0 flex items-center gap-1.5"
          disabled={status === "checking"}
          onClick={() => checkUpdate()}
        >
          {status === "checking" ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              检查中…
            </>
          ) : (
            "检查更新"
          )}
        </Button>
      )}
    </section>
  );
}
