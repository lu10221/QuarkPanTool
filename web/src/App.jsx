import React, { useState, useEffect, useRef } from 'react';
import {
  DownloadCloud,
  FolderOpen,
  Edit3,
  Share2,
  Settings,
  ChevronDown,
  ChevronRight,
  FileText,
  Video,
  Play,
  Trash2,
  RefreshCw,
  Copy,
  Folder,
  ArrowDownToLine,
  Search,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  LogOut,
  UploadCloud,
  Maximize2,
  Minimize2,
  Sliders,
  Image as ImageIcon,
  Palette,
  Sparkles,
  Upload,
  Check,
  X,
  Plus,
  Eye,
  RotateCcw,
  Link2
} from 'lucide-react';

let localToken = '';

async function api(path, body) {
  const response = await fetch(path, body === undefined ? { cache: 'no-store' } : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Local-Token': localToken },
    body: JSON.stringify(body)
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || `请求失败 (${response.status})`);
  return value;
}

function formatSize(size) {
  if (!size) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = size;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
  return `${value.toFixed(index ? 1 : 0)} ${units[index]}`;
}

function formatTime(value) {
  if (!value) return '-';
  const number = Number(value);
  const date = Number.isFinite(number) ? new Date(number < 1e12 ? number * 1000 : number) : new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('zh-CN');
}

function displayFile(file, checked = false) {
  return {
    id: file.fid, name: file.name,
    type: file.dir ? 'folder' : /\.(mp4|mkv|avi|mov|flv|wmv|ts)$/i.test(file.name) ? 'video' : 'text',
    size: file.dir ? '-' : formatSize(file.size), time: formatTime(file.updatedAt), checked
  };
}

// 精心调校的 6 套主题配色方案（告别沉闷死板的蓝紫黑搭配，涵盖深色通透与浅色冰晶风格）
const COLOR_THEMES = {
  aurora: {
    id: 'aurora',
    name: '极光青韵 (默认推荐)',
    mode: 'dark',
    primary: '#06B6D4',       // Cyan 500
    primaryHover: '#0891B2',
    secondary: '#10B981',     // Emerald 500
    accentGradient: 'linear-gradient(135deg, #06B6D4 0%, #10B981 100%)',
    accentGlow: 'rgba(6, 182, 212, 0.35)',
    accentSoftBg: 'rgba(6, 182, 212, 0.14)',
    accentText: '#22D3EE',
    cardRgb: '18, 24, 32',
    innerRgb: '10, 14, 20',
    sidebarRgb: '14, 19, 26',
    textMain: '#F1F5F9',
    textMuted: '#94A3B8',
    borderRgb: '255, 255, 255'
  },
  amber: {
    id: 'amber',
    name: '流光琥珀 (暖金黑曜)',
    mode: 'dark',
    primary: '#F59E0B',       // Amber 500
    primaryHover: '#D97706',
    secondary: '#EA580C',     // Orange 600
    accentGradient: 'linear-gradient(135deg, #F59E0B 0%, #EA580C 100%)',
    accentGlow: 'rgba(245, 158, 11, 0.35)',
    accentSoftBg: 'rgba(245, 158, 11, 0.15)',
    accentText: '#FBBF24',
    cardRgb: '28, 24, 22',
    innerRgb: '16, 13, 12',
    sidebarRgb: '22, 18, 16',
    textMain: '#FAF8F5',
    textMuted: '#A8A29E',
    borderRgb: '255, 245, 235'
  },
  sakura: {
    id: 'sakura',
    name: '绯樱晚霞 (通透珊瑚)',
    mode: 'dark',
    primary: '#F43F5E',       // Rose 500
    primaryHover: '#E11D48',
    secondary: '#EC4899',     // Pink 500
    accentGradient: 'linear-gradient(135deg, #F43F5E 0%, #EC4899 100%)',
    accentGlow: 'rgba(244, 63, 94, 0.35)',
    accentSoftBg: 'rgba(244, 63, 94, 0.15)',
    accentText: '#FB7185',
    cardRgb: '28, 20, 28',
    innerRgb: '16, 11, 18',
    sidebarRgb: '22, 15, 23',
    textMain: '#FFF1F2',
    textMuted: '#FDA4AF',
    borderRgb: '255, 228, 230'
  },
  emerald: {
    id: 'emerald',
    name: '翡翠森境 (自然生机)',
    mode: 'dark',
    primary: '#10B981',       // Emerald 500
    primaryHover: '#059669',
    secondary: '#14B8A6',     // Teal 500
    accentGradient: 'linear-gradient(135deg, #10B981 0%, #0D9488 100%)',
    accentGlow: 'rgba(16, 185, 129, 0.35)',
    accentSoftBg: 'rgba(16, 185, 129, 0.15)',
    accentText: '#34D399',
    cardRgb: '16, 26, 23',
    innerRgb: '9, 16, 14',
    sidebarRgb: '12, 20, 18',
    textMain: '#ECFDF5',
    textMuted: '#94A3B8',
    borderRgb: '236, 253, 245'
  },
  frostLight: {
    id: 'frostLight',
    name: '冰晶昼光 (macOS 浅色毛玻璃)',
    mode: 'light',
    primary: '#0284C7',       // Sky 600
    primaryHover: '#0369A1',
    secondary: '#2563EB',
    accentGradient: 'linear-gradient(135deg, #0284C7 0%, #2563EB 100%)',
    accentGlow: 'rgba(2, 132, 199, 0.25)',
    accentSoftBg: 'rgba(2, 132, 199, 0.12)',
    accentText: '#0369A1',
    cardRgb: '255, 255, 255',
    innerRgb: '241, 245, 249',
    sidebarRgb: '248, 250, 252',
    textMain: '#0F172A',
    textMuted: '#64748B',
    borderRgb: '15, 23, 42'
  },
  graphite: {
    id: 'graphite',
    name: '钛金极简 (纯正高级灰)',
    mode: 'dark',
    primary: '#3B82F6',       // Blue 500
    primaryHover: '#2563EB',
    secondary: '#60A5FA',
    accentGradient: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
    accentGlow: 'rgba(59, 130, 246, 0.35)',
    accentSoftBg: 'rgba(59, 130, 246, 0.15)',
    accentText: '#60A5FA',
    cardRgb: '24, 24, 27',    // Zinc 900
    innerRgb: '12, 12, 15',
    sidebarRgb: '18, 18, 21',
    textMain: '#FAFAFA',
    textMuted: '#A1A1AA',
    borderRgb: '255, 255, 255'
  }
};

// 预设精选高清背景（支持渐变流体与高清风景/插画壁纸）
const WALLPAPER_PRESETS = [
  {
    id: 'mountain_aurora',
    name: '极光雪山',
    type: 'image',
    luminance: 0.22,
    url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=1920&q=80',
    thumb: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=300&q=60'
  },
  {
    id: 'cyber_rain',
    name: '霓虹雨夜',
    type: 'image',
    luminance: 0.18,
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1920&q=80',
    thumb: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=300&q=60'
  },
  {
    id: 'sunset_lake',
    name: '暮色山湖',
    type: 'image',
    luminance: 0.36,
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1920&q=80',
    thumb: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=300&q=60'
  },
  {
    id: 'abstract_waves',
    name: '深海流体',
    type: 'image',
    luminance: 0.24,
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80',
    thumb: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=60'
  },
  {
    id: 'warm_dunes',
    name: '金色沙丘',
    type: 'image',
    luminance: 0.52,
    url: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1920&q=80',
    thumb: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=300&q=60'
  },
  {
    id: 'mesh_gradient',
    name: '极简流体光晕',
    type: 'gradient',
    luminance: 0.14,
    gradient: 'radial-gradient(at 15% 15%, #0f4c5c 0px, transparent 55%), radial-gradient(at 85% 20%, #1b4332 0px, transparent 50%), radial-gradient(at 50% 85%, #1d3557 0px, transparent 55%), linear-gradient(135deg, #0b0f17 0%, #111827 100%)'
  }
];

// 计算 RGB 字符串 (如 '18, 24, 32') 的相对感知亮度 (0.0 ~ 1.0)
const getRgbLuminance = (rgbStr) => {
  const parts = String(rgbStr).split(',').map(n => parseFloat(n.trim()) || 0);
  const [r = 0, g = 0, b = 0] = parts;
  return (0.299 * r + 0.587 * g * 1.0 + 0.114 * b) / 255;
};

// 根据每一层真实的混合后亮度，计算当前层最清晰的文字颜色与抗干扰阴影
const computeAdaptiveColors = ({ theme, glassConfig, bgLuminance }) => {
  const {
    cardOpacity,
    innerOpacity,
    bgDimming,
    autoContrast = true,
    textHalo = true
  } = glassConfig;

  const dimAlpha = bgDimming / 100;
  const dimLum = theme.mode === 'light' ? 0.98 : 0.04;
  // 1. 计算壁纸叠加暗化遮罩后的实际背景亮度
  const backdropLum = bgLuminance * (1 - dimAlpha) + dimLum * dimAlpha;

  // 2. 计算红框主卡片混合后的实际感知亮度
  const cardAlpha = cardOpacity / 100;
  const cardBaseLum = getRgbLuminance(theme.cardRgb);
  const effectiveCardLum = backdropLum * (1 - cardAlpha) + cardBaseLum * cardAlpha;

  // 3. 计算内部子容器（输入框/列表框）混合后的实际感知亮度
  const innerAlpha = innerOpacity / 100;
  const innerBaseLum = getRgbLuminance(theme.innerRgb);
  const effectiveInnerLum = effectiveCardLum * (1 - innerAlpha) + innerBaseLum * innerAlpha;

  // 根据亮度阈值 (0.50) 自动判定该层应该用浅色字还是深色字
  const pickLayerPalette = (lum) => {
    if (!autoContrast) {
      const isLightMode = theme.mode === 'light';
      return {
        isDarkSurface: !isLightMode,
        textMain: theme.textMain,
        textMuted: theme.textMuted,
        accentText: theme.accentText,
        textShadow: textHalo
          ? isLightMode
            ? '0 1px 2px rgba(255, 255, 255, 0.75)'
            : '0 1px 3px rgba(0, 0, 0, 0.75)'
          : 'none'
      };
    }

    const isDarkSurface = lum < 0.52;
    return {
      isDarkSurface,
      textMain: isDarkSurface ? '#F8FAFC' : '#0F172A',
      textMuted: isDarkSurface ? '#CBD5E1' : '#334155',
      accentText: isDarkSurface ? theme.accentText : theme.primaryHover,
      textShadow: textHalo
        ? isDarkSurface
          ? '0 1px 4px rgba(0, 0, 0, 0.82), 0 0 1px rgba(0, 0, 0, 0.6)'
          : '0 1px 3px rgba(255, 255, 255, 0.88), 0 0 1px rgba(255, 255, 255, 0.6)'
        : 'none'
    };
  };

  return {
    backdropLum,
    effectiveCardLum,
    effectiveInnerLum,
    page: pickLayerPalette(backdropLum),
    card: pickLayerPalette(effectiveCardLum),
    inner: pickLayerPalette(effectiveInnerLum)
  };
};

// 动态注入全局 CSS 变量与毛玻璃样式
const DynamicGlobalStyles = ({ theme, glassConfig, adaptivePalette }) => {
  const { cardOpacity, innerOpacity, blurStrength, borderOpacity } = glassConfig;
  const { page, card, inner } = adaptivePalette;

  return (
    <style dangerouslySetInnerHTML={{__html: `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      
      :root {
        --primary: ${theme.primary};
        --primary-hover: ${theme.primaryHover};
        --accent-gradient: ${theme.accentGradient};
        --accent-glow: ${theme.accentGlow};
        --accent-soft-bg: ${theme.accentSoftBg};
        --accent-text: ${card.accentText};
        --text-main: ${card.textMain};
        --text-muted: ${card.textMuted};
        --inner-text-main: ${inner.textMain};
        --inner-text-muted: ${inner.textMuted};
        --inner-accent-text: ${inner.accentText};
      }

      /* 强制根容器重置文字颜色，彻底防止 Vite 默认 index.css 的黑色字体污染 */
      body, #root, .quark-app-root {
        color: ${page.textMain} !important;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        overflow: hidden;
        margin: 0;
        user-select: none;
      }

      .quark-app-root h1,
      .quark-app-root h2,
      .quark-app-root h3,
      .quark-app-root p,
      .quark-app-root span,
      .quark-app-root label,
      .quark-app-root div,
      .quark-app-root th,
      .quark-app-root td,
      .quark-app-root button {
        color: inherit;
      }

      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb {
        background: rgba(${theme.borderRgb}, 0.25);
        border-radius: 999px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: rgba(${theme.borderRgb}, 0.4);
      }

      /* 红框主工作区卡片：支持实时透明度、毛玻璃强度与独立自适应文字对比度 */
      .glass-main-card {
        background-color: rgba(${theme.cardRgb}, ${cardOpacity / 100});
        backdrop-filter: blur(${blurStrength}px) saturate(160%);
        -webkit-backdrop-filter: blur(${blurStrength}px) saturate(160%);
        border: 1px solid rgba(${theme.borderRgb}, ${borderOpacity / 100});
        box-shadow: 0 20px 50px rgba(0, 0, 0, ${card.isDarkSurface ? '0.35' : '0.1'}),
                    inset 0 1px 0 0 rgba(255, 255, 255, ${card.isDarkSurface ? '0.14' : '0.65'});
        color: ${card.textMain} !important;
        text-shadow: ${card.textShadow};
        transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
      }

      .glass-main-card .text-muted-adaptive {
        color: ${card.textMuted} !important;
      }

      /* 红框内部的子面板：根据自身混合后的明暗度独立切换高对比度文字颜色 */
      .glass-inner-panel {
        background-color: rgba(${theme.innerRgb}, ${innerOpacity / 100});
        backdrop-filter: blur(${Math.max(4, Math.round(blurStrength * 0.5))}px);
        -webkit-backdrop-filter: blur(${Math.max(4, Math.round(blurStrength * 0.5))}px);
        border: 1px solid rgba(${theme.borderRgb}, ${Math.max(0.08, (borderOpacity / 100) * 0.85)});
        color: ${inner.textMain} !important;
        text-shadow: ${inner.textShadow};
        transition: background-color 0.15s ease, border-color 0.2s ease, color 0.15s ease;
      }

      .glass-inner-panel input,
      .glass-inner-panel textarea,
      .glass-inner-panel select {
        color: ${inner.textMain} !important;
      }

      .glass-inner-panel input::placeholder,
      .glass-inner-panel textarea::placeholder {
        color: ${inner.textMuted} !important;
        opacity: 0.72;
      }

      .glass-inner-panel:focus-within {
        border-color: var(--primary);
        box-shadow: 0 0 0 3px var(--accent-soft-bg);
      }

      /* 内部面板表头栏 */
      .glass-panel-header {
        background-color: rgba(${theme.cardRgb}, ${Math.min(0.9, (innerOpacity / 100) * 0.75)});
        border-bottom: 1px solid rgba(${theme.borderRgb}, ${Math.max(0.08, (borderOpacity / 100) * 0.7)});
        color: ${inner.textMain} !important;
      }

      /* 左侧导航栏与底部日志栏毛玻璃 */
      .glass-sidebar {
        background-color: rgba(${theme.sidebarRgb}, ${Math.min(0.92, (cardOpacity / 100) + 0.15)});
        backdrop-filter: blur(${Math.max(12, blurStrength)}px) saturate(150%);
        -webkit-backdrop-filter: blur(${Math.max(12, blurStrength)}px) saturate(150%);
        border-right: 1px solid rgba(${theme.borderRgb}, ${borderOpacity / 100});
        color: ${card.textMain} !important;
        text-shadow: ${card.textShadow};
      }

      /* 主题主按钮渐变 */
      .btn-theme-primary {
        background: var(--accent-gradient);
        color: #ffffff !important;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
        box-shadow: 0 4px 14px var(--accent-glow);
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .btn-theme-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px var(--accent-glow);
        filter: brightness(1.06);
      }
      .btn-theme-primary:active {
        transform: translateY(0px);
      }

      /* 列表悬浮高亮 */
      .glass-row-hover:hover {
        background-color: rgba(${theme.borderRgb}, ${inner.isDarkSurface ? '0.08' : '0.06'});
      }

      /* 定制滑块样式 */
      input[type="range"].glass-slider {
        -webkit-appearance: none;
        appearance: none;
        height: 6px;
        border-radius: 999px;
        background: rgba(${inner.isDarkSurface ? '255, 255, 255' : '15, 23, 42'}, 0.22);
        outline: none;
      }
      input[type="range"].glass-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--primary);
        cursor: pointer;
        box-shadow: 0 0 10px var(--accent-glow);
        border: 2px solid #fff;
        transition: transform 0.15s ease;
      }
      input[type="range"].glass-slider::-webkit-slider-thumb:hover {
        transform: scale(1.15);
      }
    `}} />
  );
};

export default function App() {
  // 导航与基础状态
  const [activeTab, setActiveTab] = useState('transfer');
  const [logExpanded, setLogExpanded] = useState(false);
  const [logs, setLogs] = useState([]);

  // 外观与毛玻璃定制状态（支持 localStorage 自动持久化保存）
  const [showAppearanceStudio, setShowAppearanceStudio] = useState(false);
  const [themeId, setThemeId] = useState(() => {
    try {
      return localStorage.getItem('quark_theme_id') || 'aurora';
    } catch {
      return 'aurora';
    }
  });
  const [glassConfig, setGlassConfig] = useState(() => {
    const defaultGlass = {
      cardOpacity: 55,       // 红框主卡片不透明度 (%)
      innerOpacity: 45,      // 红框内子容器不透明度 (%)
      blurStrength: 20,      // 毛玻璃模糊半径 (px)
      borderOpacity: 16,     // 玻璃高光边框强度 (%)
      bgDimming: 30,         // 背景暗化遮罩 (%)
      bgBlur: 0,             // 背景壁纸自身模糊度 (px)
      autoContrast: true,    // 智能分层文字对比度自适应（防止黑底黑字或白底白字）
      textHalo: true         // 文字边缘抗干扰护眼阴影（防止低透明度下与花哨壁纸混色）
    };
    try {
      const saved = localStorage.getItem('quark_glass_config');
      return saved ? { ...defaultGlass, ...JSON.parse(saved) } : defaultGlass;
    } catch {
      return defaultGlass;
    }
  });

  // 背景壁纸状态（支持预设、本地上传图片、自定义URL）
  const [selectedWallpaperId, setSelectedWallpaperId] = useState(() => {
    try {
      return localStorage.getItem('quark_wallpaper_id') || 'mountain_aurora';
    } catch {
      return 'mountain_aurora';
    }
  });
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState(() => {
    try {
      return localStorage.getItem('quark_custom_wallpaper_url') || '';
    } catch {
      return '';
    }
  });
  const [customWallpaperLum, setCustomWallpaperLum] = useState(0.25);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const fileInputRef = useRef(null);
  const storageWarningShown = useRef(false);

  // 自动保存用户调节的主题、透明度、毛玻璃和壁纸配置
  useEffect(() => {
    try {
      localStorage.setItem('quark_theme_id', themeId);
      localStorage.setItem('quark_glass_config', JSON.stringify(glassConfig));
      if (customWallpaperUrl && !customWallpaperUrl.startsWith('blob:')) {
        localStorage.setItem('quark_custom_wallpaper_url', customWallpaperUrl);
      }
      localStorage.setItem('quark_wallpaper_id', selectedWallpaperId);
      storageWarningShown.current = false;
    } catch {
      if (!storageWarningShown.current) {
        storageWarningShown.current = true;
        addLog('外观设置未保存在浏览器，刷新后可能丢失；请使用较小的图片或网络壁纸', 'error');
        setLogExpanded(true);
      }
    }
  }, [themeId, glassConfig, selectedWallpaperId, customWallpaperUrl]);

  // 全局跨页面共享数据状态
  const [targetFolder, setTargetFolder] = useState('/ 全部文件');
  const [targetFolderId, setTargetFolderId] = useState('0');
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderPath, setFolderPath] = useState([{ id: '0', name: '全部文件' }]);
  const [folderCandidates, setFolderCandidates] = useState([]);
  const folderCandidatesRequestId = useRef(0);
  const [session, setSession] = useState({ connected: false });
  const [cookieInput, setCookieInput] = useState('');
  const [loginStatus, setLoginStatus] = useState({ state: 'idle', error: '' });
  const [taskId, setTaskId] = useState('');
  const [taskKind, setTaskKind] = useState('');
  const seenTaskLogs = useRef(0);

  // 转存与下载状态
  const [rawText, setRawText] = useState('');
  const [transferMode, setTransferMode] = useState('save'); // 'save' | 'download'
  const [queue, setQueue] = useState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const executableQueue = queue.filter(item =>
    !['ok', 'skipped'].includes(item.statuses[transferMode]));

  // 网盘文件状态
  const [currentPath, setCurrentPath] = useState(['全部文件']);
  const [pathIds, setPathIds] = useState(['0']);
  const [driveFiles, setDriveFiles] = useState([]);
  const pathIdsRef = useRef(pathIds);
  const filesRequestId = useRef(0);
  pathIdsRef.current = pathIds;

  // 批量重命名状态
  const [findPattern, setFindPattern] = useState('【.*?】');
  const [replacePattern, setReplacePattern] = useState('');

  // 批量分享状态
  const [shareExpire, setShareExpire] = useState('永久有效');
  const [shareCodeType, setShareCodeType] = useState('随机生成');
  const [shareOutput, setShareOutput] = useState('');

  const baseTheme = COLOR_THEMES[themeId] || COLOR_THEMES.aurora;
  const activePreset = WALLPAPER_PRESETS.find(w => w.id === selectedWallpaperId);

  // 实时计算当前背景与各层容器的自适应高对比度配色
  const currentBgLum =
    selectedWallpaperId === 'custom'
      ? customWallpaperLum
      : (activePreset?.luminance ?? 0.22);

  const adaptivePalette = computeAdaptiveColors({
    theme: baseTheme,
    glassConfig,
    bgLuminance: currentBgLum
  });

  // 将自适应计算后的高对比度文字色同步到 currentTheme，确保所有内联样式自动反色
  const currentTheme = {
    ...baseTheme,
    textMain: adaptivePalette.card.textMain,
    textMuted: adaptivePalette.card.textMuted,
    accentText: adaptivePalette.card.accentText
  };

  // 自动采样上传图片的平均亮度，确保自定义壁纸也能精准触发文字反色保护
  const detectImageLuminance = (url) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 16, 16);
        const data = ctx.getImageData(0, 0, 16, 16).data;
        let totalLum = 0;
        for (let i = 0; i < data.length; i += 4) {
          totalLum += (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
        }
        setCustomWallpaperLum(totalLum / (data.length / 4));
      } catch {
        setCustomWallpaperLum(0.25);
      }
    };
    img.onerror = () => setCustomWallpaperLum(0.25);
    img.src = url;
    return () => { img.onload = null; img.onerror = null; };
  };

  useEffect(() => {
    if (selectedWallpaperId === 'custom' && customWallpaperUrl) {
      return detectImageLuminance(customWallpaperUrl);
    }
  }, [selectedWallpaperId, customWallpaperUrl]);

  const addLog = (text, type = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [...prev, { time, type, text }]);
  };

  const reportError = error => addLog(error.message || String(error), 'error');

  const refreshFiles = async (id = pathIdsRef.current[pathIdsRef.current.length - 1]) => {
    const requestId = ++filesRequestId.current;
    try {
      const { items } = await api(`/api/files?parent=${encodeURIComponent(id)}`);
      if (requestId !== filesRequestId.current) return;
      setDriveFiles(previous => items.map(item =>
        displayFile(item, previous.find(file => file.id === item.fid)?.checked || false)
      ));
      addLog(`已读取网盘目录：${items.length} 项`, 'info');
    } catch (error) { if (requestId === filesRequestId.current) reportError(error); }
  };

  const openFolder = async (id, name, depth) => {
    const requestId = ++filesRequestId.current;
    try {
      const { items } = await api(`/api/files?parent=${encodeURIComponent(id)}`);
      if (requestId !== filesRequestId.current) return;
      setPathIds(previous => depth === undefined ? [...previous, id] : previous.slice(0, depth + 1));
      setCurrentPath(previous => depth === undefined ? [...previous, name] : previous.slice(0, depth + 1));
      setDriveFiles(items.map(item => displayFile(item)));
      addLog(`已打开目录：${name}`, 'info');
    } catch (error) { if (requestId === filesRequestId.current) reportError(error); }
  };

  const loadFolderCandidates = async (path = folderPath) => {
    const requestId = ++folderCandidatesRequestId.current;
    try {
      const { items } = await api(`/api/files?parent=${encodeURIComponent(path[path.length - 1].id)}`);
      if (requestId === folderCandidatesRequestId.current) setFolderCandidates(items.filter(item => item.dir));
    } catch (error) { if (requestId === folderCandidatesRequestId.current) reportError(error); }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        localToken = (await api('/api/bootstrap')).token;
        const login = await api('/api/login/status');
        if (cancelled) return;
        setLoginStatus(login);
        const account = await api('/api/session');
        if (cancelled) return;
        setSession(account);
        addLog(account.connected ? `账号已连接：${account.nickname}` : account.error || '账号未连接', account.connected ? 'success' : 'error');
        if (account.connected) await refreshFiles('0');
      } catch (error) { if (!cancelled) reportError(error); }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!['opening', 'waiting', 'saving'].includes(loginStatus.state)) return;
    let cancelled = false;
    let timer;
    const poll = async () => {
      try {
        const status = await api('/api/login/status');
        if (cancelled) return;
        if (['opening', 'waiting', 'saving'].includes(status.state)) {
          setLoginStatus(status);
          timer = window.setTimeout(poll, 800);
        } else if (status.state === 'done') {
          const account = await api('/api/session');
          if (cancelled) return;
          setSession(account);
          if (account.connected) {
            setCurrentPath(['全部文件']);
            setPathIds(['0']);
            setTargetFolder('/ 全部文件');
            setTargetFolderId('0');
            setCookieInput('');
            addLog(`浏览器登录成功：${account.nickname}`, 'success');
            await refreshFiles('0');
            setLoginStatus(status);
          } else {
            const error = account.error || '登录状态验证失败';
            setLoginStatus({ state: 'error', error });
            addLog(error, 'error');
          }
        } else if (status.state === 'error') {
          setLoginStatus(status);
          addLog(`浏览器登录失败：${status.error}`, 'error');
        }
      } catch (error) {
        if (!cancelled) {
          setLoginStatus({ state: 'error', error: error.message || String(error) });
          reportError(error);
        }
      }
    };
    timer = window.setTimeout(poll, 800);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [loginStatus.state]);

  useEffect(() => {
    if (!showFolderModal) return;
    void loadFolderCandidates();
  }, [showFolderModal, folderPath]);

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    let timer;
    const poll = async () => {
      try {
        const task = await api(`/api/tasks/${taskId}`);
        if (cancelled) return;
        task.logs.slice(seenTaskLogs.current).forEach(entry =>
          addLog(entry.message, /失败|错误/.test(entry.message) ? 'error' : /完成|成功/.test(entry.message) ? 'success' : 'info')
        );
        seenTaskLogs.current = task.logs.length;
        if (taskKind === 'save' || taskKind === 'download') {
          setQueue(previous => previous.map(item => {
            const result = task.results.find(row => row.label === item.url);
            return result ? { ...item, statuses: { ...item.statuses, [taskKind]: result.status } } : item;
          }));
        }
        if (taskKind === 'share') {
          setShareOutput(task.results.filter(result => result.url).map(result =>
            `📁 ${result.label}\n链接：${result.url}`
          ).join('\n\n'));
        }
        if (task.state === 'running') timer = window.setTimeout(poll, 800);
        else {
          setIsExecuting(false);
          setTaskId('');
          const success = task.results.filter(result => result.status === 'ok').length;
          const skipped = task.results.filter(result => result.status === 'skipped').length;
          const failed = Math.max(
            task.results.filter(result => result.status === 'error').length + task.total - task.results.length,
            task.state === 'done' ? 0 : 1
          );
          addLog(`任务${task.state === 'partial' ? '部分完成' : task.state === 'error' ? '失败' : '完成'}：成功 ${success}，失败 ${failed}，跳过 ${skipped}`,
            task.state === 'done' ? 'success' : 'error');
          if (taskKind === 'rename' || taskKind === 'save') void refreshFiles();
        }
      } catch (error) {
        reportError(error);
        setTaskId('');
        setIsExecuting(false);
      }
    };
    void poll();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [taskId, taskKind]);

  const startTask = async (kind, items, options = {}) => {
    if (taskId) return addLog('请等待当前任务结束', 'error');
    try {
      const { id } = await api('/api/tasks', { kind, items, ...options });
      seenTaskLogs.current = 0;
      setTaskKind(kind);
      setTaskId(id);
      setLogExpanded(true);
      addLog(`已提交 ${kind} 任务，共 ${items.length} 项`, 'info');
    } catch (error) { reportError(error); setIsExecuting(false); }
  };

  const createFolder = async () => {
    const name = window.prompt('新建文件夹名称');
    if (!name?.trim()) return;
    try {
      await api('/api/folders', { parent: pathIds[pathIds.length - 1], name: name.trim() });
      addLog(`已创建文件夹：${name.trim()}`, 'success');
      await refreshFiles();
    } catch (error) { reportError(error); }
  };

  const deleteFile = async file => {
    if (!window.confirm(`确定删除网盘中的“${file.name}”？`)) return;
    try {
      await api('/api/files/delete', { fid: file.id });
      addLog(`已删除网盘项目：${file.name}`, 'success');
      await refreshFiles();
    } catch (error) { reportError(error); }
  };

  const checkSession = async () => {
    try {
      const account = cookieInput.trim()
        ? await api('/api/session/check', { cookie: cookieInput.trim() })
        : await api('/api/session');
      if (!cookieInput.trim()) setSession(account);
      addLog(account.connected ? `连通性检测通过：${account.nickname}` : account.error || '账号未连接', account.connected ? 'success' : 'error');
    } catch (error) { reportError(error); }
  };

  const saveCookie = async () => {
    if (!cookieInput.trim()) return addLog('请先输入 Cookie', 'error');
    try {
      const account = await api('/api/session/cookie', { cookie: cookieInput.trim() });
      setSession(account);
      setCookieInput('');
      setCurrentPath(['全部文件']);
      setPathIds(['0']);
      setTargetFolder('/ 全部文件');
      setTargetFolderId('0');
      addLog(`Cookie 已验证并保存：${account.nickname}`, 'success');
      await refreshFiles('0');
    } catch (error) { reportError(error); }
  };

  const startBrowserLogin = async () => {
    setLoginStatus({ state: 'opening', error: '' });
    try {
      setLoginStatus(await api('/api/login/start', {}));
      addLog('正在打开夸克网页登录窗口', 'info');
    } catch (error) {
      setLoginStatus({ state: 'error', error: error.message || String(error) });
      reportError(error);
    }
  };

  const finishBrowserLogin = async () => {
    try {
      await api('/api/login/finish', {});
      setLoginStatus({ state: 'saving', error: '' });
      addLog('正在保存并验证网页登录状态', 'info');
    } catch (error) { reportError(error); }
  };

  const logout = async () => {
    try {
      await api('/api/session/logout', {});
      filesRequestId.current += 1;
      setSession({ connected: false });
      setDriveFiles([]);
      addLog('已退出账号', 'info');
    } catch (error) { reportError(error); }
  };

  // 处理本地上传背景图片
  const handleLocalWallpaperUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, 1920 / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        const url = canvas.toDataURL('image/jpeg', 0.78);
        setCustomWallpaperUrl(url);
        setSelectedWallpaperId('custom');
        addLog(`已加载本地背景图片: ${file.name}`, 'success');
      };
      image.onerror = () => addLog('图片读取失败', 'error');
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // 处理网络图片 URL
  const handleApplyCustomUrl = () => {
    if (!customUrlInput.trim()) return;
    const url = customUrlInput.trim();
    setCustomWallpaperUrl(url);
    setSelectedWallpaperId('custom');
    addLog('已应用自定义网络背景图 URL', 'success');
  };

  // 解析分享链接逻辑
  const handleParseLinks = async () => {
    if (!rawText.trim()) {
      addLog('请先粘贴至少一条夸克网盘分享链接', 'error');
      return;
    }
    const lines = rawText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const parsed = [];
    const seen = new Set();
    for (let i = 0; i < lines.length; i += 1) {
      const match = lines[i].match(/https:\/\/pan\.quark\.cn\/s\/[A-Za-z0-9]+(?:\?[^\s]*)?/i);
      if (!match) continue;
      const url = new URL(match[0].replace(/[，。；,;]+$/, ''));
      const codeMatch = lines[i].match(/(?:提取码|密码|口令|pwd)\s*[:：=?\s]\s*([A-Za-z0-9]{4})/i)
        || lines[i + 1]?.match(/^(?:提取码|密码|口令|pwd)\s*[:：=?\s]\s*([A-Za-z0-9]{4})/i);
      if (codeMatch && !url.searchParams.has('pwd')) url.searchParams.set('pwd', codeMatch[1]);
      if (seen.has(url.href)) continue;
      seen.add(url.href);
      parsed.push({ id: `${i}-${url.href}`, raw: lines[i], url: url.href,
        code: url.searchParams.get('pwd') || '免提取码' });
    }
    if (!parsed.length) return addLog('未识别到夸克分享链接', 'error');
    try {
      const { items } = await api('/api/links/parse', { items: parsed.map(item => item.url) });
      setQueue(previous => items.map((item, index) => ({
        ...parsed[index], url: item.url, code: item.code,
        statuses: previous.find(row => row.url === item.url)?.statuses ||
          { save: 'pending', download: 'pending' }
      })));
      addLog(`后端已验证 ${items.length} 条夸克分享链接`, 'success');
    } catch (error) { reportError(error); }
  };

  // 一键填入测试数据方便体验
  const handleFillSampleLinks = () => {
    setRawText(
      'https://pan.quark.cn/s/7a8b9c0d1e2f 提取码：1234\n' +
      'https://pan.quark.cn/s/3f4e5d6c7b8a 提取码: 9981\n' +
      'https://pan.quark.cn/s/9z8y7x6w5v4u'
    );
  };

  const handleExecuteQueue = () => {
    if (executableQueue.length === 0 || isExecuting) return;
    if (taskId) return addLog('请等待当前任务结束', 'error');
    setIsExecuting(true);
    void startTask(transferMode, executableQueue.map(item => item.url),
      transferMode === 'save' ? { folderId: targetFolderId } : {});
  };

  // 计算当前背景图层样式
  const getBackgroundStyle = () => {
    if (selectedWallpaperId === 'custom' && customWallpaperUrl) {
      return {
        backgroundImage: `url("${customWallpaperUrl}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      };
    }
    if (activePreset?.type === 'gradient') {
      return { background: activePreset.gradient };
    }
    return {
      backgroundImage: `url("${activePreset?.url || WALLPAPER_PRESETS[0].url}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    };
  };

  const renderSidebar = () => {
    const navItems = [
      { id: 'transfer', icon: DownloadCloud, label: '转存与下载' },
      { id: 'files', icon: FolderOpen, label: '网盘文件' },
      { id: 'rename', icon: Edit3, label: '批量重命名' },
      { id: 'share', icon: Share2, label: '批量分享' },
      { id: 'settings', icon: Settings, label: '账号设置' },
    ];

    return (
      <aside className="w-[225px] glass-sidebar flex flex-col z-20 shrink-0 h-full relative transition-all duration-200">
        {/* 顶部品牌标识 */}
        <div className="p-6 flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg shrink-0"
            style={{ background: currentTheme.accentGradient, boxShadow: `0 6px 18px ${currentTheme.accentGlow}` }}
          >
            <HardDrive className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-bold tracking-wide text-sm" style={{ color: currentTheme.textMain }}>
              QuarkPanTool
            </h1>
            <p className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: currentTheme.accentText }}>
              LOCAL WORKSPACE
            </p>
          </div>
        </div>

        <div className="px-5 pb-2 text-[11px] font-semibold tracking-wider uppercase opacity-60">
          工作台
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 px-3 space-y-1.5">
          {navItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium relative overflow-hidden"
                style={{
                  backgroundColor: isActive ? currentTheme.accentSoftBg : 'transparent',
                  color: isActive ? currentTheme.accentText : currentTheme.textMuted,
                  border: isActive ? `1px solid ${currentTheme.primary}40` : '1px solid transparent'
                }}
              >
                {isActive && (
                  <span
                    className="w-1 h-4 rounded-full absolute left-1.5"
                    style={{ background: currentTheme.primary }}
                  />
                )}
                <item.icon
                  className="w-[18px] h-[18px] shrink-0"
                  style={{ color: isActive ? currentTheme.accentText : currentTheme.textMuted }}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* 左下角用户信息卡片 */}
        <div className="p-3.5 mx-3 mb-4 rounded-xl glass-inner-panel flex items-center gap-3 cursor-pointer hover:opacity-95 transition-all">
          <div className="w-9 h-9 rounded-full bg-slate-800/60 flex items-center justify-center overflow-hidden border border-white/15 shrink-0">
            <img
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=Quark&backgroundColor=0f172a"
              alt="avatar"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: currentTheme.textMain }}>
              {session.connected ? session.nickname : '未登录'}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${session.connected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <p className="text-[11px] text-emerald-400 font-medium">{session.connected ? '网盘已连接' : '网盘未连接'}</p>
            </div>
          </div>
        </div>
      </aside>
    );
  };

  // 右侧悬浮外观、透明度、毛玻璃与背景自定义工作台
  const renderAppearanceStudio = () => {
    return (
      <>
        {/* 右上角快捷悬浮胶囊按钮（对应截图右侧位置） */}
        <div className="fixed right-4 top-5 z-40 flex flex-col gap-2 glass-main-card p-1.5 rounded-2xl">
          <button
            onClick={() => setShowAppearanceStudio(!showAppearanceStudio)}
            title="打开外观、透明度与背景设置"
            className="p-2.5 rounded-xl transition-all flex items-center justify-center relative group"
            style={{
              background: showAppearanceStudio ? currentTheme.accentGradient : 'transparent',
              color: showAppearanceStudio ? '#fff' : currentTheme.textMain
            }}
          >
            <Palette className="w-4 h-4" />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            title="上传自定义本地背景图片"
            className="p-2.5 rounded-xl hover:bg-white/10 transition-all flex items-center justify-center"
            style={{ color: currentTheme.textMain }}
          >
            <ImageIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setGlassConfig({
                cardOpacity: 55,
                innerOpacity: 45,
                blurStrength: 20,
                borderOpacity: 16,
                bgDimming: 30,
                bgBlur: 0,
                autoContrast: true,
                textHalo: true
              });
              setThemeId('aurora');
              setSelectedWallpaperId('mountain_aurora');
            }}
            title="恢复默认外观参数"
            className="p-2.5 rounded-xl hover:bg-white/10 transition-all flex items-center justify-center"
            style={{ color: adaptivePalette.card.textMuted }}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* 隐藏的本地图片上传 Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleLocalWallpaperUpload}
          className="hidden"
        />

        {/* 可展开的实时视觉调节面板 */}
        {showAppearanceStudio && (
          <div className="fixed right-16 top-5 z-40 w-[330px] max-h-[calc(100vh-80px)] overflow-y-auto glass-main-card rounded-2xl p-4 shadow-2xl animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" style={{ color: adaptivePalette.card.accentText }} />
                <span className="text-xs font-bold tracking-wide">外观与毛玻璃工作台</span>
              </div>
              <button
                onClick={() => setShowAppearanceStudio(false)}
                className="p-1 rounded-lg hover:bg-white/10 opacity-70 hover:opacity-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 新增：文字清晰度与智能对比度保护开关 */}
            <div className="mb-3.5 p-2.5 rounded-xl glass-inner-panel space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" style={{ color: adaptivePalette.inner.accentText }} />
                  <span className="text-[11px] font-bold">智能防看不清保护</span>
                </div>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{
                    backgroundColor: currentTheme.accentSoftBg,
                    color: adaptivePalette.inner.accentText
                  }}
                >
                  {glassConfig.autoContrast ? '已自动适配对比度' : '手动模式'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                <button
                  onClick={() => setGlassConfig(prev => ({ ...prev, autoContrast: !prev.autoContrast }))}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium flex items-center justify-between border transition-all"
                  style={{
                    backgroundColor: glassConfig.autoContrast ? currentTheme.accentSoftBg : 'rgba(128,128,128,0.1)',
                    borderColor: glassConfig.autoContrast ? currentTheme.primary : 'rgba(128,128,128,0.2)'
                  }}
                >
                  <span>智能反色文字</span>
                  <span className="font-bold">{glassConfig.autoContrast ? 'ON' : 'OFF'}</span>
                </button>

                <button
                  onClick={() => setGlassConfig(prev => ({ ...prev, textHalo: !prev.textHalo }))}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium flex items-center justify-between border transition-all"
                  style={{
                    backgroundColor: glassConfig.textHalo ? currentTheme.accentSoftBg : 'rgba(128,128,128,0.1)',
                    borderColor: glassConfig.textHalo ? currentTheme.primary : 'rgba(128,128,128,0.2)'
                  }}
                >
                  <span>护眼文字描边</span>
                  <span className="font-bold">{glassConfig.textHalo ? 'ON' : 'OFF'}</span>
                </button>
              </div>
            </div>

            {/* 1. 主题配色切换 */}
            <div className="mb-4">
              <label className="text-[11px] font-semibold opacity-85 block mb-2">
                1. 主题配色方案（6种精选色系）
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.values(COLOR_THEMES).map(t => {
                  const active = themeId === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setThemeId(t.id)}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-[11px] font-medium transition-all border"
                      style={{
                        backgroundColor: active ? currentTheme.accentSoftBg : 'rgba(128,128,128,0.08)',
                        borderColor: active ? currentTheme.primary : 'rgba(128,128,128,0.15)',
                        color: adaptivePalette.card.textMain
                      }}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                        style={{ background: t.accentGradient }}
                      />
                      <span className="truncate">{t.name.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. 红框区域透明度与毛玻璃调节 */}
            <div className="space-y-3 mb-4 p-3 rounded-xl glass-inner-panel">
              <div className="text-[11px] font-semibold flex items-center gap-1.5" style={{ color: adaptivePalette.inner.accentText }}>
                <Sliders className="w-3.5 h-3.5" />
                <span>2. 红框面板透明度 & 毛玻璃</span>
              </div>

              {/* 主卡片不透明度 */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span style={{ color: adaptivePalette.inner.textMain }}>红框主容器不透明度</span>
                  <span className="font-mono font-semibold" style={{ color: adaptivePalette.inner.accentText }}>
                    {glassConfig.cardOpacity}%
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="95"
                  value={glassConfig.cardOpacity}
                  onChange={e => setGlassConfig(prev => ({ ...prev, cardOpacity: Number(e.target.value) }))}
                  className="w-full glass-slider"
                />
              </div>

              {/* 内部子框体不透明度 */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span style={{ color: adaptivePalette.inner.textMain }}>内部输入框/队列框透明度</span>
                  <span className="font-mono font-semibold" style={{ color: adaptivePalette.inner.accentText }}>
                    {glassConfig.innerOpacity}%
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="90"
                  value={glassConfig.innerOpacity}
                  onChange={e => setGlassConfig(prev => ({ ...prev, innerOpacity: Number(e.target.value) }))}
                  className="w-full glass-slider"
                />
              </div>

              {/* 毛玻璃模糊半径 */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span style={{ color: adaptivePalette.inner.textMain }}>毛玻璃模糊强度 (Blur)</span>
                  <span className="font-mono font-semibold" style={{ color: adaptivePalette.inner.accentText }}>
                    {glassConfig.blurStrength}px
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={glassConfig.blurStrength}
                  onChange={e => setGlassConfig(prev => ({ ...prev, blurStrength: Number(e.target.value) }))}
                  className="w-full glass-slider"
                />
              </div>

              {/* 玻璃边框高光 */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span style={{ color: adaptivePalette.inner.textMain }}>玻璃边缘高光强度</span>
                  <span className="font-mono font-semibold" style={{ color: adaptivePalette.inner.accentText }}>
                    {glassConfig.borderOpacity}%
                  </span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="45"
                  value={glassConfig.borderOpacity}
                  onChange={e => setGlassConfig(prev => ({ ...prev, borderOpacity: Number(e.target.value) }))}
                  className="w-full glass-slider"
                />
              </div>
            </div>

            {/* 3. 自定义背景壁纸设置 */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold opacity-75">
                  3. 自定义背景壁纸
                </label>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 btn-theme-primary"
                >
                  <Upload className="w-3 h-3" /> 上传本地壁纸
                </button>
              </div>

              {/* 预设壁纸缩略图网格 */}
              <div className="grid grid-cols-3 gap-1.5">
                {WALLPAPER_PRESETS.map(wp => {
                  const isSelected = selectedWallpaperId === wp.id;
                  return (
                    <button
                      key={wp.id}
                      onClick={() => setSelectedWallpaperId(wp.id)}
                      className="h-12 rounded-lg overflow-hidden relative border-2 transition-all group"
                      style={{
                        borderColor: isSelected ? currentTheme.primary : 'transparent'
                      }}
                    >
                      {wp.type === 'image' ? (
                        <img src={wp.thumb} alt={wp.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                      ) : (
                        <div className="w-full h-full" style={{ background: wp.gradient }} />
                      )}
                      <div className="absolute inset-0 bg-black/35 flex items-end p-1">
                        <span className="text-[9px] text-white font-medium truncate">{wp.name}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 自定义网络图片 URL 输入 */}
              <div className="flex gap-1.5 pt-1">
                <input
                  type="text"
                  value={customUrlInput}
                  onChange={e => setCustomUrlInput(e.target.value)}
                  placeholder="或粘贴图片直链 https://..."
                  className="flex-1 glass-inner-panel rounded-lg px-2.5 py-1.5 text-[11px] outline-none"
                  style={{ color: currentTheme.textMain }}
                />
                <button
                  onClick={handleApplyCustomUrl}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium glass-inner-panel hover:opacity-80"
                >
                  应用
                </button>
              </div>

              {/* 背景暗角遮罩浓度 */}
              <div className="pt-1">
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="opacity-80">背景暗化遮罩（提升文字清晰度）</span>
                  <span className="font-mono font-semibold" style={{ color: currentTheme.accentText }}>
                    {glassConfig.bgDimming}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="85"
                  value={glassConfig.bgDimming}
                  onChange={e => setGlassConfig(prev => ({ ...prev, bgDimming: Number(e.target.value) }))}
                  className="w-full glass-slider"
                />
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  const renderTransferView = () => {
    return (
      <div className="h-full flex flex-col p-6 max-w-5xl mx-auto w-full animate-in fade-in duration-300">
        {/* 顶部页面标题 */}
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-wider mb-1 uppercase" style={{ color: currentTheme.accentText }}>
              QUARK DRIVE / 工作台
            </p>
            <h2 className="text-2xl font-bold tracking-tight">转存与下载</h2>
          </div>
          <div className="text-xs opacity-75 hidden sm:flex items-center gap-2">
            <span>提示：点击右上角</span>
            <span className="px-2 py-0.5 rounded-md glass-inner-panel font-medium" style={{ color: currentTheme.accentText }}>
              调色盘图标
            </span>
            <span>可实时拖动滑块调节下方红框区域透明度与毛玻璃</span>
          </div>
        </div>

        {/* ================= 你标记的红框主卡片区域（支持全透明度和毛玻璃调节） ================= */}
        <div
          className="glass-main-card rounded-2xl p-6 flex-1 flex flex-col min-h-0"
          style={{ borderTop: `2px solid ${currentTheme.primary}` }}
        >
          <div className="mb-4 flex justify-between items-start">
            <div>
              <h3 className="text-sm font-bold tracking-wide">分享链接队列</h3>
              <p className="text-xs mt-1" style={{ color: currentTheme.textMuted }}>
                粘贴夸克分享链接和提取码，逐项执行并查看真实结果。
              </p>
            </div>
            <button
              onClick={handleFillSampleLinks}
              className="text-xs px-2.5 py-1 rounded-lg glass-inner-panel hover:opacity-90 transition-opacity flex items-center gap-1.5"
              style={{ color: currentTheme.accentText }}
            >
              <Link2 className="w-3.5 h-3.5" /> 填入测试链接
            </button>
          </div>

          {/* 模式切换与目标目录选择 */}
          <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
            <div className="flex glass-inner-panel rounded-xl p-1">
              <button
                onClick={() => setTransferMode('save')}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: transferMode === 'save' ? currentTheme.accentSoftBg : 'transparent',
                  color: transferMode === 'save' ? currentTheme.accentText : currentTheme.textMuted
                }}
              >
                <UploadCloud className="w-4 h-4" /> 转存到网盘
              </button>
              <button
                onClick={() => setTransferMode('download')}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: transferMode === 'download' ? currentTheme.accentSoftBg : 'transparent',
                  color: transferMode === 'download' ? currentTheme.accentText : currentTheme.textMuted
                }}
              >
                <ArrowDownToLine className="w-4 h-4" /> 下载到本地
              </button>
            </div>

            {transferMode === 'save' && (
              <button
                onClick={() => setShowFolderModal(true)}
                className="flex items-center gap-2 glass-inner-panel px-3.5 py-2 rounded-xl text-xs font-medium hover:opacity-90 transition-all"
              >
                <Folder className="w-4 h-4 text-amber-400" />
                <span>{targetFolder}</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60 ml-1" />
              </button>
            )}
          </div>

          {/* 分享文本输入区（同样支持透明度调节，不再是死黑块） */}
          <div className="glass-inner-panel rounded-xl flex flex-col mb-4 overflow-hidden">
            <div className="px-4 py-2 glass-panel-header flex justify-between items-center">
              <span className="text-xs font-semibold" style={{ color: currentTheme.accentText }}>
                分享文本
              </span>
              <span className="text-[11px]" style={{ color: currentTheme.textMuted }}>
                支持多行批量识别
              </span>
            </div>
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder={'粘贴分享链接：可在同一行或下一行附上提取码\nhttps://pan.quark.cn/s/xxxxxxxx 提取码：1234'}
              className="w-full h-28 bg-transparent text-sm p-4 resize-none outline-none font-mono placeholder:opacity-40"
              style={{ color: currentTheme.textMain }}
            />
            <div className="px-4 py-2.5 glass-panel-header border-t border-b-0 flex justify-between items-center">
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer glass-inner-panel px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity">
                <FileText className="w-3.5 h-3.5" style={{ color: currentTheme.accentText }} />
                <span>导入文本文件 (.txt)</span>
                <input
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => {
                      setRawText(String(ev.target?.result || ''));
                      addLog(`已从本地文件导入链接: ${file.name}`, 'success');
                    };
                    reader.readAsText(file);
                  }}
                />
              </label>

              <button
                onClick={handleParseLinks}
                className="btn-theme-primary px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2"
              >
                <Search className="w-3.5 h-3.5" /> 解析链接
              </button>
            </div>
          </div>

          {/* 待处理链接队列区（同样支持透明度与毛玻璃） */}
          <div className="flex-1 flex flex-col glass-inner-panel rounded-xl overflow-hidden min-h-0">
            <div className="px-4 py-2.5 glass-panel-header flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">待处理链接</span>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-md"
                  style={{ background: currentTheme.accentSoftBg, color: currentTheme.accentText }}
                >
                  {executableQueue.length}
                </span>
              </div>
              <button
                onClick={() => setQueue([])}
                className="text-xs opacity-60 hover:opacity-100 hover:text-rose-400 transition-all"
              >
                清空
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {queue.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-sm opacity-50 gap-2">
                  <DownloadCloud className="w-8 h-8 opacity-40" />
                  <span>解析后，链接会显示在这里。</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {queue.map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-3.5 py-2.5 rounded-xl glass-row-hover border border-white/5 transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-mono font-bold shrink-0"
                          style={{ background: currentTheme.accentSoftBg, color: currentTheme.accentText }}
                        >
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-mono truncate">{item.url}</p>
                          <div className="flex items-center gap-3 text-xs mt-0.5" style={{ color: currentTheme.textMuted }}>
                            <span>
                              提取码:{' '}
                              <strong className="font-mono" style={{ color: currentTheme.accentText }}>
                                {item.code}
                              </strong>
                            </span>
                            {item.statuses[transferMode] === 'pending' ? (
                              <span className="text-amber-400/90">● 等待处理</span>
                            ) : item.statuses[transferMode] === 'ok' || item.statuses[transferMode] === 'skipped' ? (
                              <span className="text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> {item.statuses[transferMode] === 'skipped' ? '已跳过' : '已完成'}
                              </span>
                            ) : (
                              <span className="text-rose-400">执行失败</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setQueue(prev => prev.filter(q => q.id !== item.id))}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-500/20 hover:text-rose-400 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 底部执行操作栏 */}
            <div className="px-4 py-3 glass-panel-header border-t border-b-0 flex justify-between items-center shrink-0">
              <div className="text-xs" style={{ color: currentTheme.textMuted }}>
                目标:{' '}
                <span className="font-medium" style={{ color: currentTheme.textMain }}>
                  {transferMode === 'save' ? targetFolder : '项目目录 / downloads'}
                </span>
              </div>
              <button
                onClick={handleExecuteQueue}
                disabled={executableQueue.length === 0 || isExecuting || Boolean(taskId)}
                className="btn-theme-primary px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 disabled:opacity-40"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>
                  {isExecuting
                    ? '正在处理...'
                    : `开始${transferMode === 'save' ? '转存' : '下载'} (${executableQueue.length})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDriveFilesView = () => {
    return (
      <div className="h-full flex flex-col p-6 max-w-5xl mx-auto w-full animate-in fade-in duration-300">
        <div className="mb-5 flex justify-between items-end">
          <div>
            <p className="text-[11px] font-semibold tracking-wider mb-1 uppercase" style={{ color: currentTheme.accentText }}>
              QUARK DRIVE / 工作台
            </p>
            <h2 className="text-2xl font-bold">网盘文件</h2>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => void refreshFiles()}
              className="glass-inner-panel px-3.5 py-2 rounded-xl text-xs font-medium hover:opacity-90 transition-all flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> 刷新目录
            </button>
            <button
              onClick={() => void createFolder()}
              className="btn-theme-primary px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> 新建文件夹
            </button>
          </div>
        </div>

        <div
          className="glass-main-card rounded-2xl flex-1 flex flex-col min-h-0 overflow-hidden"
          style={{ borderTop: `2px solid ${currentTheme.primary}` }}
        >
          {/* 面包屑路径导航 */}
          <div className="px-6 py-3.5 glass-panel-header flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium">
              {currentPath.map((seg, i) => (
                <React.Fragment key={i}>
                  <button
                    onClick={() => void openFolder(pathIds[i], seg, i)}
                    className="hover:underline"
                    style={{
                      color: i === currentPath.length - 1 ? currentTheme.textMain : currentTheme.accentText
                    }}
                  >
                    {seg}
                  </button>
                  {i < currentPath.length - 1 && <ChevronRight className="w-3.5 h-3.5 opacity-40" />}
                </React.Fragment>
              ))}
            </div>
            <span className="text-xs opacity-60">共 {driveFiles.length} 项</span>
          </div>

          {/* 文件表格 */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs border-b border-white/10" style={{ color: currentTheme.textMuted }}>
                  <th className="py-3.5 px-6 font-medium w-3/5">文件名</th>
                  <th className="py-3.5 px-6 font-medium">大小</th>
                  <th className="py-3.5 px-6 font-medium">修改时间</th>
                  <th className="py-3.5 px-6 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-white/5">
                {driveFiles.map(file => (
                  <tr key={file.id} className="glass-row-hover transition-colors group">
                    <td className="py-3.5 px-6 flex items-center gap-3">
                      {file.type === 'folder' && <Folder className="w-5 h-5 text-amber-400 fill-amber-400/20 shrink-0" />}
                      {file.type === 'video' && <Video className="w-5 h-5 shrink-0" style={{ color: currentTheme.accentText }} />}
                      {file.type === 'text' && <FileText className="w-5 h-5 opacity-60 shrink-0" />}
                      {file.type === 'folder' ? (
                        <button
                          type="button"
                          onClick={() => void openFolder(file.id, file.name)}
                          className="font-medium truncate text-left hover:underline"
                          aria-label={`打开目录 ${file.name}`}
                        >
                          {file.name}
                        </button>
                      ) : (
                        <span className="font-medium truncate">{file.name}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-xs font-mono" style={{ color: currentTheme.textMuted }}>
                      {file.size}
                    </td>
                    <td className="py-3.5 px-6 text-xs font-mono" style={{ color: currentTheme.textMuted }}>
                      {file.time}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <button
                        onClick={() => void deleteFile(file)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-500/20 hover:text-rose-400 transition-all"
                        title="删除文件"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderRenameView = () => {
    // 根据用户输入的正则表达式实时计算预览结果
    const previewList = driveFiles.map(f => {
      let newName = f.name;
      if (findPattern) {
        try {
          const regex = new RegExp(findPattern, 'g');
          newName = f.name.replace(regex, replacePattern);
        } catch {
          newName = f.name.replaceAll(findPattern, replacePattern);
        }
      }
      return { ...f, newName, changed: newName !== f.name };
    });

    const handleApplyRename = () => {
      const changed = previewList.filter(item => item.changed);
      if (!changed.length) return addLog('没有需要重命名的文件', 'info');
      void startTask('rename', changed.map(item => ({ fid: item.id, name: item.newName })));
    };

    return (
      <div className="h-full flex flex-col p-6 max-w-5xl mx-auto w-full animate-in fade-in duration-300">
        <div className="mb-5">
          <p className="text-[11px] font-semibold tracking-wider mb-1 uppercase" style={{ color: currentTheme.accentText }}>
            QUARK DRIVE / 工作台
          </p>
          <h2 className="text-2xl font-bold">批量重命名</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
          {/* 左侧：正则替换规则卡片 */}
          <div
            className="glass-main-card rounded-2xl p-6 flex flex-col gap-4"
            style={{ borderTop: `2px solid ${currentTheme.primary}` }}
          >
            <h3 className="text-sm font-bold tracking-wide border-b border-white/10 pb-3">
              替换规则 (支持正则表达式)
            </h3>

            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: currentTheme.textMuted }}>
                目标目录
              </label>
              <button
                onClick={() => setShowFolderModal(true)}
                className="w-full glass-inner-panel rounded-xl px-3.5 py-2.5 text-xs flex items-center justify-between hover:opacity-90"
              >
                <span className="flex items-center gap-2 truncate">
                  <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="truncate">{targetFolder}</span>
                </span>
                <span style={{ color: currentTheme.accentText }}>选择</span>
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: currentTheme.textMuted }}>
                查找内容 (Find / Regex)
              </label>
              <input
                type="text"
                value={findPattern}
                onChange={e => setFindPattern(e.target.value)}
                placeholder="例如: 【.*?】"
                className="w-full glass-inner-panel rounded-xl px-3.5 py-2.5 text-sm font-mono outline-none"
                style={{ color: currentTheme.accentText }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: currentTheme.textMuted }}>
                替换为 (Replace)
              </label>
              <input
                type="text"
                value={replacePattern}
                onChange={e => setReplacePattern(e.target.value)}
                placeholder="留空则为直接删除匹配内容"
                className="w-full glass-inner-panel rounded-xl px-3.5 py-2.5 text-sm font-mono outline-none"
                style={{ color: currentTheme.textMain }}
              />
            </div>

            {/* 常用正则快捷填入 */}
            <div className="space-y-1.5">
              <span className="text-[11px]" style={{ color: currentTheme.textMuted }}>
                快捷规则预设：
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => { setFindPattern('【.*?】'); setReplacePattern(''); }}
                  className="text-[11px] px-2.5 py-1 rounded-lg glass-inner-panel hover:opacity-90"
                >
                  清除【...】前缀
                </button>
                <button
                  onClick={() => { setFindPattern('\\.'); setReplacePattern(' '); }}
                  className="text-[11px] px-2.5 py-1 rounded-lg glass-inner-panel hover:opacity-90"
                >
                  分隔点转空格
                </button>
              </div>
            </div>

            <button
              onClick={handleApplyRename}
              className="mt-auto w-full btn-theme-primary font-semibold py-2.5 rounded-xl text-xs flex justify-center items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> 执行批量重命名
            </button>
          </div>

          {/* 右侧：实时重命名对比预览 */}
          <div
            className="lg:col-span-2 glass-main-card rounded-2xl flex flex-col min-h-0 overflow-hidden"
            style={{ borderTop: `2px solid ${currentTheme.primary}` }}
          >
            <div className="px-5 py-3.5 glass-panel-header flex justify-between items-center">
              <span className="text-sm font-bold">实时修改预览</span>
              <span className="text-xs" style={{ color: currentTheme.accentText }}>
                匹配命中 {previewList.filter(p => p.changed).length} 项
              </span>
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-2.5">
              {previewList.map(item => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 glass-inner-panel p-3.5 rounded-xl text-xs font-mono"
                >
                  <div className={`flex-1 truncate ${item.changed ? 'text-rose-400 line-through opacity-75' : 'opacity-60'}`}>
                    {item.name}
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-40 shrink-0" />
                  <div
                    className="flex-1 truncate font-semibold"
                    style={{ color: item.changed ? '#34D399' : currentTheme.textMain }}
                  >
                    {item.newName}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderShareView = () => {
    const handleGenerateShares = () => {
      const selected = driveFiles.filter(f => f.checked);
      if (selected.length === 0) {
        addLog('请至少勾选一个要分享的网盘文件或文件夹', 'error');
        return;
      }
      setShareOutput('');
      void startTask('share', selected.map(file => ({ fid: file.id, name: file.name })), {
        expiredType: ({ '永久有效': 1, '7天': 3, '30天': 4 })[shareExpire],
        passMode: shareCodeType === '随机生成' ? 'random' : 'none'
      });
    };

    return (
      <div className="h-full flex flex-col p-6 max-w-5xl mx-auto w-full animate-in fade-in duration-300">
        <div className="mb-5">
          <p className="text-[11px] font-semibold tracking-wider mb-1 uppercase" style={{ color: currentTheme.accentText }}>
            QUARK DRIVE / 工作台
          </p>
          <h2 className="text-2xl font-bold">批量创建分享</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
          <div
            className="glass-main-card rounded-2xl p-6 flex flex-col gap-5"
            style={{ borderTop: `2px solid ${currentTheme.primary}` }}
          >
            <h3 className="text-sm font-bold tracking-wide border-b border-white/10 pb-3">
              分享参数配置
            </h3>

            <div className="space-y-2 flex-1 flex flex-col min-h-0">
              <label className="text-xs font-medium" style={{ color: currentTheme.textMuted }}>
                勾选要分享的文件或目录
              </label>
              <div className="flex-1 glass-inner-panel rounded-xl p-2.5 overflow-y-auto space-y-1">
                {driveFiles.map(file => (
                  <label
                    key={file.id}
                    className="flex items-center gap-3 p-2.5 glass-row-hover rounded-lg cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={file.checked}
                      onChange={() =>
                        setDriveFiles(prev =>
                          prev.map(f => (f.id === file.id ? { ...f, checked: !f.checked } : f))
                        )
                      }
                      className="rounded"
                      style={{ accentColor: currentTheme.primary }}
                    />
                    {file.type === 'folder' ? (
                      <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <Video className="w-4 h-4 shrink-0" style={{ color: currentTheme.accentText }} />
                    )}
                    <span className="text-xs font-medium truncate">{file.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: currentTheme.textMuted }}>
                  有效期
                </label>
                <select
                  value={shareExpire}
                  onChange={e => setShareExpire(e.target.value)}
                  className="w-full glass-inner-panel rounded-xl px-3 py-2 text-xs outline-none"
                  style={{ color: currentTheme.textMain }}
                >
                  <option className="bg-slate-900 text-white">永久有效</option>
                  <option className="bg-slate-900 text-white">7天</option>
                  <option className="bg-slate-900 text-white">30天</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: currentTheme.textMuted }}>
                  提取码方式
                </label>
                <select
                  value={shareCodeType}
                  onChange={e => setShareCodeType(e.target.value)}
                  className="w-full glass-inner-panel rounded-xl px-3 py-2 text-xs outline-none"
                  style={{ color: currentTheme.textMain }}
                >
                  <option className="bg-slate-900 text-white">随机生成</option>
                  <option className="bg-slate-900 text-white">无提取码</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleGenerateShares}
              className="w-full btn-theme-primary font-semibold py-2.5 rounded-xl text-xs flex justify-center items-center gap-2"
            >
              <Share2 className="w-4 h-4" /> 一键生成分享链接
            </button>
          </div>

          <div
            className="glass-main-card rounded-2xl flex flex-col min-h-0 overflow-hidden"
            style={{ borderTop: `2px solid ${currentTheme.primary}` }}
          >
            <div className="px-5 py-3.5 glass-panel-header flex justify-between items-center">
              <span className="text-sm font-bold">生成结果导出</span>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(shareOutput);
                  addLog('已复制全部分享链接到剪贴板', 'success');
                }}
                className="text-xs flex items-center gap-1.5 font-medium hover:underline"
                style={{ color: currentTheme.accentText }}
              >
                <Copy className="w-3.5 h-3.5" /> 复制全部
              </button>
            </div>
            <textarea
              readOnly
              value={shareOutput}
              className="flex-1 bg-transparent p-5 text-xs font-mono resize-none outline-none leading-relaxed"
              style={{ color: currentTheme.textMain }}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderSettingsView = () => {
    return (
      <div className="h-full flex flex-col p-6 max-w-4xl mx-auto w-full animate-in fade-in duration-300">
        <div className="mb-5">
          <p className="text-[11px] font-semibold tracking-wider mb-1 uppercase" style={{ color: currentTheme.accentText }}>
            SYSTEM / 设置
          </p>
          <h2 className="text-2xl font-bold">账号与后端配置</h2>
        </div>

        <div
          className="glass-main-card rounded-2xl p-6 space-y-6"
          style={{ borderTop: `2px solid ${currentTheme.primary}` }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-5">
            <div>
              <h3 className="text-sm font-bold">当前夸克账号状态</h3>
              <p className="text-xs mt-1" style={{ color: currentTheme.textMuted }}>
                {session.connected ? '会话有效，可正常执行网盘操作。' : session.error || '请先配置 Cookie。'}
              </p>
            </div>
            <div className="flex items-center gap-3 glass-inner-panel px-4 py-2 rounded-xl self-start sm:self-auto">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-semibold">{session.connected ? session.nickname : '未登录'}</span>
              <button onClick={() => void logout()} className="ml-2 text-xs text-rose-400 hover:underline flex items-center gap-1">
                <LogOut className="w-3.5 h-3.5" /> 退出
              </button>
            </div>
          </div>

          <div className="space-y-3 border-b border-white/10 pb-6">
            <div>
              <h3 className="text-sm font-bold">浏览器登录</h3>
              <p className="text-xs mt-1" style={{ color: currentTheme.textMuted }}>
                {loginStatus.state === 'opening' ? '正在打开 Firefox 登录窗口…' :
                  loginStatus.state === 'waiting' ? '请在弹出的窗口中登录，完成后点击下方确认。' :
                  loginStatus.state === 'saving' ? '正在保存 Cookie 并验证账号…' :
                  loginStatus.state === 'error' ? loginStatus.error :
                  loginStatus.state === 'done' ? '网页登录完成，账号状态已更新。' :
                  '在本机打开夸克网盘登录窗口，完成后自动保存 Cookie。'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => void startBrowserLogin()}
                disabled={['opening', 'waiting', 'saving'].includes(loginStatus.state)}
                className="btn-theme-primary px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <FolderOpen className="w-4 h-4" /> 打开浏览器登录
              </button>
              {loginStatus.state === 'waiting' && (
                <button
                  onClick={() => void finishBrowserLogin()}
                  className="glass-inner-panel px-4 py-2 rounded-xl text-xs font-semibold hover:opacity-90 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" /> 我已完成登录
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-1">
              <label className="text-xs font-semibold">更新夸克网盘 Cookie</label>
              <span className="text-[11px] font-mono" style={{ color: currentTheme.accentText }}>
                需包含 __puus 与 __pus 字段
              </span>
            </div>
            <textarea
              value={cookieInput}
              onChange={event => setCookieInput(event.target.value)}
              placeholder="在此粘贴从浏览器开发者工具获取的完整 Cookie 字符串..."
              className="w-full h-28 glass-inner-panel rounded-xl p-3.5 text-xs font-mono resize-none outline-none"
              style={{ color: currentTheme.textMain }}
            />
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => void checkSession()}
                className="glass-inner-panel px-4 py-2 rounded-xl text-xs font-semibold hover:opacity-90"
              >
                测试连通性
              </button>
              <button
                onClick={() => void saveCookie()}
                className="btn-theme-primary px-6 py-2 rounded-xl text-xs font-semibold"
              >
                保存配置
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 目录树选择弹窗
  const renderFolderModal = () => {
    if (!showFolderModal) return null;
    const folders = [
      { id: folderPath[folderPath.length - 1].id, name: `/ ${folderPath.map(part => part.name).join(' / ')}`, select: true },
      ...(folderPath.length > 1 ? [{ id: folderPath[folderPath.length - 2].id, name: '.. 返回上一级', parent: true }] : []),
      ...folderCandidates.map(item => ({ id: item.fid, name: item.name }))
    ];
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="glass-main-card rounded-2xl w-full max-w-md p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-white/10 pb-3">
            <h3 className="text-sm font-bold">选择网盘目标目录</h3>
            <button onClick={() => setShowFolderModal(false)} className="p-1 rounded-lg hover:bg-white/10">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {folders.map(folder => (
              <button
                key={folder.id + folder.name}
                onClick={() => {
                  if (folder.select) {
                    setTargetFolder(folder.name);
                    setTargetFolderId(folder.id);
                    setShowFolderModal(false);
                    addLog(`已切换目标目录至: ${folder.name}`, 'info');
                    if (activeTab === 'rename') {
                      const path = folderPath;
                      setPathIds(path.map(part => part.id));
                      setCurrentPath(path.map(part => part.name));
                      void refreshFiles(folder.id);
                    }
                  } else if (folder.parent) {
                    setFolderPath(previous => previous.slice(0, -1));
                  } else {
                    setFolderPath(previous => [...previous, { id: folder.id, name: folder.name }]);
                  }
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium glass-row-hover transition-all"
                style={{
                  backgroundColor: targetFolderId === folder.id && folder.select ? currentTheme.accentSoftBg : 'transparent',
                  color: targetFolderId === folder.id && folder.select ? currentTheme.accentText : currentTheme.textMain
                }}
              >
                <span className="flex items-center gap-2.5">
                  <Folder className="w-4 h-4 text-amber-400" />
                  <span>{folder.name}</span>
                </span>
                {targetFolderId === folder.id && folder.select && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // 底部可折叠任务记录抽屉
  const renderTaskLogConsole = () => {
    return (
      <div
        className={`glass-sidebar border-t border-r-0 transition-all duration-300 ease-in-out flex flex-col z-30 ${
          logExpanded ? 'h-56' : 'h-11'
        }`}
      >
        <div
          className="h-11 px-6 flex justify-between items-center cursor-pointer hover:bg-white/5 transition-colors shrink-0"
          onClick={() => setLogExpanded(!logExpanded)}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: currentTheme.primary, boxShadow: `0 0 8px ${currentTheme.primary}` }}
            />
            <span className="text-xs font-semibold">任务记录</span>
            <span className="text-[11px] opacity-60">[{logs.length} 条日志]</span>
            {logs.length > 0 && (
              <span className="text-[11px] opacity-75 ml-3 truncate max-w-md font-mono">
                最新: {logs[logs.length - 1].text}
              </span>
            )}
          </div>
          <button className="opacity-60 hover:opacity-100 p-1">
            {logExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {logExpanded && (
          <div className="flex-1 overflow-y-auto px-6 py-2.5 font-mono text-[11px] space-y-1.5 glass-inner-panel border-0">
            {logs.map((log, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="opacity-50 shrink-0">[{log.time}]</span>
                <span
                  className="shrink-0 font-bold"
                  style={{
                    color:
                      log.type === 'info'
                        ? currentTheme.accentText
                        : log.type === 'success'
                        ? '#34D399'
                        : '#FB7185'
                  }}
                >
                  {log.type === 'info' ? '[INFO]' : log.type === 'success' ? '[ OK ]' : '[ERR ]'}
                </span>
                <span className="opacity-90">{log.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="quark-app-root">
      <DynamicGlobalStyles
        theme={currentTheme}
        glassConfig={glassConfig}
        adaptivePalette={adaptivePalette}
      />

      {/* 底层：可自定义背景壁纸层 */}
      <div
        className="fixed inset-0 z-0 transition-all duration-500"
        style={{
          ...getBackgroundStyle(),
          filter: glassConfig.bgBlur > 0 ? `blur(${glassConfig.bgBlur}px)` : 'none',
          transform: glassConfig.bgBlur > 0 ? 'scale(1.04)' : 'scale(1)'
        }}
      />

      {/* 中间层：可调节浓度的背景暗化遮罩（保证任何花哨壁纸下文字依然清晰） */}
      <div
        className="fixed inset-0 z-0 pointer-events-none transition-opacity duration-200"
        style={{
          backgroundColor:
            currentTheme.mode === 'light'
              ? `rgba(255, 255, 255, ${glassConfig.bgDimming / 100})`
              : `rgba(8, 12, 18, ${glassConfig.bgDimming / 100})`
        }}
      />

      {/* 顶层：主界面工作台 */}
      <div className="h-screen w-full flex flex-col relative z-10">
        <div className="flex-1 flex overflow-hidden">
          {renderSidebar()}
          <main className="flex-1 overflow-y-auto relative">
            {activeTab === 'transfer' && renderTransferView()}
            {activeTab === 'files' && renderDriveFilesView()}
            {activeTab === 'rename' && renderRenameView()}
            {activeTab === 'share' && renderShareView()}
            {activeTab === 'settings' && renderSettingsView()}
          </main>
        </div>
        {renderTaskLogConsole()}
      </div>

      {/* 悬浮外观与背景定制面板 & 目录选择弹窗 */}
      {renderAppearanceStudio()}
      {renderFolderModal()}
    </div>
  );
}
