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
    links = newLinks;
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
        .id(d => d.id).distance(110).strength(0.25))
      .force('charge', d3.forceManyBody().strength(-280))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(50))
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
