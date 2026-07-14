(function(r) {
  r.makeBadge = function(text, center) {
    const c = document.createElement('canvas');
    c.width = 88; c.height = 31;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 88, 31);

    ctx.strokeStyle = center ? '#ff3333' : '#5a1a1a';
    ctx.lineWidth = center ? 2 : 1;
    ctx.strokeRect(0.5, 0.5, 87, 30);

    ctx.fillStyle = 'rgba(255,51,51,0.07)';
    for (let y = 2; y < 31; y += 2) {
      ctx.fillRect(2, y, 84, 1);
    }

    ctx.font = 'bold 10px "Share Tech Mono", monospace';
    ctx.fillStyle = '#ff3333';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff3333';
    ctx.shadowBlur = center ? 4 : 0;

    const label = text.replace(/^https?:\/\//, '').replace(/^www\./, '').slice(0, 15);
    ctx.fillText(label.toUpperCase(), 44, 19);

    ctx.fillStyle = '#f30';
    ctx.fillRect(2, 2, 3, 1);
    ctx.fillRect(2, 2, 1, 3);
    ctx.fillRect(83, 2, 3, 1);
    ctx.fillRect(85, 2, 1, 3);

    return c.toDataURL();
  };

  r.renderSpell = function(canvas, graphNodes, graphLinks) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.strokeStyle = '#ff3333';
    ctx.shadowColor = '#ff3333';
    ctx.shadowBlur = 8;

    for (let r2 = 320; r2 > 20; r2 -= 28) {
      ctx.beginPath();
      ctx.arc(0, 0, r2, 0, Math.PI * 2);
      ctx.globalAlpha = 0.15 + r2 / 2000;
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    const display = graphNodes.slice(0, Math.min(120, graphNodes.length));
    display.forEach((n, i) => {
      const ang = (i / display.length) * Math.PI * 2;
      const rad = 200 + (i % 3) * 40;
      const x = Math.cos(ang) * rad;
      const y = Math.sin(ang) * rad;
      ctx.fillStyle = n.cursed ? '#300' : '#1a0000';
      ctx.strokeStyle = '#f33';
      ctx.fillRect(x - 30, y - 6, 60, 12);
      ctx.strokeRect(x - 30, y - 6, 60, 12);
      ctx.fillStyle = '#f33';
      ctx.font = '9px "Share Tech Mono"';
      ctx.textAlign = 'center';
      ctx.fillText((n.label || n.url || '???').slice(0, 8), x, y + 3);
    });
    ctx.restore();

    ctx.fillStyle = '#f33';
    ctx.font = '14px "VT323"';
    ctx.fillText('KRUX DUMP // ' + graphNodes.length + ' NODES', 20, 30);
    ctx.fillText(new Date().toISOString(), 20, 50);
  };
})((window.KRUX = window.KRUX || {}).renderer = {});
