let fullData    = [];
let filters     = { gender: 'all' };
let sortMode    = 'desc';
let playing     = false;
let timer       = null;
let currentStep = 0;
let selectedCountry = null;

const tooltip = d3.select('#tooltip');

// ═══════════════════════════════════════════════
// UČITAVANJE
// ═══════════════════════════════════════════════
d3.csv('data/survey.csv').then(rawData => {

  rawData.forEach(d => {
    const g = (d.Gender || '').trim().toLowerCase();
    if (['male','m','man','cis male','cis man','male (cis)','malr','mal','make'].includes(g))
      d.Gender = 'Male';
    else if (['female','f','woman','cis female','cis woman','female (cis)','femail'].includes(g))
      d.Gender = 'Female';
    else
      d.Gender = 'Other';
  });

  fullData = rawData;
  console.log('Učitano:', fullData.length, 'redaka');

  updateAll();
  setupFilters();
  setupSorting();
  setupAnimation();
  setupReset();
  initMap();
  updateCountryInfo();
});

// ═══════════════════════════════════════════════
// COUNTRY MAPPING
// ═══════════════════════════════════════════════
const countryNameMap = {
  'United States':          'United States of America',
  'United Kingdom':         'United Kingdom',
  'Russia':                 'Russia',
  'Czech Republic':         'Czechia',
  'Bosnia and Herzegovina': 'Bosnia and Herz.',
  'Bahamas, The':           'Bahamas',
  'South Africa':           'South Africa',
  'New Zealand':            'New Zealand',
  'Costa Rica':             'Costa Rica',
  'Philippines':            'Philippines',
  'Singapore':              'Singapore',
  'Australia':              'Australia',
  'Austria':                'Austria',
  'Belgium':                'Belgium',
  'Brazil':                 'Brazil',
  'Bulgaria':               'Bulgaria',
  'Canada':                 'Canada',
  'China':                  'China',
  'Colombia':               'Colombia',
  'Croatia':                'Croatia',
  'Denmark':                'Denmark',
  'Finland':                'Finland',
  'France':                 'France',
  'Georgia':                'Georgia',
  'Germany':                'Germany',
  'Greece':                 'Greece',
  'Hungary':                'Hungary',
  'India':                  'India',
  'Ireland':                'Ireland',
  'Israel':                 'Israel',
  'Italy':                  'Italy',
  'Japan':                  'Japan',
  'Latvia':                 'Latvia',
  'Mexico':                 'Mexico',
  'Moldova':                'Moldova',
  'Netherlands':            'Netherlands',
  'Nigeria':                'Nigeria',
  'Norway':                 'Norway',
  'Poland':                 'Poland',
  'Portugal':               'Portugal',
  'Romania':                'Romania',
  'Slovenia':               'Slovenia',
  'Spain':                  'Spain',
  'Sweden':                 'Sweden',
  'Switzerland':            'Switzerland',
  'Thailand':               'Thailand',
  'Uruguay':                'Uruguay',
  'Zimbabwe':               'Zimbabwe',
};

const reverseMap = {};
Object.entries(countryNameMap).forEach(([dataName, topoName]) => {
  reverseMap[topoName] = dataName;
});

// ═══════════════════════════════════════════════
// FILTRIRANJE
// ═══════════════════════════════════════════════
function applyFilters(data) {
  return data.filter(d =>
    (filters.gender === 'all' || d.Gender === filters.gender) &&
    (!selectedCountry || d.Country === selectedCountry)
  );
}

function setupFilters() {
  d3.selectAll('.filter-btn').on('click', function () {
    const key = this.dataset.key;
    const val = this.dataset.value;
    filters[key] = (filters[key] === val && val !== 'all') ? 'all' : val;
    d3.selectAll(`.filter-btn[data-key="${key}"]`).classed('active', false);
    d3.select(this).classed('active', true);
    updateAll();
    updateMapHighlight();
    updateCountryInfo();
  });
}

function updateAll() {
  const filtered = applyFilters(fullData);
  updateBars(filtered);
  updateDonut(filtered);
  updateHeatmap(filtered);
  updateRadar(filtered);
}

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
// DONUT CHART
// ═══════════════════════════════════════════════
const dSize = 280, dRadius = dSize/2, dInner = dRadius * 0.52;

const donutSvg = d3.select('#donut-chart').append('svg')
  .attr('width', dSize + 120).attr('height', dSize)
  .append('g').attr('transform',`translate(${dRadius},${dRadius})`);

const arcFn  = d3.arc().innerRadius(dInner).outerRadius(dRadius - 15);
const arcHov = d3.arc().innerRadius(dInner).outerRadius(dRadius - 8);
const pieFn  = d3.pie().value(d => d.value).sort(null);

const donutColors = d3.scaleOrdinal()
  .domain(['Yes','No']).range(['#2E75B6','#E8C468']);

const centerPct = donutSvg.append('text')
  .attr('text-anchor','middle').attr('dy','-0.1em')
  .style('font-size','1.6rem').style('font-weight','700').style('fill','#1a5fa8');
const centerLbl = donutSvg.append('text')
  .attr('text-anchor','middle').attr('dy','1.4em')
  .style('font-size','0.72rem').style('fill','#888');

const legendG = d3.select('#donut-chart svg').append('g')
  .attr('transform',`translate(${dSize + 10}, ${dSize/2 - 20})`);
[{ label:'Traži tretman', color:'#2E75B6' },
 { label:'Ne traži',      color:'#E8C468' }].forEach((d,i) => {
  const row = legendG.append('g').attr('transform',`translate(0,${i*26})`);
  row.append('rect').attr('width',14).attr('height',14).attr('rx',3).attr('fill',d.color);
  row.append('text').attr('x',20).attr('y',11)
    .style('font-size','0.78rem').style('fill','#444').text(d.label);
});

function updateDonut(data) {
  const yes = data.filter(d => d.treatment === 'Yes').length;
  const no  = data.length - yes;
  const pct = data.length ? Math.round(yes/data.length*100) : 0;

  centerPct.text(pct + '%');
  centerLbl.text('traži tretman');

  const pieData = pieFn([
    { label:'Yes', value: yes },
    { label:'No',  value: no  }
  ]);

  const paths = donutSvg.selectAll('.arc').data(pieData, d => d.data.label);
  paths.exit().transition().duration(300).attr('opacity',0).remove();

  paths.enter().append('path').attr('class','arc')
    .attr('fill', d => donutColors(d.data.label))
    .each(function(d) { this._current = { startAngle: d.startAngle, endAngle: d.startAngle }; })
    .merge(paths)
    .on('mouseover', function(event, d) {
      d3.select(this).transition().duration(150).attr('d', arcHov);
      const lbl = d.data.label === 'Yes' ? 'Traži tretman' : 'Ne traži';
      showTip(event, `<strong>${lbl}</strong><br/>N = ${d.data.value}<br/>${Math.round(d.data.value/data.length*100)}%`);
    })
    .on('mousemove', moveTip)
    .on('mouseout', function() {
      d3.select(this).transition().duration(150).attr('d', arcFn);
      hideTip();
    })
    .transition().duration(700).ease(d3.easeCubicOut)
    .attrTween('d', function(d) {
      const interp = d3.interpolate(this._current, d);
      this._current = d;
      return t => arcFn(interp(t));
    });
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

        // Toggle — klik na istu zemlju = deselect
        selectedCountry = selectedCountry === dataName ? null : dataName;

        // Vizualni feedback — priguši ostale, sve klikabilne
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

    // Legenda
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

// ═══════════════════════════════════════════════
// COUNTRY INFO TRAKA
// ═══════════════════════════════════════════════
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
// SORTIRANJE
// ═══════════════════════════════════════════════
function setupSorting() {
  d3.selectAll('.sort-btn').on('click', function() {
    sortMode = this.dataset.sort;
    d3.selectAll('.sort-btn').classed('active', false);
    d3.select(this).classed('active', true);
    updateBars(applyFilters(fullData));
  });
}

// ═══════════════════════════════════════════════
// PLAY / PAUSE
// ═══════════════════════════════════════════════
function setupAnimation() {
  const steps = [
    { label: 'Svi',    gender: 'all'    },
    { label: 'Muški',  gender: 'Male'   },
    { label: 'Ženski', gender: 'Female' }
  ];

  d3.select('#play-btn').on('click', function() {
    playing = !playing;
    d3.select(this).text(playing ? '⏸ Pauza' : '▶ Play');

    if (playing) {
      timer = d3.interval(() => {
        currentStep = (currentStep + 1) % steps.length;
        const step = steps[currentStep];
        filters.gender = step.gender;
        d3.select('#time-label').text('Korak: ' + step.label);
        d3.selectAll('.filter-btn[data-key="gender"]').classed('active', false);
        d3.selectAll(`.filter-btn[data-value="${step.gender}"]`).classed('active', true);
        updateAll();
        updateMapHighlight();
        updateCountryInfo();
      }, 1400);
    } else {
      if (timer) { timer.stop(); timer = null; }
    }
  });
}

// ═══════════════════════════════════════════════
// RESET
// ═══════════════════════════════════════════════
function setupReset() {
  d3.select('#reset-btn').on('click', () => {
    playing = false;
    if (timer) { timer.stop(); timer = null; }
    d3.select('#play-btn').text('▶ Play');
    d3.select('#time-label').text('');
    currentStep   = 0;
    filters       = { gender: 'all' };
    sortMode      = 'desc';
    selectedCountry = null;

    d3.selectAll('.filter-btn').classed('active', false);
    d3.selectAll('.filter-btn[data-value="all"]').classed('active', true);
    d3.selectAll('.sort-btn').classed('active', false);
    d3.selectAll('.sort-btn[data-sort="desc"]').classed('active', true);

    mapG.selectAll('.country-path')
      .transition().duration(300)
      .attr('opacity', 1)
      .style('pointer-events', 'all');

    updateAll();
    updateMapHighlight();
    updateCountryInfo();
  });
}

// ═══════════════════════════════════════════════
// TOOLTIP
// ═══════════════════════════════════════════════
function showTip(event, html) { tooltip.style('opacity', 0.95).html(html); }
function moveTip(event) {
  tooltip.style('left', (event.clientX + 16) + 'px')
         .style('top',  (event.clientY - 36) + 'px');
}
function hideTip() { tooltip.style('opacity', 0); }

// ═══════════════════════════════════════════════
// RADAR / SPIDER CHART
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

// Mreža (pozadinska web)
for (let lvl = 1; lvl <= levels; lvl++) {
  const r = (radarR / levels) * lvl;
  const points = radarVars.map((_, i) => {
    const angle = angleSlice * i - Math.PI / 2;
    return [r * Math.cos(angle), r * Math.sin(angle)];
  });
  radarG.append('polygon')
    .attr('points', points.map(p => p.join(',')).join(' '))
    .attr('fill', 'none')
    .attr('stroke', '#ddd')
    .attr('stroke-width', 0.8);

  // Postotne oznake na zadnjoj osi
  radarG.append('text')
    .attr('x', 4)
    .attr('y', -r)
    .style('font-size', '0.6rem')
    .style('fill', '#aaa')
    .text(Math.round((lvl / levels) * 100) + '%');
}

// Osi (krakovi)
radarVars.forEach((v, i) => {
  const angle = angleSlice * i - Math.PI / 2;
  const x = radarR * Math.cos(angle);
  const y = radarR * Math.sin(angle);

  radarG.append('line')
    .attr('x1', 0).attr('y1', 0)
    .attr('x2', x).attr('y2', y)
    .attr('stroke', '#ccc').attr('stroke-width', 1);

  // Labeli osi
  const labelR = radarR + 22;
  const lx = labelR * Math.cos(angle);
  const ly = labelR * Math.sin(angle);

  radarG.append('text')
    .attr('x', lx).attr('y', ly)
    .attr('text-anchor', Math.abs(lx) < 5 ? 'middle' : lx > 0 ? 'start' : 'end')
    .attr('dominant-baseline', ly < -5 ? 'auto' : ly > 5 ? 'hanging' : 'middle')
    .style('font-size', '0.68rem')
    .style('fill', '#555')
    .text(radarLabels[v]);
});

// Legenda
const legendData = [
  { label: 'Svi',    color: radarColors.All    },
  { label: 'Muški',  color: radarColors.Male   },
  { label: 'Ženski', color: radarColors.Female }
];
const legendRG = radarSvg.append('g')
  .attr('transform', `translate(10, 10)`);
legendData.forEach((d, i) => {
  const row = legendRG.append('g').attr('transform', `translate(0,${i*20})`);
  row.append('rect').attr('width',12).attr('height',12).attr('rx',2).attr('fill',d.color).attr('opacity',0.7);
  row.append('text').attr('x',18).attr('y',10)
    .style('font-size','0.72rem').style('fill','#444').text(d.label);
});

function radarCoords(value, index) {
  const angle = angleSlice * index - Math.PI / 2;
  const r = value * radarR;
  return [r * Math.cos(angle), r * Math.sin(angle)];
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
    radarG.append('path')
      .attr('class', className)
      .attr('d', pathStr)
      .attr('fill', color)
      .attr('fill-opacity', 0.15)
      .attr('stroke', color)
      .attr('stroke-width', 2)
      .attr('opacity', 0)
      .style('pointer-events', 'none')
      .transition().duration(600)
      .attr('opacity', 1);
  } else {
    existing.transition().duration(600).ease(d3.easeCubicOut)
      .attr('d', pathStr)
      .style('pointer-events', 'none');
  }

  // Vidljive točke – pointer-events none
  const dots = radarG.selectAll('.' + className + '-dot').data(radarData);
  dots.exit().remove();
  dots.enter().append('circle')
    .attr('class', className + '-dot')
    .attr('r', 5)
    .attr('fill', color)
    .attr('stroke', 'white')
    .attr('stroke-width', 1.5)
    .attr('opacity', 0)
    .style('pointer-events', 'none')  // ← ne primaju hover
    .merge(dots)
    .transition().duration(600)
    .attr('cx', (d, i) => radarCoords(d.pct, i)[0])
    .attr('cy', (d, i) => radarCoords(d.pct, i)[1])
    .attr('opacity', 1);
}

// Nevidljive hover zone – crtaju se NAKON svih oblika
function drawRadarHoverZones(allData, maleData, femaleData) {
  radarG.selectAll('.radar-hover').remove();

  const datasets = [
    { data: allData,    color: radarColors.All,    label: 'Svi'    },
    { data: maleData,   color: radarColors.Male,   label: 'Muški'  },
    { data: femaleData, color: radarColors.Female, label: 'Ženski' }
  ];

  datasets.forEach(({ data, color, label }) => {
    const radarData = getRadarData(data);

    radarData.forEach((d, i) => {
      const [cx, cy] = radarCoords(d.pct, i);

      radarG.append('circle')
        .attr('class', 'radar-hover')
        .attr('cx', cx).attr('cy', cy)
        .attr('r', 12)  // velika nevidljiva zona
        .attr('fill', 'transparent')
        .attr('stroke', 'none')
        .on('mouseover', function(event) {
          d3.select(this.parentNode).selectAll('circle.radar-hover')
            .filter(function() {
              const cx2 = +d3.select(this).attr('cx');
              const cy2 = +d3.select(this).attr('cy');
              return Math.abs(cx2 - cx) < 1 && Math.abs(cy2 - cy) < 1;
            });
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