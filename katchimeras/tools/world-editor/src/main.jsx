import { useEffect, useMemo, useRef, useState } from 'react';
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
          <button onClick={load}>Reload</button>
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

createRoot(document.getElementById('root')).render(<App />);
