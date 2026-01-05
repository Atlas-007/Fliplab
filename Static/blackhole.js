(() => {
	const grav_f = 6.67430e-11;
	const light_c = 2.99792458e8;



	
	const canvas = document.getElementById('simCanvas');
	const ctx = canvas.getContext('2d', { alpha: false });

	const resize = () => {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	};
	window.addEventListener('resize', resize);
	resize();



	// ui 
	const mass = document.getElementById('mass');
	const scale = document.getElementById('scale');
	const tScale = document.getElementById('timeScale');
	const subs = document.getElementById('substeps');
	const pauseBtn = document.getElementById('pauseBtn');
	const stepBtn = document.getElementById('stepBtn');
	const clearBtn = document.getElementById('clearBtn');
	const status = document.getElementById('status');



	
	class BH {
		constructor(m, centerPx, m_per_px) {
			this.G = grav_f;
			this.c = light_c;
			this.M = m;
			this.center = { x: centerPx.x, y: centerPx.y };
			this.scale = m_per_px;
			this.update_rs();
		}
		update_rs() {
			this.r_s = 2 * this.G * this.M / (this.c ** 2);
		}
		setMass(m) { this.M = m; this.update_rs(); }
		setScale(s) { this.scale = s; }
		
		accAt(pos) {
			const r = Math.hypot(pos.x, pos.y);
			if (r === 0) return { x: 0, y: 0 };
			const f = -this.G * this.M / (r * r * r + 1e-20);
			return { x: f * pos.x, y: f * pos.y };
		}
		metersToPixels(pos) {
			return {
				x: Math.round(this.center.x + pos.x / this.scale),
				y: Math.round(this.center.y + pos.y / this.scale)
			};
		}
		pixelsToMeters(px) {
			return {
				x: (px.x - this.center.x) * this.scale,
				y: (px.y - this.center.y) * this.scale
			};
		}
		draw(ctx, visPx = 20) {
			ctx.save();
			ctx.fillStyle = '#000';
			ctx.beginPath();
			ctx.arc(this.center.x, this.center.y, visPx, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
		}
	}



	
	class Photon {
		constructor(radius_m, angle_rad, bh, color = [255, 100, 80], trail_len = 80, initialVel = null) {
			this.bh = bh;
			this.radius_m = Math.max(1e-12, radius_m);
			this.angle = angle_rad;
			this.color = color;
			this.trail_len = Math.max(1, trail_len);

			const r = this.radius_m;
			this.pos = { x: r * Math.cos(this.angle), y: r * Math.sin(this.angle) };

			// default orbital
			const v = Math.sqrt(Math.max(1e-20, this.bh.G * this.bh.M / r));
			this.vel = { x: -v * Math.sin(this.angle), y: v * Math.cos(this.angle) };

			if (initialVel) {
				this.vel.x = initialVel.x;
				this.vel.y = initialVel.y;
			}

			this.positions = [{ x: this.pos.x, y: this.pos.y }];
			this.alive = true;
		}

		// explicit reset
		reset() {
			const r = this.radius_m;
			this.pos = { x: r * Math.cos(this.angle), y: r * Math.sin(this.angle) };
			const v = Math.sqrt(Math.max(1e-20, this.bh.G * this.bh.M / r));
			this.vel = { x: -v * Math.sin(this.angle), y: v * Math.cos(this.angle) };
			this.positions = [{ x: this.pos.x, y: this.pos.y }];
			this.alive = true;
		}

		update(dt, substeps = 4) {
			if (!this.alive) return;
			const dt_sub = dt / Math.max(1, substeps);
			for (let i = 0; i < substeps; i++) {
				const acc = this.bh.accAt(this.pos);
				this.vel.x += acc.x * dt_sub;
				this.vel.y += acc.y * dt_sub;
				this.pos.x += this.vel.x * dt_sub;
				this.pos.y += this.vel.y * dt_sub;
				if (Math.hypot(this.pos.x, this.pos.y) <= this.bh.r_s) {
					this.alive = false;
					break;
				}
			}
			this.positions.push({ x: this.pos.x, y: this.pos.y });
			if (this.positions.length > this.trail_len) this.positions = this.positions.slice(-this.trail_len);
		}

		drawTrail(ctx) {
			const L = this.positions.length;
			if (L === 0) return;
			for (let i = 0; i < L; i++) {
				const p = this.positions[i];
				const px = this.bh.metersToPixels(p);
				const alpha = (i + 1) / (L + 1);
				ctx.globalAlpha = alpha * 0.9;
				const r = (i === L - 1) ? 3 : 2;
				ctx.beginPath();
				ctx.fillStyle = `rgb(${this.color[0]},${this.color[1]},${this.color[2]})`;
				ctx.arc(px.x, px.y, r, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.globalAlpha = 1.0;
		}

		drawPhoton(ctx) {
			const px = this.bh.metersToPixels(this.pos);
			ctx.fillStyle = '#000';
			ctx.beginPath();
			ctx.arc(px.x, px.y, 3, 0, Math.PI * 2);
			ctx.fill();
		}
	}



	// sim state 
	const centerPx = { x: canvas.width / 2, y: canvas.height / 2 };
	let bh = new BH(parseFloat(mass.value), centerPx, parseFloat(scale.value));
	let photons = [];
	let paused = false;
	let lastTime = performance.now();
	let tscale = parseFloat(tScale.value);
	let subsVal = parseInt(subs.value) || 4;



	// aiming and hover state
	let aiming = false;
	let aimStart = null;
	let aimCur = null;

	let hover = null;
	const HOV_TH = 15;



	// add photon helper 
	function addPhotonFromClick(mousePx, options = {}) {
		const pos_m = bh.pixelsToMeters(mousePx);
		const r = Math.hypot(pos_m.x, pos_m.y);
		if (r <= Math.max(bh.r_s * 1.02, 1e-6)) return;
		const angle = Math.atan2(pos_m.y, pos_m.x);
		let initialVel = null;
		if (options.initialVelMeters) initialVel = { x: options.initialVelMeters.x, y: options.initialVelMeters.y };
		const p = new Photon(r, angle, bh, options.isStationary ? [150,200,255] : [255,150,100], 200, initialVel);
		if (options.isStationary) { p.vel.x = 0; p.vel.y = 0; }
		if (options.reverse) { p.vel.x *= -1; p.vel.y *= -1; }
		photons.push(p);
	}



	// mouse handlers 
	canvas.addEventListener('mousedown', (e) => {
		const rect = canvas.getBoundingClientRect();
		const px = { x: e.clientX - rect.left, y: e.clientY - rect.top };
		if (e.button === 0) addPhotonFromClick(px, { isStationary: false, reverse: e.shiftKey });
		else if (e.button === 2) {
			aiming = true;
			aimStart = px;
			aimCur = px;
			e.preventDefault();
		}
	});

	canvas.addEventListener('mousemove', (e) => {
		const rect = canvas.getBoundingClientRect();
		const mousePx = { x: e.clientX - rect.left, y: e.clientY - rect.top };
		if (aiming) aimCur = mousePx;
		let nearest = null;
		let nd = Infinity;
		for (const p of photons) {
			if (!p.alive) continue;
			const pPx = bh.metersToPixels(p.pos);
			const d = Math.hypot(pPx.x - mousePx.x, pPx.y - mousePx.y);
			if (d < nd) { nd = d; nearest = p; }
		}
		if (nearest && nd <= HOV_TH) hover = nearest; else hover = null;
	});

	window.addEventListener('mouseup', (e) => {
		if (!aiming) return;
		const rect = canvas.getBoundingClientRect();
		const endPx = (e.clientX !== undefined) ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : aimCur;
		const dx_px = endPx.x - aimStart.x;
		const dy_px = endPx.y - aimStart.y;
		const drag_px = Math.hypot(dx_px, dy_px);
		if (drag_px < 4) {
			addPhotonFromClick(aimStart, { isStationary: true });
		} else {
			const drag_m = { x: dx_px * bh.scale, y: dy_px * bh.scale };
			const start_m = bh.pixelsToMeters(aimStart);
			const r = Math.hypot(start_m.x, start_m.y);
			const v_orb = Math.sqrt(Math.max(1e-20, bh.G * bh.M / r));
			const multiplier = drag_px / 200.0;
			const magDragM = Math.hypot(drag_m.x, drag_m.y) + 1e-20;
			const drag_unit = { x: drag_m.x / magDragM, y: drag_m.y / magDragM };
			const initVelMeters = { x: drag_unit.x * v_orb * multiplier, y: drag_unit.y * v_orb * multiplier };
			addPhotonFromClick(aimStart, { isStationary: false, initialVelMeters: initVelMeters });
		}
		aiming = false;
		aimStart = null;
		aimCur = null;
	});

	canvas.addEventListener('contextmenu', (e) => e.preventDefault());



	// keyboard shortcuts 
	window.addEventListener('keydown', (e) => {
		if (e.key === ' ') { paused = !paused; updatePause(); e.preventDefault(); }
		else if (e.key === 'r' || e.key === 'R') {
			mass.value = "5e30";
			scale.value = "50000";
			mass.dispatchEvent(new Event('change'));
			scale.dispatchEvent(new Event('change'));
		} else if (e.key === 'ArrowUp') { bh.setMass(bh.M * 1.5); mass.value = bh.M; updateInfo(); }
		else if (e.key === 'ArrowDown') { bh.setMass(Math.max(1e20, bh.M / 1.5)); mass.value = bh.M; updateInfo(); }
		else if (e.key === 'ArrowLeft') { bh.setScale(Math.max(1.0, bh.scale / 1.5)); scale.value = bh.scale; updateInfo(); }
		else if (e.key === 'ArrowRight') { bh.setScale(bh.scale * 1.5); scale.value = bh.scale; updateInfo(); }
	});



	// UI hookup 
	mass.addEventListener('change', () => { const m = parseFloat(mass.value) || bh.M; bh.setMass(m); updateInfo(); });
	scale.addEventListener('change', () => { const s = parseFloat(scale.value) || bh.scale; bh.setScale(s); updateInfo(); });
	tScale.addEventListener('change', () => { tscale = parseFloat(tScale.value) || 1.0; });
	subs.addEventListener('change', () => { subsVal = parseInt(subs.value) || 4; });

	pauseBtn.addEventListener('click', () => { paused = !paused; updatePause(); });
	function updatePause() { pauseBtn.textContent = paused ? 'Resume' : 'Pause'; }
	stepBtn.addEventListener('click', () => { stepSimulation(1/60); });
	clearBtn.addEventListener('click', () => { photons = []; });



	// status text
	function updateInfo() {
		status.textContent = `mass: ${bh.M.toExponential(2)} kg | r_s: ${Math.round(bh.r_s)} m | scale: ${bh.scale.toFixed(2)} m/px | photons: ${photons.length}`;
	}



	// sim stepping & draw 
	function stepSimulation(dtSeconds) {
		const dt = dtSeconds * tscale;
		for (let p of photons) p.update(dt, subsVal);
		photons = photons.filter(p => p.alive && Math.hypot(p.pos.x, p.pos.y) > bh.r_s);
	}

	function formatSpeed(v) {
		if (!isFinite(v) || v === 0) return '0 m/s';
		const fracC = v / bh.c;
		if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(2)} km/s  (${(fracC * 100).toFixed(4)}% c)`;
		else return `${v.toFixed(2)} m/s  (${(fracC * 100).toFixed(6)}% c)`;
	}



	// hover draw 
	function drawHover(ctx) {
		if (!hover) return;
		const p = hover;
		const pPx = bh.metersToPixels(p.pos);
		const speed = Math.hypot(p.vel.x, p.vel.y);
		const radius_m = Math.hypot(p.pos.x, p.pos.y);
		const radius_px = radius_m / bh.scale;
		const cx = bh.center.x, cy = bh.center.y;
		const rx = pPx.x - cx;
		const ry = pPx.y - cy;
		const rlen = Math.hypot(rx, ry) + 1e-20;
		const outward = { x: rx / rlen, y: ry / rlen };
		const off = 18;
		const lx = pPx.x + outward.x * off;
		const ly = pPx.y + outward.y * off;
		const speedText = formatSpeed(speed);
		let radiusText;
		if (radius_m >= 1e3) radiusText = `${(radius_m/1000).toFixed(2)} km (${radius_px.toFixed(1)} px)`;
		else radiusText = `${radius_m.toFixed(2)} m (${radius_px.toFixed(1)} px)`;
		const text = `v: ${speedText}  |  r: ${radiusText}`;
		ctx.save();
		ctx.strokeStyle = 'rgba(0,0,0,0.65)';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(pPx.x, pPx.y);
		ctx.lineTo(lx - 6*outward.x, ly - 6*outward.y);
		ctx.stroke();
		ctx.font = '12px monospace';
		const padding = 6;
		const metrics = ctx.measureText(text);
		const tw = metrics.width;
		const th = 14;
		const boxX = lx - tw / 2 - padding;
		const boxY = ly - th / 2 - padding / 2;
		ctx.globalAlpha = 0.95;
		ctx.fillStyle = 'rgba(255,255,255,0.95)';
		roundRect(ctx, boxX, boxY, tw + padding*2, th + padding, 4, true, true);
		ctx.fillStyle = '#000';
		ctx.fillText(text, boxX + padding, boxY + padding + 10);
		ctx.beginPath();
		ctx.strokeStyle = '#ff8800';
		ctx.lineWidth = 2;
		ctx.arc(pPx.x, pPx.y, 6, 0, Math.PI * 2);
		ctx.stroke();
		ctx.restore();
	}



	// rounded rect helper 
	function roundRect(ctx, x, y, w, h, r, fill, stroke) {
		if (typeof r === 'undefined') r = 5;
		ctx.beginPath();
		ctx.moveTo(x + r, y);
		ctx.arcTo(x + w, y, x + w, y + h, r);
		ctx.arcTo(x + w, y + h, x, y + h, r);
		ctx.arcTo(x, y + h, x, y, r);
		ctx.arcTo(x, y, x + w, y, r);
		ctx.closePath();
		if (fill) ctx.fill();
		if (stroke) { ctx.strokeStyle = '#0077ff'; ctx.stroke(); }
	}



	// aim overlay 
	function drawAim(ctx) {
		if (!aiming || !aimStart || !aimCur) return;
		ctx.save();
		ctx.lineWidth = 2;
		ctx.setLineDash([6,6]);
		ctx.globalAlpha = 0.9;
		ctx.beginPath();
		ctx.strokeStyle = '#0077ff';
		ctx.moveTo(aimStart.x, aimStart.y);
		ctx.lineTo(aimCur.x, aimCur.y);
		ctx.stroke();
		const dx = aimCur.x - aimStart.x;
		const dy = aimCur.y - aimStart.y;
		const ang = Math.atan2(dy, dx);
		const headLen = 12;
		ctx.beginPath();
		ctx.moveTo(aimCur.x, aimCur.y);
		ctx.lineTo(aimCur.x - headLen * Math.cos(ang - Math.PI/6), aimCur.y - headLen * Math.sin(ang - Math.PI/6));
		ctx.lineTo(aimCur.x - headLen * Math.cos(ang + Math.PI/6), aimCur.y - headLen * Math.sin(ang + Math.PI/6));
		ctx.closePath();
		ctx.fillStyle = '#0077ff';
		ctx.fill();
		ctx.globalAlpha = 0.8;
		ctx.beginPath();
		ctx.fillStyle = '#99ccff';
		ctx.arc(aimStart.x, aimStart.y, 5, 0, Math.PI * 2);
		ctx.fill();
		const dx_px = aimCur.x - aimStart.x;
		const dy_px = aimCur.y - aimStart.y;
		const drag_px = Math.hypot(dx_px, dy_px);
		let speedText = '0 m/s';
		if (drag_px >= 4) {
			const drag_m = { x: dx_px * bh.scale, y: dy_px * bh.scale };
			const start_m = bh.pixelsToMeters(aimStart);
			const r = Math.hypot(start_m.x, start_m.y);
			const v_orb = Math.sqrt(Math.max(1e-20, bh.G * bh.M / r));
			const multiplier = drag_px / 200.0;
			const magDragM = Math.hypot(drag_m.x, drag_m.y) + 1e-20;
			const drag_unit = { x: drag_m.x / magDragM, y: drag_m.y / magDragM };
			const initVelMeters = { x: drag_unit.x * v_orb * multiplier, y: drag_unit.y * v_orb * multiplier };
			const speed = Math.hypot(initVelMeters.x, initVelMeters.y);
			speedText = formatSpeed(speed);
		}
		const midX = (aimStart.x + aimCur.x) / 2;
		const midY = (aimStart.y + aimCur.y) / 2;
		const text = `speed: ${speedText}`;
		ctx.font = '12px monospace';
		const padding = 6;
		const metrics = ctx.measureText(text);
		const tw = metrics.width;
		const th = 14;
		const boxX = midX - tw / 2 - padding;
		const boxY = midY - 30 - th / 2;
		ctx.globalAlpha = 0.95;
		ctx.fillStyle = 'rgba(255,255,255,0.9)';
		ctx.fillRect(boxX, boxY, tw + padding * 2, th + padding * 1.4);
		ctx.strokeStyle = '#0077ff';
		ctx.strokeRect(boxX, boxY, tw + padding * 2, th + padding * 1.4);
		ctx.fillStyle = '#000';
		ctx.fillText(text, boxX + padding, boxY + padding + 10);
		ctx.restore();
	}



	// draw
	function draw() {
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		const bhVisPx = Math.max(2, Math.floor(Math.max(1.0, bh.r_s) / bh.scale));
		bh.draw(ctx, bhVisPx);
		for (let p of photons) p.drawTrail(ctx);
		for (let p of photons) if (p.alive) p.drawPhoton(ctx);
		drawHover(ctx);
		drawAim(ctx);
		ctx.fillStyle = '#000';
		ctx.font = '14px sans-serif';
		ctx.fillText(`mass: ${bh.M.toExponential(2)} kg  r_s: ${Math.round(bh.r_s)} m  scale: ${bh.scale.toFixed(2)} m/px  photons: ${photons.length}`, 12, 28);
		ctx.fillText(`time scale: ${tscale}  substeps: ${subsVal}`, 12, 48);
	}



	// frame loop
	function frame(now) {
		const raw_dt = Math.min(0.05, (now - lastTime) / 1000.0);
		lastTime = now;
		if (!paused) stepSimulation(raw_dt);
		draw();
		updateInfo();
		requestAnimationFrame(frame);
	}

	lastTime = performance.now();
	requestAnimationFrame(frame);
	updatePause();
	updateInfo();

})();






