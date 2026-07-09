import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const TILE_W = 128;
const TILE_H = 64;
const SLAB_CENTRE_CELL = { col: 1, row: 1 };
const OBJECT_BOTTOM_FRAC = 0.96;
const OBJECT_SEAT = TILE_H * 0.25;
const SPRITE_DROP = TILE_H * 0.18;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 5;
const ZOOM_STEP = 1.18;
const EGG_FAMILY = {
  id: 'egg',
  category: 'egg',
  label: 'Egg',
  enabled: true,
  virtual: true,
  prompt: '',
  assets: [
    {
      assetKey: 'egg',
      label: 'Egg',
      state: 'default',
      path: 'assets/images/katchimeras/cutouts/egg-base.png',
    },
  ],
};

function cellCenter(col, row) {
  return { x: (col - row) * (TILE_W / 2), y: (col + row + 1) * (TILE_H / 2) };
}

function cellFromPoint(x, y) {
  const a = x / (TILE_W / 2);
  const b = y / (TILE_H / 2) - 1;
  return { col: (a + b) / 2, row: (b - a) / 2 };
}

function isoDepth(point) {
  return Math.round(point.y * 100 - point.x);
}

function clampStagePoint(point, bounds, fallbackSize) {
  const minX = Number.isFinite(bounds.minX) ? bounds.minX : 0;
  const maxX = Number.isFinite(bounds.maxX) ? bounds.maxX : fallbackSize;
  const minY = Number.isFinite(bounds.minY) ? bounds.minY : 0;
  const maxY = Number.isFinite(bounds.maxY) ? bounds.maxY : fallbackSize;
  return {
    x: clamp(point.x, minX, maxX),
    y: clamp(point.y, minY, maxY),
  };
}

function imageUrl(path, cacheBust = '') {
  return `/${path}${cacheBust ? `?v=${cacheBust}` : ''}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const ENV_PROGRESS = {
  base: [
    'Preparing base prompt',
    'Sending style reference to FAL AI',
    'Generating base image',
    'Downloading image and refreshing scene',
  ],
  fit: [
    'Saving prompt and placement',
    'Cropping base around object',
    'Generating fitted image via FAL AI',
    'Matting and extracting candidate prop',
    'Refreshing previews',
  ],
  apply: [
    'Reading fitted candidate',
    'Replacing live prop image',
    'Refreshing scene',
  ],
  mask: [
    'Saving reveal mask',
    'Refreshing masked scene preview',
  ],
  extractObject: [
    'Saving current mask',
    'Cropping full scene around object',
    'Isolating object via FAL AI',
    'Matting transparent object',
    'Saving extracted object layer',
    'Refreshing scene',
  ],
  linkObject: [
    'Downloading linked generated image',
    'Matting transparent object',
    'Saving extracted object layer',
    'Refreshing scene',
  ],
  extractAllObjects: [
    'Finding masked objects without extractions',
    'Starting parallel GPT image edit jobs, two at a time',
    'Matting extracted objects',
    'Saving extracted object layers',
    'Refreshing scene',
  ],
  bake: [
    'Collecting station list and placement rectangles',
    'Sending base image and text-only object list to FAL AI',
    'Generating full baked scene from scratch',
    'Saving baked scene preview',
    'Refreshing previews',
  ],
  directPipeline: [
    'Preparing direct full-scene prompt',
    'Generating populated scene from style reference',
    'Saving direct scene preview',
    'Removing station objects from final scene',
    'Saving extracted base preview',
    'Refreshing previews',
  ],
  save: ['Saving prompt changes'],
};

function round(value, step) {
  return Math.round(value / step) * step;
}

function firstAsset(family) {
  return family.assets?.[0] ?? null;
}

function assetForFamily(family, selectedAssetKey) {
  return family.assets?.find((asset) => asset.assetKey === selectedAssetKey) ?? firstAsset(family);
}

function categoryScale(layout, family, asset) {
  return (
    layout.scaleByAssetKey?.[asset?.assetKey] ??
    layout.scaleByCategory?.[family.category] ??
    1
  );
}

function hasNormalisedPosition(pos) {
  return Number.isFinite(pos?.nx) && Number.isFinite(pos?.ny);
}

function App() {
  const [catalog, setCatalog] = useState(null);
  const [layout, setLayout] = useState(null);
  const [discoveredAssets, setDiscoveredAssets] = useState([]);
  const [validation, setValidation] = useState(null);
  const [selectedFamilyId, setSelectedFamilyId] = useState(null);
  const [selectedAssetKey, setSelectedAssetKey] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [scope, setScope] = useState('selected');
  const [status, setStatus] = useState('Loading');
  const [cacheBust, setCacheBust] = useState('');
  const [snap, setSnap] = useState(false);
  const [tool, setTool] = useState('move');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [assetPicker, setAssetPicker] = useState(null);
  const [assetSearch, setAssetSearch] = useState('');
  const stageRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const response = await fetch('/api/catalog');
    const data = await response.json();
    setCatalog(data.catalog);
    setLayout(data.layout);
    setDiscoveredAssets(data.discoveredAssets);
    setValidation(data.validation);
    const first = data.catalog.families?.[0];
    setSelectedFamilyId(first?.id ?? null);
    setSelectedAssetKey(firstAsset(first)?.assetKey ?? null);
    setPrompt(first?.prompt ?? '');
    setStatus('Ready');
  }

  const families = useMemo(() => {
    const baseFamilies = catalog?.families ?? [];
    return layout?.positions?.egg ? [...baseFamilies, EGG_FAMILY] : baseFamilies;
  }, [catalog, layout]);
  const selectedFamily = families.find((family) => family.id === selectedFamilyId) ?? families[0] ?? null;
  const selectedAsset = selectedFamily ? assetForFamily(selectedFamily, selectedAssetKey) : null;
  const selectedAssetInfo = selectedAsset
    ? discoveredAssets.find((asset) => asset.path === selectedAsset.path)
    : null;
  const selectedAssetWired = !!selectedAssetInfo?.assetKeys?.includes(selectedAsset?.assetKey);

  useEffect(() => {
    if (!selectedFamily) return;
    setSelectedAssetKey((current) => assetForFamily(selectedFamily, current)?.assetKey ?? firstAsset(selectedFamily)?.assetKey ?? null);
    setPrompt(selectedFamily.prompt ?? '');
  }, [selectedFamily]);

  const placedFamilies = useMemo(
    () => families.filter((family) => family.enabled && layout?.positions?.[family.category]),
    [families, layout]
  );
  const potentialAssets = useMemo(() => discoveredAssets.filter((asset) => !asset.wired), [discoveredAssets]);
  const assetChoices = useMemo(() => {
    const query = assetSearch.trim().toLowerCase();
    return [...discoveredAssets]
      .sort((left, right) => {
        if (left.wired !== right.wired) return left.wired ? -1 : 1;
        return `${left.folder}/${left.fileName}`.localeCompare(`${right.folder}/${right.fileName}`);
      })
      .filter((asset) => {
        if (!query) return true;
        return (
          asset.fileName.toLowerCase().includes(query) ||
          asset.folder.toLowerCase().includes(query) ||
          asset.path.toLowerCase().includes(query) ||
          asset.assetKeys.join(' ').toLowerCase().includes(query)
        );
      });
  }, [assetSearch, discoveredAssets]);

  const geometry = useMemo(() => {
    const size = 760;
    const centre = { x: size / 2, y: size / 2 + 24 };
    const scale = 1.22;
    const origin = cellCenter(SLAB_CENTRE_CELL.col, SLAB_CENTRE_CELL.row);
    return { size, centre, scale, origin };
  }, []);

  function toStagePoint(col, row) {
    const p = cellCenter(col, row);
    return {
      x: geometry.centre.x + (p.x - geometry.origin.x) * geometry.scale,
      y: geometry.centre.y + (p.y - geometry.origin.y) * geometry.scale,
    };
  }

  function positionToStagePoint(pos) {
    if (hasNormalisedPosition(pos)) {
      return { x: pos.nx * geometry.size, y: pos.ny * geometry.size };
    }
    return toStagePoint(pos.col, pos.row);
  }

  function fromStagePoint(x, y) {
    return cellFromPoint(
      (x - geometry.centre.x) / geometry.scale + geometry.origin.x,
      (y - geometry.centre.y) / geometry.scale + geometry.origin.y
    );
  }

  function localPoint(event) {
    const rect = stageRef.current.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - pan.x) / zoom,
      y: (event.clientY - rect.top - pan.y) / zoom,
    };
  }

  function zoomAt(clientX, clientY, nextZoom) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) {
      setZoom(nextZoom);
      return;
    }
    const clampedZoom = clamp(Number(nextZoom.toFixed(3)), MIN_ZOOM, MAX_ZOOM);
    const viewportPoint = { x: clientX - rect.left, y: clientY - rect.top };
    const worldPoint = {
      x: (viewportPoint.x - pan.x) / zoom,
      y: (viewportPoint.y - pan.y) / zoom,
    };
    setZoom(clampedZoom);
    setPan({
      x: Number((viewportPoint.x - worldPoint.x * clampedZoom).toFixed(2)),
      y: Number((viewportPoint.y - worldPoint.y * clampedZoom).toFixed(2)),
    });
  }

  function zoomAtViewportCenter(nextZoom) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) {
      setZoom(clamp(nextZoom, MIN_ZOOM, MAX_ZOOM));
      return;
    }
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, nextZoom);
  }

  function resetViewport() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function updatePosition(category, col, row) {
    const rawCol = snap ? Math.round(col) : col;
    const rawRow = snap ? Math.round(row) : row;
    updatePositionFromStagePoint(category, toStagePoint(rawCol, rawRow));
  }

  function updatePositionFromStagePoint(category, stagePoint) {
    const bounds = layout.bounds ?? {};
    const boundedPoint = clampStagePoint(stagePoint, bounds, geometry.size);
    const boundedCell = fromStagePoint(boundedPoint.x, boundedPoint.y);
    const nextCol = Number(boundedCell.col.toFixed(3));
    const nextRow = Number(boundedCell.row.toFixed(3));
    const nextNx = Number((boundedPoint.x / geometry.size).toFixed(5));
    const nextNy = Number((boundedPoint.y / geometry.size).toFixed(5));
    setLayout((current) => ({
      ...current,
      positions: { ...current.positions, [category]: { col: nextCol, row: nextRow, nx: nextNx, ny: nextNy } },
    }));
  }

  function updateCategoryScale(category, scale) {
    const bounds = layout.bounds ?? {};
    const nextScale = clamp(Number(scale.toFixed(3)), bounds.minScale ?? 0.35, bounds.maxScale ?? 3.5);
    setLayout((current) => ({
      ...current,
      scaleByCategory: { ...current.scaleByCategory, [category]: nextScale },
    }));
  }

  function updateAssetScale(assetKey, scale) {
    if (!assetKey || !Number.isFinite(scale)) return;
    const bounds = layout.bounds ?? {};
    const nextScale = clamp(Number(scale.toFixed(3)), bounds.minScale ?? 0.35, bounds.maxScale ?? 3.5);
    setLayout((current) => ({
      ...current,
      scaleByAssetKey: { ...current.scaleByAssetKey, [assetKey]: nextScale },
    }));
  }

  function resetSelectedScale() {
    if (!selectedAsset) return;
    setLayout((current) => {
      const next = { ...current, scaleByAssetKey: { ...current.scaleByAssetKey } };
      delete next.scaleByAssetKey[selectedAsset.assetKey];
      return next;
    });
  }

  function beginObjectDrag(event, family) {
    if (event.button === 1) {
      beginPan(event);
      return;
    }
    if (tool !== 'move') return;
    event.preventDefault();
    event.stopPropagation();
    const point = localPoint(event);
    const pos = layout.positions[family.category];
    dragRef.current = { type: 'object', family, startPoint: positionToStagePoint(pos), start: point };
    setSelectedFamilyId(family.id);
  }

  function beginScale(event, family, asset) {
    event.preventDefault();
    event.stopPropagation();
    const point = localPoint(event);
    dragRef.current = {
      type: 'scale',
      family,
      asset,
      start: point,
      startScale: categoryScale(layout, family, asset),
    };
    setSelectedFamilyId(family.id);
    setSelectedAssetKey(asset.assetKey);
  }

  function beginPan(event) {
    if (event.button !== 1 && tool !== 'pan') return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { type: 'pan', startClient: { x: event.clientX, y: event.clientY }, startPan: pan };
  }

  function onPointerMove(event) {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.type === 'pan') {
      setPan({
        x: drag.startPan.x + event.clientX - drag.startClient.x,
        y: drag.startPan.y + event.clientY - drag.startClient.y,
      });
      return;
    }
    const point = localPoint(event);
    if (drag.type === 'object') {
      updatePositionFromStagePoint(drag.family.category, {
        x: drag.startPoint.x + point.x - drag.start.x,
        y: drag.startPoint.y + point.y - drag.start.y,
      });
    }
    if (drag.type === 'scale') {
      const delta = (point.x - drag.start.x + point.y - drag.start.y) / 260;
      updateAssetScale(drag.asset.assetKey, drag.startScale + delta);
    }
  }

  function endDrag() {
    dragRef.current = null;
  }

  function handleWheel(event) {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    const factor = direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    zoomAt(event.clientX, event.clientY, zoom * factor);
  }

  function handleKey(event) {
    if (!selectedFamily || !layout) return;
    const delta = event.shiftKey ? 0.25 : 0.05;
    const pos = layout.positions[selectedFamily.category];
    if (!pos) return;
    if (event.key === 'ArrowLeft') updatePosition(selectedFamily.category, pos.col - delta, pos.row);
    if (event.key === 'ArrowRight') updatePosition(selectedFamily.category, pos.col + delta, pos.row);
    if (event.key === 'ArrowUp') updatePosition(selectedFamily.category, pos.col, pos.row - delta);
    if (event.key === 'ArrowDown') updatePosition(selectedFamily.category, pos.col, pos.row + delta);
  }

  async function saveLayout() {
    setStatus('Saving layout');
    const response = await fetch('/api/layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(layout),
    });
    const data = await response.json();
    setValidation(data.validation ?? data);
    if (!response.ok) {
      setStatus('Save failed');
      return;
    }
    setLayout(data.layout);
    setStatus('Saved');
  }

  async function validateNow() {
    const response = await fetch('/api/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ catalog, layout }),
    });
    const data = await response.json();
    setValidation(data);
    setStatus(data.ok ? 'Validation passed' : 'Validation failed');
  }

  async function regenerate() {
    if (!selectedFamily || !selectedAsset || selectedFamily.virtual) return;
    setStatus('Regenerating art');
    const response = await fetch('/api/regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        familyId: selectedFamily.id,
        assetKey: selectedAsset.assetKey,
        scope,
        prompt,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error ?? 'Regeneration failed');
      return;
    }
    setCacheBust(String(data.cacheBust));
    setDiscoveredAssets(data.assets ?? discoveredAssets);
    setStatus('Regenerated');
  }

  async function applyPickedAsset(choice) {
    if (!selectedFamily || !choice) return;
    if (selectedFamily.virtual) return;
    if (assetPicker?.mode === 'replace' && !selectedAsset) return;
    const mode = assetPicker?.mode === 'variant' ? 'variant' : 'replace';
    setStatus(mode === 'variant' ? 'Adding variant' : 'Replacing slot art');
    const response = await fetch('/api/asset-slot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        familyId: selectedFamily.id,
        assetKey: selectedAsset?.assetKey,
        sourcePath: choice.path,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error ?? 'Asset selection failed');
      setValidation(data.validation ?? validation);
      return;
    }
    if (data.catalog) setCatalog(data.catalog);
    if (data.discoveredAssets) setDiscoveredAssets(data.discoveredAssets);
    if (data.cacheBust) setCacheBust(String(data.cacheBust));
    if (data.validation) setValidation(data.validation);
    if (data.newAsset) setSelectedAssetKey(data.newAsset.assetKey);
    setAssetPicker(null);
    setAssetSearch('');
    setStatus(mode === 'variant' ? 'Variant added' : 'Slot art replaced');
  }

  if (!catalog || !layout) {
    return <div className="boot">Loading world editor</div>;
  }

  return (
    <main className="app" tabIndex={0} onKeyDown={handleKey}>
      <aside className="left">
        <div className="brand">
          <div>
            <h1>World Editor</h1>
            <p>{status}</p>
          </div>
          <div className="actions">
            <a className="linkButton" href="/environments">Environments</a>
            <button onClick={load}>Reload</button>
          </div>
        </div>
        <div className="toolbar">
          <button className={tool === 'move' ? 'active' : ''} onClick={() => setTool('move')}>Move</button>
          <button className={tool === 'pan' ? 'active' : ''} onClick={() => setTool('pan')}>Pan</button>
          <button className={snap ? 'active' : ''} onClick={() => setSnap((value) => !value)}>Snap</button>
        </div>
        <section className="list">
          <h2>Structures</h2>
          {families.map((family) => {
            const asset = firstAsset(family);
            return (
              <button
                key={family.id}
                className={`row ${family.id === selectedFamily?.id ? 'selected' : ''}`}
                onClick={() => setSelectedFamilyId(family.id)}>
                <img src={asset ? imageUrl(asset.path, cacheBust) : ''} alt="" />
                <span>
                  <strong>{family.label}</strong>
                  <small>{family.category}</small>
                </span>
              </button>
            );
          })}
        </section>
        <section className="list compact">
          <h2>Potential Assets</h2>
          {potentialAssets.slice(0, 80).map((asset) => (
            <div className="assetRow" key={asset.path}>
              <img src={asset.url} alt="" />
              <span>{asset.folder}/{asset.fileName}</span>
            </div>
          ))}
        </section>
      </aside>

      <section className="workspace">
        <div className="topbar">
          <div>
            <strong>{selectedFamily?.label}</strong>
            <span>{selectedAsset?.assetKey}</span>
          </div>
          <div className="actions">
            <div className="zoomControls">
              <button onClick={() => zoomAtViewportCenter(zoom / ZOOM_STEP)}>-</button>
              <input
                aria-label="Zoom"
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step="0.05"
                value={zoom}
                onChange={(event) => zoomAtViewportCenter(Number(event.target.value))}
              />
              <button onClick={() => zoomAtViewportCenter(zoom * ZOOM_STEP)}>+</button>
              <button onClick={resetViewport}>{Math.round(zoom * 100)}%</button>
            </div>
            <button onClick={validateNow}>Validate</button>
            <button className="primary" onClick={saveLayout}>Save Layout</button>
          </div>
        </div>

        <div
          ref={stageRef}
          className={`stage ${tool}`}
          onPointerDown={beginPan}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onWheel={handleWheel}
          onAuxClick={(event) => event.preventDefault()}>
          <div className="stageInner" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
            <div className="patch" style={{ width: geometry.size, height: geometry.size }}>
              <img className="base" src={imageUrl(layout.base.path, cacheBust)} alt="" />
              <GridOverlay geometry={geometry} />
              {placedFamilies.map((family) => {
                const asset = assetForFamily(family, family.id === selectedFamily?.id ? selectedAssetKey : null);
                const pos = layout.positions[family.category];
                const point = positionToStagePoint(pos);
                const scale = categoryScale(layout, family, asset);
                const size = TILE_W * geometry.scale * scale;
                const left = point.x - size / 2;
                const top = point.y + OBJECT_SEAT * geometry.scale - size * OBJECT_BOTTOM_FRAC + SPRITE_DROP * geometry.scale;
                return (
                  <div
                    key={family.id}
                    className={`object ${family.id === selectedFamily?.id ? 'selected' : ''}`}
                    style={{ left, top, width: size, height: size, zIndex: 1000 + isoDepth(point) }}
                    onPointerDown={(event) => beginObjectDrag(event, family)}>
                    <img src={imageUrl(asset.path, cacheBust)} alt="" draggable="false" />
                    <button className="scaleHandle" onPointerDown={(event) => beginScale(event, family, asset)} />
                    <span className="coord">{pos.col.toFixed(2)}, {pos.row.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <aside className="right">
        <section className="panel">
          <h2>Properties</h2>
          <label>
            Category
            <input value={selectedFamily?.category ?? ''} readOnly />
          </label>
          <label>
            Asset
            <select value={selectedAsset?.assetKey ?? ''} onChange={(event) => setSelectedAssetKey(event.target.value)}>
              {selectedFamily?.assets?.map((asset) => (
                <option key={asset.assetKey} value={asset.assetKey}>{asset.label} - {asset.assetKey}</option>
              ))}
            </select>
          </label>
          <div className="coords">
            <label>
              Col
              <input
                type="number"
                step="0.01"
                value={layout.positions[selectedFamily?.category]?.col ?? 0}
                onChange={(event) => updatePosition(selectedFamily.category, Number(event.target.value), layout.positions[selectedFamily.category]?.row ?? 0)}
              />
            </label>
            <label>
              Row
              <input
                type="number"
                step="0.01"
                value={layout.positions[selectedFamily?.category]?.row ?? 0}
                onChange={(event) => updatePosition(selectedFamily.category, layout.positions[selectedFamily.category]?.col ?? 0, Number(event.target.value))}
              />
            </label>
          </div>
          <div className="coords">
            <label>
              NX
              <input
                type="number"
                step="0.001"
                value={layout.positions[selectedFamily?.category]?.nx ?? 0}
                onChange={(event) => {
                  const pos = layout.positions[selectedFamily.category];
                  updatePositionFromStagePoint(selectedFamily.category, {
                    x: Number(event.target.value) * geometry.size,
                    y: (pos?.ny ?? 0) * geometry.size,
                  });
                }}
              />
            </label>
            <label>
              NY
              <input
                type="number"
                step="0.001"
                value={layout.positions[selectedFamily?.category]?.ny ?? 0}
                onChange={(event) => {
                  const pos = layout.positions[selectedFamily.category];
                  updatePositionFromStagePoint(selectedFamily.category, {
                    x: (pos?.nx ?? 0) * geometry.size,
                    y: Number(event.target.value) * geometry.size,
                  });
                }}
              />
            </label>
          </div>
          <label>
            Category scale
            <input
              type="number"
              step="0.01"
              value={layout.scaleByCategory[selectedFamily?.category] ?? 1}
              onChange={(event) => updateCategoryScale(selectedFamily.category, Number(event.target.value))}
            />
          </label>
          <label>
            Asset scale override
            <input
              type="number"
              step="0.01"
              value={selectedAsset ? layout.scaleByAssetKey[selectedAsset.assetKey] ?? '' : ''}
              placeholder="none"
              onChange={(event) => updateAssetScale(selectedAsset?.assetKey, Number(event.target.value || 1))}
            />
          </label>
          <button onClick={resetSelectedScale}>Clear Asset Scale</button>
          {selectedAsset ? (
            <div className="currentAsset">
              <img src={imageUrl(selectedAsset.path, cacheBust)} alt="" />
              <div>
                <strong>{selectedAsset.label}</strong>
                <small>{selectedAsset.path}</small>
                <small>{selectedAssetWired ? 'Wired to app asset key' : 'Design-only unless wired in world-visuals'}</small>
              </div>
            </div>
          ) : null}
          <div className="buttonGrid">
            <button onClick={() => setAssetPicker({ mode: 'replace' })} disabled={!selectedAsset || selectedFamily?.virtual}>Choose Slot Art</button>
            <button onClick={() => setAssetPicker({ mode: 'variant' })} disabled={selectedFamily?.virtual}>Add Variant</button>
          </div>
        </section>

        <section className="panel">
          <h2>States</h2>
          <div className="thumbs">
            {selectedFamily?.assets?.map((asset) => (
              <button
                key={asset.assetKey}
                className={asset.assetKey === selectedAsset?.assetKey ? 'active' : ''}
                onClick={() => setSelectedAssetKey(asset.assetKey)}>
                <img src={imageUrl(asset.path, cacheBust)} alt="" />
                <span>{asset.state ?? asset.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Regenerate</h2>
          <label>
            Scope
            <select value={scope} onChange={(event) => setScope(event.target.value)}>
              <option value="selected">Selected asset</option>
              <option value="family">Whole family</option>
            </select>
          </label>
          <label>
            Prompt
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={8} />
          </label>
          <button className="primary" onClick={regenerate} disabled={selectedFamily?.virtual}>Run Pipeline</button>
        </section>

        <section className="panel validation">
          <h2>Validation</h2>
          <p className={validation?.ok ? 'ok' : 'bad'}>{validation?.ok ? 'OK' : 'Needs attention'}</p>
          {(validation?.errors ?? []).map((item) => <p className="bad" key={item}>{item}</p>)}
          {(validation?.warnings ?? []).slice(0, 6).map((item) => <p className="warn" key={item}>{item}</p>)}
        </section>
      </aside>

      {assetPicker ? (
        <div className="modalBackdrop" role="presentation" onMouseDown={() => setAssetPicker(null)}>
          <div className="assetModal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modalHead">
              <div>
                <h2>{assetPicker.mode === 'variant' ? 'Add Variant' : 'Choose Slot Art'}</h2>
                <p>
                  {assetPicker.mode === 'variant'
                    ? `Add a selectable design variant to ${selectedFamily?.label}.`
                    : `Copy selected art into ${selectedAsset?.assetKey}, preserving the app asset key.`}
                </p>
              </div>
              <button onClick={() => setAssetPicker(null)}>Close</button>
            </div>
            <input
              className="assetSearch"
              value={assetSearch}
              onChange={(event) => setAssetSearch(event.target.value)}
              placeholder="Search folder, filename, path, or asset key"
              autoFocus
            />
            <div className="assetGrid">
              {assetChoices.map((choice) => {
                const isCurrent = choice.path === selectedAsset?.path;
                return (
                  <button
                    key={choice.path}
                    className={`assetChoice ${isCurrent ? 'current' : ''}`}
                    onClick={() => applyPickedAsset(choice)}>
                    <img src={`${choice.url}${cacheBust ? `?v=${cacheBust}` : ''}`} alt="" />
                    <span>
                      <strong>{choice.fileName}</strong>
                      <small>{choice.folder}</small>
                      <small>{choice.wired ? choice.assetKeys.join(', ') : 'potential asset'}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function GridOverlay({ geometry }) {
  const points = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const p = cellCenter(col, row);
      points.push({
        id: `${col}-${row}`,
        x: geometry.centre.x + (p.x - geometry.origin.x) * geometry.scale,
        y: geometry.centre.y + (p.y - geometry.origin.y) * geometry.scale,
      });
    }
  }
  return (
    <div className="gridOverlay">
      {points.map((point) => (
        <span key={point.id} style={{ left: point.x, top: point.y }} />
      ))}
    </div>
  );
}

function revealRectForStation(station) {
  const mask = station?.revealMask;
  if (mask?.type === 'rect' && mask.rect) return mask.rect;
  if (mask?.type === 'polygon' && mask.bounds) return mask.bounds;
  const padding = mask?.type === 'rect' ? Number(mask.padding ?? 0) : 0;
  return {
    x: station.hitbox.x - padding,
    y: station.hitbox.y - padding,
    w: station.hitbox.w + padding * 2,
    h: station.hitbox.h + padding * 2,
  };
}

function rectToPoints(rect) {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x + rect.w, y: rect.y + rect.h },
    { x: rect.x, y: rect.y + rect.h },
  ];
}

function rectToPointsForResolution(rect, resolution) {
  const corners = rectToPoints(rect);
  if (resolution <= 1) return corners;
  const next = [];
  corners.forEach((point, index) => {
    const after = corners[(index + 1) % corners.length];
    next.push(point);
    next.push({
      x: Math.round((point.x + after.x) / 2),
      y: Math.round((point.y + after.y) / 2),
    });
  });
  return next;
}

function boundsForPoints(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    w: Math.max(...xs) - x,
    h: Math.max(...ys) - y,
  };
}

function clipPathForPoints(points, bounds) {
  if (!points?.length || !bounds?.w || !bounds?.h) return undefined;
  return `polygon(${points.map((point) => `${((point.x - bounds.x) / bounds.w) * 100}% ${((point.y - bounds.y) / bounds.h) * 100}%`).join(', ')})`;
}

function pointsEqual(a = [], b = []) {
  return a.length === b.length && a.every((point, index) => point.x === b[index]?.x && point.y === b[index]?.y);
}

function polygonResolutionForPoints(points = []) {
  return points.length >= 8 ? 2 : 1;
}

function savedMaskForStation(station) {
  if (station?.revealMask?.type === 'polygon' && station.revealMask.points?.length >= 3) {
    return { type: 'polygon', points: station.revealMask.points, bounds: station.revealMask.bounds ?? boundsForPoints(station.revealMask.points) };
  }
  const rect = revealRectForStation(station);
  return { type: 'rect', rect, bounds: rect };
}

function stationDepthZIndex(station, rect) {
  return Math.round((rect.y + rect.h) / 8) + (station?.zIndex ?? 20);
}

function EnvironmentDesigner() {
  const [environments, setEnvironments] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [selectedStationId, setSelectedStationId] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [rect, setRect] = useState(null);
  const [maskMode, setMaskMode] = useState('rect');
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [polygonResolution, setPolygonResolution] = useState(1);
  const [basePrompt, setBasePrompt] = useState('');
  const [stationPrompt, setStationPrompt] = useState('');
  const [revealObjectUrlInput, setRevealObjectUrlInput] = useState('');
  const [zoom, setZoom] = useState(0.58);
  const [pan, setPan] = useState({ x: 30, y: 28 });
  const [cacheBust, setCacheBust] = useState('');
  const [status, setStatus] = useState('Loading environments');
  const [progress, setProgress] = useState(null);
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const progressTimerRef = useRef(null);

  useEffect(() => {
    loadEnvironmentList();
  }, []);

  useEffect(() => {
    if (selectedId) loadEnvironment(selectedId);
  }, [selectedId]);

  useEffect(() => () => clearProgressTimer(), []);

  const selectedStation = detail?.layout?.stations?.find((station) => station.id === selectedStationId) ?? detail?.layout?.stations?.[0] ?? null;
  const selectedAssetKey = selectedStation?.art?.levels?.[selectedLevel - 1] ?? selectedStation?.art?.levels?.[0] ?? null;
  const selectedStatus = selectedStation ? detail?.assets?.stations?.find((item) => item.id === selectedStation.id) : null;
  const selectedLevelStatus = selectedStatus?.levels?.find((item) => item.key === selectedAssetKey) ?? null;
  const selectedRevealObject = selectedStatus?.revealObject ?? null;
  const selectedRevealObjectUrl = selectedRevealObject?.url ? `${selectedRevealObject.url}?v=${cacheBust}` : null;
  const selectedStationArtPrompt = selectedStation ? propPromptFor(detail, selectedStation.id) : '';
  const effectiveBasePrompt = basePrompt.trim() || detail?.art?.basePrompt || detail?.environment?.artPrompt || '';
  const effectiveStationPrompt = stationPrompt.trim() || selectedStationArtPrompt || '';
  const revealMode = detail?.layout?.plate?.revealMode === 'fullSceneMasks';
  const overlayAsset = revealMode ? null : selectedLevelStatus?.candidate ?? selectedLevelStatus?.final ?? null;
  const savedMask = selectedStation ? savedMaskForStation(selectedStation) : null;
  const selectedRenderMode = revealMode && selectedStation?.revealRenderMode === 'object' && selectedRevealObject ? 'object' : 'mask';
  const selectedComparisonRect = selectedStation ? (revealMode ? savedMask.bounds : selectedStation.hitbox) : null;
  const maskDirty = revealMode && selectedRenderMode === 'mask' && !!selectedStation && !!rect && (
    maskMode !== savedMask.type ||
    (maskMode === 'polygon'
      ? !pointsEqual(polygonPoints, savedMask.points ?? [])
      : rect.x !== selectedComparisonRect.x || rect.y !== selectedComparisonRect.y || rect.w !== selectedComparisonRect.w || rect.h !== selectedComparisonRect.h)
  );
  const objectPlacementDirty = revealMode && selectedRenderMode === 'object' && !!selectedStation && !!rect && (
    rect.x !== selectedComparisonRect.x ||
    rect.y !== selectedComparisonRect.y ||
    rect.w !== selectedComparisonRect.w ||
    rect.h !== selectedComparisonRect.h
  );
  const placementDirty = !revealMode && !!rect && !!selectedStation && (
    rect.x !== selectedComparisonRect.x ||
    rect.y !== selectedComparisonRect.y ||
    rect.w !== selectedComparisonRect.w ||
    rect.h !== selectedComparisonRect.h
  );

  useEffect(() => {
    if (!detail) return;
    setBasePrompt(detail.art?.basePrompt || detail.environment?.artPrompt || '');
    const firstStation = detail.layout?.stations?.[0] ?? null;
    setSelectedStationId((current) => detail.layout?.stations?.some((station) => station.id === current) ? current : firstStation?.id ?? null);
  }, [detail?.environment?.id, detail?.art?.basePrompt, detail?.environment?.artPrompt]);

  useEffect(() => {
    if (!selectedStation) return;
    const mask = savedMaskForStation(selectedStation);
    const nextRect = revealMode ? mask.bounds : selectedStation.hitbox;
    setRect({ ...nextRect });
    setMaskMode(revealMode ? mask.type : 'rect');
    setPolygonPoints(mask.type === 'polygon' ? mask.points.map((point) => ({ ...point })) : rectToPoints(nextRect));
    setPolygonResolution(mask.type === 'polygon' ? polygonResolutionForPoints(mask.points) : 1);
    setStationPrompt(selectedStationArtPrompt);
    setRevealObjectUrlInput('');
  }, [revealMode, selectedStation?.id, selectedStationArtPrompt]);

  async function loadEnvironmentList() {
    const response = await fetch('/api/environments');
    const data = await response.json();
    setEnvironments(data.environments ?? []);
    setSelectedId((current) => current ?? data.environments?.[0]?.id ?? null);
    setStatus('Ready');
  }

  async function loadEnvironment(id) {
    const response = await fetch(`/api/environments/${id}`);
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error ?? 'Could not load environment');
      return;
    }
    setDetail(data);
    setCacheBust(String(Date.now()));
    setStatus('Ready');
  }

  function stagePoint(event) {
    const box = stageRef.current.getBoundingClientRect();
    const width = detail?.layout?.plate?.width ?? 1;
    const height = detail?.layout?.plate?.height ?? 1;
    return {
      x: clamp((event.clientX - box.left - pan.x) / zoom, 0, width),
      y: clamp((event.clientY - box.top - pan.y) / zoom, 0, height),
    };
  }

  function constrainRect(nextRect) {
    const width = detail?.layout?.plate?.width ?? 1;
    const height = detail?.layout?.plate?.height ?? 1;
    const w = clamp(Math.round(nextRect.w), 8, width);
    const h = clamp(Math.round(nextRect.h), 8, height);
    return {
      x: clamp(Math.round(nextRect.x), 0, Math.max(0, width - w)),
      y: clamp(Math.round(nextRect.y), 0, Math.max(0, height - h)),
      w,
      h,
    };
  }

  function beginStageDrag(event) {
    if (!detail) return;
    event.preventDefault();
    dragRef.current = { type: 'pan', startClient: { x: event.clientX, y: event.clientY }, startPan: pan };
  }

  function beginObjectDrag(event, mode, handle = 'se') {
    if (!detail || !rect) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      type: mode === 'scale' ? 'object-scale' : 'object-move',
      handle,
      start: stagePoint(event),
      startRect: { ...rect },
      startPoints: polygonPoints.map((point) => ({ ...point })),
    };
  }

  function beginPolygonPointDrag(event, index) {
    if (!detail || !rect) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      type: 'polygon-point',
      index,
      start: stagePoint(event),
      startPoints: polygonPoints.map((point) => ({ ...point })),
    };
  }

  function applyRectTransformToPoints(startPoints, startRect, nextRect) {
    if (!startPoints?.length || !startRect?.w || !startRect?.h) return rectToPoints(nextRect);
    return startPoints.map((point) => ({
      x: Math.round(nextRect.x + ((point.x - startRect.x) / startRect.w) * nextRect.w),
      y: Math.round(nextRect.y + ((point.y - startRect.y) / startRect.h) * nextRect.h),
    }));
  }

  function moveStageDrag(event) {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.type === 'pan') {
      setPan({
        x: drag.startPan.x + event.clientX - drag.startClient.x,
        y: drag.startPan.y + event.clientY - drag.startClient.y,
      });
      return;
    }
    if (drag.type === 'object-move') {
      const point = stagePoint(event);
      const nextRect = constrainRect({
        ...drag.startRect,
        x: drag.startRect.x + point.x - drag.start.x,
        y: drag.startRect.y + point.y - drag.start.y,
      });
      setRect(nextRect);
      if (revealMode && selectedRenderMode === 'mask' && maskMode === 'polygon') {
        setPolygonPoints(applyRectTransformToPoints(drag.startPoints, drag.startRect, nextRect));
      }
      return;
    }
    if (drag.type === 'object-scale') {
      const point = stagePoint(event);
      const dx = point.x - drag.start.x;
      const dy = point.y - drag.start.y;
      const next = { ...drag.startRect };
      if (drag.handle.includes('e')) next.w = drag.startRect.w + dx;
      if (drag.handle.includes('s')) next.h = drag.startRect.h + dy;
      if (drag.handle.includes('w')) {
        next.x = drag.startRect.x + dx;
        next.w = drag.startRect.w - dx;
      }
      if (drag.handle.includes('n')) {
        next.y = drag.startRect.y + dy;
        next.h = drag.startRect.h - dy;
      }
      const nextRect = constrainRect(next);
      setRect(nextRect);
      if (revealMode && selectedRenderMode === 'mask' && maskMode === 'polygon') {
        setPolygonPoints(applyRectTransformToPoints(drag.startPoints, drag.startRect, nextRect));
      }
      return;
    }
    if (drag.type === 'polygon-point') {
      const point = stagePoint(event);
      const width = detail?.layout?.plate?.width ?? 1;
      const height = detail?.layout?.plate?.height ?? 1;
      const nextPoints = drag.startPoints.map((item, index) => index === drag.index
        ? { x: clamp(Math.round(item.x + point.x - drag.start.x), 0, width), y: clamp(Math.round(item.y + point.y - drag.start.y), 0, height) }
        : item
      );
      setPolygonPoints(nextPoints);
      setRect(constrainRect(boundsForPoints(nextPoints)));
      return;
    }
  }

  function endStageDrag() {
    dragRef.current = null;
  }

  function moveObjectDrag(event) {
    if (!dragRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    moveStageDrag(event);
  }

  function endObjectDrag(event) {
    if (!dragRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    endStageDrag();
  }

  const zoomEnvironment = useCallback((event) => {
    event.preventDefault();
    if (!stageRef.current) return;
    const next = clamp(zoom * (event.deltaY > 0 ? 0.9 : 1.1), 0.18, 2.4);
    const box = stageRef.current.getBoundingClientRect();
    const viewPoint = { x: event.clientX - box.left, y: event.clientY - box.top };
    const worldPoint = { x: (viewPoint.x - pan.x) / zoom, y: (viewPoint.y - pan.y) / zoom };
    setZoom(Number(next.toFixed(3)));
    setPan({
      x: Number((viewPoint.x - worldPoint.x * next).toFixed(1)),
      y: Number((viewPoint.y - worldPoint.y * next).toFixed(1)),
    });
  }, [pan.x, pan.y, zoom]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    stage.addEventListener('wheel', zoomEnvironment, { passive: false });
    return () => stage.removeEventListener('wheel', zoomEnvironment);
  }, [zoomEnvironment]);

  function clearProgressTimer() {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }

  function startProgress(label, steps) {
    clearProgressTimer();
    const safeSteps = steps?.length ? steps : [label];
    setProgress({ label, steps: safeSteps, index: 0, busy: true, error: null });
    progressTimerRef.current = setInterval(() => {
      setProgress((current) => {
        if (!current?.busy) return current;
        return { ...current, index: Math.min(current.index + 1, current.steps.length - 1) };
      });
    }, 4200);
  }

  function finishProgress(label) {
    clearProgressTimer();
    setProgress((current) => current ? { ...current, label, index: current.steps.length - 1, busy: false, error: null } : null);
    window.setTimeout(() => {
      setProgress((current) => (current && !current.busy ? null : current));
    }, 1800);
  }

  function failProgress(error) {
    clearProgressTimer();
    setProgress((current) => current ? { ...current, busy: false, error } : null);
  }

  async function callEnvironmentApi(pathSuffix, body, busyLabel, doneLabel, steps = null) {
    if (!detail) return null;
    setStatus(busyLabel);
    startProgress(busyLabel, steps);
    try {
      const response = await fetch(`/api/environments/${detail.environment.id}${pathSuffix}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      const data = await response.json();
      if (!response.ok) {
        setStatus(data.error ?? 'Request failed');
        failProgress(data.error ?? 'Request failed');
        return null;
      }
      setDetail(data);
      setCacheBust(String(data.cacheBust ?? Date.now()));
      const partialFailure = Array.isArray(data.failures) && data.failures.length > 0;
      const nextDoneLabel = partialFailure
        ? `${doneLabel}: ${data.extractedCount ?? 0} extracted, ${data.failedCount ?? data.failures.length} failed`
        : doneLabel;
      setStatus(nextDoneLabel);
      finishProgress(nextDoneLabel);
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Request failed';
      setStatus(message);
      failProgress(message);
      return null;
    }
  }

  async function savePrompts() {
    await callEnvironmentApi('/art', {
      basePrompt: effectiveBasePrompt,
      stationId: selectedStation?.id,
      stationPrompt: effectiveStationPrompt,
    }, 'Saving prompts', 'Prompts saved', ENV_PROGRESS.save);
  }

  async function generateBase() {
    await callEnvironmentApi('/base', { prompt: effectiveBasePrompt, model: 'gpt' }, 'Generating base environment', 'Base generated', ENV_PROGRESS.base);
  }

  async function bakeScene() {
    await callEnvironmentApi('/bake-scene', { prompt: effectiveBasePrompt, model: 'gpt' }, 'Baking full environment scene', 'Baked scene generated', ENV_PROGRESS.bake);
  }

  async function generateDirectScenePipeline() {
    await callEnvironmentApi('/direct-scene-pipeline', { prompt: effectiveBasePrompt, model: 'gpt' }, 'Generating direct scene pipeline', 'Direct scene and base generated', ENV_PROGRESS.directPipeline);
  }

  async function saveRevealMask() {
    if (!selectedStation || !rect) return;
    await callEnvironmentApi(`/stations/${selectedStation.id}/reveal-mask`, {
      mask: maskMode === 'polygon'
        ? { type: 'polygon', points: polygonPoints }
        : { type: 'rect', rect },
    }, 'Saving reveal mask', 'Reveal mask saved', ENV_PROGRESS.mask);
  }

  async function switchRevealRenderMode(nextMode) {
    if (!selectedStation || !rect || nextMode === selectedRenderMode) return;
    await callEnvironmentApi(`/stations/${selectedStation.id}/reveal-render-mode`, {
      mode: nextMode,
      ...(nextMode === 'object'
        ? { rect }
        : {
            mask: maskMode === 'polygon'
              ? { type: 'polygon', points: polygonPoints }
              : { type: 'rect', rect },
          }),
    }, nextMode === 'object' ? 'Switching to extracted object' : 'Switching to mask reveal', 'Reveal mode updated', ENV_PROGRESS.mask);
  }

  async function saveExtractedObjectPlacement() {
    if (!selectedStation || !rect) return;
    await callEnvironmentApi(`/stations/${selectedStation.id}/reveal-render-mode`, {
      mode: 'object',
      rect,
    }, 'Saving extracted object placement', 'Extracted placement saved', ENV_PROGRESS.mask);
  }

  async function extractRevealObject() {
    if (!selectedStation || !rect) return;
    await callEnvironmentApi(`/stations/${selectedStation.id}/extract-reveal-object`, {
      mask: maskMode === 'polygon'
        ? { type: 'polygon', points: polygonPoints }
        : { type: 'rect', rect },
      model: 'gpt',
    }, 'Extracting isolated object', 'Extracted object ready', ENV_PROGRESS.extractObject);
  }

  async function linkRevealObjectUrl() {
    if (!selectedStation || !rect || !revealObjectUrlInput.trim()) return;
    await callEnvironmentApi(`/stations/${selectedStation.id}/link-reveal-object-url`, {
      url: revealObjectUrlInput.trim(),
      mask: maskMode === 'polygon'
        ? { type: 'polygon', points: polygonPoints }
        : { type: 'rect', rect },
    }, 'Linking extracted object URL', 'Linked extracted object ready', ENV_PROGRESS.linkObject);
    setRevealObjectUrlInput('');
  }

  async function extractAllMissingRevealObjects() {
    await callEnvironmentApi('/extract-missing-reveal-objects', {
      model: 'gpt',
      concurrency: 2,
    }, 'Extracting all missing objects', 'Missing objects extracted', ENV_PROGRESS.extractAllObjects);
  }

  function switchMaskMode(nextMode) {
    if (!rect || nextMode === maskMode) return;
    if (nextMode === 'polygon') {
      setPolygonPoints(maskMode === 'rect' ? rectToPointsForResolution(rect, polygonResolution) : polygonPoints.length >= 3 ? polygonPoints : rectToPointsForResolution(rect, polygonResolution));
      setMaskMode('polygon');
      return;
    }
    const nextRect = polygonPoints.length >= 3 ? boundsForPoints(polygonPoints) : rect;
    setRect(constrainRect(nextRect));
    setMaskMode('rect');
  }

  function changePolygonResolution(nextResolution) {
    const value = Number(nextResolution);
    if (!rect || !Number.isFinite(value)) return;
    const next = clamp(Math.round(value), 1, 2);
    setPolygonResolution(next);
    setPolygonPoints(rectToPointsForResolution(boundsForPoints(polygonPoints.length >= 3 ? polygonPoints : rectToPoints(rect)), next));
  }

  async function fitObject() {
    if (!selectedStation || !rect || !overlayAsset) return;
    await savePrompts();
    await callEnvironmentApi(`/stations/${selectedStation.id}/fit`, {
      level: selectedLevel,
      rect,
      model: 'gpt',
    }, 'Fitting object into environment', 'Fitted candidate generated', ENV_PROGRESS.fit);
  }

  async function applyFittedObject() {
    if (!selectedStation || !selectedLevelStatus?.candidate) return;
    await callEnvironmentApi(`/stations/${selectedStation.id}/apply-fit`, {
      level: selectedLevel,
    }, 'Applying fitted prop', 'Fitted prop applied', ENV_PROGRESS.apply);
  }

  const displayBaseAsset = revealMode ? detail?.assets?.extractedBase ?? detail?.assets?.base : detail?.assets?.base;
  const baseUrl = displayBaseAsset?.url ? `${displayBaseAsset.url}?v=${cacheBust}` : null;
  const originalBaseUrl = detail?.assets?.base?.url ? `${detail.assets.base.url}?v=${cacheBust}` : null;
  const fullSceneUrl = detail?.assets?.directScene?.url ? `${detail.assets.directScene.url}?v=${cacheBust}` : null;
  const styleUrl = detail?.assets?.styleReference?.url ? `${detail.assets.styleReference.url}?v=${cacheBust}` : null;
  const overlayUrl = overlayAsset?.url ? `${overlayAsset.url}?v=${cacheBust}` : null;
  const plate = detail?.layout?.plate ?? { width: 1536, height: 1536 };
  const canRegenerateObject = placementDirty && !!baseUrl && !!selectedStation && !!selectedAssetKey && !!rect && !!overlayAsset;
  const canSaveRevealMask = revealMode && maskDirty && !!selectedStation && !!rect;
  const canSaveExtractedObjectPlacement = revealMode && objectPlacementDirty && !!selectedStation && !!rect && !!selectedRevealObject;
  const canExtractRevealObject = revealMode && !!selectedStation && !!rect && !!fullSceneUrl;
  const canLinkRevealObjectUrl = revealMode && !!selectedStation && !!rect && /^https?:\/\//i.test(revealObjectUrlInput.trim());
  const objectCount = detail?.layout?.stations?.length ?? 0;
  const missingRevealObjectCount = revealMode
    ? (detail?.layout?.stations ?? []).filter((station) => {
        const stationStatus = detail?.assets?.stations?.find((item) => item.id === station.id);
        return !!station.revealMask && !stationStatus?.revealObject;
      }).length
    : 0;
  const canBakeScene = !!originalBaseUrl && objectCount > 0 && !!effectiveBasePrompt;
  const canRunDirectPipeline = !!styleUrl && objectCount > 0 && !!effectiveBasePrompt;
  const canExtractAllMissing = revealMode && !!fullSceneUrl && missingRevealObjectCount > 0;
  const busy = !!progress?.busy;

  return (
    <main className="app envApp">
      <aside className="left">
        <div className="brand">
          <div>
            <h1>Environment Designer</h1>
            <p>{status}</p>
          </div>
          <a className="linkButton" href="/">World</a>
        </div>
        <section className="list">
          <h2>Katchimeras</h2>
          {environments.map((environment) => (
            <button
              key={environment.id}
              className={`row ${environment.id === selectedId ? 'selected' : ''}`}
              onClick={() => setSelectedId(environment.id)}>
              <span className="envAvatar">{environment.ownerVisualKeys?.[0]?.slice(0, 2).toUpperCase() ?? 'EN'}</span>
              <span>
                <strong>{environment.title}</strong>
                <small>{environment.generatedPropCount}/{environment.totalPropCount} props / {environment.domain}</small>
              </span>
            </button>
          ))}
        </section>
        <section className="panel envPanel">
          <h2>Style Ingredient</h2>
          {styleUrl ? <img className="styleIngredient" src={styleUrl} alt="" /> : <div className="emptyIngredient">No style reference</div>}
          <p className="hintText">Sent as the art-style reference for first base generation.</p>
        </section>
      </aside>

      <section className="workspace">
        <div className="topbar">
          <div>
            <strong>{detail?.environment?.title ?? 'Environment'}</strong>
            <span>{selectedStation?.label ?? 'Select a station'} / {selectedAssetKey ?? 'no asset'}</span>
          </div>
          <div className="actions">
            <button onClick={() => { setZoom(0.58); setPan({ x: 30, y: 28 }); }}>Reset</button>
          </div>
        </div>
        {progress ? <ProgressPanel progress={progress} /> : null}

        <div
          ref={stageRef}
          className="stage envStage"
          onPointerDown={beginStageDrag}
          onPointerMove={moveStageDrag}
          onPointerUp={endStageDrag}
          onPointerCancel={endStageDrag}
          onAuxClick={(event) => event.preventDefault()}>
          <div className="envStageInner" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
            <div className="envPlate" style={{ width: plate.width, height: plate.height }}>
              {baseUrl ? <img className="envBase" src={baseUrl} alt="" draggable="false" /> : <div className="missingBase">Generate the base environment first</div>}
              {revealMode && fullSceneUrl ? [...(detail?.layout?.stations ?? [])].sort((a, b) => {
                const aRect = revealRectForStation(a);
                const bRect = revealRectForStation(b);
                const bottomDelta = aRect.y + aRect.h - (bRect.y + bRect.h);
                return bottomDelta === 0 ? (a.zIndex ?? 0) - (b.zIndex ?? 0) : bottomDelta;
              }).map((station) => {
                const isSelected = station.id === selectedStation?.id;
                const maskType = isSelected ? maskMode : savedMaskForStation(station).type;
                const mask = isSelected && rect ? rect : revealRectForStation(station);
                const points = isSelected ? polygonPoints : station.revealMask?.points;
                const clipPath = maskType === 'polygon' ? clipPathForPoints(points, mask) : undefined;
                const stationStatus = detail?.assets?.stations?.find((item) => item.id === station.id);
                const revealObjectUrl = stationStatus?.revealObject?.url ? `${stationStatus.revealObject.url}?v=${cacheBust}` : null;
                const stationRenderMode = station.revealRenderMode === 'object' && revealObjectUrl ? 'object' : 'mask';
                const showExtractedObject = stationRenderMode === 'object' && !(isSelected && selectedRenderMode === 'object');
                if (showExtractedObject) {
                  return (
                    <div
                      key={`reveal-object-${station.id}`}
                      className="envExtractedObject"
                      style={{
                        left: mask.x,
                        top: mask.y,
                        width: mask.w,
                        height: mask.h,
                        zIndex: stationDepthZIndex(station, mask),
                      }}>
                      <img src={revealObjectUrl} alt="" draggable="false" />
                    </div>
                  );
                }
                if (stationRenderMode === 'object') return null;
                return (
                  <div
                    key={`reveal-${station.id}`}
                    className="envRevealLayer"
                    style={{
                      clipPath,
                      left: mask.x,
                      top: mask.y,
                      width: mask.w,
                      height: mask.h,
                      zIndex: stationDepthZIndex(station, mask),
                    }}>
                    <img
                      src={fullSceneUrl}
                      alt=""
                      draggable="false"
                      style={{
                        left: -mask.x,
                        top: -mask.y,
                        width: plate.width,
                        height: plate.height,
                      }}
                    />
                  </div>
                );
              }) : null}
              {(detail?.layout?.stations ?? []).map((station) => (
                <StationBoxButton
                  key={station.id}
                  revealMode={revealMode}
                  selected={station.id === selectedStation?.id}
                  station={station}
                  onSelect={() => {
                    setSelectedStationId(station.id);
                    setRect({ ...(revealMode ? revealRectForStation(station) : station.hitbox) });
                  }}
                />
              ))}
              {rect && !revealMode ? (
                <div className="envDrawRect" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}>
                  <span>{selectedStation?.shortLabel ?? selectedStation?.label ?? 'Selected'}</span>
                </div>
              ) : null}
              {revealMode && rect && selectedRenderMode === 'mask' ? (
                <div
                  className={`envMaskOverlay interactive ${maskMode === 'polygon' ? 'polygon' : ''}`}
                  style={{
                    left: rect.x,
                    top: rect.y,
                    width: rect.w,
                    height: rect.h,
                    zIndex: selectedStation ? stationDepthZIndex(selectedStation, rect) + 700 : 700,
                  }}
                  onPointerDown={(event) => beginObjectDrag(event, 'move')}
                  onPointerMove={moveObjectDrag}
                  onPointerUp={endObjectDrag}
                  onPointerCancel={endObjectDrag}>
                  <span>{selectedStation?.shortLabel ?? selectedStation?.label ?? 'Mask'}</span>
                  {['nw', 'ne', 'sw', 'se'].map((handle) => (
                    <button
                      key={handle}
                      className={`envResizeHandle ${handle}`}
                      aria-label={`Resize ${handle}`}
                      onPointerDown={(event) => beginObjectDrag(event, 'scale', handle)}
                    />
                  ))}
                </div>
              ) : null}
              {revealMode && selectedRenderMode === 'mask' && maskMode === 'polygon' && polygonPoints.length >= 3 ? (
                <svg
                  className="envPolygonOutline"
                  style={{ zIndex: selectedStation && rect ? stationDepthZIndex(selectedStation, rect) + 715 : 715 }}
                  viewBox={`0 0 ${plate.width} ${plate.height}`}>
                  <polygon points={polygonPoints.map((point) => `${point.x},${point.y}`).join(' ')} />
                </svg>
              ) : null}
              {revealMode && selectedRenderMode === 'mask' && maskMode === 'polygon' ? polygonPoints.map((point, index) => (
                <button
                  key={`point-${index}`}
                  className="envMaskPoint"
                  aria-label={`Move mask point ${index + 1}`}
                  style={{ left: point.x, top: point.y, zIndex: selectedStation && rect ? stationDepthZIndex(selectedStation, rect) + 720 : 720 }}
                  onPointerDown={(event) => beginPolygonPointDrag(event, index)}
                  onPointerMove={moveObjectDrag}
                  onPointerUp={endObjectDrag}
                  onPointerCancel={endObjectDrag}
                />
              )) : null}
              {revealMode && selectedRenderMode === 'object' && selectedRevealObjectUrl && rect ? (
                <div
                  className="envPropOverlay envExtractedEditorOverlay interactive"
                  style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, zIndex: selectedStation ? stationDepthZIndex(selectedStation, rect) + 700 : 700 }}
                  onPointerDown={(event) => beginObjectDrag(event, 'move')}
                  onPointerMove={moveObjectDrag}
                  onPointerUp={endObjectDrag}
                  onPointerCancel={endObjectDrag}>
                  <img src={selectedRevealObjectUrl} alt="" draggable="false" />
                  {['nw', 'ne', 'sw', 'se'].map((handle) => (
                    <button
                      key={handle}
                      className={`envResizeHandle ${handle}`}
                      aria-label={`Resize ${handle}`}
                      onPointerDown={(event) => beginObjectDrag(event, 'scale', handle)}
                    />
                  ))}
                </div>
              ) : null}
              {overlayUrl && rect ? (
                <div
                  className="envPropOverlay interactive"
                  style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, zIndex: (selectedStation?.zIndex ?? 70) + 70 }}
                  onPointerDown={(event) => beginObjectDrag(event, 'move')}
                  onPointerMove={moveObjectDrag}
                  onPointerUp={endObjectDrag}
                  onPointerCancel={endObjectDrag}>
                  <img src={overlayUrl} alt="" draggable="false" />
                  {['nw', 'ne', 'sw', 'se'].map((handle) => (
                    <button
                      key={handle}
                      className={`envResizeHandle ${handle}`}
                      aria-label={`Resize ${handle}`}
                      onPointerDown={(event) => beginObjectDrag(event, 'scale', handle)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <aside className="right">
        <section className="panel baseComposer">
          <h2>Base Scene</h2>
          <div className="referenceRow">
            {styleUrl ? <img src={styleUrl} alt="" /> : <span>No reference</span>}
            <div>
              <strong>Today background reference</strong>
              <small>This image is sent with the prompt for art style.</small>
            </div>
          </div>
          <label>
            Prompt
            <textarea
              value={basePrompt}
              onChange={(event) => setBasePrompt(event.target.value)}
              placeholder={detail?.art?.basePrompt || detail?.environment?.artPrompt || ''}
              rows={7}
            />
          </label>
          <button className="primary wideAction" disabled={busy || !effectiveBasePrompt} onClick={generateBase}>Generate Base from Prompt</button>
          <button className="wideAction" disabled={busy || !canBakeScene} onClick={bakeScene}>Bake Full Scene with Objects</button>
          <small className="hintText">
            Sends only the base image plus a text list of {objectCount} objects. Existing prop images are not used.
          </small>
          <PreviewImage title="Baked Scene" asset={detail?.assets?.bakedScene} cacheBust={cacheBust} large />
          <button className="wideAction" disabled={busy || !canRunDirectPipeline} onClick={generateDirectScenePipeline}>Generate Final, Then Extract Base</button>
          <small className="hintText">
            First creates a complete scene from the style reference and text list, then removes those objects into a clean base.
          </small>
          <div className="previewGrid">
            <PreviewImage title="Direct Scene" asset={detail?.assets?.directScene} cacheBust={cacheBust} />
            <PreviewImage title="Extracted Base" asset={detail?.assets?.extractedBase} cacheBust={cacheBust} />
          </div>
        </section>

        <section className="panel">
          <h2>Objects</h2>
          {revealMode ? (
            <button className="primary wideAction" disabled={!canExtractAllMissing || busy} onClick={extractAllMissingRevealObjects}>
              Extract All Missing{missingRevealObjectCount > 0 ? ` (${missingRevealObjectCount})` : ''}
            </button>
          ) : null}
          <div className="stationList">
            {(detail?.layout?.stations ?? []).map((station) => {
              const status = detail?.assets?.stations?.find((item) => item.id === station.id);
              const count = status?.levels?.filter((level) => !!level.final).length ?? 0;
              return (
                <button
                  key={station.id}
                  className={station.id === selectedStation?.id ? 'active' : ''}
                  onClick={() => setSelectedStationId(station.id)}>
                  <strong>{station.label}</strong>
                  <small>{count}/{station.art?.levels?.length ?? 0} generated / {station.kind}</small>
                </button>
              );
            })}
          </div>
        </section>

        {selectedStation ? (
          <section className="panel">
            <h2>Selected Object</h2>
            {revealMode ? (
              <div className="maskControls">
                <div className="segmentedControl" aria-label="Reveal render mode">
                  <button className={selectedRenderMode === 'mask' ? 'active' : ''} onClick={() => switchRevealRenderMode('mask')}>
                    Mask
                  </button>
                  <button
                    className={selectedRenderMode === 'object' ? 'active' : ''}
                    disabled={!selectedRevealObject || busy}
                    onClick={() => switchRevealRenderMode('object')}>
                    Extracted
                  </button>
                </div>
                {selectedRenderMode === 'mask' ? (
                  <div className="segmentedControl" aria-label="Mask shape">
                    <button className={maskMode === 'rect' ? 'active' : ''} onClick={() => switchMaskMode('rect')}>Box</button>
                    <button className={maskMode === 'polygon' ? 'active' : ''} onClick={() => switchMaskMode('polygon')}>Polygon</button>
                  </div>
                ) : null}
                {selectedRenderMode === 'mask' && maskMode === 'polygon' ? (
                  <label className="compactRange">
                    <span>Vertices</span>
                    <input
                      max="2"
                      min="1"
                      onChange={(event) => changePolygonResolution(event.target.value)}
                      step="1"
                      type="range"
                      value={polygonResolution}
                    />
                    <strong>{polygonResolution === 1 ? '4' : '8'}</strong>
                  </label>
                ) : null}
                {selectedRenderMode === 'object' ? (
                  <small className="hintText">Dragging now moves the extracted PNG. Corner handles scale the extracted object placement.</small>
                ) : null}
              </div>
            ) : null}
            <label>
              Level
              <select value={selectedLevel} onChange={(event) => setSelectedLevel(Number(event.target.value))}>
                {(selectedStation.art?.levels ?? []).map((key, index) => (
                  <option key={key} value={index + 1}>Level {index + 1} / {key}</option>
                ))}
              </select>
            </label>
            {canSaveRevealMask ? (
              <button className="primary wideAction" disabled={busy} onClick={saveRevealMask}>
                Save Reveal Mask
              </button>
            ) : null}
            {canSaveExtractedObjectPlacement ? (
              <button className="primary wideAction" disabled={busy} onClick={saveExtractedObjectPlacement}>
                Save Extracted Placement
              </button>
            ) : null}
            {revealMode ? (
              <button className="primary wideAction" disabled={!canExtractRevealObject || busy} onClick={extractRevealObject}>
                Extract Object
              </button>
            ) : null}
            {revealMode ? (
              <div className="urlLinkControl">
                <input
                  aria-label="Generated image URL"
                  onChange={(event) => setRevealObjectUrlInput(event.target.value)}
                  placeholder="Paste generated image URL"
                  type="url"
                  value={revealObjectUrlInput}
                />
                <button disabled={!canLinkRevealObjectUrl || busy} onClick={linkRevealObjectUrl}>
                  Link
                </button>
              </div>
            ) : null}
            {!revealMode && placementDirty ? (
              <button className="primary wideAction" disabled={!canRegenerateObject || busy} onClick={fitObject}>
                Regenerate in New Spot
              </button>
            ) : null}
            {!revealMode && selectedLevelStatus?.candidate ? (
              <button className="wideAction" disabled={busy} onClick={applyFittedObject}>Apply Fitted Prop</button>
            ) : null}
            <div className="previewGrid">
              {revealMode ? <PreviewImage title="Extracted" asset={selectedRevealObject} cacheBust={cacheBust} /> : null}
              <PreviewImage title="Candidate" asset={selectedLevelStatus?.candidate} cacheBust={cacheBust} />
              <PreviewImage title="Live" asset={selectedLevelStatus?.final} cacheBust={cacheBust} />
            </div>
          </section>
        ) : null}
      </aside>
    </main>
  );
}

function propPromptFor(detail, stationId) {
  return detail?.art?.props?.find((item) => item.stationId === stationId)?.prompt ?? '';
}

function PreviewImage({ title, asset, cacheBust, large = false }) {
  return (
    <div className={`envPreview ${large ? 'large' : ''}`}>
      <strong>{title}</strong>
      {asset?.url ? <img src={`${asset.url}?v=${cacheBust}`} alt="" /> : <span>No image yet</span>}
    </div>
  );
}

function StationBoxButton({ station, selected, revealMode, onSelect }) {
  const rect = revealMode ? revealRectForStation(station) : station.hitbox;
  return (
    <button
      className={`envBox ${selected ? 'selected' : ''}`}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        zIndex: stationDepthZIndex(station, rect) + 500,
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}>
      <span>{station.shortLabel ?? station.label}</span>
    </button>
  );
}

function ProgressPanel({ progress }) {
  const current = progress.steps[progress.index] ?? progress.label;
  const pct = Math.round(((progress.index + 1) / progress.steps.length) * 100);
  return (
    <div className={`progressPanel ${progress.error ? 'error' : ''}`}>
      <div className="progressHead">
        <span className={progress.busy ? 'spinner' : 'progressDone'} />
        <div>
          <strong>{progress.error ? 'Generation failed' : progress.label}</strong>
          <small>{progress.error ?? current}</small>
        </div>
      </div>
      <div className="progressTrack">
        <span style={{ width: `${pct}%` }} />
      </div>
      <ol>
        {progress.steps.map((step, index) => (
          <li key={step} className={index < progress.index ? 'done' : index === progress.index ? 'active' : ''}>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Root() {
  return window.location.pathname.startsWith('/environments') ? <EnvironmentDesigner /> : <App />;
}

createRoot(document.getElementById('root')).render(<Root />);
