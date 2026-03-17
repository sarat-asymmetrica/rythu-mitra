<script lang="ts">
  import { onMount } from 'svelte';

  const KOLAM_SPACING = 34; // Fibonacci
  const GOLDEN_ANGLE_RAD = 137.508 * (Math.PI / 180);

  let canvas: HTMLCanvasElement;

  function drawKolam() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const spacing = KOLAM_SPACING;
    const dotR = 1.5;

    for (let x = spacing; x < canvas.width; x += spacing) {
      const col = Math.floor(x / spacing);
      for (let y = spacing; y < canvas.height; y += spacing) {
        const row = Math.floor(y / spacing);

        // Base dot
        ctx.beginPath();
        ctx.arc(x, y, dotR, 0, Math.PI * 2);
        ctx.fillStyle = '#8B4513';
        ctx.fill();

        // Golden-angle arc on every 3rd dot
        if ((col + row) % 3 === 0) {
          const startAngle = GOLDEN_ANGLE_RAD * col;
          ctx.beginPath();
          ctx.arc(x, y, spacing * 0.3, startAngle, startAngle + Math.PI * 0.8);
          ctx.strokeStyle = 'rgba(139, 69, 19, 0.3)';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  onMount(() => {
    drawKolam();
    const handleResize = () => drawKolam();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });
</script>

<canvas
  bind:this={canvas}
  class="kolam-bg"
  aria-hidden="true"
></canvas>

<style>
  .kolam-bg {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: var(--z-canvas);
    opacity: 0.025;
  }
</style>
