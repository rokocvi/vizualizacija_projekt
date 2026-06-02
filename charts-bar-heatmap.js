// ═══════════════════════════════════════════════
// BAR CHART
// ═══════════════════════════════════════════════
const barMargin = { top: 20, right: 20, bottom: 90, left: 55 };
const barW = 520 - barMargin.left - barMargin.right;
const barH = 300 - barMargin.top  - barMargin.bottom;

const barSvg = d3.select('#bar-chart')
  .append('svg')
  .attr('width',  barW + barMargin.left + barMargin.right)
  .attr('height', barH + barMargin.top  + barMargin.bottom)
  .append('g')
  .attr('transform', `translate(${barMargin.left},${barMargin.top})`);

const xScale = d3.scaleBand().range([0, barW]).padding(0.35);
const yScale = d3.scaleLinear().range([barH, 0]);

const xAxisG = barSvg.append('g').attr('class','axis')
  .attr('transform',`translate(0,${barH})`);
const yAxisG = barSvg.append('g').attr('class','axis');

barSvg.append('text')
  .attr('transform','rotate(-90)')
  .attr('x', -barH/2).attr('y', -42)
  .attr('text-anchor','middle')
  .style('font-size','0.72rem').style('fill','#888')
  .text('% koji traži tretman');

function updateBars(data) {
  const groups = d3.rollup(data,
    v => ({
      total: v.length,
      pct: Math.round(v.filter(d => d.treatment === 'Yes').length / v.length * 100)
    }),
    d => d.no_employees
  );

  let arr = Array.from(groups, ([key, val]) => ({ key, ...val }))
    .filter(d => d.key && d.key.trim() !== '');

  const sizeOrder = {
    '1-5': 1, '6-25': 2, '26-100': 3,
    '100-500': 4, '500-1000': 5, 'More than 1000': 6
  };

  if (sortMode === 'asc')   arr.sort((a,b) => a.pct - b.pct);
  if (sortMode === 'desc')  arr.sort((a,b) => b.pct - a.pct);
  if (sortMode === 'alpha') arr.sort((a,b) => (sizeOrder[a.key]||9) - (sizeOrder[b.key]||9));

  xScale.domain(arr.map(d => d.key));
  yScale.domain([0, 100]);

  xAxisG.transition().duration(500)
    .call(d3.axisBottom(xScale))
    .selectAll('text')
    .attr('transform','rotate(-30)')
    .style('text-anchor','end');

  yAxisG.transition().duration(500)
    .call(d3.axisLeft(yScale).tickFormat(d => d + '%').ticks(5));

  const labels = barSvg.selectAll('.bar-label').data(arr, d => d.key);
  labels.exit().remove();
  labels.enter().append('text').attr('class','bar-label')
    .merge(labels)
    .transition().duration(600)
    .attr('x', d => xScale(d.key) + xScale.bandwidth()/2)
    .attr('y', d => yScale(d.pct) - 5)
    .attr('text-anchor','middle')
    .style('font-size','0.7rem').style('fill','#555').style('font-weight','600')
    .text(d => d.pct + '%');

  const bars = barSvg.selectAll('.bar').data(arr, d => d.key);

  bars.exit().transition().duration(400)
    .attr('y', barH).attr('height', 0).attr('opacity', 0).remove();

  bars.enter().append('rect').attr('class','bar')
    .attr('x', d => xScale(d.key))
    .attr('y', barH).attr('height', 0)
    .attr('width', xScale.bandwidth())
    .attr('rx', 4).attr('fill','#2E75B6').attr('opacity', 0)
    .merge(bars)
    .on('mouseover', function(event, d) {
      d3.select(this).transition().duration(150).attr('fill','#F28E2B');
      showTip(event, `<strong>${d.key} zaposlenika</strong><br/>Traži tretman: ${d.pct}%<br/>Ukupno: ${d.total}`);
    })
    .on('mousemove', moveTip)
    .on('mouseout', function() {
      d3.select(this).transition().duration(200).attr('fill','#2E75B6');
      hideTip();
    })
    .transition().duration(600).ease(d3.easeCubicOut)
    .attr('x', d => xScale(d.key))
    .attr('y', d => yScale(d.pct))
    .attr('height', d => barH - yScale(d.pct))
    .attr('width', xScale.bandwidth())
    .attr('opacity', 1);
}

// ═══════════════════════════════════════════════
// HEATMAPA
// ═══════════════════════════════════════════════
const hmM = { top: 30, right: 20, bottom: 110, left: 130 };
const hmW = 520 - hmM.left - hmM.right;
const hmH = 340 - hmM.top  - hmM.bottom;

const hmSvg = d3.select('#heatmap-chart').append('svg')
  .attr('width',  hmW + hmM.left + hmM.right)
  .attr('height', hmH + hmM.top  + hmM.bottom)
  .append('g').attr('transform',`translate(${hmM.left},${hmM.top})`);

const hmVars = ['treatment','family_history','remote_work','benefits','seek_help'];
const hmLabels = {
  treatment:      'Tretman',
  family_history: 'Obitelj. anamneza',
  remote_work:    'Remote rad',
  benefits:       'Benefiti',
  seek_help:      'Traži pomoć'
};

const hmX = d3.scaleBand().domain(hmVars).range([0, hmW]).padding(0.06);
const hmY = d3.scaleBand().domain(hmVars).range([0, hmH]).padding(0.06);
const hmColor = d3.scaleSequential(d3.interpolateBlues).domain([0, 1]);

hmSvg.append('g').attr('class','axis').attr('transform',`translate(0,${hmH})`)
  .call(d3.axisBottom(hmX).tickFormat(k => hmLabels[k]))
  .selectAll('text').attr('transform','rotate(-38)').style('text-anchor','end').style('font-size','0.72rem');

hmSvg.append('g').attr('class','axis')
  .call(d3.axisLeft(hmY).tickFormat(k => hmLabels[k]))
  .selectAll('text').style('font-size','0.72rem');

function binaryVal(d, key) {
  const v = (d[key] || '').toLowerCase();
  return ['yes','1','true'].includes(v) ? 1 : 0;
}

function correlation(data, a, b) {
  const aV = data.map(d => binaryVal(d,a));
  const bV = data.map(d => binaryVal(d,b));
  const ma = d3.mean(aV), mb = d3.mean(bV);
  const num = d3.sum(aV.map((v,i) => (v-ma)*(bV[i]-mb)));
  const den = Math.sqrt(
    d3.sum(aV.map(v => (v-ma)**2)) *
    d3.sum(bV.map(v => (v-mb)**2))
  );
  return den === 0 ? 0 : num/den;
}

function updateHeatmap(data) {
  const pairs = [];
  hmVars.forEach(a => hmVars.forEach(b =>
    pairs.push({ a, b, r: correlation(data, a, b) })
  ));

  const cells = hmSvg.selectAll('.hmcell').data(pairs, d => d.a+'-'+d.b);
  cells.exit().transition().duration(300).attr('opacity',0).remove();

  cells.enter().append('rect').attr('class','hmcell')
    .attr('x', d => hmX(d.a)).attr('y', d => hmY(d.b))
    .attr('width', hmX.bandwidth()).attr('height', hmY.bandwidth())
    .attr('rx', 3).attr('opacity', 0)
    .merge(cells)
    .on('mouseover', function(event, d) {
      d3.select(this).transition().duration(100).attr('opacity', 0.75);
      showTip(event, `<strong>${hmLabels[d.a]}</strong> × <strong>${hmLabels[d.b]}</strong><br/>r = ${d.r.toFixed(3)}`);
    })
    .on('mousemove', moveTip)
    .on('mouseout', function() {
      d3.select(this).transition().duration(100).attr('opacity', 1);
      hideTip();
    })
    .transition().duration(600)
    .attr('fill', d => hmColor(Math.abs(d.r)))
    .attr('opacity', 1);

  const texts = hmSvg.selectAll('.hmtext').data(pairs, d => d.a+'-'+d.b);
  texts.exit().remove();
  texts.enter().append('text').attr('class','hmtext')
    .merge(texts)
    .attr('x', d => hmX(d.a) + hmX.bandwidth()/2)
    .attr('y', d => hmY(d.b) + hmY.bandwidth()/2 + 4)
    .attr('text-anchor','middle')
    .style('font-size','0.62rem')
    .style('fill', d => Math.abs(d.r) > 0.4 ? 'white' : '#333')
    .text(d => d.r.toFixed(2));
}