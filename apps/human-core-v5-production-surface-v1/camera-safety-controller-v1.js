(function (global) {
  'use strict';

  const REGION_IDS = Object.freeze([
    'full-body', 'head-face', 'neck-shoulder', 'left-axilla', 'right-axilla', 'left-elbow', 'right-elbow',
    'left-hand', 'right-hand', 'pelvis-groin', 'left-knee', 'right-knee', 'left-ankle-foot', 'right-ankle-foot',
    'back-centerline', 'front-centerline',
  ]);
  const REGION_ALIASES = Object.freeze({
    '': 'full-body', axilla: 'left-axilla', elbow: 'left-elbow', hand: 'left-hand', knee: 'left-knee',
    'ankle-foot': 'left-ankle-foot', 'chest-waist': 'pelvis-groin',
  });

  class CameraSafetyControllerV1 {
    constructor(options) {
      this.THREE = options.THREE; this.camera = options.camera; this.renderer = options.renderer; this.viewport = options.viewport; this.controls = options.controls;
      this.getVisibleSurfaces = options.getVisibleSurfaces; this.getProductionPositions = options.getProductionPositions; this.getProductionMatrixWorld = options.getProductionMatrixWorld;
      this.updateWorldMatrices = options.updateWorldMatrices || (() => {}); this.updateCamera = options.updateCamera; this.renderScene = options.renderScene || (() => {});
      this.measureNonBackgroundPixels = options.measureNonBackgroundPixels || null; this.onMetrics = options.onMetrics || (() => {}); this.onNotice = options.onNotice || (() => {}); this.onRegion = options.onRegion || (() => {});
      this.region = normalizeRegion(options.initialRegion || 'full-body'); this.lockVisible = options.lockVisible !== false; this.cameraRecoveryCount = 0; this.lastValidCameraState = null;
      this.worldBoundingBox = null; this.worldBoundingSphere = null; this.regionData = null; this.allowedTargetBounds = null; this.pendingResizeReasons = new Set(); this.resizeFrame = 0; this.connected = false;
      this.metrics = defaultMetrics(this.region); this.refreshBounds(); this.applyDistanceLimits(); this.updateClipPlanes(); this.publishMetrics();
    }

    connectResizeSignals() {
      if (this.connected) return; this.connected = true;
      this.resizeObserver = new ResizeObserver(() => this.scheduleResize('resize-observer')); this.resizeObserver.observe(this.viewport);
      this.windowResizeListener = () => this.scheduleResize('window-resize'); global.addEventListener('resize', this.windowResizeListener);
      if (global.visualViewport) { this.visualViewportResizeListener = () => this.scheduleResize('visual-viewport-resize'); global.visualViewport.addEventListener('resize', this.visualViewportResizeListener); }
      this.fullscreenListener = () => this.scheduleResize('fullscreen-change'); document.addEventListener('fullscreenchange', this.fullscreenListener);
    }

    refreshBounds() {
      const THREE = this.THREE; this.updateWorldMatrices();
      const worldBox = new THREE.Box3(); worldBox.makeEmpty();
      for (const surface of this.getVisibleSurfaces()) {
        if (!surface.group.visible) continue;
        const geometry = surface.solid.geometry; if (!geometry.boundingBox) geometry.computeBoundingBox();
        for (const point of boxCorners(geometry.boundingBox.min.toArray(), geometry.boundingBox.max.toArray())) worldBox.expandByPoint(new THREE.Vector3(point[0], point[1], point[2]).applyMatrix4(surface.solid.matrixWorld));
      }
      if (worldBox.isEmpty()) throw new Error('CameraSafetyControllerV1 cannot find a visible human bounding box.');
      this.worldBoundingBox = worldBox; this.worldBoundingSphere = worldBox.getBoundingSphere(new THREE.Sphere());
      const bodySize = worldBox.getSize(new THREE.Vector3()); this.bodyHeight = bodySize.y; this.bodyRadius = this.worldBoundingSphere.radius;
      const targetExpansion = bodySize.multiplyScalar(0.2); this.allowedTargetBounds = worldBox.clone(); this.allowedTargetBounds.min.sub(targetExpansion); this.allowedTargetBounds.max.add(targetExpansion);
      this.regionData = this.buildRegionData(this.region); this.applyDistanceLimits(); return this.regionData;
    }

    buildRegionData(region) {
      const THREE = this.THREE;
      if (region === 'full-body') {
        const points = this.collectProductionWorldPoints(null); for (const corner of boxCorners(this.worldBoundingBox.min.toArray(), this.worldBoundingBox.max.toArray())) points.push(new THREE.Vector3(...corner));
        return regionDataFromBox(THREE, region, this.worldBoundingBox.clone(), points);
      }
      const positions = this.getProductionPositions(); const computed = computeRegionBoundsFromPositions(positions, region); const matrix = this.getProductionMatrixWorld();
      const worldBox = new THREE.Box3(); worldBox.makeEmpty(); const points = [];
      for (const index of computed.pointIndices) { const offset = index * 3; const point = new THREE.Vector3(positions[offset], positions[offset + 1], positions[offset + 2]).applyMatrix4(matrix); worldBox.expandByPoint(point); points.push(point); }
      if (worldBox.isEmpty()) for (const corner of boxCorners(computed.bounds.min, computed.bounds.max)) { const point = new THREE.Vector3(...corner).applyMatrix4(matrix); worldBox.expandByPoint(point); points.push(point); }
      return regionDataFromBox(THREE, region, worldBox, points);
    }

    collectProductionWorldPoints(indices) {
      const THREE = this.THREE; const positions = this.getProductionPositions(); const matrix = this.getProductionMatrixWorld(); const points = [];
      if (indices) for (const index of indices) { const offset = index * 3; points.push(new THREE.Vector3(positions[offset], positions[offset + 1], positions[offset + 2]).applyMatrix4(matrix)); }
      else for (let offset = 0; offset < positions.length; offset += 3) points.push(new THREE.Vector3(positions[offset], positions[offset + 1], positions[offset + 2]).applyMatrix4(matrix));
      return points;
    }

    applyDistanceLimits() {
      if (!this.regionData) return null;
      const limits = computeDistanceLimits({ min: this.regionData.box.min.toArray(), max: this.regionData.box.max.toArray() });
      this.minimumDistance = limits.minimumDistance; this.maximumDistance = limits.maximumDistance;
      const fit = computeFitDistanceForBounds({ min: this.regionData.box.min.toArray(), max: this.regionData.box.max.toArray() }, { yaw: this.controls.yaw, pitch: this.controls.pitch, aspect: this.camera.aspect, verticalFovDegrees: this.camera.fov, sideMargin: 0.05, verticalMargin: 0.07, boundingSphereRadius: this.regionData.sphere.radius });
      this.framingMinimumDistance = fit.distance; this.effectiveMinimumDistance = this.lockVisible && this.region === 'full-body' ? Math.max(this.minimumDistance, this.framingMinimumDistance) : this.minimumDistance;
      this.controls.minDistance = this.minimumDistance; this.controls.maxDistance = this.maximumDistance;
      this.regionData.localMinimumDistance = this.minimumDistance; this.regionData.localMaximumDistance = this.maximumDistance;
      return limits;
    }

    setLockVisible(value) { this.lockVisible = Boolean(value); this.applyDistanceLimits(); if (this.lockVisible) this.handleInteractionEnd('lock-visible-enabled'); else this.publishMetrics(); }

    setRegion(region, options) {
      this.region = normalizeRegion(region); this.refreshBounds(); this.onRegion(this.region);
      if (options?.fit === false) return this.validateAndRecover(options?.reason || 'region-change', true);
      return this.fitCurrentRegion(options?.reason || 'region-change');
    }

    fitFullBody(reason) { return this.setRegion('full-body', { reason: reason || 'fit-full-body' }); }

    fitCurrentRegion(reason) {
      this.refreshBounds(); const bounds = { min: this.regionData.box.min.toArray(), max: this.regionData.box.max.toArray() };
      const fit = computeFitDistanceForBounds(bounds, { yaw: this.controls.yaw, pitch: this.controls.pitch, aspect: this.camera.aspect, verticalFovDegrees: this.camera.fov, sideMargin: this.region === 'full-body' ? 0.05 : 0.08, verticalMargin: this.region === 'full-body' ? 0.07 : 0.1, boundingSphereRadius: this.regionData.sphere.radius });
      this.controls.target.copy(this.regionData.sphere.center); this.controls.distance = clamp(fit.distance, this.minimumDistance, this.maximumDistance);
      this.updateCamera(); this.updateClipPlanes(); this.renderScene(); return this.validateAndRecover(reason || 'fit-current-region', true);
    }

    enforceDistance() {
      const previous = this.controls.distance; const lowerBound = this.effectiveMinimumDistance || this.minimumDistance; this.controls.distance = clamp(this.controls.distance, lowerBound, this.maximumDistance);
      const below = previous < this.minimumDistance; const above = previous > this.maximumDistance;
      const belowFraming = previous < lowerBound;
      if (above) this.onNotice('已达到最远查看距离'); else if (belowFraming) this.onNotice('已达到最近查看距离');
      this.updateCamera(); return { below, belowFraming, above, corrected: previous !== this.controls.distance };
    }

    clampTarget() {
      const target = this.controls.target; const inside = this.allowedTargetBounds.containsPoint(target);
      if (!inside) {
        target.set(clamp(target.x, this.allowedTargetBounds.min.x, this.allowedTargetBounds.max.x), clamp(target.y, this.allowedTargetBounds.min.y, this.allowedTargetBounds.max.y), clamp(target.z, this.allowedTargetBounds.min.z, this.allowedTargetBounds.max.z));
        this.updateCamera(); this.onNotice('平移目标已限制在人体附近');
      }
      return inside;
    }

    updateClipPlanes() {
      const distance = Math.max(0, this.camera.position.distanceTo(this.controls.target)); const radius = this.regionData?.sphere.radius || this.bodyRadius || 1;
      const clip = computeClipPlanes(distance, radius); this.camera.near = clip.near; this.camera.far = clip.far; this.camera.updateProjectionMatrix();
      if (!(this.camera.near < this.camera.far)) throw new Error(`CameraSafetyControllerV1 invalid clipping range: near=${this.camera.near}, far=${this.camera.far}`);
      if (this.regionData) { this.regionData.localNear = clip.near; this.regionData.localFar = clip.far; }
      return clip;
    }

    handleInteractionEnd(reason) {
      this.refreshBounds(); const limits = this.enforceDistance(); const targetWasInside = this.clampTarget(); this.updateClipPlanes(); this.renderScene();
      return this.validateAndRecover(reason || 'controls-change', true, { cameraDistanceBelowMinimum: limits.below, cameraDistanceBelowFramingMinimum: limits.belowFraming, cameraDistanceAboveMaximum: limits.above, targetWasInside });
    }

    validateAndRecover(reason, allowRecovery, flags) {
      const inspection = this.inspectVisibility(reason, flags); const valid = !inspection.cameraInsideBody && !inspection.nearPlaneIntersectsBody && !inspection.farPlaneExcludesBody && inspection.targetInsideAllowedBounds && inspection.modelVisible;
      if (valid) { this.saveLastValidCameraState(); this.publishMetrics(); }
      else if (allowRecovery !== false && this.lockVisible && this.lastValidCameraState) {
        this.restoreLastValidCameraState(false); this.cameraRecoveryCount += 1; this.renderScene(); this.onNotice('相机状态已恢复');
        return this.inspectVisibility(`${reason || 'camera'}:recovered`, { recovered: true });
      }
      this.publishMetrics(); return this.metrics;
    }

    inspectVisibility(reason, flags) {
      const THREE = this.THREE; this.updateWorldMatrices(); this.camera.updateMatrixWorld(true);
      const box = this.regionData.box; const sphere = this.regionData.sphere; const corners = boxCorners(box.min.toArray(), box.max.toArray()).map((point) => new THREE.Vector3(...point));
      let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity; let visibleProjectedCornerCount = 0;
      for (const worldPoint of corners) {
        const projected = worldPoint.clone().project(this.camera); const x = projected.x * 0.5 + 0.5; const y = -projected.y * 0.5 + 0.5;
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        if (x >= 0 && x <= 1 && y >= 0 && y <= 1 && projected.z >= -1 && projected.z <= 1) visibleProjectedCornerCount += 1;
      }
      let modelBehindNearPlaneVertexCount = 0; let modelBeyondFarPlaneVertexCount = 0;
      for (const worldPoint of this.regionData.points) {
        const viewPoint = worldPoint.clone().applyMatrix4(this.camera.matrixWorldInverse); const depth = -viewPoint.z;
        if (depth < this.camera.near) modelBehindNearPlaneVertexCount += 1; if (depth > this.camera.far) modelBeyondFarPlaneVertexCount += 1;
      }
      const modelScreenBounds = { minX, maxX, minY, maxY, x: Math.round(minX * this.viewport.clientWidth), y: Math.round(minY * this.viewport.clientHeight), width: Math.round((maxX - minX) * this.viewport.clientWidth), height: Math.round((maxY - minY) * this.viewport.clientHeight) };
      let nonBackgroundPixelCount = this.metrics.nonBackgroundPixelCount || 0;
      if (this.measureNonBackgroundPixels) { try { nonBackgroundPixelCount = this.measureNonBackgroundPixels(); } catch (error) { nonBackgroundPixelCount = -1; } }
      const projectedOverlap = maxX >= 0 && minX <= 1 && maxY >= 0 && minY <= 1; const pointCount = Math.max(1, this.regionData.points.length);
      const distance = this.camera.position.distanceTo(this.controls.target); const cameraInsideBody = sphere.containsPoint(this.camera.position);
      const nearPlaneIntersectsBody = this.camera.near >= Math.max(0, distance - sphere.radius) || modelBehindNearPlaneVertexCount > 0;
      const farPlaneExcludesBody = this.camera.far <= distance + sphere.radius || modelBeyondFarPlaneVertexCount > 0;
      const targetInsideAllowedBounds = this.allowedTargetBounds.containsPoint(this.controls.target);
      const modelVisible = projectedOverlap && modelBehindNearPlaneVertexCount < pointCount && modelBeyondFarPlaneVertexCount < pointCount && nonBackgroundPixelCount !== 0;
      this.metrics = {
        region: this.region, cameraDistance: distance, minimumDistance: this.minimumDistance, effectiveMinimumDistance: this.effectiveMinimumDistance, framingMinimumDistance: this.framingMinimumDistance, maximumDistance: this.maximumDistance,
        localTarget: this.regionData.localTarget.toArray(), localBoundingBox: { min: box.min.toArray(), max: box.max.toArray() }, localBoundingSphere: { center: sphere.center.toArray(), radius: sphere.radius }, localNear: this.regionData.localNear, localFar: this.regionData.localFar,
        cameraNear: this.camera.near, cameraFar: this.camera.far, cameraInsideBody, nearPlaneIntersectsBody, farPlaneExcludesBody,
        targetInsideAllowedBounds, visibleProjectedCornerCount, projectedBoundingBox: modelScreenBounds, modelScreenBounds, modelVisible,
        modelBehindNearPlaneVertexCount, modelBeyondFarPlaneVertexCount, nonBackgroundPixelCount,
        lastValidCameraStateAvailable: Boolean(this.lastValidCameraState), cameraRecoveryCount: this.cameraRecoveryCount,
        cameraDistanceBelowMinimum: Boolean(flags?.cameraDistanceBelowMinimum), cameraDistanceAboveMaximum: Boolean(flags?.cameraDistanceAboveMaximum),
        cameraDistanceBelowFramingMinimum: Boolean(flags?.cameraDistanceBelowFramingMinimum),
        lockVisible: this.lockVisible, lastCheckReason: reason || null,
      };
      this.publishMetrics(); return this.metrics;
    }

    saveLastValidCameraState() {
      this.lastValidCameraState = { region: this.region, yaw: this.controls.yaw, pitch: this.controls.pitch, distance: this.controls.distance, target: this.controls.target.toArray(), near: this.camera.near, far: this.camera.far };
      this.metrics.lastValidCameraStateAvailable = true;
    }

    restoreLastValidCameraState(validate) {
      if (!this.lastValidCameraState) return false; const state = this.lastValidCameraState;
      this.region = state.region; this.controls.yaw = state.yaw; this.controls.pitch = state.pitch; this.controls.distance = state.distance; this.controls.target.fromArray(state.target);
      this.refreshBounds(); this.updateCamera(); this.updateClipPlanes(); this.onRegion(this.region); this.renderScene();
      if (validate !== false) this.validateAndRecover('restore-last-valid-camera-state', false); return true;
    }

    scheduleResize(reason) {
      this.pendingResizeReasons.add(reason || 'viewport-resize'); if (this.resizeFrame) return;
      this.resizeFrame = global.requestAnimationFrame(() => {
        this.resizeFrame = 0; const reasons = Array.from(this.pendingResizeReasons).join('+'); this.pendingResizeReasons.clear(); this.resizeNow(reasons);
        global.requestAnimationFrame(() => { this.renderScene(); this.validateAndRecover(`${reasons}:projected-next-frame`, true); global.requestAnimationFrame(() => this.verifyCanvasBackingSize(`${reasons}:backing-next-frame`)); });
      });
    }

    resizeNow(reason) {
      const rect = this.viewport.getBoundingClientRect(); const width = Math.max(1, Math.floor(rect.width || this.viewport.clientWidth)); const height = Math.max(1, Math.floor(rect.height || this.viewport.clientHeight)); const dpr = Math.min(global.devicePixelRatio || 1, 2);
      this.renderer.setPixelRatio(dpr); this.renderer.setSize(width, height, false); this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
      this.viewportMetrics = { viewportWidth: width, viewportHeight: height, devicePixelRatio: dpr, cameraAspect: this.camera.aspect };
      this.refreshBounds(); this.fitCurrentRegion(reason || 'viewport-resize'); this.renderScene(); return this.metrics;
    }

    verifyCanvasBackingSize(reason) {
      const THREE = this.THREE; const drawing = this.renderer.getDrawingBufferSize(new THREE.Vector2()); const expectedWidth = Math.max(1, Math.floor(this.viewportMetrics.viewportWidth * this.viewportMetrics.devicePixelRatio)); const expectedHeight = Math.max(1, Math.floor(this.viewportMetrics.viewportHeight * this.viewportMetrics.devicePixelRatio));
      this.metrics.canvasBackingWidth = drawing.x; this.metrics.canvasBackingHeight = drawing.y; this.metrics.canvasBackingSizeVerified = drawing.x === expectedWidth && drawing.y === expectedHeight; this.metrics.lastCheckReason = reason;
      this.publishMetrics(); return this.metrics.canvasBackingSizeVerified;
    }

    publishMetrics() { this.metrics.lastValidCameraStateAvailable = Boolean(this.lastValidCameraState); this.metrics.cameraRecoveryCount = this.cameraRecoveryCount; this.metrics.lockVisible = this.lockVisible; this.onMetrics(this.metrics, this.viewportMetrics || null); }
  }

  function regionDataFromBox(THREE, region, box, points) {
    const sphere = box.getBoundingSphere(new THREE.Sphere()); const size = box.getSize(new THREE.Vector3());
    return { region, localTarget: sphere.center.clone(), localBoundingBox: box.clone(), localBoundingSphere: sphere.clone(), box, sphere, points, localHeight: size.y, localMinimumDistance: null, localMaximumDistance: null, localNear: null, localFar: null };
  }

  function computeDistanceLimits(bounds) {
    const metrics = boundsMetrics(bounds); return { bodyHeight: metrics.height, bodyRadius: metrics.radius, minimumDistance: Math.max(metrics.radius * 1.08, metrics.height * 0.48), maximumDistance: metrics.radius * 8 };
  }

  function computeClipPlanes(cameraDistanceToTarget, bodyRadius) {
    const near = Math.max(0.005, cameraDistanceToTarget - bodyRadius * 1.3); const far = Math.max(cameraDistanceToTarget + bodyRadius * 4, bodyRadius * 12);
    return { near, far, valid: near < far, cameraInsideBody: cameraDistanceToTarget <= bodyRadius, nearPlaneIntersectsBody: near >= Math.max(0, cameraDistanceToTarget - bodyRadius), farPlaneExcludesBody: far <= cameraDistanceToTarget + bodyRadius };
  }

  function computeFitDistanceForBounds(bounds, options) {
    options = options || {}; const metrics = boundsMetrics(bounds); const center = metrics.center; const radius = Number(options.boundingSphereRadius) || metrics.radius;
    const aspect = Math.max(0.01, Number(options.aspect) || 1); const verticalFov = (Number(options.verticalFovDegrees) || 32) * Math.PI / 180;
    const verticalTangent = Math.tan(verticalFov * 0.5); const horizontalFov = 2 * Math.atan(verticalTangent * aspect); const horizontalTangent = Math.tan(horizontalFov * 0.5);
    const usableHorizontal = 1 - (Number(options.sideMargin ?? 0.05) * 2); const usableVertical = 1 - (Number(options.verticalMargin ?? 0.07) * 2); const basis = cameraBasisFromAngles(Number(options.yaw) || 0, Number(options.pitch) || 0); let distance = 0;
    for (const point of boxCorners(bounds.min, bounds.max)) {
      const relative = subtract3(point, center); const localX = dot3(relative, basis.right); const localY = dot3(relative, basis.up); const localDepth = dot3(relative, basis.backward);
      distance = Math.max(distance, localDepth + Math.abs(localX) / Math.max(0.000001, horizontalTangent * usableHorizontal), localDepth + Math.abs(localY) / Math.max(0.000001, verticalTangent * usableVertical));
    }
    const effectiveHalfAngle = Math.min(Math.atan(horizontalTangent * usableHorizontal), Math.atan(verticalTangent * usableVertical)); distance = Math.max(distance, radius / Math.max(0.000001, Math.sin(effectiveHalfAngle))) * 1.0125;
    return { center, radius, distance, aspect, verticalFov, horizontalFov, usableHorizontal, usableVertical, basis };
  }

  function projectBoundsForLayout(bounds, options) {
    const fit = options?.distance ? { ...computeFitDistanceForBounds(bounds, options), distance: options.distance } : computeFitDistanceForBounds(bounds, options); let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity; let visibleProjectedCornerCount = 0;
    const verticalTangent = Math.tan(fit.verticalFov * 0.5); const horizontalTangent = Math.tan(fit.horizontalFov * 0.5);
    for (const point of boxCorners(bounds.min, bounds.max)) {
      const relative = subtract3(point, fit.center); const depth = fit.distance - dot3(relative, fit.basis.backward); const ndcX = dot3(relative, fit.basis.right) / (depth * horizontalTangent); const ndcY = dot3(relative, fit.basis.up) / (depth * verticalTangent); const x = ndcX * 0.5 + 0.5; const y = -ndcY * 0.5 + 0.5;
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); if (depth > 0 && x >= 0 && x <= 1 && y >= 0 && y <= 1) visibleProjectedCornerCount += 1;
    }
    return { fit, modelScreenBounds: { minX, maxX, minY, maxY }, visibleProjectedCornerCount, modelVisible: maxX >= 0 && minX <= 1 && maxY >= 0 && minY <= 1, safeMarginPassed: minX >= 0.05 - 0.0001 && maxX <= 0.95 + 0.0001 && minY >= 0.07 - 0.0001 && maxY <= 0.93 + 0.0001 };
  }

  function computeRegionBoundsFromPositions(positions, region) {
    region = normalizeRegion(region); const full = positionsBounds(positions); if (region === 'full-body') return { region, bounds: full, pointIndices: Array.from({ length: positions.length / 3 }, (_, index) => index) };
    const indices = []; const size = subtract3(full.max, full.min);
    for (let offset = 0; offset < positions.length; offset += 3) {
      const normalized = [(positions[offset] - full.min[0]) / size[0], (positions[offset + 1] - full.min[1]) / size[1], (positions[offset + 2] - full.min[2]) / size[2]];
      if (regionPredicate(region, normalized)) indices.push(offset / 3);
    }
    if (!indices.length) return { region, bounds: fallbackRegionBounds(full, region), pointIndices: [] };
    const selected = new Float32Array(indices.length * 3); indices.forEach((vertex, index) => { selected[index * 3] = positions[vertex * 3]; selected[index * 3 + 1] = positions[vertex * 3 + 1]; selected[index * 3 + 2] = positions[vertex * 3 + 2]; });
    return { region, bounds: positionsBounds(selected), pointIndices: indices };
  }

  function regionPredicate(region, point) {
    const [x, y, z] = point;
    if (region === 'head-face') return y >= 0.78;
    if (region === 'neck-shoulder') return y >= 0.65 && y <= 0.82 && x >= 0.18 && x <= 0.82;
    if (region === 'left-axilla') return y >= 0.54 && y <= 0.76 && x <= 0.44;
    if (region === 'right-axilla') return y >= 0.54 && y <= 0.76 && x >= 0.56;
    if (region === 'left-elbow') return y >= 0.43 && y <= 0.68 && x <= 0.3;
    if (region === 'right-elbow') return y >= 0.43 && y <= 0.68 && x >= 0.7;
    if (region === 'left-hand') return y >= 0.38 && y <= 0.65 && x <= 0.2;
    if (region === 'right-hand') return y >= 0.38 && y <= 0.65 && x >= 0.8;
    if (region === 'pelvis-groin') return y >= 0.34 && y <= 0.53 && x >= 0.28 && x <= 0.72;
    if (region === 'left-knee') return y >= 0.13 && y <= 0.34 && x <= 0.48;
    if (region === 'right-knee') return y >= 0.13 && y <= 0.34 && x >= 0.52;
    if (region === 'left-ankle-foot') return y <= 0.2 && x <= 0.5;
    if (region === 'right-ankle-foot') return y <= 0.2 && x >= 0.5;
    if (region === 'back-centerline') return y >= 0.22 && y <= 0.88 && x >= 0.44 && x <= 0.56 && z <= 0.52;
    if (region === 'front-centerline') return y >= 0.22 && y <= 0.88 && x >= 0.44 && x <= 0.56 && z >= 0.48;
    return true;
  }

  function fallbackRegionBounds(full, region) {
    const ranges = {
      'head-face': [[0.32,0.78,0.3],[0.68,1,1]], 'neck-shoulder': [[0.18,0.65,0.2],[0.82,0.82,0.9]],
      'left-axilla': [[0.05,0.54,0.2],[0.46,0.76,0.9]], 'right-axilla': [[0.54,0.54,0.2],[0.95,0.76,0.9]],
      'left-elbow': [[0.05,0.43,0.2],[0.32,0.68,0.9]], 'right-elbow': [[0.68,0.43,0.2],[0.95,0.68,0.9]],
      'left-hand': [[0,0.38,0.15],[0.22,0.65,1]], 'right-hand': [[0.78,0.38,0.15],[1,0.65,1]],
      'pelvis-groin': [[0.28,0.34,0.15],[0.72,0.53,1]], 'left-knee': [[0.3,0.13,0.15],[0.49,0.34,0.9]], 'right-knee': [[0.51,0.13,0.15],[0.7,0.34,0.9]],
      'left-ankle-foot': [[0.25,0,0],[0.5,0.2,1]], 'right-ankle-foot': [[0.5,0,0],[0.75,0.2,1]],
      'back-centerline': [[0.44,0.22,0],[0.56,0.88,0.52]], 'front-centerline': [[0.44,0.22,0.48],[0.56,0.88,1]],
    };
    const range = ranges[region] || [[0,0,0],[1,1,1]]; const size = subtract3(full.max, full.min);
    return { min: range[0].map((value, axis) => full.min[axis] + size[axis] * value), max: range[1].map((value, axis) => full.min[axis] + size[axis] * value) };
  }

  function defaultMetrics(region) { return { region, cameraDistance: null, minimumDistance: null, maximumDistance: null, cameraNear: null, cameraFar: null, cameraInsideBody: false, nearPlaneIntersectsBody: false, farPlaneExcludesBody: false, targetInsideAllowedBounds: true, visibleProjectedCornerCount: 0, modelScreenBounds: null, modelVisible: false, lastValidCameraStateAvailable: false, cameraRecoveryCount: 0 }; }
  function normalizeRegion(region) { const normalized = REGION_ALIASES[region] ?? region; return REGION_IDS.includes(normalized) ? normalized : 'full-body'; }
  function positionsBounds(positions) { const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity]; for (let offset = 0; offset < positions.length; offset += 3) for (let axis = 0; axis < 3; axis += 1) { min[axis] = Math.min(min[axis], positions[offset + axis]); max[axis] = Math.max(max[axis], positions[offset + axis]); } return { min, max }; }
  function boundsMetrics(bounds) { const center = bounds.min.map((value, axis) => (value + bounds.max[axis]) * 0.5); const size = subtract3(bounds.max, bounds.min); return { center, size, height: size[1], radius: Math.hypot(size[0], size[1], size[2]) * 0.5 }; }
  function boxCorners(min, max) { const points = []; for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) points.push([x, y, z]); return points; }
  function cameraBasisFromAngles(yaw, pitch) { const cp = Math.cos(pitch); const backward = [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp]; const length = Math.hypot(backward[2], backward[0]) || 1; const right = [backward[2] / length, 0, -backward[0] / length]; const up = [backward[1] * right[2] - backward[2] * right[1], backward[2] * right[0] - backward[0] * right[2], backward[0] * right[1] - backward[1] * right[0]]; return { backward, right, up }; }
  function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function subtract3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }

  global.HRLCameraSafetyControllerV1 = { CameraSafetyControllerV1, REGION_IDS, normalizeRegion, computeDistanceLimits, computeClipPlanes, computeFitDistanceForBounds, projectBoundsForLayout, computeRegionBoundsFromPositions };
})(globalThis);
