// ═══════════════════════════════════════════════
// GEOGRAFSKA KARTA
// ═══════════════════════════════════════════════
const mapW = 520, mapH = 320;
const mapSvg = d3.select('#map-chart').append('svg')
  .attr('width', mapW).attr('height', mapH);
const mapG = mapSvg.append('g');
const projection = d3.geoNaturalEarth1().scale(85).translate([mapW/2, mapH/2]);
const pathGen = d3.geoPath().projection(projection);
const mapColor = d3.scaleSequential(d3.interpolateBlues).domain([0, 100]);

function getByCountry() {
  return d3.rollup(
    applyFilters(fullData),
    v => Math.round(v.filter(d => d.treatment === 'Yes').length / v.length * 100),
    d => d.Country
  );
}

function initMap() {
  d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(world => {
    const countries = topojson.feature(world, world.objects.countries);

    mapG.selectAll('.country-path')
      .data(countries.features)
      .enter().append('path')
      .attr('class','country-path')
      .attr('d', pathGen)
      .attr('fill', '#e8edf4')
      .attr('stroke','white')
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, f) {
        const dataName = reverseMap[f.properties.name] || f.properties.name;
        const val = getByCountry().get(dataName);
        d3.select(this).transition().duration(150)
          .attr('stroke','#333').attr('stroke-width', 1.5);
        if (val !== undefined)
          showTip(event, `<strong>${f.properties.name}</strong><br/>Tretman: ${val}%`);
      })
      .on('mousemove', moveTip)
      .on('mouseout', function() {
        d3.select(this).transition().duration(150)
          .attr('stroke','white').attr('stroke-width', 0.5);
        hideTip();
      })
      .on('click', function(event, f) {
        const byCountry = getByCountry();
        const dataName = reverseMap[f.properties.name] || f.properties.name;
        if (!byCountry.has(dataName)) return;

        selectedCountry = selectedCountry === dataName ? null : dataName;

        mapG.selectAll('.country-path')
          .transition().duration(300)
          .attr('opacity', feat => {
            if (!selectedCountry) return 1;
            const fName = reverseMap[feat.properties.name] || feat.properties.name;
            return fName === selectedCountry ? 1 : 0.2;
          })
          .style('pointer-events', 'all');

        updateAll();
        updateCountryInfo();
      });

    const legendW = 150;
    const defs = mapSvg.append('defs');
    const grad = defs.append('linearGradient').attr('id','mapGrad');
    grad.append('stop').attr('offset','0%').attr('stop-color', mapColor(0));
    grad.append('stop').attr('offset','100%').attr('stop-color', mapColor(100));

    const lg = mapSvg.append('g')
      .attr('transform',`translate(${mapW-legendW-20},${mapH-35})`);
    lg.append('rect').attr('width',legendW).attr('height',10)
      .attr('rx',3).attr('fill','url(#mapGrad)');
    lg.append('text').attr('y',-4)
      .style('font-size','0.65rem').style('fill','#666').text('% traži tretman');
    lg.append('text').attr('y',22)
      .style('font-size','0.65rem').style('fill','#666').text('0%');
    lg.append('text').attr('x',legendW).attr('y',22).attr('text-anchor','end')
      .style('font-size','0.65rem').style('fill','#666').text('100%');

    updateMapHighlight();
  });
}

function updateMapHighlight() {
  if (!fullData.length) return;
  const byCountry = getByCountry();
  mapG.selectAll('.country-path').transition().duration(500)
    .attr('fill', f => {
      const dataName = reverseMap[f.properties.name] || f.properties.name;
      const val = byCountry.get(dataName);
      return val !== undefined ? mapColor(val) : '#e8edf4';
    });
}

function updateCountryInfo() {
  const info = d3.select('#country-info');
  if (!selectedCountry) {
    info.classed('hidden', true).html('');
    return;
  }
  const countryData = applyFilters(fullData);
  const total     = countryData.length;
  const treatment = countryData.filter(d => d.treatment === 'Yes').length;
  const pct       = total ? Math.round(treatment / total * 100) : 0;

  info.classed('hidden', false).html(`
    <span>🌍</span>
    <span>Odabrana zemlja: <strong>${selectedCountry}</strong></span>
    <span>|</span>
    <span>Ukupno ispitanika: <strong>${total}</strong></span>
    <span>|</span>
    <span>Traži tretman: <strong>${treatment} (${pct}%)</strong></span>
    <button class="clear-btn" onclick="clearCountry()">✕ Ukloni odabir</button>
  `);
}

function clearCountry() {
  selectedCountry = null;
  mapG.selectAll('.country-path')
    .transition().duration(300)
    .attr('opacity', 1)
    .style('pointer-events', 'all');
  updateAll();
  updateMapHighlight();
  updateCountryInfo();
}

// ═══════════════════════════════════════════════
// RADAR CHART
// ═══════════════════════════════════════════════
const radarVars = ['treatment','family_history','benefits','seek_help','wellness_program','remote_work'];
const radarLabels = {
  treatment:        'Tretman',
  family_history:   'Obitelj. anamneza',
  benefits:         'Benefiti',
  seek_help:        'Traži pomoć',
  wellness_program: 'Wellness program',
  remote_work:      'Remote rad'
};

const radarW = 460, radarH = 380;
const radarCx = radarW / 2, radarCy = radarH / 2;
const radarR  = 130;
const levels  = 5;

const radarSvg = d3.select('#radar-chart').append('svg')
  .attr('width', radarW).attr('height', radarH);
const radarG = radarSvg.append('g')
  .attr('transform', `translate(${radarCx},${radarCy})`);

const radarColors = {
  Male:   '#2E75B6',
  Female: '#E8704A',
  All:    '#27ae60'
};

const angleSlice = (Math.PI * 2) / radarVars.length;

// Mreža
for (let lvl = 1; lvl <= levels; lvl++) {
  const r = (radarR / levels) * lvl;
  const points = radarVars.map((_, i) => {
    const angle = angleSlice * i - Math.PI / 2;
    return [r * Math.cos(angle), r * Math.sin(angle)];
  });
  radarG.append('polygon')
    .attr('points', points.map(p => p.join(',')).join(' '))
    .attr('fill', 'none').attr('stroke', '#ddd').attr('stroke-width', 0.8);
  radarG.append('text')
    .attr('x', 4).attr('y', -r)
    .style('font-size', '0.6rem').style('fill', '#aaa')
    .text(Math.round((lvl / levels) * 100) + '%');
}

// Osi i labeli
radarVars.forEach((v, i) => {
  const angle = angleSlice * i - Math.PI / 2;
  const x = radarR * Math.cos(angle);
  const y = radarR * Math.sin(angle);
  radarG.append('line')
    .attr('x1', 0).attr('y1', 0).attr('x2', x).attr('y2', y)
    .attr('stroke', '#ccc').attr('stroke-width', 1);
  const lx = (radarR + 22) * Math.cos(angle);
  const ly = (radarR + 22) * Math.sin(angle);
  radarG.append('text')
    .attr('x', lx).attr('y', ly)
    .attr('text-anchor', Math.abs(lx) < 5 ? 'middle' : lx > 0 ? 'start' : 'end')
    .attr('dominant-baseline', ly < -5 ? 'auto' : ly > 5 ? 'hanging' : 'middle')
    .style('font-size', '0.68rem').style('fill', '#555')
    .text(radarLabels[v]);
});

// Legenda
const legendRG = radarSvg.append('g').attr('transform', `translate(10, 10)`);
[{ label:'Svi', color: radarColors.All },
 { label:'Muški', color: radarColors.Male },
 { label:'Ženski', color: radarColors.Female }].forEach((d, i) => {
  const row = legendRG.append('g').attr('transform', `translate(0,${i*20})`);
  row.append('rect').attr('width',12).attr('height',12).attr('rx',2).attr('fill',d.color).attr('opacity',0.7);
  row.append('text').attr('x',18).attr('y',10)
    .style('font-size','0.72rem').style('fill','#444').text(d.label);
});

function radarCoords(value, index) {
  const angle = angleSlice * index - Math.PI / 2;
  return [value * radarR * Math.cos(angle), value * radarR * Math.sin(angle)];
}

function getRadarData(data) {
  return radarVars.map(v => ({
    var: v,
    pct: data.length ? data.filter(d => binaryVal(d, v) === 1).length / data.length : 0
  }));
}

function drawRadarShape(data, color, className) {
  const radarData = getRadarData(data);
  const points = radarData.map((d, i) => radarCoords(d.pct, i));
  const pathStr = points.map((p, i) => (i === 0 ? 'M' : 'L') + p[0] + ',' + p[1]).join(' ') + 'Z';

  const existing = radarG.selectAll('.' + className);
  if (existing.empty()) {
    radarG.append('path').attr('class', className)
      .attr('d', pathStr).attr('fill', color).attr('fill-opacity', 0.15)
      .attr('stroke', color).attr('stroke-width', 2).attr('opacity', 0)
      .style('pointer-events', 'none')
      .transition().duration(600).attr('opacity', 1);
  } else {
    existing.transition().duration(600).ease(d3.easeCubicOut)
      .attr('d', pathStr).style('pointer-events', 'none');
  }

  const dots = radarG.selectAll('.' + className + '-dot').data(radarData);
  dots.exit().remove();
  dots.enter().append('circle').attr('class', className + '-dot')
    .attr('r', 5).attr('fill', color).attr('stroke', 'white')
    .attr('stroke-width', 1.5).attr('opacity', 0)
    .style('pointer-events', 'none')
    .merge(dots)
    .transition().duration(600)
    .attr('cx', (d, i) => radarCoords(d.pct, i)[0])
    .attr('cy', (d, i) => radarCoords(d.pct, i)[1])
    .attr('opacity', 1);
}

function drawRadarHoverZones(allData, maleData, femaleData) {
  radarG.selectAll('.radar-hover').remove();
  const datasets = [
    { data: allData,    color: radarColors.All,    label: 'Svi'    },
    { data: maleData,   color: radarColors.Male,   label: 'Muški'  },
    { data: femaleData, color: radarColors.Female, label: 'Ženski' }
  ];
  datasets.forEach(({ data, label }) => {
    getRadarData(data).forEach((d, i) => {
      const [cx, cy] = radarCoords(d.pct, i);
      radarG.append('circle').attr('class', 'radar-hover')
        .attr('cx', cx).attr('cy', cy).attr('r', 12)
        .attr('fill', 'transparent').attr('stroke', 'none')
        .on('mouseover', function(event) {
          showTip(event, `<strong>${radarLabels[d.var]}</strong> (${label})<br/>${Math.round(d.pct * 100)}%`);
        })
        .on('mousemove', moveTip)
        .on('mouseout', hideTip);
    });
  });
}

function updateRadar() {
  const allData    = applyFilters(fullData);
  const maleData   = allData.filter(d => d.Gender === 'Male');
  const femaleData = allData.filter(d => d.Gender === 'Female');
  drawRadarShape(allData,    radarColors.All,    'radar-all');
  drawRadarShape(maleData,   radarColors.Male,   'radar-male');
  drawRadarShape(femaleData, radarColors.Female, 'radar-female');
  drawRadarHoverZones(allData, maleData, femaleData);
}