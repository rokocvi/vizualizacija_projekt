// ═══════════════════════════════════════════════
// GLOBALNI STATE
// ═══════════════════════════════════════════════
let fullData        = [];
let filters         = { gender: 'all' };
let sortMode        = 'desc';
let playing         = false;
let timer           = null;
let currentStep     = 0;
let selectedCountry = null;

const tooltip = d3.select('#tooltip');

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

// ═══════════════════════════════════════════════
// KOORDINIRANO AŽURIRANJE
// ═══════════════════════════════════════════════
function updateAll() {
  const filtered = applyFilters(fullData);
  updateBars(filtered);
  updateHeatmap(filtered);
  updateRadar(filtered);
  updateInterfere(filtered);
  updateAge(filtered);
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
    currentStep     = 0;
    filters         = { gender: 'all' };
    sortMode        = 'desc';
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
// FULLSCREEN OVERLAY
// ═══════════════════════════════════════════════
function openOverlay(containerId, title) {
  const overlay = document.getElementById('chart-overlay');
  const overlayContent = document.getElementById('overlay-content');
  const overlayTitle = document.getElementById('overlay-title');
  const original = document.getElementById(containerId);

  const svg = original.querySelector('svg');
  if (!svg) return;

  overlayTitle.textContent = title;
  overlayContent.innerHTML = '';

  const origW = +svg.getAttribute('width');
  const origH = +svg.getAttribute('height');

  // Dostupni prostor u overlayju
  const availW = window.innerWidth  * 0.85;
  const availH = window.innerHeight * 0.75;

  const scale = Math.min(availW / origW, availH / origH);

  const newW = Math.round(origW * scale);
  const newH = Math.round(origH * scale);

  const clone = svg.cloneNode(true);
  clone.setAttribute('width',  newW);
  clone.setAttribute('height', newH);
  clone.setAttribute('viewBox', `0 0 ${origW} ${origH}`);
  clone.style.display = 'block';
  clone.style.maxWidth = '100%';

  overlayContent.appendChild(clone);
  overlay.classList.add('active');

  overlay.onclick = function(e) {
    if (e.target === overlay) closeOverlay();
  };

  document.onkeydown = function(e) {
    if (e.key === 'Escape') closeOverlay();
  };
}
function closeOverlay() {
  document.getElementById('chart-overlay').classList.remove('active');
  document.getElementById('overlay-content').innerHTML = '';
  document.onkeydown = null;
}