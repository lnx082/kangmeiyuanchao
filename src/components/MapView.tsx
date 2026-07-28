import { useEffect, useRef, useCallback } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import type { BattleCampaign } from '../types';

// ============================================================
// 🔑 Cesium ion Token
//    免费注册: https://ion.cesium.com/signup/
//    不配置 → 用 OpenStreetMap 底图（完全免费，无需注册）
//    配置后 → 自动启用高精度 3D 地形 + 卫星影像
// ============================================================
const CESIUM_TOKEN = import.meta.env.VITE_CESIUM_TOKEN || '';
// 真 Token 是 JWT 格式，以 eyJ 开头；占位符/空值不设置
const hasValidToken = CESIUM_TOKEN.startsWith('eyJ');
if (hasValidToken) {
  Cesium.Ion.defaultAccessToken = CESIUM_TOKEN;
}

// ============================================================
// 朝鲜半岛默认视角
// ============================================================
const KOREA_LNG = 127.5;
const KOREA_LAT = 38.5;
const DEFAULT_HEIGHT = 800_000;
const BATTLE_HEIGHT = 50_000;
const FLY_DURATION = 2.0;

// ============================================================
// Canvas 绘制红星图标
// ============================================================
function createStarCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.42;
  const innerR = size * 0.18;

  const glow = ctx.createRadialGradient(cx, cy, innerR * 0.6, cx, cy, size / 2);
  glow.addColorStop(0, 'rgba(239, 68, 68, 0.7)');
  glow.addColorStop(0.5, 'rgba(239, 68, 68, 0.15)');
  glow.addColorStop(1, 'rgba(239, 68, 68, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const outerAngle = ((i * 72 - 90) * Math.PI) / 180;
    const innerAngle = ((i * 72 + 36 - 90) * Math.PI) / 180;
    const ox = cx + outerR * Math.cos(outerAngle);
    const oy = cy + outerR * Math.sin(outerAngle);
    const ix = cx + innerR * Math.cos(innerAngle);
    const iy = cy + innerR * Math.sin(innerAngle);
    if (i === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();

  const starGrad = ctx.createRadialGradient(cx, cy * 0.75, 0, cx, cy, outerR);
  starGrad.addColorStop(0, '#FFD700');
  starGrad.addColorStop(0.35, '#EF4444');
  starGrad.addColorStop(1, '#991B1B');
  ctx.fillStyle = starGrad;
  ctx.fill();

  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  const highlight = ctx.createRadialGradient(cx, cy * 0.7, 0, cx, cy, outerR * 0.5);
  highlight.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
  highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = highlight;
  ctx.fill();

  return canvas;
}

const starDataUrlCache = new Map<number, string>();
function getStarDataUrl(size: number): string {
  if (!starDataUrlCache.has(size)) {
    starDataUrlCache.set(size, createStarCanvas(size).toDataURL('image/png'));
  }
  return starDataUrlCache.get(size)!;
}

// ============================================================
// Props
// ============================================================
interface MapViewProps {
  battles: BattleCampaign[];
  selectedBattleId: string | null;
  onBattleSelect: (id: string) => void;
}

export default function MapView({
  battles,
  selectedBattleId,
  onBattleSelect,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const entitiesRef = useRef<Map<string, Cesium.Entity>>(new Map());
  const flyLockRef = useRef(false);

  const createBattleEntity = useCallback(
    (battle: BattleCampaign): Cesium.Entity => {
      return new Cesium.Entity({
        id: battle.id,
        name: battle.name,
        position: Cesium.Cartesian3.fromDegrees(
          battle.coordinates.lng,
          battle.coordinates.lat,
          0,
        ),
        billboard: {
          image: getStarDataUrl(72),
          width: 48,
          height: 48,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          scaleByDistance: new Cesium.NearFarScalar(5000, 1.2, 500000, 0.4),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: battle.name,
          font: '600 13px "Microsoft YaHei", sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.fromCssColorString('#1a1a2e'),
          outlineWidth: 4,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.TOP,
          pixelOffset: new Cesium.Cartesian2(0, 12),
          scaleByDistance: new Cesium.NearFarScalar(5000, 1.0, 500000, 0.0),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    },
    [],
  );

  // ---- 初始化 Cesium Viewer ----
  useEffect(() => {
    if (!containerRef.current) return;

    // hasValidToken: 顶层常量，表示配置了真正的 Cesium ion JWT Token
    // 无 Token → OpenStreetMap（免费、可靠、同步加载）
    // 有 Token → 不设 baseLayer，Cesium 自动使用 Ion 卫星图
    const baseLayer = hasValidToken
      ? undefined
      : new Cesium.ImageryLayer(
          new Cesium.OpenStreetMapImageryProvider({
            url: 'https://tile.openstreetmap.org/',
            maximumLevel: 18,
          }),
        );

    const viewer = new Cesium.Viewer(containerRef.current, {
      baseLayer,
      terrainProvider: hasValidToken ? undefined : new Cesium.EllipsoidTerrainProvider(),
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      homeButton: false,
      geocoder: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      infoBox: false,
      selectionIndicator: false,
      scene3DOnly: true,
      // 关键：关闭按需渲染，确保首帧立即绘制
      requestRenderMode: false,
    });

    const scene = viewer.scene;

    // 地球底色 — 确保瓦片加载中也不会全黑
    scene.globe.baseColor = Cesium.Color.fromCssColorString('#1a2a4a');
    scene.globe.enableLighting = true;

    // 天空大气
    if (scene.skyAtmosphere) {
      scene.skyAtmosphere.hueShift = -0.1;
      scene.skyAtmosphere.saturationShift = 0.2;
    }

    // 雾
    scene.fog.enabled = true;
    scene.fog.density = 0.00003;

    // 初始视角 — 对准朝鲜半岛
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(KOREA_LNG, KOREA_LAT - 1.5, DEFAULT_HEIGHT),
      orientation: {
        heading: Cesium.Math.toRadians(5),
        pitch: Cesium.Math.toRadians(-50),
        roll: 0,
      },
    });

    // 强制渲染一帧确保地球可见
    scene.requestRender();

    viewerRef.current = viewer;

    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  // ---- 同步战役 Entity ----
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    entitiesRef.current.forEach((e) => viewer.entities.remove(e));
    entitiesRef.current.clear();

    battles.forEach((battle) => {
      const entity = createBattleEntity(battle);
      viewer.entities.add(entity);
      entitiesRef.current.set(battle.id, entity);
    });
  }, [battles, createBattleEntity]);

  // ---- 点击 ----
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const picked = viewer.scene.pick(movement.position);
      if (Cesium.defined(picked) && picked.id && (picked.id as Cesium.Entity).id) {
        const entityId = (picked.id as Cesium.Entity).id as string;
        if (entitiesRef.current.has(entityId)) {
          onBattleSelect(entityId);
          return;
        }
      }
      onBattleSelect('');
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      handler.destroy();
    };
  }, [onBattleSelect]);

  // ---- FlyTo ----
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !selectedBattleId || flyLockRef.current) return;

    const battle = battles.find((b) => b.id === selectedBattleId);
    if (!battle) return;

    flyLockRef.current = true;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        battle.coordinates.lng,
        battle.coordinates.lat,
        BATTLE_HEIGHT,
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-65),
        roll: 0,
      },
      duration: FLY_DURATION,
      complete: () => { flyLockRef.current = false; },
      cancel: () => { flyLockRef.current = false; },
    });
  }, [selectedBattleId, battles]);

  // ---- 悬停光标 ----
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

    handler.setInputAction((movement: { endPosition: Cesium.Cartesian2 }) => {
      const picked = viewer.scene.pick(movement.endPosition);
      if (Cesium.defined(picked) && picked.id && (picked.id as Cesium.Entity).id) {
        const entityId = (picked.id as Cesium.Entity).id as string;
        if (entitiesRef.current.has(entityId)) {
          viewer.canvas.style.cursor = 'pointer';
          return;
        }
      }
      viewer.canvas.style.cursor = 'default';
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    return () => {
      handler.destroy();
    };
  }, []);

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {/* Cesium 容器 — 必须绝对定位撑满 */}
      <div
        ref={containerRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      />

      {/* Token 状态提示 */}
      {!hasValidToken && (
        <div className="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-amber-700/85 px-3 py-1.5 text-[11px] text-white backdrop-blur-sm sm:text-xs">
          ⚡ 未配置 Token — OpenStreetMap 底图（无 3D 地形）
          <br />
          <span className="opacity-70">注册免费 Token → ion.cesium.com</span>
        </div>
      )}

      {hasValidToken && (
        <div className="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-emerald-700/85 px-3 py-1.5 text-[11px] text-white backdrop-blur-sm sm:text-xs">
          ✅ 3D 地形 + 卫星影像已启用
        </div>
      )}

      {/* 底部提示 */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-black/55 px-4 py-2 text-xs text-white/75 backdrop-blur-sm">
        点击红星查看战役 · 滚轮缩放 · 拖拽旋转地球
      </div>
    </div>
  );
}
