// ═══════════════════════════════════════════════
// WORK INTERFERE BAR CHART
// ═══════════════════════════════════════════════
const intMargin = { top: 20, right: 20, bottom: 60, left: 55 };
const intW = 520 - intMargin.left - intMargin.right;
const intH = 300 - intMargin.top  - intMargin.bottom;

const intSvg = d3.select('#interfere-chart').append('svg')
  .attr('width',  intW + intMargin.left + intMargin.right)
  .attr('height', intH + intMargin.top  + intMargin.bottom)
  .append('g')
  .attr('transform', `translate(${intMargin.left},${intMargin.top})`);

const intX = d3.scaleBand().range([0, intW]).padding(0.35);
const intY = d3.scaleLinear().range([intH, 0]);

const intXAxisG = intSvg.append('g').attr('class','axis')
  .attr('transform',`translate(0,${intH})`);
const intYAxisG = intSvg.append('g').attr('class','axis');

const interfereColors = d3.scaleOrdinal()
  .domain(['Never', 'Rarely', 'Sometimes', 'Often'])
  .range(['#27ae60', '#2E75B6', '#E8C468', '#e74c3c']);

const interfereOrder = ['Never', 'Rarely', 'Sometimes', 'Often'];

intSvg.append('text')
  .attr('transform','rotate(-90)')
  .attr('x', -intH/2).attr('y', -42)
  .attr('text-anchor','middle')
  .style('font-size','0.72rem').style('fill','#888')
  .text('Broj ispitanika');

function updateInterfere(data) {
  const groups = d3.rollup(data, v => v.length, d => d.work_interfere);
  let arr = Array.from(groups, ([key, value]) => ({ key, value }))
    .filter(d => d.key && d.key.trim() !== '' && interfereOrder.includes(d.key));
  arr.sort((a, b) => interfereOrder.indexOf(a.key) - interfereOrder.indexOf(b.key));

  const total = d3.sum(arr, d => d.value);
  intX.domain(arr.map(d => d.key));
  intY.domain([0, d3.max(arr, d => d.value) * 1.15]);

  intXAxisG.transition().duration(500).call(d3.axisBottom(intX));
  intYAxisG.transition().duration(500).call(d3.axisLeft(intY).ticks(5));

  const labels = intSvg.selectAll('.int-label').data(arr, d => d.key);
  labels.exit().remove();
  labels.enter().append('text').attr('class','int-label')
    .merge(labels)
    .transition().duration(600)
    .attr('x', d => intX(d.key) + intX.bandwidth()/2)
    .attr('y', d => intY(d.value) - 5)
    .attr('text-anchor','middle')
    .style('font-size','0.7rem').style('fill','#555').style('font-weight','600')
    .text(d => `${d.value} (${Math.round(d.value/total*100)}%)`);

  const bars = intSvg.selectAll('.int-bar').data(arr, d => d.key);
  bars.exit().transition().duration(400)
    .attr('y', intH).attr('height', 0).attr('opacity', 0).remove();
  bars.enter().append('rect').attr('class','int-bar')
    .attr('x', d => intX(d.key)).attr('y', intH).attr('height', 0)
    .attr('width', intX.bandwidth()).attr('rx', 4)
    .attr('fill', d => interfereColors(d.key)).attr('opacity', 0)
    .merge(bars)
    .on('mouseover', function(event, d) {
      d3.select(this).transition().duration(150).attr('opacity', 0.75);
      showTip(event, `<strong>${d.key}</strong><br/>N = ${d.value}<br/>${Math.round(d.value/total*100)}% ispitanika`);
    })
    .on('mousemove', moveTip)
    .on('mouseout', function() {
      d3.select(this).transition().duration(200).attr('opacity', 1);
      hideTip();
    })
    .transition().duration(600).ease(d3.easeCubicOut)
    .attr('x', d => intX(d.key))
    .attr('y', d => intY(d.value))
    .attr('height', d => intH - intY(d.value))
    .attr('width', intX.bandwidth())
    .attr('opacity', 1);
}

// ═══════════════════════════════════════════════
// AGE HISTOGRAM
// ═══════════════════════════════════════════════
const ageMargin = { top: 20, right: 20, bottom: 60, left: 55 };
const ageW = 520 - ageMargin.left - ageMargin.right;
const ageH = 300 - ageMargin.top  - ageMargin.bottom;

const ageSvg = d3.select('#age-chart').append('svg')
  .attr('width',  ageW + ageMargin.left + ageMargin.right)
  .attr('height', ageH + ageMargin.top  + ageMargin.bottom)
  .append('g')
  .attr('transform', `translate(${ageMargin.left},${ageMargin.top})`);

const ageXAxisG = ageSvg.append('g').attr('class','axis')
  .attr('transform',`translate(0,${ageH})`);
const ageYAxisG = ageSvg.append('g').attr('class','axis');

ageSvg.append('text')
  .attr('transform','rotate(-90)')
  .attr('x', -ageH/2).attr('y', -42)
  .attr('text-anchor','middle')
  .style('font-size','0.72rem').style('fill','#888')
  .text('Broj ispitanika');

ageSvg.append('text')
  .attr('x', ageW/2).attr('y', ageH + 50)
  .attr('text-anchor','middle')
  .style('font-size','0.72rem').style('fill','#888')
  .text('Dob');

function updateAge(data) {
  const cleaned = data.map(d => +d.Age).filter(a => a >= 18 && a <= 70);
  const xScale = d3.scaleLinear().domain([18, 70]).range([0, ageW]);
  const bins = d3.bin().domain([18, 70]).thresholds(d3.range(18, 70, 5))(cleaned);
  const yScale = d3.scaleLinear()
    .domain([0, d3.max(bins, d => d.length) * 1.15])
    .range([ageH, 0]);

  ageXAxisG.transition().duration(500).call(d3.axisBottom(xScale).ticks(10));
  ageYAxisG.transition().duration(500).call(d3.axisLeft(yScale).ticks(5));

  const barsAll = ageSvg.selectAll('.age-bar').data(bins);
  const barsTreatment = ageSvg.selectAll('.age-bar-treatment').data(bins);

  barsAll.exit().transition().duration(400).attr('y', ageH).attr('height', 0).remove();
  barsTreatment.exit().transition().duration(400).attr('y', ageH).attr('height', 0).remove();

  barsAll.enter().append('rect').attr('class','age-bar')
    .attr('x', d => xScale(d.x0) + 1).attr('y', ageH).attr('height', 0)
    .attr('fill', '#BFD3E6').attr('opacity', 0.8)
    .merge(barsAll)
    .on('mouseover', function(event, d) {
      const count = data.filter(r => +r.Age >= d.x0 && +r.Age < d.x1 && r.treatment === 'Yes').length;
      showTip(event,
        `<strong>Dob: ${d.x0}–${d.x1}</strong><br/>` +
        `Ukupno: ${d.length}<br/>` +
        `Traži tretman: ${d.length ? Math.round(count/d.length*100) : 0}%`
      );
    })
    .on('mousemove', moveTip)
    .on('mouseout', hideTip)
    .transition().duration(600).ease(d3.easeCubicOut)
    .attr('x', d => xScale(d.x0) + 1)
    .attr('y', d => yScale(d.length))
    .attr('width', d => Math.max(0, xScale(d.x1) - xScale(d.x0) - 2))
    .attr('height', d => ageH - yScale(d.length))
    .attr('opacity', 0.8);

  barsTreatment.enter().append('rect').attr('class','age-bar-treatment')
    .attr('x', d => xScale(d.x0) + 1).attr('y', ageH).attr('height', 0)
    .attr('fill', '#2E75B6').attr('opacity', 0.85)
    .merge(barsTreatment)
    .transition().duration(600).ease(d3.easeCubicOut)
    .attr('x', d => xScale(d.x0) + 1)
    .attr('y', d => {
      const count = data.filter(r => +r.Age >= d.x0 && +r.Age < d.x1 && r.treatment === 'Yes').length;
      return yScale(count);
    })
    .attr('width', d => Math.max(0, xScale(d.x1) - xScale(d.x0) - 2))
    .attr('height', d => {
      const count = data.filter(r => +r.Age >= d.x0 && +r.Age < d.x1 && r.treatment === 'Yes').length;
      return ageH - yScale(count);
    })
    .attr('opacity', 0.85);

  ageSvg.selectAll('.age-legend').remove();
  [{ label:'Ukupno', color:'#BFD3E6' },
   { label:'Traži tretman', color:'#2E75B6' }].forEach((d, i) => {
    const lg = ageSvg.append('g').attr('class','age-legend')
      .attr('transform', `translate(${ageW - 130 + i * 65}, 0)`);
    lg.append('rect').attr('width',12).attr('height',12).attr('rx',2).attr('fill',d.color);
    lg.append('text').attr('x',16).attr('y',10)
      .style('font-size','0.68rem').style('fill','#555').text(d.label);
  });
}