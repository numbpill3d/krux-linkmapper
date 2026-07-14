(function(g) {
  let simulation = null;
  let nodes = [];
  let links = [];
  let zoom = null;

  g.init = function(svgEl, width, height) {
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    svg.append('rect')
      .attr('class', 'graph-bg')
      .attr('width', width)
      .attr('height', height);

    zoom = d3.zoom()
      .scaleExtent([0.2, 5])
      .on('zoom', (event) => {
        svg.selectAll('g.graph-content')
          .attr('transform', event.transform);
      });

    svg.call(zoom);
    svg.on('dblclick.zoom', null);

    svg.append('g').attr('class', 'graph-content');
  };

  g.setGraph = function(newNodes, newLinks) {
    nodes = newNodes;
    // Drop links whose endpoints aren't present (defensive — backend should
    // already guarantee this, but d3 throws "node not found" otherwise).
    const ids = new Set(nodes.map(n => n.id));
    links = newLinks.filter(l => ids.has(l.source) && ids.has(l.target));
  };

  g.render = function(width, height) {
    const svg = d3.select('svg.links');
    const content = svg.select('g.graph-content');
    content.selectAll('*').remove();

    const linkDim = content.append('g')
      .selectAll('line').data(links).enter().append('line')
      .attr('class', 'link-dim');

    const linkChain = content.append('g')
      .selectAll('line').data(links).enter().append('line')
      .attr('class', 'link-chain');

    simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links)
        .id(d => d.id).distance(70).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-180))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05))
      .force('collide', d3.forceCollide(34))
      .on('tick', () => {
        linkChain
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);
        linkDim
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);
        nodes.forEach(n => {
          if (n.el) {
            n.el.style.left = n.x + 'px';
            n.el.style.top = n.y + 'px';
          }
        });
      });

    // Settle the layout a bit before first paint so the graph appears centered
    // instead of exploding from the origin.
    for (let i = 0; i < 30; i++) simulation.tick();
    simulation.alpha(0.8).restart();

    return simulation;
  };

  g.stop = function() {
    if (simulation) {
      simulation.stop();
      simulation = null;
    }
  };

  g.zoomIn = function() {
    const svg = d3.select('svg.links');
    svg.transition().duration(200).call(zoom.scaleBy, 1.3);
  };

  g.zoomOut = function() {
    const svg = d3.select('svg.links');
    svg.transition().duration(200).call(zoom.scaleBy, 0.7);
  };

  g.resetZoom = function() {
    const svg = d3.select('svg.links');
    svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
  };

  g.getNodes = () => nodes;
  g.getLinks = () => links;
})((window.KRUX = window.KRUX || {}).graph = {});
