<script lang="ts">
  import { onMount } from 'svelte';
  import { donutSegments, totalExpense } from '../lib/stores';

  let canvas: HTMLCanvasElement;

  function drawDonut(segments: { label: string; value: number; color: string; percent: number }[], total: number) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const outerR = W * 0.44;
    const innerR = W * 0.28;
    const gapAngle = 0.04;

    const startTime = performance.now();
    const duration = 987;

    function frame(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      ctx.clearRect(0, 0, W, H);
      let startAngle = -Math.PI / 2;

      for (const seg of segments) {
        const fraction = seg.value / total;
        const sweepTarget = fraction * Math.PI * 2 - gapAngle;
        const sweep = sweepTarget * eased;
        if (sweep <= 0) { startAngle += sweepTarget + gapAngle; continue; }

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, outerR, startAngle, startAngle + sweep);
        ctx.closePath();
        ctx.fillStyle = seg.color;
        ctx.fill();

        startAngle += sweepTarget + gapAngle;
      }

      // Punch inner hole
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      if (progress < 1) requestAnimationFrame(frame);
    }

    setTimeout(() => requestAnimationFrame(frame), 600);
  }

  $effect(() => {
    const segs = $donutSegments;
    const total = $totalExpense;
    if (canvas && segs.length > 0 && total > 0) {
      drawDonut(segs, total);
    }
  });

  onMount(() => {
    if ($donutSegments.length > 0 && $totalExpense > 0) {
      drawDonut($donutSegments, $totalExpense);
    }
  });
</script>

<div class="donut-wrap">
  <canvas bind:this={canvas} width="200" height="200"></canvas>
  <div class="donut-center">
    <span class="donut-center-label">ఖర్చులు</span>
    <span class="donut-center-amount">₹{$totalExpense.toLocaleString('en-IN')}</span>
  </div>
</div>

<style>
  .donut-wrap {
    position: relative;
    flex-shrink: 0;
    width: 200px;
    height: 200px;
  }

  canvas { display: block; }

  .donut-center {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    pointer-events: none;
  }

  .donut-center-label {
    font-size: 9px;
    color: var(--ink-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: block;
  }

  .donut-center-amount {
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--ink-primary);
    font-variant-numeric: tabular-nums;
    display: block;
    margin-top: 1px;
  }

  @media (max-width: 420px) {
    .donut-wrap { width: 140px; height: 140px; }
    canvas { width: 140px; height: 140px; }
  }
</style>
